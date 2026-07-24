import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { Snapshot } from "../lib/types";
import {
  PEDIGREE_CARD,
  buildPedigree,
  lifespan,
  type AddMeSlot,
} from "../lib/pedigree";

type Props = {
  snapshot: Snapshot;
  focusId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddRelative: (slot: AddMeSlot) => void;
  onEmptyStart?: () => void;
};

export function PedigreeView({
  snapshot,
  focusId,
  selectedId,
  onSelect,
  onAddRelative,
  onEmptyStart,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const { items, edges, width, height } = buildPedigree(snapshot, focusId, 4);
  const empty = items.length === 0;

  useEffect(() => {
    setPan({ x: 32, y: 40 });
    setScale(1);
  }, [focusId]);

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    const next = Math.min(1.6, Math.max(0.55, scale - e.deltaY * 0.001));
    setScale(next);
  }

  function onPointerDown(e: ReactPointerEvent) {
    if ((e.target as HTMLElement).closest("[data-card]")) return;
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!drag.current) return;
    setPan({
      x: drag.current.px + (e.clientX - drag.current.x),
      y: drag.current.py + (e.clientY - drag.current.y),
    });
  }

  function onPointerUp() {
    drag.current = null;
  }

  if (empty) {
    return (
      <div className="pedigree-empty">
        <div className="pedigree-empty-card">
          <h2>Ваше древо пока пусто</h2>
          <p>Начните с себя — как на Ancestry и FamilySearch. Дальше добавите маму, папу и старшие поколения прямо на схеме.</p>
          <button className="btn" type="button" onClick={onEmptyStart}>
            Добавить себя
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="pedigree-viewport"
      ref={viewportRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="pedigree-toolbar">
        <button type="button" className="tool-btn" onClick={() => setScale((s) => Math.min(1.6, s + 0.1))}>
          +
        </button>
        <button type="button" className="tool-btn" onClick={() => setScale((s) => Math.max(0.55, s - 0.1))}>
          −
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={() => {
            setScale(1);
            setPan({ x: 32, y: 40 });
          }}
        >
          100%
        </button>
      </div>

      <div
        className="pedigree-world"
        style={{
          width,
          height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        }}
      >
        <svg className="pedigree-edges" width={width} height={height}>
          {edges.map((e) => {
            const mx = (e.x1 + e.x2) / 2;
            return (
              <path
                key={`${e.fromId}-${e.toKey}`}
                d={`M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`}
                fill="none"
                stroke="rgba(120, 100, 80, 0.35)"
                strokeWidth="2"
              />
            );
          })}
        </svg>

        {items.map((item) => {
          if (item.kind === "add") {
            return (
              <button
                key={item.key}
                type="button"
                data-card
                className={`person-card add-me ${item.role}`}
                style={{ left: item.x, top: item.y, width: PEDIGREE_CARD.w, height: PEDIGREE_CARD.h }}
                onClick={() => onAddRelative(item)}
              >
                <span className="add-plus">+</span>
                <span>{item.role === "father" ? "Добавить папу" : "Добавить маму"}</span>
              </button>
            );
          }

          const selected = selectedId === item.id;
          const sex = item.person.sex ?? "U";
          return (
            <button
              key={item.id}
              type="button"
              data-card
              className={`person-card sex-${sex} ${selected ? "is-selected" : ""} ${
                item.id === focusId ? "is-focus" : ""
              }`}
              style={{ left: item.x, top: item.y, width: PEDIGREE_CARD.w, height: PEDIGREE_CARD.h }}
              onClick={() => onSelect(item.id)}
            >
              <strong>{item.person.name}</strong>
              <span className="years">{lifespan(item.person)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
