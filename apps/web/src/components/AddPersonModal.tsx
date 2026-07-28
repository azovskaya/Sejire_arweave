import { useState } from "react";
import type { FormEvent } from "react";
import type { Person } from "../lib/types";
import { normalizeDateInput } from "../lib/dates";
import { DateTextInput } from "./DateTextInput";

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
    onSave({
      ...form,
      name: form.name.trim(),
      born: normalizeDateInput(form.born),
      died: normalizeDateInput(form.died),
      burialDate: normalizeDateInput(form.burialDate),
    });
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form className="modal add-modal" onSubmit={submit}>
        <h2>{title}</h2>
        <p className="sub">
          Заполните известные факты. Позже всё можно уточнить, нажав карточку на схеме.
        </p>

        <label>
          Полное имя
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus={typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches}
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
            <DateTextInput
              value={form.born}
              onChange={(born) => setForm({ ...form, born })}
              aria-label="Дата рождения"
            />
          </label>
          <label>
            Дата смерти
            <DateTextInput
              value={form.died}
              onChange={(died) => setForm({ ...form, died })}
              aria-label="Дата смерти"
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
            <DateTextInput
              value={form.burialDate}
              onChange={(burialDate) => setForm({ ...form, burialDate })}
              aria-label="Дата захоронения"
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
