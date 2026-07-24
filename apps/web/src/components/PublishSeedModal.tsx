import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  createMnemonic,
  isValidMnemonic,
  normalizeMnemonic,
  splitWords,
} from "../lib/crypto/bip39";
import { deriveKeysFromMnemonic } from "../lib/crypto/keys";
import type { TreeStore } from "../lib/types";
import { emptyVault, putTree, sealVault, downloadEnvelope } from "../lib/crypto/vault";

type Props = {
  store: TreeStore;
  onClose: () => void;
  onPublished: (info: { txId?: string; mode: "export" | "arweave" }) => void;
};

export function PublishSeedModal({ store, onClose, onPublished }: Props) {
  const [mode, setMode] = useState<"intro" | "create-show" | "create-confirm" | "existing" | "busy">(
    "intro"
  );
  const [mnemonic, setMnemonic] = useState("");
  const [confirm, setConfirm] = useState("");
  const [existing, setExisting] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const words = useMemo(() => (mnemonic ? splitWords(mnemonic) : []), [mnemonic]);

  async function runPublish(phrase: string, preferArweave: boolean) {
    setMode("busy");
    setError(null);
    try {
      const keys = deriveKeysFromMnemonic(phrase);
      let vault = emptyVault(keys.vaultId);
      vault = putTree(vault, store);
      setStatus("Шифруем сейф ключом из 12 слов…");
      const envelope = await sealVault(keys, vault);

      if (!preferArweave) {
        downloadEnvelope(envelope);
        onPublished({ mode: "export" });
        return;
      }

      setStatus("Готовим Arweave-ключ из фразы (10–40 сек)…");
      const { jwkFromSeed } = await import("../lib/arweave/wallet");
      const { publishEnvelope, getWalletBalanceAr } = await import("../lib/arweave/publish");
      const jwk = await jwkFromSeed(keys.seed);
      const balance = await getWalletBalanceAr(jwk);
      setStatus(`Баланс ${balance} AR. Отправляем в Arweave…`);
      const result = await publishEnvelope(jwk, envelope);
      if (!result.ok) {
        downloadEnvelope(envelope);
        setError(`${result.error} Зашифрованный файл всё же скачан.`);
        setMode("intro");
        return;
      }
      onPublished({ mode: "arweave", txId: result.txId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMode("intro");
    }
  }

  function startCreate() {
    setMnemonic(createMnemonic());
    setConfirm("");
    setError(null);
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
    await runPublish(phrase, true);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal panel">
        <h2>Отправка древа в Arweave</h2>
        <p className="sub">
          Древо уже собрано. Теперь нужны <strong>12 слов</strong> — ими шифруется сейф. Без фразы
          опубликованные данные не прочитать.
        </p>

        {mode === "intro" && (
          <div className="actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <button className="btn" type="button" onClick={startCreate}>
              Создать 12 слов и продолжить
            </button>
            <button className="btn ghost" type="button" onClick={() => setMode("existing")}>
              У меня уже есть 12 слов
            </button>
            <button className="btn ghost" type="button" onClick={onClose}>
              Отмена — вернуться к древу
            </button>
          </div>
        )}

        {mode === "create-show" && (
          <div>
            <p className="sub">Запишите фразу на бумаге. Это единственный ключ к вечному сейфу.</p>
            <ol className="seed-grid">
              {words.map((w, i) => (
                <li key={`${w}-${i}`}>
                  <span>{i + 1}.</span> {w}
                </li>
              ))}
            </ol>
            <div className="actions">
              <button className="btn ghost" type="button" onClick={() => setMode("intro")}>
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
              <button className="btn ghost" type="button" onClick={() => void runPublish(mnemonic, false)}>
                Только файл
              </button>
              <button className="btn" type="submit">
                В Arweave
              </button>
            </div>
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

        {mode === "busy" && <p className="sub">{status || "Работаем…"}</p>}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
