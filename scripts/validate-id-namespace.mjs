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

const sampleSizeRaw = getArg('--sample-size', '20');
const sampleSize = Number.parseInt(sampleSizeRaw, 10);
if (!Number.isInteger(sampleSize) || sampleSize <= 0) {
  throw new Error(`Invalid --sample-size: ${sampleSizeRaw}`);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const pageSize = 1000;

function isTestId(id) {
  return typeof id === 'string' && id.endsWith('-test');
}

function normalizeUpdatedAt(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toMs(value) {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

async function loadAllRows() {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('mastery_records')
      .select('id,updated_at,history,last_practice_date,consecutive_green')
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

function buildReport(rows) {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const testRows = rows.filter((row) => isTestId(row.id));

  const mapped = testRows.map((row) => {
    const targetId = row.id.replace(/-test$/, '');
    const target = rowsById.get(targetId) || null;
    const srcUpdated = normalizeUpdatedAt(row.updated_at);
    const targetUpdated = normalizeUpdatedAt(target?.updated_at);
    const srcMs = toMs(srcUpdated);
    const targetMs = toMs(targetUpdated);
    const winner = target ? (srcMs > targetMs ? 'test' : 'prod') : 'test';

    return {
      test_id: row.id,
      target_id: targetId,
      test_updated_at: srcUpdated,
      target_updated_at: targetUpdated,
      target_exists: Boolean(target),
      winner,
      test_history_len: Array.isArray(row.history) ? row.history.length : 0,
      target_history_len: Array.isArray(target?.history) ? target.history.length : 0,
    };
  });

  const conflictRows = mapped.filter((row) => row.target_exists);
  const missingTargetRows = mapped.filter((row) => !row.target_exists);
  const testWinsOnConflict = conflictRows.filter((row) => row.winner === 'test');
  const prodWinsOnConflict = conflictRows.filter((row) => row.winner === 'prod');

  const uniqueTargets = new Set(mapped.map((row) => row.target_id));
  const mappedCoverage = uniqueTargets.size === 0
    ? 100
    : Number(((mapped.length / uniqueTargets.size) * 100).toFixed(2));

  return {
    summary: {
      total_rows: rows.length,
      total_test_rows: testRows.length,
      mapped_rows: mapped.length,
      unique_target_ids: uniqueTargets.size,
      target_exists_rows: conflictRows.length,
      target_missing_rows: missingTargetRows.length,
      test_wins_on_conflict: testWinsOnConflict.length,
      prod_wins_on_conflict: prodWinsOnConflict.length,
      mapped_coverage_percent: mappedCoverage,
    },
    samples: {
      conflict_sample: conflictRows.slice(0, sampleSize),
      missing_target_sample: missingTargetRows.slice(0, sampleSize),
      test_wins_sample: testWinsOnConflict.slice(0, sampleSize),
    },
  };
}

async function main() {
  console.log('Running ID namespace validation...');
  console.log(`sample_size: ${sampleSize}`);

  const rows = await loadAllRows();
  const report = buildReport(rows);

  console.log('\n[SUMMARY]');
  Object.entries(report.summary).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });

  console.log(`\n[CONFLICT SAMPLE <= ${sampleSize}]`);
  console.log(JSON.stringify(report.samples.conflict_sample, null, 2));

  console.log(`\n[MISSING TARGET SAMPLE <= ${sampleSize}]`);
  console.log(JSON.stringify(report.samples.missing_target_sample, null, 2));

  console.log(`\n[TEST-WINS SAMPLE <= ${sampleSize}]`);
  console.log(JSON.stringify(report.samples.test_wins_sample, null, 2));
}

main().catch((error) => {
  console.error('Namespace validation failed:', error.message);
  process.exitCode = 1;
});
