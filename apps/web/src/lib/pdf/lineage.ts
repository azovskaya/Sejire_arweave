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

/**
 * Ancestor generations for a classic roots-down chart.
 * gens[0] = focus (bottom), gens[1] = parents, …
 */
export function ancestorGenerations(
  snapshot: Snapshot,
  focusId: string,
  maxGenerations = 5
): Person[][] {
  const focus = snapshot.persons[focusId];
  if (!focus || focus.tombstone) return [];

  const gens: Person[][] = [[focus]];
  for (let g = 0; g < maxGenerations - 1; g += 1) {
    const next: Person[] = [];
    const seen = new Set<string>();
    for (const person of gens[g]) {
      const { fatherId, motherId } = splitParents(snapshot, person.id);
      for (const pid of [fatherId, motherId]) {
        if (!pid || seen.has(pid)) continue;
        const p = snapshot.persons[pid];
        if (!p || p.tombstone) continue;
        seen.add(pid);
        next.push(p);
      }
    }
    if (!next.length) break;
    gens.push(next);
  }
  return gens;
}

export function yearSpan(p: Person): string {
  const by = yearFromDate(p.born) ?? "";
  const dy = yearFromDate(p.died) ?? "";
  if (by && dy) return `${by}–${dy}`;
  if (by) return `род. ${by}`;
  if (dy) return `ум. ${dy}`;
  return "";
}
