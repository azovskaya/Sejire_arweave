import type { Person, Snapshot } from "./types";
import { activePersons } from "./treeEngine";

/** BFS ancestors of person (including self at distance 0). */
export function ancestorsOf(snapshot: Snapshot, personId: string): Map<string, number> {
  const persons = snapshot.persons;
  const dist = new Map<string, number>();
  const queue: string[] = [personId];
  dist.set(personId, 0);
  while (queue.length) {
    const id = queue.shift()!;
    const p = persons[id];
    if (!p || p.tombstone) continue;
    const d = dist.get(id) ?? 0;
    for (const parentId of p.parents) {
      if (!dist.has(parentId)) {
        dist.set(parentId, d + 1);
        queue.push(parentId);
      }
    }
  }
  return dist;
}

/** Lowest common ancestor distance heuristic for kinship label. */
export function relationshipLabel(snapshot: Snapshot, aId: string, bId: string): string {
  if (aId === bId) return "тот же человек";
  const a = ancestorsOf(snapshot, aId);
  const b = ancestorsOf(snapshot, bId);

  let best: { id: string; da: number; db: number } | null = null;
  for (const [id, da] of a) {
    if (!b.has(id)) continue;
    const db = b.get(id)!;
    if (!best || da + db < best.da + best.db) best = { id, da, db };
  }
  if (!best) return "нет общей линии в этом снимке";

  const { da, db } = best;
  if (da === 1 && db === 0) return "ребёнок";
  if (da === 0 && db === 1) return "родитель";
  if (da === 2 && db === 0) return "внук/внучка";
  if (da === 0 && db === 2) return "дед/бабушка";
  if (da === 1 && db === 1) return "брат/сестра (или единокровные)";
  if (da === 2 && db === 1) return "племянник/племянница";
  if (da === 1 && db === 2) return "дядя/тётя";
  if (da === 2 && db === 2) return "двоюродные";
  return `общие предки (шаги ${da}+${db})`;
}

export type LayoutNode = {
  id: string;
  person: Person;
  depth: number;
  x: number;
};

/** Simple top-down layout by generation depth from roots. */
export function layoutTree(snapshot: Snapshot): LayoutNode[] {
  const people = activePersons(snapshot);
  if (!people.length) return [];

  const ids = new Set(people.map((p) => p.id));
  const depth = new Map<string, number>();

  const roots = people.filter((p) => p.parents.every((pid) => !ids.has(pid) || snapshot.persons[pid]?.tombstone));
  const start = roots.length ? roots : people;

  const queue = start.map((p) => p.id);
  for (const id of queue) depth.set(id, 0);

  // children index
  const children = new Map<string, string[]>();
  for (const p of people) {
    for (const parentId of p.parents) {
      if (!ids.has(parentId)) continue;
      const list = children.get(parentId) ?? [];
      list.push(p.id);
      children.set(parentId, list);
    }
  }

  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id) ?? 0;
    for (const childId of children.get(id) ?? []) {
      const next = d + 1;
      if (!depth.has(childId) || next > (depth.get(childId) ?? 0)) {
        depth.set(childId, next);
        queue.push(childId);
      }
    }
  }

  for (const p of people) {
    if (!depth.has(p.id)) depth.set(p.id, 0);
  }

  const byDepth = new Map<number, Person[]>();
  for (const p of people) {
    const d = depth.get(p.id) ?? 0;
    const list = byDepth.get(d) ?? [];
    list.push(p);
    byDepth.set(d, list);
  }

  const nodes: LayoutNode[] = [];
  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  for (const d of depths) {
    const row = byDepth.get(d) ?? [];
    row.forEach((p, i) => {
      const x = row.length === 1 ? 0.5 : i / (row.length - 1);
      nodes.push({ id: p.id, person: p, depth: d, x });
    });
  }
  return nodes;
}
