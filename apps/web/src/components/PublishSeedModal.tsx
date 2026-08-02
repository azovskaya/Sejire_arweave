import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  createMnemonic,
  isValidMnemonic,
  normalizeMnemonic,
  splitWords,
} from "../lib/crypto/bip39";
import { deriveKeysFromMnemonic, fingerprintVaultId } from "../lib/crypto/keys";
import type { TreeStore } from "../lib/types";
import {
  downloadEnvelope,
  emptyVault,
  openEnvelope,
  openLocalVault,
  putTree,
  sealVault,
  type VaultV1,
} from "../lib/crypto/vault";
import { fetchLatestEnvelope } from "../lib/arweave/fetch";

type Props = {
  store: TreeStore;
  onClose: () => void;
  onPublished: (info: { txId?: string; mode: "export" | "arweave"; address?: string }) => void;
};

type Mode = "intro" | "create-show" | "create-confirm" | "existing" | "busy" | "fund-wait";

async function loadVault(keys: ReturnType<typeof deriveKeysFromMnemonic>): Promise<VaultV1> {
  const local = await openLocalVault(keys);
  if (local) return local;
  try {
    const remote = await fetchLatestEnvelope(keys.vaultId);
    if (remote) return await openEnvelope(keys, remote.envelope);
  } catch {
    // offline / GraphQL unavailable — start fresh vault
  }
  return emptyVault(keys.vaultId);
}

function confirmDiscardSeed() {
  return window.confirm(
    "Сгенерированные 12 слов будут потеряны с экрана. Вы уже записали их на бумагу?"
  );
}

