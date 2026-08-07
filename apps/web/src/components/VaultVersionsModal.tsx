import { useEffect, useState } from "react";
import {
  fetchVaultEnvelope,
  formatVersionWhen,
  listVaultVersions,
  type VaultVersionMeta,
} from "../lib/arweave/fetch";
import { deriveKeysFromMnemonic, fingerprintVaultId } from "../lib/crypto/keys";
import { openEnvelope, openLocalVault, type VaultV1 } from "../lib/crypto/vault";
import { isValidMnemonic, normalizeMnemonic } from "../lib/crypto/bip39";
import {
  getSessionMnemonic,
  getVaultSession,
  setVaultSession,
} from "../lib/vaultSession/session";
import { activePersons } from "../lib/treeEngine";

type Props = {
  onClose: () => void;
  onOpenVersion: (vault: VaultV1) => void;
};

export function VaultVersionsModal({ onClose, onOpenVersion }: Props) {
  const session = getVaultSession();
  const [versions, setVersions] = useState<VaultVersionMeta[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [phrase, setPhrase] = useState(getSessionMnemonic() ?? "");
  const [needPhrase, setNeedPhrase] = useState(!getSessionMnemonic());
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!session?.vaultId) {
      setBusy(false);
      setError("Сначала откройте или сохраните сейф по 12 словам.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setStatus(`Сейф ${fingerprintVaultId(session.vaultId)}…`);
        const list = await listVaultVersions(session.vaultId);
        if (!cancelled) {
          setVersions(list);
          if (list.length === 0) setError("В сети пока нет версий этого сейфа.");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) {
          setBusy(false);
          setStatus("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.vaultId]);

  async function openTx(txId: string) {
    if (!session?.vaultId) return;
    const raw = normalizeMnemonic(phrase);
    if (!isValidMnemonic(raw)) {
      setNeedPhrase(true);
      setError("Введите 12 слов, чтобы открыть версию.");
      return;
    }
    setOpeningId(txId);
    setError(null);
    try {
      const keys = deriveKeysFromMnemonic(raw);
      if (keys.vaultId !== session.vaultId) {
        throw new Error("Эти 12 слов относятся к другому сейфу.");
      }
      const remote = await fetchVaultEnvelope(session.vaultId, txId);
      if (!remote) throw new Error("Не удалось скачать эту версию.");
      const vault = await openEnvelope(keys, remote.envelope);
      setVaultSession(
        { vaultId: keys.vaultId, headTxId: txId, source: "network" },
        raw
      );
      onOpenVersion(vault);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /mismatch|decrypt|JSON/i.test(msg)
          ? "Не удалось открыть: проверьте 12 слов."
          : msg
      );
    } finally {
      setOpeningId(null);
    }
  }

  async function openLocal() {
    const raw = normalizeMnemonic(phrase);
    if (!isValidMnemonic(raw)) {
      setNeedPhrase(true);
      setError("Введите 12 слов.");
      return;
    }
    setOpeningId("local");
    setError(null);
    try {
      const keys = deriveKeysFromMnemonic(raw);
      const vault = await openLocalVault(keys);
      if (!vault) throw new Error("Локальной копии нет.");
      setVaultSession(
        { vaultId: keys.vaultId, headTxId: session?.headTxId ?? null, source: "local" },
        raw
      );
      onOpenVersion(vault);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal panel">
        <h2>Версии сейфа</h2>
        <p className="sub">
          Каждое сохранение в сеть — новая неизменяемая версия под теми же 12 словами. Старые
          остаются. Новая версия снова оплачивается.
        </p>
        {session?.vaultId && (
          <p className="sub mono publish-meta">
            Сейф {fingerprintVaultId(session.vaultId)}
            {session.headTxId ? ` · открыта ${session.headTxId.slice(0, 8)}…` : ""}
          </p>
        )}

        {(needPhrase || !getSessionMnemonic()) && (
          <label className="full">
            12 слов
            <textarea
              rows={2}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="word1 word2 … word12"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
        )}

        {busy && <p className="sub">{status || "Ищем версии…"}</p>}

        {!busy && versions.length > 0 && (
          <ul className="vault-version-list">
            {versions.map((v, i) => {
              const isHead = session?.headTxId === v.txId || (i === 0 && !session?.headTxId);
              const peopleHint = "";
              return (
                <li key={v.txId}>
                  <button
                    type="button"
                    className="vault-version-item"
                    disabled={openingId !== null}
                    onClick={() => void openTx(v.txId)}
                  >
                    <span className="vault-version-title">
                      {i === 0 ? "Последняя" : `Версия ${versions.length - i}`}
                      {isHead ? " · сейчас" : ""}
                      {openingId === v.txId ? "…" : ""}
                    </span>
                    <span className="vault-version-meta">
                      {formatVersionWhen(v)} · {v.txId.slice(0, 10)}…
                      {peopleHint}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!busy && (
          <div className="actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <button
              type="button"
              className="btn ghost"
              disabled={openingId !== null}
              onClick={() => void openLocal()}
            >
              Локальная копия в браузере
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              Закрыть
            </button>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}

/** Count people for display after decrypt — used by RestoreSeed picker. */
export function vaultPersonCount(vault: VaultV1): number {
  const treeId = vault.active_tree_id;
  const store = treeId ? vault.trees[treeId] : Object.values(vault.trees)[0];
  if (!store) return 0;
  return activePersons(store.draft).length;
}
