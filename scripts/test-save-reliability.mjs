import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const today = new Date().toISOString().slice(0, 10);
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const ids = [
  `reliability-${suffix}-1`,
  `reliability-${suffix}-2`,
  `reliability-${suffix}-3`,
];

const items = [
  { id: ids[0], mark_practice: 'white', mark_self: 'red', mark_final: 'white', only_wrong: false, step: 1 },
  { id: ids[1], mark_practice: 'white', mark_self: 'green', mark_final: 'white', only_wrong: false, step: 1 },
  { id: ids[2], mark_practice: 'white', mark_self: 'white', mark_final: 'white', only_wrong: false, step: 1 },
];

const commitId = crypto.randomUUID();

async function run() {
  console.log('Running reliability smoke test...');
  console.log('today:', today);
  console.log('commitId:', commitId);
  console.log('ids:', ids.join(', '));

  const first = await supabase.rpc('commit_dictation_results', {
    p_commit_id: commitId,
    p_today: today,
    p_items: items,
    p_context: { source: 'smoke-test' },
  });

  if (first.error) throw new Error(`First commit failed: ${first.error.message}`);
  if (!first.data?.ok) throw new Error(`First commit returned non-ok: ${JSON.stringify(first.data)}`);

  const second = await supabase.rpc('commit_dictation_results', {
    p_commit_id: commitId,
    p_today: today,
    p_items: items,
    p_context: { source: 'smoke-test' },
  });

  if (second.error) throw new Error(`Second commit failed: ${second.error.message}`);
  if (!second.data?.ok || second.data?.duplicate !== true) {
    throw new Error(`Second commit should be duplicate=true, got: ${JSON.stringify(second.data)}`);
  }

  const rowsResp = await supabase
    .from('mastery_records')
    .select('id,history,last_practice_date,consecutive_green,temp_state')
    .in('id', ids)
    .order('id');

  if (rowsResp.error) throw new Error(`Query failed: ${rowsResp.error.message}`);
  const rows = rowsResp.data || [];
  if (rows.length !== ids.length) {
    throw new Error(`Expected ${ids.length} rows, got ${rows.length}`);
  }

  for (const row of rows) {
    if (!Array.isArray(row.history) || row.history.length !== 1) {
      throw new Error(`Row ${row.id} history length expected 1, got: ${JSON.stringify(row.history)}`);
    }
    if (String(row.last_practice_date).slice(0, 10) !== today) {
      throw new Error(`Row ${row.id} last_practice_date expected ${today}, got ${row.last_practice_date}`);
    }
  }

  console.log('Smoke test passed.');
  console.log('First commit result:', JSON.stringify(first.data));
  console.log('Second commit result:', JSON.stringify(second.data));
}

run().catch((error) => {
  console.error('Smoke test failed:', error.message);
  process.exitCode = 1;
});
