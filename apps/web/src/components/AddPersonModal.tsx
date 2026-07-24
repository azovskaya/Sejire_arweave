import { useState } from "react";
import type { FormEvent } from "react";
import type { Person } from "../lib/types";

type Props = {
  title: string;
  defaultSex?: Person["sex"];
  onCancel: () => void;
  onSave: (data: { name: string; sex: Person["sex"]; born: string; died: string; notes: string }) => void;
};

export function AddPersonModal({ title, defaultSex = "U", onCancel, onSave }: Props) {
  const [name, setName] = useState("");
  const [sex, setSex] = useState<Person["sex"]>(defaultSex);
  const [born, setBorn] = useState("");
  const [died, setDied] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), sex, born, died, notes });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal panel add-modal" onSubmit={submit}>
        <h2>{title}</h2>
        <p className="sub">Как на MyHeritage и FamilySearch — коротко имя и даты, остальное можно дописать позже.</p>
        <label>
          Имя
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required placeholder="ФИО" />
        </label>
        <label>
          Пол
          <select value={sex} onChange={(e) => setSex(e.target.value as Person["sex"])}>
            <option value="U">не указан</option>
            <option value="F">женский</option>
            <option value="M">мужской</option>
          </select>
        </label>
        <div className="row-2">
          <label>
            Рождение
            <input type="date" value={born} onChange={(e) => setBorn(e.target.value)} />
          </label>
          <label>
            Смерть
            <input type="date" value={died} onChange={(e) => setDied(e.target.value)} />
          </label>
        </div>
        <label>
          Заметки
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" className="btn">
            Добавить
          </button>
        </div>
      </form>
    </div>
  );
}
