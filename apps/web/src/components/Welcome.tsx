import type { MouseEvent } from "react";
import { loadDraftTree } from "../lib/draftStorage";

type Props = {
  onStartNew: (title: string) => void;
  onContinueDraft: () => void;
  onRestoreSeed: () => void;
};

/**
 * Brand-first welcome: SEJIRE is the hero.
 * Secondary actions under the brand (needed on phones — no Shift / right-click).
 */
export function Welcome({ onStartNew, onContinueDraft, onRestoreSeed }: Props) {
  const hasDraft = Boolean(loadDraftTree());

  function onBrandClick(e: MouseEvent<HTMLButtonElement>) {
    if (e.shiftKey) {
      onStartNew("Мой род");
      return;
    }
    if (hasDraft) onContinueDraft();
    else onStartNew("Мой род");
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-hero">
        <button
          type="button"
          className="welcome-brand"
          onClick={onBrandClick}
          onContextMenu={(e) => {
            e.preventDefault();
            onRestoreSeed();
          }}
          aria-label={hasDraft ? "Продолжить черновик SEJIRE" : "Начать SEJIRE"}
          title={
            hasDraft
              ? "Открыть черновик · Shift — новый · ПКМ — по 12 словам"
              : "Начать · ПКМ — по 12 словам"
          }
        >
          SEJIRE
        </button>

        <div className="welcome-actions">
          {hasDraft ? (
            <>
              <button type="button" className="welcome-link" onClick={onContinueDraft}>
                Продолжить черновик
              </button>
              <button type="button" className="welcome-link" onClick={() => onStartNew("Мой род")}>
                Новое древо
              </button>
            </>
          ) : (
            <button type="button" className="welcome-link" onClick={() => onStartNew("Мой род")}>
              Начать
            </button>
          )}
          <button type="button" className="welcome-link" onClick={onRestoreSeed}>
            Открыть по 12 словам
          </button>
        </div>
      </div>
    </div>
  );
}
