import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Person, TreeStore } from "./lib/types";
import {
  activePersons,
  clearStore,
  commitDraft,
  createTree,
  diffPersonIds,
  getCommit,
  getHead,
  listHistory,
  loadDraftFromCommit,
  loadStore,
  removeDraftPerson,
  saveStore,
  upsertPersonFields,
} from "./lib/treeEngine";

function uid() {
  return `p_${Math.random().toString(36).slice(2, 9)}`;
}

export default function App() {
  const [store, setStore] = useState<TreeStore | null>(() => loadStore());
  const [viewCommitId, setViewCommitId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState("Род Султановых");
  const [commitMessage, setCommitMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    born: "",
    died: "",
    parents: "",
    notes: "",
    mediaTx: "",
  });

  useEffect(() => {
    if (store) saveStore(store);
  }, [store]);

  const history = useMemo(() => (store ? listHistory(store) : []), [store]);
  const head = store ? getHead(store) : null;
  const viewing = viewCommitId && store ? getCommit(store, viewCommitId) : null;
  const isHistorical = Boolean(viewing && head && viewing.commit_id !== head.commit_id);
  const visibleSnapshot = viewing?.snapshot ?? store?.draft;
  const people = visibleSnapshot ? activePersons(visibleSnapshot) : [];

  const diff = useMemo(() => {
    if (!store || !viewing || !head) return null;
    if (viewing.commit_id === head.commit_id) return null;
    return diffPersonIds(viewing.snapshot, head.snapshot);
  }, [store, viewing, head]);

  function onCreate(e: FormEvent) {
    e.preventDefault();
    const tree = createTree(titleInput);
    setStore(tree);
    setViewCommitId(null);
  }

  function onAddPerson(e: FormEvent) {
    e.preventDefault();
    if (!store || isHistorical) return;
    const name = form.name.trim();
    if (!name) return;

    const parents = form.parents
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const media = form.mediaTx.trim()
      ? [{ tx: form.mediaTx.trim(), kind: "image" as const, caption: "Архив" }]
      : [];

    const person: Person = {
      id: uid(),
      name,
      born: form.born || null,
      died: form.died || null,
      parents,
      media,
      notes: form.notes,
      tombstone: false,
    };

    setStore(upsertPersonFields(store, person));
    setForm({ name: "", born: "", died: "", parents: "", notes: "", mediaTx: "" });
  }

  function onCommit() {
    if (!store || isHistorical) return;
    const next = commitDraft(store, commitMessage || `Добавление: ${form.name || "обновление древа"}`);
    setStore(next);
    setViewCommitId(next.meta.head);
    setCommitMessage("");
  }

  function onSelectVersion(commitId: string) {
    if (!store) return;
    setViewCommitId(commitId);
  }

  function onContinueFromVersion() {
    if (!store || !viewCommitId) return;
    const next = loadDraftFromCommit(store, viewCommitId);
    // Continuing from old version still requires a NEW commit later — draft becomes dirty baseline
    setStore({ ...next, dirty: true });
    setViewCommitId(null);
  }

  function onReset() {
    clearStore();
    setStore(null);
    setViewCommitId(null);
  }

  if (!store) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-glyph" aria-hidden />
            <strong>SEJIRE</strong>
            <span>протокол вечной памяти</span>
          </div>
          <div className="badge">
            <em /> local engine · AO-ready
          </div>
        </header>

        <section className="hero-create">
          <h1>SEJIRE</h1>
          <p>
            Каждое дополнение — новая неизменяемая версия древа. Прошлое всегда можно открыть.
          </p>
          <form className="create-row" onSubmit={onCreate}>
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Название рода"
              aria-label="Название рода"
              required
            />
            <button className="btn" type="submit">
              Создать древо
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-glyph" aria-hidden />
          <strong>SEJIRE</strong>
          <span>{store.meta.title}</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <div className="badge">
            <em />
            HEAD v{(store.meta.next_version - 1) || 0}
            {store.dirty ? " · черновик" : " · зафиксировано"}
          </div>
          <button className="btn ghost" type="button" onClick={onReset}>
            Сбросить
          </button>
        </div>
      </header>

      {isHistorical && viewing && (
        <div className="banner">
          <span>
            Просмотр исторической версии <strong>v{viewing.version}</strong> — «{viewing.message}».
            Редактирование отключено. Чтобы продолжить отсюда, создайте новую линию коммитов.
          </span>
          <button className="btn ghost" type="button" onClick={onContinueFromVersion}>
            Взять как основу нового commit
          </button>
        </div>
      )}

      <div className="layout">
        <section className="panel">
          <h2>Древо</h2>
          <p className="sub">
            Факты и связи хранятся как UTF-8 граф. Медиа — только ссылка на Arweave TX.
          </p>

          {!isHistorical && (
            <>
              <form onSubmit={onAddPerson}>
                <div className="form-grid">
                  <label className="full">
                    Имя
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Аян Бекмуратов"
                      required
                    />
                  </label>
                  <label>
                    Дата рождения
                    <input
                      type="date"
                      value={form.born}
                      onChange={(e) => setForm({ ...form, born: e.target.value })}
                    />
                  </label>
                  <label>
                    Дата смерти
                    <input
                      type="date"
                      value={form.died}
                      onChange={(e) => setForm({ ...form, died: e.target.value })}
                    />
                  </label>
                  <label className="full">
                    ID родителей (через запятую)
                    <input
                      value={form.parents}
                      onChange={(e) => setForm({ ...form, parents: e.target.value })}
                      placeholder="p_abc, p_def"
                    />
                  </label>
                  <label className="full">
                    Медиа TX (Arweave, опционально)
                    <input
                      value={form.mediaTx}
                      onChange={(e) => setForm({ ...form, mediaTx: e.target.value })}
                      placeholder="Arweave transaction id"
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
                  placeholder="Сообщение коммита (как в git)"
                />
                <button
                  className="btn"
                  type="button"
                  disabled={!store.dirty && people.length === 0}
                  onClick={onCommit}
                >
                  Зафиксировать новую версию
                </button>
              </div>
            </>
          )}

          <div className="people">
            {people.length === 0 && (
              <p className="empty">Пока никого нет. Добавьте предка и зафиксируйте версию.</p>
            )}
            {people.map((p) => (
              <article className="person" key={p.id}>
                <h3>{p.name}</h3>
                <p>
                  {p.born || "—"} → {p.died || "…"}
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
                <div className="meta">
                  <span className="chip">id: {p.id}</span>
                  {p.parents.map((pid) => (
                    <span className="chip" key={pid}>
                      parent: {pid}
                    </span>
                  ))}
                  {p.media.map((m) => (
                    <span className="chip" key={m.tx}>
                      media: {m.tx.slice(0, 10)}…
                    </span>
                  ))}
                  {!isHistorical && (
                    <button
                      className="btn ghost"
                      type="button"
                      style={{ padding: "0.2rem 0.45rem", fontSize: "0.75rem" }}
                      onClick={() => setStore(removeDraftPerson(store, p.id))}
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
          <p className="sub">Каждый commit — полное дерево на момент фиксации. Удалить прошлое нельзя.</p>

          {history.length === 0 ? (
            <p className="empty">Коммитов ещё нет.</p>
          ) : (
            <ul className="history">
              {history.map((h) => (
                <li key={h.commit_id}>
                  <button
                    type="button"
                    className={
                      (viewCommitId ?? store.meta.head) === h.commit_id ? "active" : undefined
                    }
                    onClick={() => onSelectVersion(h.commit_id)}
                  >
                    <div className="ver">
                      v{h.version}
                      {h.commit_id === store.meta.head ? " · HEAD" : ""}
                    </div>
                    <div className="msg">{h.message}</div>
                    <div className="when">
                      {new Date(h.created_at).toLocaleString("ru-RU")} · {h.person_count} чел.
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {diff && (
            <div className="diff">
              <div>
                Diff к HEAD:{" "}
                <strong>+{diff.added.length}</strong> / <strong>~{diff.changed.length}</strong> /{" "}
                <strong>-{diff.removed.length}</strong>
              </div>
            </div>
          )}
        </aside>
      </div>

      <p className="footer-note">
        Local engine повторяет протокол AO (`ao/processes/tree.lua`): линейная история, owner
        commits, holographic versions. On-chain: HyperBEAM + ArConnect — Phase 2.
      </p>
    </div>
  );
}
