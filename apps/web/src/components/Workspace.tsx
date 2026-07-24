import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { JWKInterface } from "arweave/web/lib/wallet";
import type { Person, TreeStore } from "../lib/types";
import type { SejireKeys } from "../lib/crypto/keys";
import { fingerprintVaultId } from "../lib/crypto/keys";
import type { VaultV1 } from "../lib/crypto/vault";
import { downloadEnvelope, putTree, sealVault } from "../lib/crypto/vault";
import { relationshipLabel } from "../lib/kinship";
import { TreeCanvas } from "./TreeCanvas";
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
    parentIds: [] as string[],
    notes: "",
    mediaTx: "",
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [jwk, setJwk] = useState<JWKInterface | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kinA, setKinA] = useState("");
  const [kinB, setKinB] = useState("");

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
  const draftPeople = store ? activePersons(store.draft) : [];
  const diff = useMemo(() => {
    if (!store || !viewing || !head) return null;
    if (viewing.commit_id === head.commit_id) return null;
    return diffPersonIds(viewing.snapshot, head.snapshot);
  }, [store, viewing, head]);

  const kinLabel =
    visibleSnapshot && kinA && kinB ? relationshipLabel(visibleSnapshot, kinA, kinB) : null;

  async function onCreateTree(e: FormEvent) {
    e.preventDefault();
    const tree = createTree(titleInput);
    await persist(tree);
    setViewCommitId(null);
  }

  function toggleParent(id: string) {
    setForm((prev) => {
      const has = prev.parentIds.includes(id);
      return {
        ...prev,
        parentIds: has ? prev.parentIds.filter((x) => x !== id) : [...prev.parentIds, id],
      };
    });
  }

  async function onAddPerson(e: FormEvent) {
    e.preventDefault();
    if (!store || isHistorical) return;
    const name = form.name.trim();
    if (!name) return;
    const media = form.mediaTx.trim()
      ? [{ tx: form.mediaTx.trim(), kind: "image" as const, caption: "Архив" }]
      : [];
    const person: Person = {
      id: uid(),
      name,
      born: form.born || null,
      died: form.died || null,
      parents: form.parentIds,
      media,
      notes: form.notes,
      tombstone: false,
    };
    await persist(upsertPersonFields(store, person));
    setForm({ name: "", born: "", died: "", parentIds: [], notes: "", mediaTx: "" });
    setSelectedId(person.id);
  }

  async function onCommit() {
    if (!store || isHistorical) return;
    const next = commitDraft(store, commitMessage || "Фиксация версии");
    await persist(next);
    setViewCommitId(next.meta.head);
    setCommitMessage("");
    setNotice(`Версия v${next.meta.next_version - 1} зафиксирована. Прошлое сохранено.`);
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
      setNotice("Файл сейфа скачан. На другом устройстве: 12 слов + этот файл.");
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
      setNotice(`В вечности: https://arweave.net/${result.txId} — откроется по 12 словам с любого устройства.`);
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
          <p>Сейф открыт по 12 словам. Создайте род — каждое дополнение станет новой вечной версией.</p>
          <form className="create-row" onSubmit={(e) => void onCreateTree(e)}>
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Название рода"
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
            {fingerprintVaultId(keys.vaultId)} · v{Math.max(0, store.meta.next_version - 1)}
            {store.dirty ? " · черновик" : ""}
          </div>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => void onExport()}>
            Экспорт
          </button>
          <button className="btn" type="button" disabled={busy} onClick={() => void onPublish()}>
            В вечность
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
          <h2>Схема рода</h2>
          <p className="sub">Нажмите на человека, чтобы выделить. Связи — по родителям.</p>
          {visibleSnapshot && (
            <TreeCanvas
              snapshot={visibleSnapshot}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}

          <h2 style={{ marginTop: "1.25rem" }}>Добавить человека</h2>
          {!isHistorical ? (
            <>
              <form onSubmit={(e) => void onAddPerson(e)}>
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
                    <legend>Родители (отметьте из уже добавленных)</legend>
                    {draftPeople.length === 0 && (
                      <p className="empty">Пока никого нет — сначала добавьте старших.</p>
                    )}
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
                  <label className="full">
                    Медиа TX (Arweave, опционально)
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
                  placeholder="Что изменилось в этой версии?"
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
          ) : (
            <p className="empty">Вернитесь к HEAD, чтобы редактировать.</p>
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
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
                <div className="meta">
                  <span className="chip">id: {p.id}</span>
                  {p.parents.map((pid) => {
                    const parent = people.find((x) => x.id === pid) ?? draftPeople.find((x) => x.id === pid);
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
                        void persist(removeDraftPerson(store, p.id));
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
          <p className="sub">Каждое дополнение = новый commit. Удалить прошлое нельзя.</p>
          {history.length === 0 ? (
            <p className="empty">Зафиксируйте первую версию.</p>
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

          <h2 style={{ marginTop: "1.4rem" }}>Родство</h2>
          <p className="sub">Кто кому приходится в текущем снимке.</p>
          <div className="form-grid">
            <label>
              Человек A
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
              Человек B
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
