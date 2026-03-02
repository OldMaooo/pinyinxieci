export const DRAFT_STORAGE_KEY = 'pinyin_draft_v1';

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

export function readDraft() {
  return safeParse(localStorage.getItem(DRAFT_STORAGE_KEY));
}

export function writeDraft(draft) {
  if (!draft || typeof draft !== 'object') return;
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

export function hasUnsyncedDraft() {
  const draft = readDraft();
  return Boolean(draft?.dirty);
}

export function upsertDraft(base, patch) {
  const now = new Date().toISOString();
  return {
    ...base,
    ...patch,
    dirty: true,
    updatedAt: now,
  };
}
