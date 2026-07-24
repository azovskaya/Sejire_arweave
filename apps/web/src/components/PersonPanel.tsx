import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { Person } from "../lib/types";
import { lifespan } from "../lib/pedigree";

type Props = {
  person: Person | null;
  relatives: { id: string; name: string; relation: string }[];
  onClose: () => void;
  onSave: (person: Person) => void;
  onAdd: (role: "father" | "mother" | "child") => void;
  onSelectRelative: (id: string) => void;
  onDelete: () => void;
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

export function PersonPanel({
  person,
  relatives,
  onClose,
  onSave,
  onAdd,
  onSelectRelative,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<Person>(person ?? emptyPerson());
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setDraft(person ?? emptyPerson());
    setConfirmDelete(false);
  }, [person]);

  if (!person) {
    return (
      <aside className="person-panel is-empty">
        <p>Выберите карточку на схеме или добавьте себя, чтобы заполнить сведения.</p>
      </aside>
    );
  }

  const current = person;

  function setField<K extends keyof Person>(key: K, value: Person[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    onSave({
      ...current,
      ...draft,
      id: current.id,
      name: draft.name.trim(),
      maidenName: draft.maidenName?.trim() || null,
      birthPlace: draft.birthPlace?.trim() || null,
      deathPlace: draft.deathPlace?.trim() || null,
      burialPlace: draft.burialPlace?.trim() || null,
      occupation: draft.occupation?.trim() || null,
      notes: draft.notes?.trim() || "",
      born: draft.born || null,
      died: draft.died || null,
      burialDate: draft.burialDate || null,
      parents: current.parents,
      media: current.media ?? [],
      tombstone: current.tombstone ?? false,
    });
  }

  return (
    <aside className="person-panel">
      <header className="person-panel-head">
        <div className="person-panel-head-text">
          <p className="eyebrow">Профиль</p>
          <h2 className="clamp-2">{draft.name || "Без имени"}</h2>
          <p className="sub mono">{lifespan(draft) || "даты не указаны"}</p>
        </div>
        <button type="button" className="tool-btn" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </header>

      <form className="person-panel-form" onSubmit={submit}>
        <section className="field-block">
          <h3>Личные данные</h3>
          <label>
            Полное имя
            <input value={draft.name} onChange={(e) => setField("name", e.target.value)} required />
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
            <input
              type="date"
              value={draft.born ?? ""}
              onChange={(e) => setField("born", e.target.value || null)}
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
            <input
              type="date"
              value={draft.died ?? ""}
              onChange={(e) => setField("died", e.target.value || null)}
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
            <input
              type="date"
              value={draft.burialDate ?? ""}
              onChange={(e) => setField("burialDate", e.target.value || null)}
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

        <button className="btn full" type="submit">
          Сохранить
        </button>
      </form>

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
