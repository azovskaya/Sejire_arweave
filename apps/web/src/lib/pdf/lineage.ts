import type { Person, Snapshot } from "../types";
import { splitParents } from "../pedigree";
import { yearFromDate } from "../dates";

/** Youngest-first male line: [self, father, grandfather, …]. */
export function maleLineUp(snapshot: Snapshot, startId: string): Person[] {
  const line: Person[] = [];
  const seen = new Set<string>();
  let currentId: string | null = startId;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const person = snapshot.persons[currentId];
    if (!person || person.tombstone) break;
    line.push(person);
    const { fatherId } = splitParents(snapshot, currentId);
    currentId = fatherId;
  }

  return line;
}

export type AncestorSlot = {
  person: Person;
  /** 0 = focus (youngest / bottom of poster) */
  generation: number;
  /** Pedigree index: father = 2*childSlot, mother = 2*childSlot+1 */
  slot: number;
};

/**
 * Binary pedigree layout: father left / mother right under each child.
 * Connector edges do not cross when X follows slot spans.
 */
export function ancestorSlotLayout(
  snapshot: Snapshot,
  focusId: string,
  maxGenerations = 5
): AncestorSlot[] {
  const focus = snapshot.persons[focusId];
  if (!focus || focus.tombstone) return [];

  const out: AncestorSlot[] = [];
  const placed = new Set<string>();
  type Q = { id: string; generation: number; slot: number };
  const queue: Q[] = [{ id: focusId, generation: 0, slot: 0 }];

  while (queue.length) {
    const cur = queue.shift()!;
    if (placed.has(cur.id) || cur.generation >= maxGenerations) continue;
    const person = snapshot.persons[cur.id];
    if (!person || person.tombstone) continue;
    placed.add(cur.id);
    out.push({ person, generation: cur.generation, slot: cur.slot });

    if (cur.generation + 1 >= maxGenerations) continue;
    const { fatherId, motherId } = splitParents(snapshot, cur.id);
    if (fatherId && !placed.has(fatherId)) {
      queue.push({ id: fatherId, generation: cur.generation + 1, slot: cur.slot * 2 });
    }
    if (motherId && !placed.has(motherId)) {
      queue.push({ id: motherId, generation: cur.generation + 1, slot: cur.slot * 2 + 1 });
    }
  }

  return out;
}

/**
 * Ancestor generations for charts.
 * gens[0] = focus, gens[1] = parents, … ordered by pedigree slot.
 */
export function ancestorGenerations(
  snapshot: Snapshot,
  focusId: string,
  maxGenerations = 5
): Person[][] {
  const slots = ancestorSlotLayout(snapshot, focusId, maxGenerations);
  if (!slots.length) return [];
  const depth = Math.max(...slots.map((s) => s.generation)) + 1;
  const gens: Person[][] = Array.from({ length: depth }, () => []);
  for (let g = 0; g < depth; g += 1) {
    gens[g] = slots
      .filter((s) => s.generation === g)
      .sort((a, b) => a.slot - b.slot)
      .map((s) => s.person);
  }
  return gens;
}

/** Center X of a slot as a fraction of usable width (0..1). */
export function slotCenterFraction(generation: number, slot: number, depth: number): number {
  const leafSlots = 2 ** Math.max(0, depth - 1);
  const leafSpan = 2 ** Math.max(0, depth - 1 - generation);
  const leftLeaf = slot * leafSpan;
  return (leftLeaf + leafSpan / 2) / leafSlots;
}

export function yearSpan(p: Person): string {
  const by = yearFromDate(p.born) ?? "";
  const dy = yearFromDate(p.died) ?? "";
  if (by && dy) return `${by}–${dy}`;
  if (by) return `род. ${by}`;
  if (dy) return `ум. ${dy}`;
  return "";
}
