import { useState } from "react";
import type { FormEvent } from "react";
import { isValidMnemonic, normalizeMnemonic } from "../lib/crypto/bip39";
import { deriveKeysFromMnemonic, fingerprintVaultId } from "../lib/crypto/keys";
import type { EnvelopeV1 } from "../lib/crypto/encrypt";
import { parseSeedBackup } from "../lib/crypto/seedBackup";
import { openEnvelope, openLocalVault, type VaultV1 } from "../lib/crypto/vault";
import {
  fetchVaultEnvelope,
  formatVersionWhen,
  listVaultVersions,
  type VaultVersionMeta,
} from "../lib/arweave/fetch";
import { saveDraftTree, loadDraftTree } from "../lib/draftStorage";
import { defaultGuide, saveGuide } from "../lib/guide";
import { pickHomeFocus } from "../lib/pedigree";
import { activePersons } from "../lib/treeEngine";
import { setVaultSession } from "../lib/vaultSession/session";
import {
  getLocalVaultVersion,
  listLocalVaultVersions,
  type LocalVaultVersion,
} from "../lib/vaultSession/localArchive";

type Props = {
  onRestored: () => void;
  onBack: () => void;
};

type PickerItem =
  | { kind: "network"; meta: VaultVersionMeta; index: number }
  | { kind: "archive"; entry: LocalVaultVersion }
  | { kind: "local" };

