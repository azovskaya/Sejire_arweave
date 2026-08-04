import { SHEZHIRE_TEMPLATES, type ShezhireTemplateId } from "../lib/pdf/shezhirePdf";

type Props = {
  onPick: (template: ShezhireTemplateId) => void;
  onClose: () => void;
};

export function ShezhireTemplateModal({ onPick, onClose }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal panel shezhire-template-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Жеті ата</h2>
        <p className="sub">Три разных PDF. Баспалдақ — альбомный лист.</p>
        <div className="shezhire-template-list">
          {SHEZHIRE_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className="shezhire-template-option"
              onClick={() => onPick(tpl.id)}
            >
              <span className="shezhire-template-head">
                <strong>{tpl.title}</strong>
                <em>{tpl.format}</em>
              </span>
              <span>{tpl.blurb}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost" type="button" onClick={onClose} style={{ width: "100%" }}>
          Отмена
        </button>
      </div>
    </div>
  );
}
