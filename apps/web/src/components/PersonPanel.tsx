import { useEffect, useRef, useState } from "react";
import type { Person } from "../lib/types";
import { lifespan } from "../lib/pedigree";
import { normalizeDateInput } from "../lib/dates";
import { DateTextInput } from "./DateTextInput";

type Props = {
  person: Person | null;
  relatives: { id: string; name: string; relation: string }[];
  /** Explicit open — on mobile opens bottom sheet; on desktop keeps side panel. */
  open?: boolean;
  onClose: () => void;
  onChange: (person: Person) => void;
  onAdd: (role: "father" | "mother" | "child") => void;
  onSelectRelative: (id: string) => void;
  onDelete: () => void;
  /** Mobile has no reliable double-tap — offer “view ancestors from here”. */
  onFocusAncestors?: () => void;
  showFocusAncestors?: boolean;
};

function emptyPerson(): Person {
  return {
    id: "",
    name: "",
    sex: "U",
    born: null,
    died: null,
    birthPlace: null,
    deathPlace: null,
    burialDate: null,
    burialPlace: null,
    occupation: null,
    maidenName: null,
    parents: [],
    media: [],
    notes: "",
  };
}

function buildPerson(base: Person, draft: Person): Person {
  return {
    ...base,
    ...draft,
    id: base.id,
    name: draft.name.trim(),
    maidenName: draft.maidenName?.trim() || null,
    birthPlace: draft.birthPlace?.trim() || null,
    deathPlace: draft.deathPlace?.trim() || null,
    burialPlace: draft.burialPlace?.trim() || null,
    occupation: draft.occupation?.trim() || null,
    notes: draft.notes?.trim() || "",
    born: draft.born ? normalizeDateInput(draft.born) || null : null,
    died: draft.died ? normalizeDateInput(draft.died) || null : null,
    burialDate: draft.burialDate ? normalizeDateInput(draft.burialDate) || null : null,
    parents: base.parents,
    media: base.media ?? [],
    tombstone: base.tombstone ?? false,
  };
}

function sameProfile(a: Person, b: Person) {
  return (
    a.name === b.name &&
    a.sex === b.sex &&
    a.maidenName === b.maidenName &&
    a.born === b.born &&
    a.died === b.died &&
    a.birthPlace === b.birthPlace &&
    a.deathPlace === b.deathPlace &&
    a.burialDate === b.burialDate &&
    a.burialPlace === b.burialPlace &&
    a.occupation === b.occupation &&
    (a.notes ?? "") === (b.notes ?? "")
  );
}

