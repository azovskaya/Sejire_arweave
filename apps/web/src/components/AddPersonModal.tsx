import { useState } from "react";
import type { FormEvent } from "react";
import type { Person } from "../lib/types";

export type AddPersonPayload = {
  name: string;
  sex: Person["sex"];
  maidenName: string;
  born: string;
  died: string;
  birthPlace: string;
  deathPlace: string;
  burialDate: string;
  burialPlace: string;
  occupation: string;
  notes: string;
};

type Props = {
  title: string;
  defaultSex?: Person["sex"];
  onCancel: () => void;
  onSave: (data: AddPersonPayload) => void;
};

export function AddPersonModal({ title, defaultSex = "U", onCancel, onSave }: Props) {
  const [form, setForm] = useState<AddPersonPayload>({
    name: "",
    sex: defaultSex,
    maidenName: "",
    born: "",
    died: "",
    birthPlace: "",
    deathPlace: "",
    burialDate: "",
    burialPlace: "",
    occupation: "",
    notes: "",
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim() });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal add-modal" onSubmit={submit}>
        <h2>{title}</h2>
        <p className="sub">
          Заполните известные факты. Позже всё можно уточнить в панели профиля справа.
        </p>

        <label>
          Полное имя
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
            required
          />
        </label>
        <div className="row-2">
          <label>
            Пол
            <select
              value={form.sex}
              onChange={(e) => setForm({ ...form, sex: e.target.value as Person["sex"] })}
            >
              <option value="U">не указан</option>
              <option value="F">женский</option>
              <option value="M">мужской</option>
            </select>
          </label>
          <label>
            Девичья фамилия
            <input
              value={form.maidenName}
              onChange={(e) => setForm({ ...form, maidenName: e.target.value })}
              placeholder="если есть"
            />
          </label>
        </div>
        <div className="row-2">
          <label>
            Дата рождения
            <input
              type="date"
              value={form.born}
              onChange={(e) => setForm({ ...form, born: e.target.value })}
            />
          </label>
          <label>
            Дата смерти
            <input
              type="date"
              value={form.died}
              onChange={(e) => setForm({ ...form, died: e.target.value })}
            />
          </label>
        </div>
        <label>
          Место рождения
          <input
            value={form.birthPlace}
            onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
            placeholder="город, страна"
          />
        </label>
        <label>
          Место смерти
          <input
            value={form.deathPlace}
            onChange={(e) => setForm({ ...form, deathPlace: e.target.value })}
            placeholder="город, страна"
          />
        </label>
        <div className="row-2">
          <label>
            Дата захоронения
            <input
              type="date"
              value={form.burialDate}
              onChange={(e) => setForm({ ...form, burialDate: e.target.value })}
            />
          </label>
          <label>
            Место захоронения
            <input
              value={form.burialPlace}
              onChange={(e) => setForm({ ...form, burialPlace: e.target.value })}
              placeholder="кладбище, город"
            />
          </label>
        </div>
        <label>
          Род занятий
          <input
            value={form.occupation}
            onChange={(e) => setForm({ ...form, occupation: e.target.value })}
          />
        </label>
        <label>
          Заметки
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
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
