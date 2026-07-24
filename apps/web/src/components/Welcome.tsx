import { useState } from "react";
import type { FormEvent } from "react";
import { loadDraftTree } from "../lib/draftStorage";
import { loadGuide } from "../lib/guide";

type Props = {
  onStartNew: (title: string) => void;
  onContinueDraft: () => void;
  onRestoreSeed: () => void;
};

export function Welcome({ onStartNew, onContinueDraft, onRestoreSeed }: Props) {
  const hasDraft = Boolean(loadDraftTree());
  const guide = loadGuide();
  const [title, setTitle] = useState("Мой род");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onStartNew(title.trim() || "Мой род");
  }

  return (
    <section className="hero-create" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1>SEJIRE</h1>
      <p>
        Сначала соберите древо: вы → мама и папа → бабушки и дедушки.  
        <strong style={{ color: "#e09a5f", fontWeight: 600 }}>12 слов понадобятся только когда отправите древо в Arweave.</strong>
      </p>

      <form className="panel" style={{ textAlign: "left", width: "100%" }} onSubmit={onSubmit}>
        <h2>Новое древо предков</h2>
        <p className="sub">Название можно изменить позже. Начнём с записи о вас.</p>
        <label className="full">
          Название рода
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <div className="actions" style={{ marginTop: "0.85rem" }}>
          <button className="btn" type="submit">
            Начать с себя
          </button>
        </div>
      </form>

      {hasDraft && (
        <div className="actions" style={{ marginTop: "1rem", justifyContent: "center" }}>
          <button className="btn ghost" type="button" onClick={onContinueDraft}>
            Продолжить черновик
            {guide && guide.step !== "done" ? ` (шаг: ${guide.step})` : ""}
          </button>
        </div>
      )}

      <p className="sub" style={{ marginTop: "1.5rem" }}>
        Уже публиковали в Arweave?{" "}
        <button type="button" className="linkish" onClick={onRestoreSeed}>
          Открыть по 12 словам
        </button>
      </p>
    </section>
  );
}