export function PublishSeedModal({ store, onClose, onPublished }: Props) {
  const [mode, setMode] = useState<Mode>("intro");
  const [mnemonic, setMnemonic] = useState("");
  const [confirm, setConfirm] = useState("");
  const [existing, setExisting] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const words = useMemo(() => (mnemonic ? splitWords(mnemonic) : []), [mnemonic]);

  const seedLocked = mode === "create-show" || mode === "create-confirm" || mode === "busy" || mode === "fund-wait";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (mode === "busy") {
        e.preventDefault();
        return;
      }
      if (mode === "create-show" || mode === "create-confirm" || mode === "fund-wait") {
        e.preventDefault();
        if (!confirmDiscardSeed()) return;
        setMode("intro");
        setMnemonic("");
        setConfirm("");
        setError(null);
        setWalletAddress(null);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  async function runPublish(phrase: string, preferArweave: boolean) {
    setMode("busy");
    setError(null);
    if (!preferArweave) setWalletAddress(null);
    try {
      const keys = deriveKeysFromMnemonic(phrase);
      setStatus(`Сейф ${fingerprintVaultId(keys.vaultId)}…`);
      let vault = await loadVault(keys);
      vault = putTree(vault, store);
      setStatus("Шифруем сейф ключом из 12 слов…");
      const envelope = await sealVault(keys, vault);

      if (!preferArweave) {
        downloadEnvelope(envelope);
        onPublished({ mode: "export" });
        return;
      }

      setStatus("Из 12 слов создаём адрес Arweave (без стороннего кошелька, 10–40 сек)…");
      const { jwkFromSeed, addressFromJwk } = await import("../lib/arweave/wallet");
      const { publishEnvelope, getWalletBalanceAr } = await import("../lib/arweave/publish");
      const jwk = await jwkFromSeed(keys.seed);
      const address = await addressFromJwk(jwk);
      setWalletAddress(address);
      const balance = await getWalletBalanceAr(jwk);
      setStatus(`Адрес из фразы ${address.slice(0, 8)}… · баланс ${balance} AR. Отправляем…`);
      const result = await publishEnvelope(jwk, envelope);
      if (!result.ok) {
        downloadEnvelope(envelope);
        const fundHint = result.needsFunds
          ? " Переведите немного AR на адрес ниже (из ваших 12 слов). Отдельный кошелёк не нужен."
          : "";
        setError(`${result.error}${fundHint} Зашифрованный файл скачан как запасной вариант.`);
        setMnemonic(phrase);
        setMode(result.needsFunds ? "fund-wait" : "intro");
        return;
      }
      onPublished({ mode: "arweave", txId: result.txId, address });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMode(mnemonic ? "fund-wait" : "intro");
    }
  }

  function startCreate() {
    if (mnemonic && !confirmDiscardSeed()) return;
    setMnemonic(createMnemonic());
    setConfirm("");
    setError(null);
    setWalletAddress(null);
    setMode("create-show");
  }

  async function onConfirmCreate(e: FormEvent) {
    e.preventDefault();
    if (normalizeMnemonic(confirm) !== normalizeMnemonic(mnemonic)) {
      setError("Фраза не совпадает.");
      return;
    }
    await runPublish(mnemonic, true);
  }

  async function onExisting(e: FormEvent) {
    e.preventDefault();
    const phrase = normalizeMnemonic(existing);
    if (!isValidMnemonic(phrase)) {
      setError("Нужна корректная BIP-39 фраза из 12 слов.");
      return;
    }
    setMnemonic(phrase);
    await runPublish(phrase, true);
  }

  async function exportFileOnly() {
    if (normalizeMnemonic(confirm) !== normalizeMnemonic(mnemonic)) {
      setError("Сначала повторите 12 слов — так мы убедимся, что вы их записали.");
      return;
    }
    await runPublish(mnemonic, false);
  }

  async function copyAddress() {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setStatus("Адрес скопирован");
    } catch {
      setStatus("Скопируйте адрес вручную");
    }
  }

  function requestClose() {
    if (mode === "busy") return;
    if (seedLocked && mnemonic) {
      if (!confirmDiscardSeed()) return;
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal panel">
        <h2>Сохранить</h2>
        <p className="sub">
          <strong>12 слов</strong> — ваш ключ. Без них дерево потом не открыть. Запишите на бумагу.
        </p>

        {mode === "intro" && (
          <div className="actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <button className="btn" type="button" onClick={startCreate}>
              Создать 12 слов
            </button>
            <button className="btn ghost" type="button" onClick={() => setMode("existing")}>
              У меня уже есть слова
            </button>
            <button className="btn ghost" type="button" onClick={requestClose}>
              Отмена
            </button>
          </div>
        )}

        {mode === "create-show" && (
          <div>
            <p className="sub">
              Запишите эти слова на бумаге <strong>сейчас</strong>.
            </p>
            <ol className="seed-grid">
              {words.map((w, i) => (
                <li key={`${w}-${i}`}>
                  <span>{i + 1}.</span> {w}
                </li>
              ))}
            </ol>
            <div className="actions">
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  if (!confirmDiscardSeed()) return;
                  setMnemonic("");
                  setMode("intro");
                }}
              >
                Назад
              </button>
              <button className="btn" type="button" onClick={() => setMode("create-confirm")}>
                Я записал(а)
              </button>
            </div>
          </div>
        )}

        {mode === "create-confirm" && (
          <form onSubmit={(e) => void onConfirmCreate(e)}>
            <p className="sub">Повторите 12 слов.</p>
            <textarea rows={3} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            <div className="actions">
              <button className="btn ghost" type="button" onClick={() => setMode("create-show")}>
                Назад
              </button>
              <button className="btn" type="submit">
                Сохранить
              </button>
            </div>
            <button
              className="welcome-link-quiet"
              type="button"
              style={{ marginTop: "0.75rem", width: "100%", textAlign: "center" }}
              onClick={() => void exportFileOnly()}
            >
              Только скачать файл (без сети)
            </button>
          </form>
        )}

        {mode === "existing" && (
          <form onSubmit={(e) => void onExisting(e)}>
            <textarea
              rows={3}
              value={existing}
              onChange={(e) => setExisting(e.target.value)}
              placeholder="word1 word2 … word12"
              required
            />
            <div className="actions">
              <button className="btn ghost" type="button" onClick={() => setMode("intro")}>
                Назад
              </button>
              <button className="btn" type="submit">
                Зашифровать и отправить
              </button>
            </div>
          </form>
        )}

        {mode === "busy" && (
          <div>
            <p className="sub">{status || "Работаем… Не закрывайте окно."}</p>
            {walletAddress && (
              <p className="sub mono publish-meta">Адрес из 12 слов: {walletAddress}</p>
            )}
          </div>
        )}

        {mode === "fund-wait" && (
          <div>
            <p className="sub">
              Те же 12 слов сохранены в этом окне. Пополните адрес и нажмите «Повторить отправку» —
              не создавайте новую фразу.
            </p>
            {words.length > 0 && (
              <ol className="seed-grid">
                {words.map((w, i) => (
                  <li key={`${w}-${i}`}>
                    <span>{i + 1}.</span> {w}
                  </li>
                ))}
              </ol>
            )}
            {walletAddress && (
              <p className="sub mono publish-meta">Адрес: {walletAddress}</p>
            )}
            <div className="actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <button className="btn" type="button" onClick={() => void runPublish(mnemonic, true)}>
                Повторить отправку
              </button>
              <button className="btn ghost" type="button" onClick={() => void copyAddress()}>
                Скопировать адрес
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  if (!confirmDiscardSeed()) return;
                  setMnemonic("");
                  setConfirm("");
                  setWalletAddress(null);
                  setError(null);
                  setMode("intro");
                }}
              >
                В начало (новые 12 слов — только если уверены)
              </button>
            </div>
            {status && <p className="sub">{status}</p>}
          </div>
        )}

        {error && (
          <div className="form-error-block">
            <p className="form-error">{error}</p>
            {walletAddress && mode !== "fund-wait" && (
              <p className="sub mono publish-meta">Адрес из ваших 12 слов: {walletAddress}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
