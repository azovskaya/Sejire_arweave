import type { GuideState } from "./guide";
import { defaultGuide } from "./guide";
import type { Person, Snapshot, TreeMeta, TreeStore } from "./types";
import { safeFilename } from "./pdf/poster";

export const TREE_JSON_SCHEMA = "sejire/tree-export/v1" as const;

/** Full portable backup of everything the editor knows about this tree. */
export type TreeExportV1 = {
  schema: typeof TREE_JSON_SCHEMA;
  exported_at: string;
  app: "SEJIRE";
  protocol: "sejire/v0.3";
  store: TreeStore;
  guide: GuideState;
};

export function buildTreeExport(store: TreeStore, guide: GuideState): TreeExportV1 {
  return {
    schema: TREE_JSON_SCHEMA,
    exported_at: new Date().toISOString(),
    app: "SEJIRE",
    protocol: "sejire/v0.3",
    store: structuredClone(store),
    guide: structuredClone(guide),
  };
}

export function downloadTreeJson(store: TreeStore, guide: GuideState) {
  const payload = buildTreeExport(store, guide);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const title = safeFilename(store.meta.title || "tree", "tree");
  a.href = url;
  a.download = `sejire-${title}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function normalizePerson(raw: unknown, id: string): Person | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === "string" ? raw.name : "";
  const parents = Array.isArray(raw.parents)
    ? raw.parents.filter((p): p is string => typeof p === "string")
    : [];
  const media = Array.isArray(raw.media) ? (raw.media as Person["media"]) : [];
  return {
    id: typeof raw.id === "string" ? raw.id : id,
    name,
    sex: raw.sex === "M" || raw.sex === "F" || raw.sex === "U" ? raw.sex : "U",
    born: (raw.born as string | null | undefined) ?? null,
    died: (raw.died as string | null | undefined) ?? null,
    place: (raw.place as Person["place"]) ?? null,
    birthPlace: (raw.birthPlace as string | null | undefined) ?? null,
    deathPlace: (raw.deathPlace as string | null | undefined) ?? null,
    burialDate: (raw.burialDate as string | null | undefined) ?? null,
    burialPlace: (raw.burialPlace as string | null | undefined) ?? null,
    occupation: (raw.occupation as string | null | undefined) ?? null,
    maidenName: (raw.maidenName as string | null | undefined) ?? null,
    parents,
    media,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    tombstone: Boolean(raw.tombstone),
  };
}

function normalizeSnapshot(raw: unknown): Snapshot | null {
  if (!isRecord(raw) || !isRecord(raw.persons)) return null;
  const persons: Record<string, Person> = {};
  for (const [id, value] of Object.entries(raw.persons)) {
    const person = normalizePerson(value, id);
    if (person) persons[id] = person;
  }
  return { persons };
}

function normalizeMeta(raw: unknown, fallbackDraft: Snapshot): TreeMeta | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.title !== "string") return null;
  return {
    id: raw.id,
    title: raw.title,
    head: typeof raw.head === "string" || raw.head === null ? (raw.head as string | null) : null,
    next_version: typeof raw.next_version === "number" ? raw.next_version : 1,
    created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
    author: typeof raw.author === "string" ? raw.author : "local",
    clanName: (raw.clanName as string | null | undefined) ?? null,
    tamgaUrl: (raw.tamgaUrl as string | null | undefined) ?? null,
  };
}

function normalizeGuide(raw: unknown): GuideState {
  const base = defaultGuide();
  if (!isRecord(raw)) return { ...base, step: "done" };
  return {
    step: typeof raw.step === "string" ? (raw.step as GuideState["step"]) : "done",
    selfId: typeof raw.selfId === "string" ? raw.selfId : null,
    motherId: typeof raw.motherId === "string" ? raw.motherId : null,
    fatherId: typeof raw.fatherId === "string" ? raw.fatherId : null,
    maternalGrandmotherId:
      typeof raw.maternalGrandmotherId === "string" ? raw.maternalGrandmotherId : null,
    maternalGrandfatherId:
      typeof raw.maternalGrandfatherId === "string" ? raw.maternalGrandfatherId : null,
    paternalGrandmotherId:
      typeof raw.paternalGrandmotherId === "string" ? raw.paternalGrandmotherId : null,
    paternalGrandfatherId:
      typeof raw.paternalGrandfatherId === "string" ? raw.paternalGrandfatherId : null,
  };
}

export type ParseTreeJsonResult =
  | { ok: true; store: TreeStore; guide: GuideState }
  | { ok: false; error: string };

/**
 * Accepts sejire/tree-export/v1 or a bare TreeStore JSON for flexibility.
 */
export function parseTreeJson(text: string): ParseTreeJsonResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "Файл не является JSON" };
  }
  if (!isRecord(data)) return { ok: false, error: "Неверный формат файла" };

  let storeRaw: unknown = data;
  let guideRaw: unknown = null;

  if (data.schema === TREE_JSON_SCHEMA || data.app === "SEJIRE") {
    storeRaw = data.store;
    guideRaw = data.guide;
  } else if (isRecord(data.meta) && isRecord(data.draft)) {
    storeRaw = data;
  } else if (isRecord(data.persons)) {
    // bare snapshot
    const draft = normalizeSnapshot(data);
    if (!draft) return { ok: false, error: "Нет людей в снимке" };
    const id = `tree_${Date.now().toString(36)}`;
    return {
      ok: true,
      store: {
        meta: {
          id,
          title: "Импорт SEJIRE",
          head: null,
          next_version: 1,
          created_at: new Date().toISOString(),
          author: "local",
          clanName: null,
          tamgaUrl: null,
        },
        commits: {},
        versions: {},
        draft,
        dirty: true,
      },
      guide: { ...defaultGuide(), step: "done" },
    };
  }

  if (!isRecord(storeRaw)) return { ok: false, error: "В файле нет данных древа (store)" };
  const draft = normalizeSnapshot(storeRaw.draft);
  if (!draft) return { ok: false, error: "В файле нет черновика (draft.persons)" };
  const meta = normalizeMeta(storeRaw.meta, draft);
  if (!meta) return { ok: false, error: "В файле нет корректного meta" };

  const commits = isRecord(storeRaw.commits) ? storeRaw.commits : {};
  const versions = isRecord(storeRaw.versions) ? storeRaw.versions : {};

  const store: TreeStore = {
    meta,
    commits: commits as TreeStore["commits"],
    versions: versions as TreeStore["versions"],
    draft,
    dirty: true,
  };

  return { ok: true, store, guide: normalizeGuide(guideRaw) };
}

export async function readTreeJsonFile(file: File): Promise<ParseTreeJsonResult> {
  const text = await file.text();
  return parseTreeJson(text);
}
