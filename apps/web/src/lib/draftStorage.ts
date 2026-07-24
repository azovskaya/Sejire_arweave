import type { TreeStore } from "./types";

const DRAFT_KEY = "sejire.draft.tree.v1";

export function saveDraftTree(store: TreeStore) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
}

export function loadDraftTree(): TreeStore | null {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TreeStore;
  } catch {
    return null;
  }
}

export function clearDraftTree() {
  localStorage.removeItem(DRAFT_KEY);
}
