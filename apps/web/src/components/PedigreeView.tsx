import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
    "Двойной клик / кнопка в профиле — смотреть предков отсюда",
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
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const scaleRef = useRef(scale);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  scaleRef.current = scale;

  const { items, edges, width, height } = buildPedigree(snapshot, focusId, 7);
  const empty = items.length === 0;
  const focusPerson = focusId ? snapshot.persons[focusId] : null;
  const showHome = Boolean(homeFocusId && focusId && homeFocusId !== focusId);
  const focusItem = items.find((i) => i.kind === "person" && i.id === focusId);
  const focusCardY = focusItem?.y ?? 0;

  function panToFocus(viewportH: number, cardY: number) {
    return {
      x: 28,
      y: Math.round(viewportH / 2 - (cardY + PEDIGREE_CARD.h / 2)),
    };
  }

  function resetView() {
    const vh = viewportRef.current?.clientHeight || 480;
    setScale(1);
    setPan(panToFocus(vh, focusCardY));
  }

  useLayoutEffect(() => {
    if (empty) return;
    const el = viewportRef.current;
    if (!el) return;
    setScale(1);
    setPan(panToFocus(el.clientHeight || 480, focusCardY));
  }, [focusId, empty, width, height, focusCardY]);

  useEffect(() => {
    if (empty) return;
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const vh = el.clientHeight || 480;
      setPan((prev) => {
        if (Math.abs(prev.x - 28) > 8) return prev;
        return panToFocus(vh, focusCardY);
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [empty, focusCardY]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function distance(a: Touch, b: Touch) {
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      return Math.hypot(dx, dy);
    }
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        drag.current = null;
        pinch.current = {
          dist: distance(e.touches[0], e.touches[1]),
          scale: scaleRef.current,
        };
      }
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && pinch.current) {
        e.preventDefault();
        const d = distance(e.touches[0], e.touches[1]);
        const next = Math.min(1.45, Math.max(0.55, pinch.current.scale * (d / pinch.current.dist)));
        setScale(next);
      }
    }
    function onTouchEnd() {
      pinch.current = null;
    }
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [empty]);

  function onWheel(e: ReactWheelEvent) {
    e.preventDefault();
    setScale((s) => Math.min(1.45, Math.max(0.55, s - e.deltaY * 0.001)));
  }

  function onPointerDown(e: ReactPointerEvent) {
    const target = e.target as HTMLElement;
    // Don't start canvas pan when using chrome controls / cards / form controls
    if (target.closest("[data-card], .pedigree-chrome, .pedigree-hint, button, a, input, textarea, select")) {
      return;
    }
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

  function endPan() {
    drag.current = null;
  }

  function isCoarsePointer() {
    return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(hover: none)").matches;
  }

  function onCardActivate(id: string) {
    onSelect(id);
  }

  function onCardFocusAncestors(id: string) {
    // Double-tap on phones often fires dblclick and closes the fresh sheet — skip on touch.
    if (isCoarsePointer()) return;
    onSetFocus(id);
  }

  if (empty) {
    return (
      <div className="pedigree-empty">
        <div className="pedigree-empty-card">
          <p className="eyebrow">SEJIRE</p>
          <h2>Начните с себя</h2>
          <button className="btn" type="button" onClick={onEmptyStart}>
            Добавить себя
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="pedigree-viewport"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onLostPointerCapture={endPan}
    >
      <div
        className="pedigree-chrome"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="focus-chip" title="Схема строится от этого человека к предкам">
          <span className="focus-chip-label">От</span>
          <strong className="clamp-1">{focusPerson?.name || "—"}</strong>
          {showHome && homeFocusId ? (
            <button
              type="button"
              className="chip-action chip-action-primary"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSetFocus(homeFocusId);
              }}
              title="Вернуть схему к вам"
            >
              К себе
            </button>
          ) : null}
        </div>
        {(scale !== 1 || Math.abs(pan.x - 28) > 2) && (
          <div className="pedigree-toolbar" aria-label="Вид">
            <button
              type="button"
              className="tool-btn wide"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                resetView();
              }}
            >
              Сброс вида
            </button>
          </div>
        )}
      </div>

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
              onClick={() => onCardActivate(item.id)}
              onDoubleClick={() => onCardFocusAncestors(item.id)}
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
