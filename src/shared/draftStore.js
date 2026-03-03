export const DRAFT_STORAGE_KEY = 'pinyin_draft_v1';
export const DRAFT_NAMESPACE_PROD = 'prod';
export const DRAFT_NAMESPACE_DEV = 'dev';

function safeParse(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('[draftStore] parse failed:', error);
    return null;
  }
}

function isTestId(id) {
  return typeof id === 'string' && id.endsWith('-test');
}

function normalizeIdByNamespace(id, targetNamespace) {
  if (typeof id !== 'string') return id;
  if (targetNamespace === DRAFT_NAMESPACE_PROD) return id.replace(/-test$/, '');
  if (targetNamespace === DRAFT_NAMESPACE_DEV) return isTestId(id) ? id : `${id}-test`;
  return id;
}

function inferNamespaceFromDraft(draft) {
  if (!draft || typeof draft !== 'object') return DRAFT_NAMESPACE_PROD;
  if (draft.idNamespace === DRAFT_NAMESPACE_DEV || draft.idNamespace === DRAFT_NAMESPACE_PROD) {
    return draft.idNamespace;
  }

  const hasTestIdInWords = Array.isArray(draft.wordsSnapshot)
    && draft.wordsSnapshot.some((w) => isTestId(w?.id));
  if (hasTestIdInWords) return DRAFT_NAMESPACE_DEV;

  const hasTestIdInPendingItems = Array.isArray(draft.pendingCommit?.items)
    && draft.pendingCommit.items.some((item) => isTestId(item?.id));
  if (hasTestIdInPendingItems) return DRAFT_NAMESPACE_DEV;

  const expectedById = draft.pendingCommit?.expectedById || {};
  const hasTestKeyInExpected = Object.keys(expectedById).some((id) => isTestId(id));
  if (hasTestKeyInExpected) return DRAFT_NAMESPACE_DEV;

  return DRAFT_NAMESPACE_PROD;
}

function withNamespace(draft) {
  if (!draft || typeof draft !== 'object') return null;
  return {
    ...draft,
    version: Number.isInteger(draft.version) ? draft.version : 3,
    idNamespace: inferNamespaceFromDraft(draft),
  };
}

export function normalizeDraftNamespace(draft, targetNamespace) {
  if (!draft || typeof draft !== 'object') return null;
  if (targetNamespace !== DRAFT_NAMESPACE_PROD && targetNamespace !== DRAFT_NAMESPACE_DEV) {
    return withNamespace(draft);
  }

  const normalized = withNamespace(draft);
  if (!normalized) return null;

  const next = {
    ...normalized,
    idNamespace: targetNamespace,
  };

  if (Array.isArray(next.wordsSnapshot)) {
    next.wordsSnapshot = next.wordsSnapshot.map((w) => ({
      ...w,
      id: normalizeIdByNamespace(w?.id, targetNamespace),
    }));
  }

  if (next.pendingCommit && typeof next.pendingCommit === 'object') {
    const pending = { ...next.pendingCommit };
    if (Array.isArray(pending.items)) {
      pending.items = pending.items.map((item) => ({
        ...item,
        id: normalizeIdByNamespace(item?.id, targetNamespace),
      }));
    }
    if (pending.expectedById && typeof pending.expectedById === 'object') {
      const mappedExpected = {};
      Object.entries(pending.expectedById).forEach(([id, expected]) => {
        mappedExpected[normalizeIdByNamespace(id, targetNamespace)] = expected;
      });
      pending.expectedById = mappedExpected;
    }
    next.pendingCommit = pending;
  }

  return next;
}

export function readDraft(options = {}) {
  const draft = withNamespace(safeParse(localStorage.getItem(DRAFT_STORAGE_KEY)));
  if (!draft) return null;
  const targetNamespace = options?.targetNamespace;
  if (targetNamespace && draft.idNamespace !== targetNamespace) return null;
  return draft;
}

export function writeDraft(draft) {
  if (!draft || typeof draft !== 'object') return;
  const normalized = withNamespace(draft);
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(normalized));
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export function hasUnsyncedDraft(targetNamespace = null) {
  const draft = readDraft();
  if (targetNamespace && draft?.idNamespace !== targetNamespace) return false;
  return Boolean(draft?.dirty);
}

export function upsertDraft(base, patch) {
  const now = new Date().toISOString();
  const namespace = patch?.idNamespace || base?.idNamespace || inferNamespaceFromDraft(base) || DRAFT_NAMESPACE_PROD;
  return {
    ...base,
    ...patch,
    version: 3,
    idNamespace: namespace,
    dirty: true,
    updatedAt: now,
  };
}