function formatArchiveWhen(iso: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return "время неизвестно";
  return new Date(d).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RestoreSeed({ onRestored, onBack }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [showFile, setShowFile] = useState(false);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerItem[] | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  async function finishWithVault(
    vault: VaultV1,
    opts: { vaultId: string; headTxId: string | null; mnemonic: string; source: "network" | "local" | "file" }
  ) {
    const treeId = vault.active_tree_id;
    const store = treeId ? vault.trees[treeId] : Object.values(vault.trees)[0];
    if (!store) throw new Error("В сейфе нет деревьев");
    const existing = loadDraftTree();
    if (existing && activePersons(existing.draft).length > 0) {
      const ok = window.confirm(
        "Текущий черновик в браузере будет заменён восстановленным деревом. Продолжить?"
      );
      if (!ok) return;
    }
    const selfId = pickHomeFocus(store.draft, null);
    saveDraftTree(store);
    saveGuide({ ...defaultGuide(), step: "done", selfId });
    setVaultSession(
      { vaultId: opts.vaultId, headTxId: opts.headTxId, source: opts.source },
      opts.mnemonic
    );
    onRestored();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeMnemonic(input);
    if (!isValidMnemonic(normalized)) {
      setError("Нужны 12 корректных английских слов.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const keys = deriveKeysFromMnemonic(normalized);
      setPhrase(normalized);
      setVaultId(keys.vaultId);
      setStatus(`Ищем версии (${fingerprintVaultId(keys.vaultId)})…`);

      let versions: VaultVersionMeta[] = [];
      try {
        versions = await listVaultVersions(keys.vaultId);
      } catch {
        versions = [];
      }
      const archive = listLocalVaultVersions(keys.vaultId);
      const networkIds = new Set(versions.map((v) => v.txId));
      const archiveOnly = archive.filter((a) => !networkIds.has(a.id));
      const local = await openLocalVault(keys);
      const items: PickerItem[] = [
        ...versions.map((meta, index) => ({ kind: "network" as const, meta, index })),
        ...archiveOnly.map((entry) => ({ kind: "archive" as const, entry })),
        ...(local ? [{ kind: "local" as const }] : []),
      ];

      if (items.length === 0) {
        throw new Error("Сейф не найден ни в сети, ни в этом браузере.");
      }

      if (items.length === 1) {
        await openPickerItem(items[0], normalized, keys.vaultId);
        return;
      }

      setPicker(items);
      setStatus("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        /mismatch|decrypt|JSON/i.test(msg)
          ? "Не удалось открыть: проверьте 12 слов или файл."
          : msg
      );
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function openPickerItem(
    item: PickerItem,
    phraseOverride?: string,
    vaultOverride?: string
  ) {
    const usePhrase = phraseOverride ?? phrase;
    const useVaultId = vaultOverride ?? vaultId;
    if (!usePhrase || !useVaultId) return;
    const id =
      item.kind === "local" ? "local" : item.kind === "network" ? item.meta.txId : item.entry.id;
    setOpeningId(id);
    setError(null);
    try {
      const keys = deriveKeysFromMnemonic(usePhrase);
      if (item.kind === "local") {
        const local = await openLocalVault(keys);
        if (!local) throw new Error("Локальной копии нет");
        await finishWithVault(local, {
          vaultId: useVaultId,
          headTxId: null,
          mnemonic: usePhrase,
          source: "local",
        });
        return;
      }
      if (item.kind === "archive") {
        const vault = await openEnvelope(keys, item.entry.envelope);
        await finishWithVault(vault, {
          vaultId: useVaultId,
          headTxId: item.entry.id,
          mnemonic: usePhrase,
          source: "local",
        });
        return;
      }
      let vault: VaultV1 | null = null;
      const remote = await fetchVaultEnvelope(useVaultId, item.meta.txId);
      if (remote) vault = await openEnvelope(keys, remote.envelope);
      if (!vault) {
        const archived = getLocalVaultVersion(useVaultId, item.meta.txId);
        if (!archived) throw new Error("Не удалось скачать версию");
        vault = await openEnvelope(keys, archived.envelope);
      }
      await finishWithVault(vault, {
        vaultId: useVaultId,
        headTxId: item.meta.txId,
        mnemonic: usePhrase,
        source: "network",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        /mismatch|decrypt|JSON/i.test(msg)
          ? "Не удалось открыть: проверьте 12 слов или файл."
          : msg
      );
    } finally {
      setOpeningId(null);
    }
  }

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      const fromSeed = parseSeedBackup(raw);
      if (fromSeed) {
        setInput(fromSeed);
        setStatus("12 слов загружены из sejire/seed/v1 — нажмите «Открыть»");
        return;
      }
      if (raw.schema !== "sejire/envelope/v1") {
        setError("Нужен файл sejire/seed/v1 (12 слов) или sejire/envelope/v1 (сейф).");
        return;
      }
      const normalized = normalizeMnemonic(input);
      if (!isValidMnemonic(normalized)) {
        setError("Для сейфа сначала введите 12 слов (или загрузите seed JSON).");
        return;
      }
      const keys = deriveKeysFromMnemonic(normalized);
      const vault = await openEnvelope(keys, raw as EnvelopeV1);
      await finishWithVault(vault, {
        vaultId: keys.vaultId,
        headTxId: null,
        mnemonic: normalized,
        source: "file",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        /mismatch|decrypt|JSON/i.test(msg)
          ? "Не удалось открыть: проверьте 12 слов или файл."
          : msg
      );
    } finally {
      setBusy(false);
    }
  }

  if (picker && phrase && vaultId) {
    const networkCount = picker.filter((p) => p.kind === "network").length;
    return (
      <section className="hero-create" style={{ maxWidth: 480, margin: "0 auto" }}>
        <button type="button" className="welcome-menu-brand" onClick={onBack}>
          SEJIRE
        </button>
        <div className="panel" style={{ textAlign: "left", width: "100%" }}>
          <h2>Выберите версию</h2>
          <p className="sub">
            Сейф {fingerprintVaultId(vaultId)}: найдено несколько сохранений. Можно открыть любое.
          </p>
          <ul className="vault-version-list">
            {picker.map((item, i) => {
              if (item.kind === "local") {
                return (
                  <li key="local">
                    <button
                      type="button"
                      className="vault-version-item"
                      disabled={openingId !== null}
                      onClick={() => void openPickerItem(item)}
                    >
                      <span className="vault-version-title">
                        Текущая локальная копия{openingId === "local" ? "…" : ""}
                      </span>
                      <span className="vault-version-meta">в этом браузере</span>
                    </button>
                  </li>
                );
              }
              if (item.kind === "archive") {
                return (
                  <li key={item.entry.id}>
                    <button
                      type="button"
                      className="vault-version-item"
                      disabled={openingId !== null}
                      onClick={() => void openPickerItem(item)}
                    >
                      <span className="vault-version-title">
                        {item.entry.source === "demo" ? "Демо-версия" : "Версия в браузере"}
                        {openingId === item.entry.id ? "…" : ""}
                      </span>
                      <span className="vault-version-meta">
                        {formatArchiveWhen(item.entry.savedAt)} · {item.entry.id.slice(0, 10)}…
                      </span>
                    </button>
                  </li>
                );
              }
              const n = networkCount - item.index;
              return (
                <li key={item.meta.txId}>
                  <button
                    type="button"
                    className="vault-version-item"
                    disabled={openingId !== null}
                    onClick={() => void openPickerItem(item)}
                  >
                    <span className="vault-version-title">
                      {item.index === 0 ? "Последняя в сети" : `Сеть · версия ${n}`}
                      {openingId === item.meta.txId ? "…" : ""}
                    </span>
                    <span className="vault-version-meta">
                      {formatVersionWhen(item.meta)} · {item.meta.txId.slice(0, 10)}…
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setPicker(null);
                setPhrase(null);
                setVaultId(null);
              }}
            >
              Назад
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="hero-create" style={{ maxWidth: 480, margin: "0 auto" }}>
      <button type="button" className="welcome-menu-brand" onClick={onBack}>
        SEJIRE
      </button>
      <form className="panel" style={{ textAlign: "left", width: "100%" }} onSubmit={(e) => void onSubmit(e)}>
        <h2>Открыть по словам</h2>
        <p className="sub">
          Введите 12 слов. Если сейф сохраняли несколько раз — увидите все версии и выберете нужную.
        </p>
        <textarea
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="word1 word2 … word12"
          required
        />
        <div className="actions">
          <button className="btn ghost" type="button" onClick={onBack}>
            Назад
          </button>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? status || "Ищем…" : "Открыть"}
          </button>
        </div>
        <button
          type="button"
          className="welcome-link-quiet"
          style={{ marginTop: "0.85rem" }}
          onClick={() => setShowFile((v) => !v)}
        >
          {showFile ? "Скрыть файл" : "Открыть из файла"}
        </button>
        {showFile ? (
          <label className="full" style={{ marginTop: "0.55rem" }}>
            JSON: 12 слов (seed) или сейф (envelope)
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
        ) : null}
        {status && !busy && <p className="sub">{status}</p>}
        {error && <p className="form-error">{error}</p>}
      </form>
    </section>
  );
}
