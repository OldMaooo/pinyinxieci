import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY');
}

const args = process.argv.slice(2);

function getArg(name, fallback = null) {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

const sampleSizeRaw = getArg('--sample-size', '20');
const sampleSize = Number.parseInt(sampleSizeRaw, 10);
if (!Number.isInteger(sampleSize) || sampleSize <= 0) {
  throw new Error(`Invalid --sample-size: ${sampleSizeRaw}`);
}

const baselinePath = getArg('--save-baseline');
const comparePath = getArg('--compare');
const includeUpdatedAt = hasFlag('--include-updated-at');
const pageSize = 1000;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizeDate(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function normalizeRecord(record, opts = {}) {
  return {
    id: record.id,
    history: Array.isArray(record.history) ? record.history : [],
    temp_state: record.temp_state || {},
    last_history_update_date: normalizeDate(record.last_history_update_date),
    consecutive_green: record.consecutive_green || 0,
    last_practice_date: normalizeDate(record.last_practice_date),
    last_status: record.last_status || null,
    ...(opts.includeUpdatedAt ? { updated_at: record.updated_at || null } : {})
  };
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digestRecords(records) {
  const hash = crypto.createHash('sha256');
  for (const record of records) {
    hash.update(stableStringify(record));
    hash.update('\n');
  }
  return hash.digest('hex');
}

async function loadAllRecords() {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('mastery_records')
      .select('id,history,temp_state,last_history_update_date,consecutive_green,last_practice_date,last_status,updated_at')
      .order('id', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Fetch failed at range ${from}-${to}: ${error.message}`);
    }

    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function buildSnapshot(rawRows) {
  const normalized = rawRows.map((r) => normalizeRecord(r, { includeUpdatedAt }));

  const stats = {
    total_rows: normalized.length,
    with_red_history: 0,
    with_any_history: 0,
    with_temp_red: 0,
    mastered_consecutive_ge5: 0,
  };

  for (const row of normalized) {
    const history = row.history || [];
    if (history.length > 0) stats.with_any_history += 1;
    if (history.includes('red')) stats.with_red_history += 1;
    const temp = row.temp_state || {};
    if (temp.practice === 'red' || temp.self === 'red' || temp.final === 'red') {
      stats.with_temp_red += 1;
    }
    if ((row.consecutive_green || 0) >= 5) {
      stats.mastered_consecutive_ge5 += 1;
    }
  }

  return {
    generated_at: new Date().toISOString(),
    include_updated_at: includeUpdatedAt,
    stats,
    digest: digestRecords(normalized),
    sample_head: normalized.slice(0, sampleSize),
    sample_tail: normalized.slice(Math.max(0, normalized.length - sampleSize)),
    records: normalized,
  };
}

function diffSnapshots(before, after) {
  const beforeMap = new Map(before.records.map((r) => [r.id, stableStringify(r)]));
  const afterMap = new Map(after.records.map((r) => [r.id, stableStringify(r)]));

  const added = [];
  const removed = [];
  const changed = [];

  for (const [id, payload] of beforeMap.entries()) {
    if (!afterMap.has(id)) {
      removed.push(id);
      continue;
    }
    if (afterMap.get(id) !== payload) {
      changed.push(id);
    }
  }

  for (const id of afterMap.keys()) {
    if (!beforeMap.has(id)) {
      added.push(id);
    }
  }

  return {
    added,
    removed,
    changed,
  };
}

function printSummary(label, snapshot) {
  console.log(`\n[${label}]`);
  console.log(`total_rows: ${snapshot.stats.total_rows}`);
  console.log(`digest: ${snapshot.digest}`);
  console.log(`with_any_history: ${snapshot.stats.with_any_history}`);
  console.log(`with_red_history: ${snapshot.stats.with_red_history}`);
  console.log(`with_temp_red: ${snapshot.stats.with_temp_red}`);
  console.log(`mastered_consecutive_ge5: ${snapshot.stats.mastered_consecutive_ge5}`);
}

async function main() {
  console.log('Running readonly mastery validation...');
  console.log(`sample_size: ${sampleSize}`);
  console.log(`include_updated_at: ${includeUpdatedAt}`);

  const rawRows = await loadAllRecords();
  const current = buildSnapshot(rawRows);
  printSummary('CURRENT', current);

  if (baselinePath) {
    const abs = path.resolve(baselinePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
    console.log(`\nBaseline saved: ${abs}`);
  }

  if (comparePath) {
    const abs = path.resolve(comparePath);
    const before = JSON.parse(fs.readFileSync(abs, 'utf8'));
    printSummary('BASELINE', before);

    const totalSame = before.stats?.total_rows === current.stats.total_rows;
    const digestSame = before.digest === current.digest;
    const diff = diffSnapshots(before, current);

    console.log('\n[COMPARE RESULT]');
    console.log(`total_rows_same: ${totalSame}`);
    console.log(`digest_same: ${digestSame}`);
    console.log(`added: ${diff.added.length}`);
    console.log(`removed: ${diff.removed.length}`);
    console.log(`changed: ${diff.changed.length}`);

    if (diff.added.length > 0) {
      console.log(`added_ids(sample): ${diff.added.slice(0, 20).join(', ')}`);
    }
    if (diff.removed.length > 0) {
      console.log(`removed_ids(sample): ${diff.removed.slice(0, 20).join(', ')}`);
    }
    if (diff.changed.length > 0) {
      console.log(`changed_ids(sample): ${diff.changed.slice(0, 20).join(', ')}`);
    }

    if (totalSame && digestSame && diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
      console.log('\nPASS: No data drift detected.');
    } else {
      console.log('\nWARNING: Data differences detected. Check added/removed/changed IDs above.');
      process.exitCode = 2;
    }
  }

  if (!baselinePath && !comparePath) {
    console.log('\nTip: use --save-baseline <file> or --compare <file>');
  }
}

main().catch((error) => {
  console.error('Readonly validation failed:', error.message);
  process.exitCode = 1;
});
