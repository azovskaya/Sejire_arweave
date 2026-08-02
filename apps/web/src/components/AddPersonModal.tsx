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
  /** When true, ask for sex (e.g. adding yourself). Parents/children get sex from role. */
  askSex?: boolean;
  onCancel: () => void;
  onSave: (data: AddPersonPayload) => void;
};

function emptyPayload(sex: Person["sex"]): AddPersonPayload {
  return {
    name: "",
    sex,
    maidenName: "",
    born: "",
    died: "",
    birthPlace: "",
    deathPlace: "",
    burialDate: "",
    burialPlace: "",
    occupation: "",
    notes: "",
  };
}

export function AddPersonModal({
  title,
  defaultSex = "U",
  askSex = false,
  onCancel,
  onSave,
}: Props) {
  const [name, setName] = useState("");
  const [sex, setSex] = useState<Person["sex"]>(defaultSex);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      ...emptyPayload(askSex ? sex : defaultSex),
      name: trimmed,
      sex: askSex ? sex : defaultSex,
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
      <form className="modal add-modal add-modal-simple" onSubmit={submit}>
        <h2>{title}</h2>
        <p className="sub">Достаточно имени — остальное можно дописать на карточке.</p>

        <label>
          Имя
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches}
            required
            placeholder="Как зовут"
          />
        </label>

        {askSex ? (
          <label>
            Пол
            <select value={sex} onChange={(e) => setSex(e.target.value as Person["sex"])}>
              <option value="U">не указан</option>
              <option value="F">женский</option>
              <option value="M">мужской</option>
            </select>
          </label>
        ) : null}

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
