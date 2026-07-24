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
  onFocus: () => void;
  onRemove: () => void;
};

export function PersonPanel({ person, relatives, onClose, onSave, onAdd, onFocus, onRemove }: Props) {
  const [draft, setDraft] = useState<Person | null>(person);

  useEffect(() => {
    setDraft(person);
  }, [person]);

  if (!person || !draft) {
    return (
      <aside className="person-panel is-empty">
        <p>Выберите человека на древе или добавьте себя, чтобы начать.</p>
      </aside>
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    onSave(draft);
  }

  return (
    <aside className="person-panel">
      <header className="person-panel-head">
        <div>
          <p className="eyebrow">Профиль</p>
          <h2>{draft.name || "Без имени"}</h2>
          <p className="sub">{lifespan(draft)}</p>
        </div>
        <button type="button" className="tool-btn" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </header>

      <form className="person-panel-form" onSubmit={submit}>
        <label>
          Имя
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
          />
        </label>
        <label>
          Пол
          <select
            value={draft.sex ?? "U"}
            onChange={(e) => setDraft({ ...draft, sex: e.target.value as Person["sex"] })}
          >
            <option value="U">не указан</option>
            <option value="F">женский</option>
            <option value="M">мужской</option>
          </select>
        </label>
        <div className="row-2">
          <label>
            Рождение
            <input
              type="date"
              value={draft.born ?? ""}
              onChange={(e) => setDraft({ ...draft, born: e.target.value || null })}
            />
          </label>
          <label>
            Смерть
            <input
              type="date"
              value={draft.died ?? ""}
              onChange={(e) => setDraft({ ...draft, died: e.target.value || null })}
            />
          </label>
        </div>
        <label>
          Заметки
          <textarea
            rows={3}
            value={draft.notes ?? ""}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
        <button className="btn" type="submit">
          Сохранить
        </button>
      </form>

      <div className="panel-section">
        <h3>Добавить родственника</h3>
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
      </div>

      {relatives.length > 0 && (
        <div className="panel-section">
          <h3>Близкие</h3>
          <ul className="rel-list">
            {relatives.map((r) => (
              <li key={`${r.relation}-${r.id}`}>
                <span>{r.relation}</span>
                <strong>{r.name}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel-section actions-col">
        <button type="button" className="btn ghost" onClick={onFocus}>
          Сделать центром древа
        </button>
        <button type="button" className="btn ghost danger-text" onClick={onRemove}>
          Скрыть из текущей версии
        </button>
      </div>
    </aside>
  );
}
