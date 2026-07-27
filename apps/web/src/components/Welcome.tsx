import { loadDraftTree } from "../lib/draftStorage";

type Props = {
  onStartNew: (title: string) => void;
  onContinueDraft: () => void;
  onRestoreSeed: () => void;
};

export function Welcome({ onStartNew, onContinueDraft, onRestoreSeed }: Props) {
  const hasDraft = Boolean(loadDraftTree());

  return (
    <div className="welcome-screen">
      <div className="welcome-hero">
        <h1>SEJIRE</h1>

        <div className="welcome-actions">
          <button className="btn" type="button" onClick={() => onStartNew("Мой род")}>
            Начать
          </button>
          {hasDraft && (
            <button className="btn ghost" type="button" onClick={onContinueDraft}>
              Черновик
            </button>
          )}
          <button className="btn ghost" type="button" onClick={onRestoreSeed}>
            Открыть
          </button>
        </div>
      </div>
    </div>
  );
}