export function PersonPanel({
  person,
  relatives,
  open = false,
  onClose,
  onChange,
  onAdd,
  onSelectRelative,
  onDelete,
  onFocusAncestors,
  showFocusAncestors = false,
}: Props) {
  const [draft, setDraft] = useState<Person>(person ?? emptyPerson());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ready = useRef(false);
  const sheetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setDraft(person ?? emptyPerson());
    setConfirmDelete(false);
    ready.current = false;
    const t = window.setTimeout(() => {
      ready.current = true;
    }, 0);
    return () => window.clearTimeout(t);
  }, [person]);

  useEffect(() => {
    if (!person || !ready.current) return;
    const next = buildPerson(person, draft);
    if (sameProfile(person, next)) return;
    if (!next.name.trim()) return;
    const timer = window.setTimeout(() => onChange(next), 350);
    return () => window.clearTimeout(timer);
  }, [draft, person, onChange]);

  useEffect(() => {
    if (!person) return;
    const el = sheetRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [person]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !open) return;
    function onFocusIn(e: Event) {
      const t = e.target as HTMLElement | null;
      if (!t || !t.matches("input, textarea, select")) return;
      window.setTimeout(() => {
        t.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 50);
    }
    el.addEventListener("focusin", onFocusIn);
    return () => el.removeEventListener("focusin", onFocusIn);
  }, [open, person]);

  if (!person) {
    return (
      <aside className="person-panel is-empty" aria-hidden="true">
        <p>Нажмите карточку на схеме, чтобы открыть форму сведений.</p>
      </aside>
    );
  }

  function setField<K extends keyof Person>(key: K, value: Person[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const panelClass = open ? "person-panel is-open" : "person-panel is-docked";

  return (
    <aside
      ref={sheetRef}
      className={panelClass}
      role="dialog"
      aria-modal={open ? "true" : undefined}
      aria-label={`Профиль: ${draft.name || "без имени"}`}
    >
      <div className="person-sheet-handle" aria-hidden />
      <header className="person-panel-head">
        <div className="person-panel-head-text">
          <p className="eyebrow">Профиль · сохраняется сам</p>
          <h2 className="clamp-2">{draft.name || "Без имени"}</h2>
          <p className="sub mono">{lifespan(draft) || "даты не указаны"}</p>
        </div>
        <button type="button" className="tool-btn" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </header>

      {showFocusAncestors && onFocusAncestors ? (
        <div className="panel-section person-panel-focus-actions">
          <button type="button" className="btn ghost" onClick={onFocusAncestors}>
            Смотреть предков отсюда
          </button>
        </div>
      ) : null}

      <div className="person-panel-form">
        <section className="field-block">
          <h3>Личные данные</h3>
          <label>
            Полное имя
            <input value={draft.name} onChange={(e) => setField("name", e.target.value)} />
          </label>
          <label>
            Девичья фамилия
            <input
              value={draft.maidenName ?? ""}
              onChange={(e) => setField("maidenName", e.target.value || null)}
              placeholder="если применимо"
            />
          </label>
          <label>
            Пол
            <select
              value={draft.sex ?? "U"}
              onChange={(e) => setField("sex", e.target.value as Person["sex"])}
            >
              <option value="U">не указан</option>
              <option value="F">женский</option>
              <option value="M">мужской</option>
            </select>
          </label>
          <label>
            Род занятий
            <input
              value={draft.occupation ?? ""}
              onChange={(e) => setField("occupation", e.target.value || null)}
            />
          </label>
        </section>

        <section className="field-block">
          <h3>Рождение</h3>
          <label>
            Дата рождения
            <DateTextInput
              value={draft.born ?? ""}
              onChange={(v) => setField("born", v || null)}
              aria-label="Дата рождения"
            />
          </label>
          <label>
            Место рождения
            <input
              value={draft.birthPlace ?? ""}
              onChange={(e) => setField("birthPlace", e.target.value || null)}
              placeholder="город, страна"
            />
          </label>
        </section>

        <section className="field-block">
          <h3>Смерть</h3>
          <label>
            Дата смерти
            <DateTextInput
              value={draft.died ?? ""}
              onChange={(v) => setField("died", v || null)}
              aria-label="Дата смерти"
            />
          </label>
          <label>
            Место смерти
            <input
              value={draft.deathPlace ?? ""}
              onChange={(e) => setField("deathPlace", e.target.value || null)}
              placeholder="город, страна"
            />
          </label>
        </section>

        <section className="field-block">
          <h3>Захоронение</h3>
          <label>
            Дата захоронения
            <DateTextInput
              value={draft.burialDate ?? ""}
              onChange={(v) => setField("burialDate", v || null)}
              aria-label="Дата захоронения"
            />
          </label>
          <label>
            Место захоронения
            <input
              value={draft.burialPlace ?? ""}
              onChange={(e) => setField("burialPlace", e.target.value || null)}
              placeholder="кладбище, город"
            />
          </label>
        </section>

        <section className="field-block">
          <h3>Заметки</h3>
          <label>
            Биография / примечания
            <textarea
              rows={4}
              value={draft.notes ?? ""}
              onChange={(e) => setField("notes", e.target.value)}
            />
          </label>
        </section>
      </div>

      <div className="panel-section">
        <h3>Родственники</h3>
        <div className="rel-actions">
          <button type="button" className="btn ghost" onClick={() => onAdd("father")}>
            + Папа
          </button>
          <button type="button" className="btn ghost" onClick={() => onAdd("mother")}>
            + Мама
          </button>
          <button type="button" className="btn ghost" onClick={() => onAdd("child")}>
            + Ребёнок
          </button>
        </div>
        {relatives.length > 0 && (
          <ul className="rel-list">
            {relatives.map((r) => (
              <li key={`${r.relation}-${r.id}`}>
                <span>{r.relation}</span>
                <button type="button" className="rel-link clamp-1" onClick={() => onSelectRelative(r.id)}>
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel-section delete-zone">
        {!confirmDelete ? (
          <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>
            Удалить с древа
          </button>
        ) : (
          <div className="delete-confirm">
            <p>
              Убрать <strong>{draft.name || "этого человека"}</strong> со схемы? Сразу после этого можно
              нажать «Вернуть».
            </p>
            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete();
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
