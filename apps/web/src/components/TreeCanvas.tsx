import type { Snapshot } from "../lib/types";
import { layoutTree } from "../lib/kinship";

type Props = {
  snapshot: Snapshot;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

export function TreeCanvas({ snapshot, selectedId, onSelect }: Props) {
  const nodes = layoutTree(snapshot);
  if (!nodes.length) {
    return <p className="empty">Пока нет людей для схемы.</p>;
  }

  const maxDepth = Math.max(...nodes.map((n) => n.depth), 0);
  const height = Math.max(180, (maxDepth + 1) * 88);
  const width = 640;

  const pos = new Map(nodes.map((n) => [n.id, n]));
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const n of nodes) {
    for (const parentId of n.person.parents) {
      const parent = pos.get(parentId);
      if (!parent) continue;
      edges.push({
        x1: 40 + parent.x * (width - 80),
        y1: 36 + parent.depth * 88,
        x2: 40 + n.x * (width - 80),
        y2: 36 + n.depth * 88,
      });
    }
  }

  return (
    <div className="tree-canvas-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="tree-canvas" role="img" aria-label="Схема рода">
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke="rgba(197,122,69,0.45)"
            strokeWidth="1.5"
          />
        ))}
        {nodes.map((n) => {
          const cx = 40 + n.x * (width - 80);
          const cy = 36 + n.depth * 88;
          const selected = selectedId === n.id;
          return (
            <g
              key={n.id}
              transform={`translate(${cx}, ${cy})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect?.(n.id)}
            >
              <rect
                x={-70}
                y={-22}
                width={140}
                height={44}
                rx={2}
                fill={selected ? "rgba(197,122,69,0.25)" : "rgba(18,22,28,0.95)"}
                stroke={selected ? "#e09a5f" : "rgba(232,237,244,0.16)"}
              />
              <text textAnchor="middle" y={-2} fill="#e8edf4" fontSize="12" fontFamily="Syne, sans-serif">
                {n.person.name.length > 18 ? `${n.person.name.slice(0, 16)}…` : n.person.name}
              </text>
              <text textAnchor="middle" y={14} fill="#9aa6b5" fontSize="10">
                {n.person.born || "—"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
