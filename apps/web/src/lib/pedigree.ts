import type { Person, Snapshot } from "./types";
import { activePersons } from "./treeEngine";
import { yearFromDate } from "./dates";

export type PedigreeNode = {
  kind: "person";
  id: string;
  person: Person;
  generation: number;
  slot: number; // vertical index within generation
  x: number;
  y: number;
};

export type AddMeSlot = {
  kind: "add";
  key: string;
  childId: string;
  role: "father" | "mother";
  generation: number;
  slot: number;
  x: number;
  y: number;
};

export type PedigreeItem = PedigreeNode | AddMeSlot;

export type PedigreeEdge = {
  fromId: string;
  toKey: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const CARD_W = 208;
const CARD_H = 122;
const GAP_X = 44;
const GAP_Y = 20;

export const PEDIGREE_CARD = { w: CARD_W, h: CARD_H, gapX: GAP_X, gapY: GAP_Y };

/** Visible ancestor columns on the canvas (focus + this many − 1). Deeper knees: look from an older person. */
export const SCREEN_PEDIGREE_GENERATIONS = 7;

function yearOf(iso?: string | null) {
  return yearFromDate(iso);
}

export function lifespan(p: Person) {
  const b = yearOf(p.born);
  const d = yearOf(p.died);
  if (b && d) return `${b}–${d}`;
  if (b) return `род. ${b}`;
  if (d) return `ум. ${d}`;
  return "";
}

export function birthPlaceLabel(p: Person) {
  return (p.birthPlace || p.place?.label || "").trim();
}

export function cardSubtitle(p: Person) {
  const life = lifespan(p);
  const place = birthPlaceLabel(p);
  if (life && place) return `${life} · ${place}`;
  return life || place || "даты не указаны";
}

/** Compact lines for pedigree cards — order matters for overflow budget. */
export function cardFactLines(p: Person): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  const life = lifespan(p);
  if (life) lines.push({ label: "годы", value: life });
  const birth = birthPlaceLabel(p);
  if (birth) lines.push({ label: "род.", value: birth });
  const death = (p.deathPlace || "").trim();
  if (death) lines.push({ label: "ум.", value: death });
  const burial = (p.burialPlace || "").trim();
  if (burial) lines.push({ label: "погр.", value: burial });
  const job = (p.occupation || "").trim();
  if (job && lines.length < 4) lines.push({ label: "зан.", value: job });
  return lines.slice(0, 4);
}

/** Guess mother/father among parents by sex (fallback: order). */
export function splitParents(snapshot: Snapshot, personId: string) {
  const person = snapshot.persons[personId];
  if (!person) return { fatherId: null as string | null, motherId: null as string | null };
  const parents = person.parents
    .map((id) => snapshot.persons[id])
    .filter((p): p is Person => Boolean(p) && !p.tombstone);

  let father = parents.find((p) => p.sex === "M") ?? null;
  let mother = parents.find((p) => p.sex === "F") ?? null;
  const rest = parents.filter((p) => p !== father && p !== mother);
  if (!father && rest.length) father = rest.shift()!;
  if (!mother && rest.length) mother = rest.shift()!;
  // if still one parent without sex, treat first as father for layout stability
  if (!father && !mother && parents[0]) father = parents[0];
  if (father && !mother && parents.length > 1) {
    mother = parents.find((p) => p.id !== father!.id) ?? null;
  }
  return { fatherId: father?.id ?? null, motherId: mother?.id ?? null };
}

/**
 * Classic landscape pedigree (FamilySearch-style):
 * focus on the left, ancestors in columns to the right.
 * Default 7 columns = self + 6 ancestor gens (жети ата depth on screen).
 * Beyond that, shift the window ("Смотреть предков отсюда") — a full 7th
 * empty binary column would be 64 giant "+" cards and a 9000px canvas.
 */
