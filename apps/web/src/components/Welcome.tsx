import { useState } from "react";
import { loadDraftTree } from "../lib/draftStorage";
import { isPagesTestMirror } from "../lib/siteMirror";

type Props = {
  onStartNew: (title: string) => void;
  onContinueDraft: () => void;
  onRestoreSeed: () => void;
};

type Step = "brand" | "menu";

/**
 * Step 1: only SEJIRE.
 * Step 2: start choices — same mental model on phone and desktop.
 */
export function Welcome({ onStartNew, onContinueDraft, onRestoreSeed }: Props) {
  const [step, setStep] = useState<Step>("brand");
  const hasDraft = Boolean(loadDraftTree());

  function startFresh() {
    if (hasDraft) {
      const ok = window.confirm(
        "Текущий черновик будет удалён. Сначала можно продолжить его и выгрузить JSON. Создать новое древо?"
      );
      if (!ok) return;
    }
    onStartNew("Мой род");
  }

  if (step === "brand") {
    return (
      <div className="welcome-screen is-brand">
        <button
          type="button"
          className="welcome-brand"
          onClick={() => setStep("menu")}
          aria-label="SEJIRE — открыть меню"
        >
          SEJIRE
        </button>
      </div>
    );
  }

  return (
    <div className="welcome-screen is-menu">
      <div className="welcome-menu">
        <button type="button" className="welcome-menu-brand" onClick={() => setStep("brand")}>
          SEJIRE
        </button>
        {isPagesTestMirror() ? (
          <p className="welcome-menu-sub">
            Это тестовое зеркало GitHub Pages. Канон{" "}
            <a href="https://sejire.ar.io" target="_blank" rel="noreferrer">
              sejire.ar.io
            </a>{" "}
            пока со старым паком.
          </p>
        ) : null}

        <div className="welcome-menu-actions">
          {hasDraft ? (
            <>
              <button type="button" className="btn welcome-menu-btn" onClick={onContinueDraft}>
                Продолжить
              </button>
              <button type="button" className="btn ghost welcome-menu-btn" onClick={onRestoreSeed}>
                Открыть по 12 словам
              </button>
              <button type="button" className="welcome-link-quiet" onClick={startFresh}>
                Новое древо
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn welcome-menu-btn" onClick={startFresh}>
                Начать
              </button>
              <button type="button" className="btn ghost welcome-menu-btn" onClick={onRestoreSeed}>
                Открыть по 12 словам
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
