import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { Snapshot } from "../lib/types";
import {
  PEDIGREE_CARD,
  buildPedigree,
  cardFactLines,
  type AddMeSlot,
} from "../lib/pedigree";

type Props = {
  snapshot: Snapshot;
  focusId: string | null;
  homeFocusId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetFocus: (id: string) => void;
  onAddRelative: (slot: AddMeSlot) => void;
  onEmptyStart?: () => void;
};

function cardTooltip(person: {
  name: string;
  maidenName?: string | null;
  born?: string | null;
  died?: string | null;
  birthPlace?: string | null;
  deathPlace?: string | null;
  burialDate?: string | null;
  burialPlace?: string | null;
  occupation?: string | null;
  place?: { label?: string } | null;
  notes?: string;
}) {
  return [
    person.name,
    "Клик — открыть профиль",
    "Двойной клик — смотреть предков отсюда",
    person.maidenName ? `девичья: ${person.maidenName}` : "",
    person.born ? `рождение: ${person.born}` : "",
    person.birthPlace || person.place?.label
      ? `место рождения: ${person.birthPlace || person.place?.label}`
      : "",
    person.died ? `смерть: ${person.died}` : "",
    person.deathPlace ? `место смерти: ${person.deathPlace}` : "",
    person.burialDate ? `захоронение: ${person.burialDate}` : "",
    person.burialPlace ? `место захоронения: ${person.burialPlace}` : "",
    person.occupation ? `занятие: ${person.occupation}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function PedigreeView({
  snapshot,
  focusId,
  homeFocusId,
  selectedId,
  onSelect,
  onSetFocus,
  onAddRelative,
  onEmptyStart,
}: Props) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 28, y: 28 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const { items, edges, width, height } = buildPedigree(snapshot, focusId, 4);
  const empty = items.length === 0;
  const focusPerson = focusId ? snapshot.persons[focusId] : null;
  const showHome = Boolean(homeFocusId && focusId && homeFocusId !== focusId);

  useEffect(() => {
    setPan({ x: 28, y: 28 });
    setScale(1);
  }, [focusId]);

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    setScale((s) => Math.min(1.45, Math.max(0.55, s - e.deltaY * 0.001)));
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

  if (empty) {
    return (
      <div className="pedigree-empty">
        <div className="pedigree-empty-card">
          <p className="eyebrow">SEJIRE</p>
          <h2>Начните с себя</h2>
          <p>
            Добавьте себя на схему, затем маму и папу карточками «+». Полные сведения — в панели
            справа.
          </p>
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
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <div className="pedigree-chrome">
        <div className="focus-chip" title="Схема строится от этого человека влево направо — к предкам">
          <span className="focus-chip-label">Схема от</span>
          <strong className="clamp-1">{focusPerson?.name || "—"}</strong>
          {showHome && homeFocusId ? (
            <button type="button" className="chip-action" onClick={() => onSetFocus(homeFocusId)}>
              К себе
            </button>
          ) : null}
          {selectedId && selectedId !== focusId ? (
            <button type="button" className="chip-action" onClick={() => onSetFocus(selectedId)}>
              От выбранного
            </button>
          ) : null}
        </div>
        <div className="pedigree-toolbar" aria-label="Масштаб">
          <button type="button" className="tool-btn" onClick={() => setScale((s) => Math.min(1.45, s + 0.1))}>
            +
          </button>
          <button type="button" className="tool-btn" onClick={() => setScale((s) => Math.max(0.55, s - 0.1))}>
            −
          </button>
          <button
            type="button"
            className="tool-btn wide"
            onClick={() => {
              setScale(1);
              setPan({ x: 28, y: 28 });
            }}
          >
            Сброс вида
          </button>
        </div>
      </div>
      <p className="pedigree-hint">Клик — профиль · двойной клик — смотреть предков отсюда</p>

      <div
        className="pedigree-world"
        style={{
          width,
          height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        }}
      >
        <svg className="pedigree-edges" width={width} height={height} aria-hidden>
          {edges.map((e) => {
            const mx = (e.x1 + e.x2) / 2;
            return (
              <path
                key={`${e.fromId}-${e.toKey}`}
                d={`M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`}
                fill="none"
                stroke="rgba(34, 35, 38, 0.22)"
                strokeWidth="1.75"
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
                className={`person-card add-me role-${item.role}`}
                style={{ left: item.x, top: item.y, width: PEDIGREE_CARD.w, height: PEDIGREE_CARD.h }}
                onClick={() => onAddRelative(item)}
              >
                <span className="card-inner">
                  <span className="add-plus">+</span>
                  <span className="card-title">
                    {item.role === "father" ? "Добавить папу" : "Добавить маму"}
                  </span>
                </span>
              </button>
            );
          }

          const selected = selectedId === item.id;
          const sex = item.person.sex ?? "U";
          const facts = cardFactLines(item.person);
          return (
            <button
              key={item.id}
              type="button"
              data-card
              title={cardTooltip(item.person)}
              className={`person-card sex-${sex} ${selected ? "is-selected" : ""} ${
                item.id === focusId ? "is-focus" : ""
              }`}
              style={{ left: item.x, top: item.y, width: PEDIGREE_CARD.w, height: PEDIGREE_CARD.h }}
              onClick={() => onSelect(item.id)}
              onDoubleClick={() => onSetFocus(item.id)}
            >
              <span className="card-inner">
                <span className="card-title">{item.person.name}</span>
                {facts.length === 0 ? (
                  <span className="card-meta muted">нет сведений</span>
                ) : (
                  facts.map((f) => (
                    <span className="card-row" key={`${item.id}-${f.label}-${f.value}`}>
                      <span className="card-label">{f.label}</span>
                      <span className="card-value">{f.value}</span>
                    </span>
                  ))
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
