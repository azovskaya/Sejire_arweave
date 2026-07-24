import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { JWKInterface } from "arweave/web/lib/wallet";
import type { Person, TreeStore } from "../lib/types";
import type { SejireKeys } from "../lib/crypto/keys";
import { fingerprintVaultId } from "../lib/crypto/keys";
import type { VaultV1 } from "../lib/crypto/vault";
import { downloadEnvelope, putTree, sealVault } from "../lib/crypto/vault";
import {
  activePersons,
  commitDraft,
  createTree,
  diffPersonIds,
  getCommit,
  getHead,
  listHistory,
  loadDraftFromCommit,
  removeDraftPerson,
  upsertPersonFields,
} from "../lib/treeEngine";

function uid() {
  return `p_${Math.random().toString(36).slice(2, 9)}`;
}

type Props = {
  keys: SejireKeys;
  vault: VaultV1;
  onVaultChange: (vault: VaultV1) => void;
  onLock: () => void;
};

export function Workspace({ keys, vault, onVaultChange, onLock }: Props) {
  const [titleInput, setTitleInput] = useState("Род Султановых");
  const [viewCommitId, setViewCommitId] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    born: "",
    died: "",
    parents: "",
    notes: "",
    mediaTx: "",
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [jwk, setJwk] = useState<JWKInterface | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const store = vault.active_tree_id ? vault.trees[vault.active_tree_id] ?? null : null;

  async function persist(nextStore: TreeStore) {
    const nextVault = putTree(vault, nextStore);
    await sealVault(keys, nextVault);
    onVaultChange(nextVault);
  }

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

  async function onCreateTree(e: FormEvent) {
    e.preventDefault();
    const tree = createTree(titleInput);
    await persist(tree);
    setViewCommitId(null);
  }

  async function onAddPerson(e: FormEvent) {
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
    await persist(upsertPersonFields(store, person));
    setForm({ name: "", born: "", died: "", parents: "", notes: "", mediaTx: "" });
  }

  async function onCommit() {
    if (!store || isHistorical) return;
    const next = commitDraft(store, commitMessage || "Фиксация версии");
    await persist(next);
    setViewCommitId(next.meta.head);
    setCommitMessage("");
  }

  async function ensureWallet() {
    if (jwk && address) return { jwk, address };
    setNotice("Генерируем детерминированный Arweave-ключ из 12 слов (один раз, ~10–40 сек)…");
    const { jwkFromSeed, addressFromJwk } = await import("../lib/arweave/wallet");
    const generated = await jwkFromSeed(keys.seed);
    const addr = await addressFromJwk(generated);
    setJwk(generated);
    setAddress(addr);
    setNotice(`Кошелёк готов: ${addr.slice(0, 10)}…`);
    return { jwk: generated, address: addr };
  }

  async function onExport() {
    setBusy(true);
    setNotice(null);
    try {
      const envelope = await sealVault(keys, vault);
      downloadEnvelope(envelope);
      setNotice("Envelope сохранён. Его можно открыть на другом устройстве вместе с 12 словами.");
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    setBusy(true);
    setNotice(null);
    try {
      const { jwk: wallet } = await ensureWallet();
      const envelope = await sealVault(keys, vault);
      const { getWalletBalanceAr, publishEnvelope } = await import("../lib/arweave/publish");
      const balance = await getWalletBalanceAr(wallet);
      setNotice(`Баланс ${balance} AR. Публикуем зашифрованный сейф…`);
      const result = await publishEnvelope(wallet, envelope);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setNotice(`Опубликовано в Arweave. TX: ${result.txId}. Сейф доступен из любой точки по 12 словам.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!store) {
    return (
      <div>
        <header className="topbar">
          <div className="brand">
            <span className="brand-glyph" aria-hidden />
            <strong>SEJIRE</strong>
            <span>vault {fingerprintVaultId(keys.vaultId)}</span>
          </div>
          <button className="btn ghost" type="button" onClick={onLock}>
            Заблокировать
          </button>
        </header>
        <section className="hero-create">
          <h1>Новое древо</h1>
          <p>Сейф открыт. Создайте первое семейное древо — каждое дополнение станет новой версией.</p>
          <form className="create-row" onSubmit={onCreateTree}>
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Название рода"
              required
            />
            <button className="btn" type="submit">
              Создать
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div>
      <header className="topbar">
        <div className="brand">
          <span className="brand-glyph" aria-hidden />
          <strong>SEJIRE</strong>
          <span>{store.meta.title}</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <div className="badge">
            <em />
            vault {fingerprintVaultId(keys.vaultId)} · HEAD v{Math.max(0, store.meta.next_version - 1)}
            {store.dirty ? " · черновик" : ""}
          </div>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => void onExport()}>
            Экспорт
          </button>
          <button className="btn" type="button" disabled={busy} onClick={() => void onPublish()}>
            В вечность (Arweave)
          </button>
          <button className="btn ghost" type="button" onClick={onLock}>
            Lock
          </button>
        </div>
      </header>

      {notice && <div className="banner">{notice}</div>}

      {isHistorical && viewing && (
        <div className="banner">
          <span>
            Просмотр v{viewing.version} — «{viewing.message}». Редактирование отключено.
          </span>
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              const next = { ...loadDraftFromCommit(store, viewCommitId!), dirty: true };
              void persist(next);
              setViewCommitId(null);
            }}
          >
            Взять как основу нового commit
          </button>
        </div>
      )}

      <div className="layout">
        <section className="panel">
          <h2>Древо</h2>
          <p className="sub">Данные шифруются на устройстве ключом из 12 слов. В сеть уходит только ciphertext.</p>

          {!isHistorical && (
            <>
              <form onSubmit={(e) => void onAddPerson(e)}>
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
                  <label className="full">
                    ID родителей
                    <input
                      value={form.parents}
                      onChange={(e) => setForm({ ...form, parents: e.target.value })}
                      placeholder="p_abc, p_def"
                    />
                  </label>
                  <label className="full">
                    Медиа TX (Arweave)
                    <input
                      value={form.mediaTx}
                      onChange={(e) => setForm({ ...form, mediaTx: e.target.value })}
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
                  placeholder="Сообщение коммита"
                />
                <button
                  className="btn"
                  type="button"
                  disabled={!store.dirty && people.length === 0}
                  onClick={() => void onCommit()}
                >
                  Зафиксировать версию
                </button>
              </div>
            </>
          )}

          <div className="people">
            {people.length === 0 && <p className="empty">Добавьте предка и зафиксируйте версию.</p>}
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
                  {!isHistorical && (
                    <button
                      className="btn ghost"
                      type="button"
                      style={{ padding: "0.2rem 0.45rem", fontSize: "0.75rem" }}
                      onClick={() => void persist(removeDraftPerson(store, p.id))}
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
          <p className="sub">Каждый commit — полное дерево. Удалить прошлое нельзя.</p>
          {history.length === 0 ? (
            <p className="empty">Коммитов ещё нет.</p>
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
              Diff к HEAD: <strong>+{diff.added.length}</strong> / <strong>~{diff.changed.length}</strong> /{" "}
              <strong>-{diff.removed.length}</strong>
            </div>
          )}
          {address && (
            <p className="sub" style={{ marginTop: "1rem" }}>
              Arweave: {address}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
