import { useState } from "react";
import type { FormEvent } from "react";
import { loadDraftTree } from "../lib/draftStorage";

type Props = {
  onStartNew: (title: string) => void;
  onContinueDraft: () => void;
  onRestoreSeed: () => void;
};

export function Welcome({ onStartNew, onContinueDraft, onRestoreSeed }: Props) {
  const hasDraft = Boolean(loadDraftTree());
  const [title, setTitle] = useState("Мой род");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onStartNew(title.trim() || "Мой род");
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-hero">
        <p className="eyebrow">SEJIRE · permanent family memory</p>
        <h1>SEJIRE</h1>
        <p className="lede">
          Соберите древо предков в светлом стиле вечного хранилища. Начните с себя, добавьте маму и
          папу на схеме. Двенадцать слов понадобятся только когда отправите зашифрованный сейф в
          Arweave.
        </p>

        <form className="welcome-form" onSubmit={onSubmit}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Название рода"
            placeholder="Название рода"
          />
          <button className="btn" type="submit">
            Начать с себя
          </button>
        </form>

        {hasDraft && (
          <button className="btn ghost welcome-continue" type="button" onClick={onContinueDraft}>
            Продолжить черновик
          </button>
        )}

        <button type="button" className="linkish welcome-restore" onClick={onRestoreSeed}>
          Уже публиковали? Открыть по 12 словам
        </button>
      </div>

      <ul className="welcome-points">
        <li>
          <strong>Схема в центре</strong>
          <span>Pedigree-вид с карточками «Добавить маму / папу»</span>
        </li>
        <li>
          <strong>Панель профиля</strong>
          <span>Клик по человеку — факты и родственные действия</span>
        </li>
        <li>
          <strong>Вечная фиксация</strong>
          <span>В Arweave уходит зашифрованный снимок, не аккаунт сервиса</span>
        </li>
      </ul>
    </div>
  );
}
