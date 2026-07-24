import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { TreeStore } from "../lib/types";
import { saveDraftTree } from "../lib/draftStorage";
import {
  GUIDE_COPY,
  type GuideState,
  applyGuidePerson,
  saveGuide,
  skipGuideStep,
} from "../lib/guide";
import { relationshipLabel } from "../lib/kinship";
import { TreeCanvas } from "./TreeCanvas";
import { PublishSeedModal } from "./PublishSeedModal";
import {
  activePersons,
  commitDraft,
  diffPersonIds,
  getCommit,
  getHead,
  listHistory,
  loadDraftFromCommit,
  removeDraftPerson,
  upsertPersonFields,
} from "../lib/treeEngine";

type Props = {
  store: TreeStore;
  guide: GuideState;
  onStoreChange: (store: TreeStore) => void;
  onGuideChange: (guide: GuideState) => void;
  onHome: () => void;
};

export function Workspace({ store, guide, onStoreChange, onGuideChange, onHome }: Props) {
  const [viewCommitId, setViewCommitId] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [form, setForm] = useState({ name: "", born: "", died: "", notes: "", parentIds: [] as string[] });
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kinA, setKinA] = useState("");
  const [kinB, setKinB] = useState("");
  const [showPublish, setShowPublish] = useState(false);
  const [freeForm, setFreeForm] = useState(guide.step === "done");

  useEffect(() => {
    saveDraftTree(store);
  }, [store]);

  useEffect(() => {
    saveGuide(guide);
    if (guide.step === "done") setFreeForm(true);
  }, [guide]);

  const history = useMemo(() => listHistory(store), [store]);
  const head = getHead(store);
  const viewing = viewCommitId ? getCommit(store, viewCommitId) : null;
  const isHistorical = Boolean(viewing && head && viewing.commit_id !== head.commit_id);
  const visibleSnapshot = viewing?.snapshot ?? store.draft;
  const people = activePersons(visibleSnapshot);
  const draftPeople = activePersons(store.draft);
  const diff = useMemo(() => {
    if (!viewing || !head || viewing.commit_id === head.commit_id) return null;
    return diffPersonIds(viewing.snapshot, head.snapshot);
  }, [viewing, head]);
  const kinLabel =
    visibleSnapshot && kinA && kinB ? relationshipLabel(visibleSnapshot, kinA, kinB) : null;

  const guiding = !freeForm && guide.step !== "done";
  const stepCopy = guiding && guide.step !== "done" ? GUIDE_COPY[guide.step] : null;

  function persist(next: TreeStore) {
    onStoreChange(next);
  }

  function onGuideSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !stepCopy) return;
    const result = applyGuidePerson(store, guide, form);
    persist(result.store);
    onGuideChange(result.guide);
    setForm({ name: "", born: "", died: "", notes: "", parentIds: [] });
    setNotice(`Добавлено: ${stepCopy.relation}. ${result.guide.step === "done" ? "База рода собрана — можно дополнять свободно." : ""}`);
  }

  function onFreeAdd(e: FormEvent) {
    e.preventDefault();
    if (isHistorical || !form.name.trim()) return;
    const next = upsertPersonFields(store, {
      name: form.name.trim(),
      born: form.born || null,
      died: form.died || null,
      notes: form.notes,
      parents: form.parentIds,
    });
    persist(next);
    setForm({ name: "", born: "", died: "", notes: "", parentIds: [] });
  }

  function toggleParent(id: string) {
    setForm((prev) => ({
      ...prev,
      parentIds: prev.parentIds.includes(id)
        ? prev.parentIds.filter((x) => x !== id)
        : [...prev.parentIds, id],
    }));
  }

  function onCommit() {
    if (isHistorical) return;
    const next = commitDraft(store, commitMessage || "Фиксация версии");
    persist(next);
    setViewCommitId(next.meta.head);
    setCommitMessage("");
    setNotice(`Версия v${next.meta.next_version - 1} сохранена в черновике.`);
  }

  return (
    <div>
      <header className="topbar">
        <div className="brand">
          <span className="brand-glyph" aria-hidden />
          <strong>SEJIRE</strong>
          <span>{store.meta.title}</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <div className="badge">
            <em />
            черновик · v{Math.max(0, store.meta.next_version - 1)}
            {store.dirty ? " · не зафиксировано" : ""}
          </div>
          <button className="btn" type="button" onClick={() => setShowPublish(true)}>
            Отправить в Arweave
          </button>
          <button className="btn ghost" type="button" onClick={onHome}>
            На главную
          </button>
        </div>
      </header>

      <div className="banner">
        <span>
          Сейчас вы собираете древо локально. <strong>12 слов</strong> понадобятся только при отправке в
          Arweave.
        </span>
      </div>

      {notice && <div className="banner">{notice}</div>}

      {isHistorical && viewing && (
        <div className="banner">
          <span>
            Просмотр v{viewing.version} — «{viewing.message}».
          </span>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              persist({ ...loadDraftFromCommit(store, viewCommitId!), dirty: true });
              setViewCommitId(null);
            }}
          >
            Взять как основу нового commit
          </button>
        </div>
      )}

      <div className="layout">
        <section className="panel">
          <h2>Схема рода</h2>
          <p className="sub">Порядок сбора: я → мама/папа → бабушки и дедушки → дальше свободно.</p>
          <TreeCanvas snapshot={visibleSnapshot} selectedId={selectedId} onSelect={setSelectedId} />

          {guiding && stepCopy && (
            <form className="guide-card" onSubmit={onGuideSubmit}>
              <p className="eyebrow">Шаг проводника</p>
              <h2>{stepCopy.title}</h2>
              <p className="sub">{stepCopy.hint}</p>
              <div className="form-grid">
                <label className="full">
                  Имя ({stepCopy.relation})
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="ФИО"
                    required
                    autoFocus
                  />
                </label>
                <label>
                  Рождение
                  <input
                    type="date"
                    value={form.born}
                    onChange={(e) => setForm({ ...form, born: e.target.value })}
                  />
                </label>
                <label>
                  Смерть
                  <input
                    type="date"
                    value={form.died}
                    onChange={(e) => setForm({ ...form, died: e.target.value })}
                  />
                </label>
                <label className="full">
                  Заметки
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </label>
              </div>
              <div className="actions">
                <button className="btn" type="submit">
                  Сохранить и далее
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => onGuideChange(skipGuideStep(guide))}
                >
                  Пропустить шаг
                </button>
                <button className="btn ghost" type="button" onClick={() => setFreeForm(true)}>
                  Свободный режим
                </button>
              </div>
            </form>
          )}

          {(freeForm || guide.step === "done") && !isHistorical && (
            <>
              <h2 style={{ marginTop: "1.2rem" }}>Добавить ещё человека</h2>
              <form onSubmit={onFreeAdd}>
                <div className="form-grid">
                  <label className="full">
                    Имя
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Рождение
                    <input
                      type="date"
                      value={form.born}
                      onChange={(e) => setForm({ ...form, born: e.target.value })}
                    />
                  </label>
                  <label>
                    Смерть
                    <input
                      type="date"
                      value={form.died}
                      onChange={(e) => setForm({ ...form, died: e.target.value })}
                    />
                  </label>
                  <fieldset className="full parent-pick">
                    <legend>Родители</legend>
                    <div className="parent-list">
                      {draftPeople.map((p) => (
                        <label key={p.id} className="check">
                          <input
                            type="checkbox"
                            checked={form.parentIds.includes(p.id)}
                            onChange={() => toggleParent(p.id)}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className="actions">
                  <button className="btn ghost" type="submit">
                    В черновик
                  </button>
                </div>
              </form>
              <div className="actions">
                <input
                  style={{ flex: 1 }}
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Сообщение версии"
                />
                <button className="btn" type="button" onClick={onCommit}>
                  Зафиксировать версию
                </button>
              </div>
            </>
          )}

          <div className="people">
            {people.map((p) => (
              <article
                className={`person ${selectedId === p.id ? "is-selected" : ""}`}
                key={p.id}
                onClick={() => setSelectedId(p.id)}
              >
                <h3>{p.name}</h3>
                <p>
                  {p.born || "—"} → {p.died || "…"}
                </p>
                <div className="meta">
                  {p.parents.map((pid) => {
                    const parent = draftPeople.find((x) => x.id === pid);
                    return (
                      <span className="chip" key={pid}>
                        родитель: {parent?.name ?? pid}
                      </span>
                    );
                  })}
                  {!isHistorical && (
                    <button
                      className="btn ghost"
                      type="button"
                      style={{ padding: "0.2rem 0.45rem", fontSize: "0.75rem" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        persist(removeDraftPerson(store, p.id));
                      }}
                    >
                      tombstone
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel">
          <h2>История версий</h2>
          <p className="sub">Локальные коммиты. В сеть уйдёт зашифрованный снимок по 12 словам.</p>
          {history.length === 0 ? (
            <p className="empty">Пока нет фиксаций — это нормально на этапе сбора.</p>
          ) : (
            <ul className="history">
              {history.map((h) => (
                <li key={h.commit_id}>
                  <button
                    type="button"
                    className={(viewCommitId ?? store.meta.head) === h.commit_id ? "active" : undefined}
                    onClick={() => setViewCommitId(h.commit_id)}
                  >
                    <div className="ver">
                      v{h.version}
                      {h.commit_id === store.meta.head ? " · HEAD" : ""}
                    </div>
                    <div className="msg">{h.message}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {diff && (
            <div className="diff">
              Diff: +{diff.added.length} / ~{diff.changed.length} / -{diff.removed.length}
            </div>
          )}

          <h2 style={{ marginTop: "1.2rem" }}>Родство</h2>
          <div className="form-grid">
            <label>
              A
              <select value={kinA} onChange={(e) => setKinA(e.target.value)}>
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              B
              <select value={kinB} onChange={(e) => setKinB(e.target.value)}>
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {kinLabel && <p className="kin-result">{kinLabel}</p>}
        </aside>
      </div>

      {showPublish && (
        <PublishSeedModal
          store={store}
          onClose={() => setShowPublish(false)}
          onPublished={({ mode, txId }) => {
            setShowPublish(false);
            setNotice(
              mode === "arweave"
                ? `Древо в Arweave. TX: ${txId}. Сохраните 12 слов — ими откроете сейф с любого устройства.`
                : "Зашифрованный файл скачан. Храните его вместе с 12 словами."
            );
          }}
        />
      )}
    </div>
  );
}
