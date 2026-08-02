import { useState } from "react";
import { loadDraftTree } from "../lib/draftStorage";

type Props = {
  onStartNew: (title: string) => void;
  onContinueDraft: () => void;
  onRestoreSeed: () => void;
};

type Step = "brand" | "menu";

/**
 * Step 1: only the word SEJIRE.
 * Step 2 (after tap): start choices — same controls on phone and desktop.
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
        <p className="welcome-menu-sub">Что сделать дальше</p>

        <div className="welcome-menu-actions">
          {hasDraft ? (
            <>
              <button type="button" className="btn welcome-menu-btn" onClick={onContinueDraft}>
                Продолжить черновик
              </button>
              <button type="button" className="btn ghost welcome-menu-btn" onClick={startFresh}>
                Новое древо
              </button>
            </>
          ) : (
            <button type="button" className="btn welcome-menu-btn" onClick={startFresh}>
              Начать
            </button>
          )}
          <button type="button" className="btn ghost welcome-menu-btn" onClick={onRestoreSeed}>
            Открыть по 12 словам
          </button>
        </div>

        <button type="button" className="welcome-menu-back" onClick={() => setStep("brand")}>
          Назад
        </button>
      </div>
    </div>
  );
}
