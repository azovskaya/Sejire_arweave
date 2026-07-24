import { useMemo, useState } from "react";
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

export function PublishSeedModal({ store, onClose, onPublished }: Props) {
  const [mode, setMode] = useState<"intro" | "create-show" | "create-confirm" | "existing" | "busy">(
    "intro"
  );
  const [mnemonic, setMnemonic] = useState("");
  const [confirm, setConfirm] = useState("");
  const [existing, setExisting] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const words = useMemo(() => (mnemonic ? splitWords(mnemonic) : []), [mnemonic]);

  async function runPublish(phrase: string, preferArweave: boolean) {
    setMode("busy");
    setError(null);
    setTxId(null);
    setWalletAddress(null);
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
          ? ` Переведите немного AR на адрес, который получился из ваших 12 слов (ниже). Отдельный кошелёк подключать не нужно.`
          : "";
        setError(`${result.error}${fundHint} Зашифрованный файл скачан как запасной вариант.`);
        setMode("intro");
        return;
      }
      setTxId(result.txId);
      onPublished({ mode: "arweave", txId: result.txId, address });
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
        <h2>Сохранить в Arweave</h2>
        <p className="sub">
          Отдельный кошелёк (ArConnect и т.п.) <strong>не нужен</strong>. Достаточно{" "}
          <strong>12 слов</strong>: ими шифруется сейф и из них же получается адрес в Arweave для
          оплаты одной записи. Без фразы данные не прочитать; на этом адресе должен быть небольшой
          баланс AR.
        </p>

        {mode === "intro" && (
          <div className="actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <button className="btn" type="button" onClick={startCreate}>
              Создать 12 слов и отправить
            </button>
            <button className="btn ghost" type="button" onClick={() => setMode("existing")}>
              У меня уже есть 12 слов
            </button>
            <button className="btn ghost" type="button" onClick={onClose}>
              Отмена
            </button>
          </div>
        )}

        {mode === "create-show" && (
          <div>
            <p className="sub">
              Запишите фразу на бумаге. Это и ключ шифрования, и доступ к адресу Arweave — сторонний
              кошелёк не подключается.
            </p>
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

        {mode === "busy" && (
          <div>
            <p className="sub">{status || "Работаем…"}</p>
            {walletAddress && (
              <p className="sub mono publish-meta">
                Адрес из 12 слов: {walletAddress}
              </p>
            )}
            {txId && (
              <p className="sub">
                TX:{" "}
                <a href={`https://viewblock.io/arweave/tx/${txId}`} target="_blank" rel="noreferrer">
                  {txId.slice(0, 12)}…
                </a>
              </p>
            )}
          </div>
        )}
        {error && (
          <div className="form-error-block">
            <p className="form-error">{error}</p>
            {walletAddress && (
              <p className="sub mono publish-meta">Адрес из ваших 12 слов: {walletAddress}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
