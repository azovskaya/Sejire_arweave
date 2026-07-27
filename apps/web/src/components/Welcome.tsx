import type { MouseEvent } from "react";
import { loadDraftTree } from "../lib/draftStorage";

type Props = {
  onStartNew: (title: string) => void;
  onContinueDraft: () => void;
  onRestoreSeed: () => void;
};

/**
 * Brand-only welcome: the single visible word is SEJIRE.
 * Click → continue draft if any, else start. Shift+click → new. Right-click → open by seed.
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
      <button
        type="button"
        className="welcome-brand"
        onClick={onBrandClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onRestoreSeed();
        }}
        aria-label={hasDraft ? "Продолжить черновик SEJIRE" : "Начать SEJIRE"}
        title={hasDraft ? "Открыть черновик · Shift — новый · ПКМ — по 12 словам" : "Начать · ПКМ — по 12 словам"}
      >
        SEJIRE
      </button>
    </div>
  );
}
