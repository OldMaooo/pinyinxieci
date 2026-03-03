function normalizeDateText(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizeMark(value) {
  return value === 'red' || value === 'green' ? value : 'white';
}

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

function compareRowWithExpected(row, expected) {
  if (!expected) return false;
  const rowHistory = Array.isArray(row.history) ? row.history : [];
  const expectedHistory = Array.isArray(expected.history) ? expected.history : [];
  if (stableJson(rowHistory) !== stableJson(expectedHistory)) return false;

  const rowTemp = row.temp_state || {};
  const expectedTemp = expected.temp_state || {};
  if ((rowTemp.practice || 'white') !== (expectedTemp.practice || 'white')) return false;
  if ((rowTemp.self || 'white') !== (expectedTemp.self || 'white')) return false;
  if ((rowTemp.final || 'white') !== (expectedTemp.final || 'white')) return false;

  if ((row.consecutive_green || 0) !== (expected.consecutive_green || 0)) return false;

  const rowPracticeDate = normalizeDateText(row.last_practice_date);
  const expectedPracticeDate = normalizeDateText(expected.last_practice_date);
  if (rowPracticeDate !== expectedPracticeDate) return false;

  const rowHistoryDate = normalizeDateText(row.last_history_update_date);
  const expectedHistoryDate = normalizeDateText(expected.last_history_update_date);
  if (rowHistoryDate !== expectedHistoryDate) return false;

  return true;
}

export async function commitDictationResults({ supabase, commitId, today, items, context }) {
  const { data, error } = await supabase.rpc('commit_dictation_results', {
    p_commit_id: commitId,
    p_today: today,
    p_items: items,
    p_context: context,
  });

  if (error) {
    throw new Error(error.message || '[commitClient] rpc failed');
  }

  if (!data || data.ok !== true) {
    throw new Error(data?.error || '[commitClient] rpc returned non-ok');
  }

  return data;
}

export async function fetchCommittedRows({ supabase, appliedIds }) {
  if (!appliedIds || appliedIds.length === 0) {
    return { rows: [], rowsById: {} };
  }

  const { data, error } = await supabase
    .from('mastery_records')
    .select('id,history,temp_state,last_history_update_date,consecutive_green,last_practice_date')
    .in('id', appliedIds);

  if (error) {
    throw new Error(error.message || '[commitClient] fetch rows failed');
  }

  const rowsById = {};
  (data || []).forEach((row) => {
    rowsById[row.id] = row;
  });

  return {
    rows: data || [],
    rowsById,
  };
}

export async function verifyCommittedRows({ supabase, appliedIds, expectedById, preloadedRowsById = null }) {
  if (!appliedIds || appliedIds.length === 0) {
    return { ok: true, mismatchedIds: [] };
  }

  const rowsById = preloadedRowsById || (await fetchCommittedRows({ supabase, appliedIds })).rowsById;

  const mismatchedIds = [];
  appliedIds.forEach((id) => {
    const row = rowsById[id];
    const expected = expectedById[id];
    if (!row || !compareRowWithExpected(row, expected)) {
      mismatchedIds.push(id);
    }
  });

  return {
    ok: mismatchedIds.length === 0,
    mismatchedIds,
  };
}

export async function verifyCommittedByPayload({
  supabase,
  appliedIds,
  submittedItems,
  today,
  preloadedRowsById = null
}) {
  if (!appliedIds || appliedIds.length === 0) {
    return { ok: true, mismatchedIds: [], reasonsById: {}, rowsById: {} };
  }

  const rowsById = preloadedRowsById || (await fetchCommittedRows({ supabase, appliedIds })).rowsById;
  const itemsById = {};
  (submittedItems || []).forEach((item) => {
    if (!item?.id) return;
    itemsById[item.id] = item;
  });

  const targetDate = normalizeDateText(today);
  const mismatchedIds = [];
  const reasonsById = {};

  appliedIds.forEach((id) => {
    const row = rowsById[id];
    if (!row) {
      mismatchedIds.push(id);
      reasonsById[id] = 'verify_missing_rows';
      return;
    }

    const submitted = itemsById[id];
    if (!submitted) {
      mismatchedIds.push(id);
      reasonsById[id] = 'verify_missing_submitted_item';
      return;
    }

    const rowTemp = row.temp_state || {};
    const tempMatched = (normalizeMark(rowTemp.practice) === normalizeMark(submitted.mark_practice))
      && (normalizeMark(rowTemp.self) === normalizeMark(submitted.mark_self))
      && (normalizeMark(rowTemp.final) === normalizeMark(submitted.mark_final));
    if (!tempMatched) {
      mismatchedIds.push(id);
      reasonsById[id] = 'verify_temp_mismatch';
      return;
    }

    const rowPracticeDate = normalizeDateText(row.last_practice_date);
    if (!rowPracticeDate || (targetDate && rowPracticeDate < targetDate)) {
      mismatchedIds.push(id);
      reasonsById[id] = 'verify_date_mismatch';
    }
  });

  return {
    ok: mismatchedIds.length === 0,
    mismatchedIds,
    reasonsById,
    rowsById
  };
}