export function buildPedigree(
  snapshot: Snapshot,
  focusId: string | null,
  maxGenerations = SCREEN_PEDIGREE_GENERATIONS
): { items: PedigreeItem[]; edges: PedigreeEdge[]; width: number; height: number; focusId: string | null } {
  const people = activePersons(snapshot);
  if (!people.length || !focusId || !snapshot.persons[focusId] || snapshot.persons[focusId].tombstone) {
    return { items: [], edges: [], width: 800, height: 480, focusId: null };
  }

  type Cell = { personId: string | null; add?: "father" | "mother"; childId?: string };
  const gens: Cell[][] = [];

  // gen 0
  gens[0] = [{ personId: focusId }];

  for (let g = 0; g < maxGenerations - 1; g += 1) {
    const next: Cell[] = [];
    for (const cell of gens[g]) {
      if (!cell.personId) {
        next.push({ personId: null }, { personId: null });
        continue;
      }
      const { fatherId, motherId } = splitParents(snapshot, cell.personId);
      if (fatherId) next.push({ personId: fatherId });
      else next.push({ personId: null, add: "father", childId: cell.personId });
      if (motherId) next.push({ personId: motherId });
      else next.push({ personId: null, add: "mother", childId: cell.personId });
    }
    const hasPeople = next.some((c) => c.personId);
    // A wall of only "+" cards (32 people × 2) is unusable and buries the focus.
    if (!hasPeople && next.length > 8) break;
    gens[g + 1] = next;
    if (!hasPeople) break;
  }

  const items: PedigreeItem[] = [];
  const colX = (g: number) => 40 + g * (CARD_W + GAP_X);
  const maxRows = gens[gens.length - 1]?.length ?? 1;
  const totalH = maxRows * (CARD_H + GAP_Y);
  const yFor = (g: number, slot: number) => {
    const rows = gens[g].length;
    const block = totalH / rows;
    return 40 + slot * block + (block - CARD_H) / 2;
  };

  gens.forEach((cells, g) => {
    cells.forEach((cell, slot) => {
      const x = colX(g);
      const y = yFor(g, slot);
      if (cell.personId) {
        const person = snapshot.persons[cell.personId];
        if (!person || person.tombstone) return;
        items.push({
          kind: "person",
          id: person.id,
          person,
          generation: g,
          slot,
          x,
          y,
        });
      } else if (cell.add && cell.childId) {
        items.push({
          kind: "add",
          key: `${cell.childId}:${cell.add}`,
          childId: cell.childId,
          role: cell.add,
          generation: g,
          slot,
          x,
          y,
        });
      }
    });
  });

  const byKey = new Map<string, { x: number; y: number }>();
  for (const it of items) {
    if (it.kind === "person") byKey.set(it.id, { x: it.x + CARD_W, y: it.y + CARD_H / 2 });
    else byKey.set(it.key, { x: it.x, y: it.y + CARD_H / 2 });
  }

  // child left-center → parent left-center (edge from child right to parent left)
  const edges: PedigreeEdge[] = [];
  for (const it of items) {
    if (it.kind !== "person" || it.generation === 0) continue;
    // find child in previous generation that points here
    const prev = gens[it.generation - 1];
    const parentSlot = it.slot;
    const childSlot = Math.floor(parentSlot / 2);
    const childCell = prev[childSlot];
    if (!childCell?.personId) continue;
    const childPos = byKey.get(childCell.personId);
    const parentPos = byKey.get(it.id);
    if (!childPos || !parentPos) continue;
    edges.push({
      fromId: childCell.personId,
      toKey: it.id,
      x1: childPos.x,
      y1: childPos.y,
      x2: it.x,
      y2: it.y + CARD_H / 2,
    });
  }
  // edges to add-me slots
  for (const it of items) {
    if (it.kind !== "add") continue;
    const childPos = byKey.get(it.childId);
    if (!childPos) continue;
    edges.push({
      fromId: it.childId,
      toKey: it.key,
      x1: childPos.x,
      y1: childPos.y,
      x2: it.x,
      y2: it.y + CARD_H / 2,
    });
  }

  const width = colX(gens.length - 1) + CARD_W + 80;
  const height = totalH + 80;
  return { items, edges, width, height, focusId };
}

export function pickDefaultFocus(snapshot: Snapshot, preferredId?: string | null) {
  if (preferredId && snapshot.persons[preferredId] && !snapshot.persons[preferredId].tombstone) {
    return preferredId;
  }
  const people = activePersons(snapshot);
  if (!people.length) return null;
  // Youngest generation: people who are not parents of anyone else in the tree
  const youngest = people.filter((p) => !people.some((c) => c.parents.includes(p.id)));
  if (youngest.length) return youngest[0].id;
  const withParents = people.find((p) =>
    p.parents.some((id) => snapshot.persons[id] && !snapshot.persons[id].tombstone)
  );
  return withParents?.id ?? people[0].id;
}

/** Distance from the pedigree focus to an ancestor (0 = focus). Null if not on that ancestor path. */
export function generationFromFocus(
  snapshot: Snapshot,
  focusId: string | null,
  personId: string,
  maxGenerations = 13
): number | null {
  if (!focusId || !snapshot.persons[personId] || snapshot.persons[personId].tombstone) return null;
  if (focusId === personId) return 0;
  const seen = new Set<string>();
  let frontier = [focusId];
  for (let gen = 0; gen < maxGenerations; gen += 1) {
    if (frontier.includes(personId)) return gen;
    const next: string[] = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      const { fatherId, motherId } = splitParents(snapshot, id);
      if (fatherId) next.push(fatherId);
      if (motherId) next.push(motherId);
    }
    if (!next.length) break;
    frontier = next;
  }
  return null;
}

/** Adding a parent to someone this far right would land off-screen or in a clipped column. */
export function parentAddNeedsFocusShift(childGeneration: number | null): boolean {
  if (childGeneration == null) return false;
  return childGeneration >= SCREEN_PEDIGREE_GENERATIONS - 2;
}

/** Prefer guided "self", else youngest person in the graph. */
export function pickHomeFocus(snapshot: Snapshot, selfId?: string | null) {
  if (selfId && snapshot.persons[selfId] && !snapshot.persons[selfId].tombstone) {
    return selfId;
  }
  return pickDefaultFocus(snapshot, null);
}
