import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  createMnemonic,
  isValidMnemonic,
  normalizeMnemonic,
  splitWords,
} from "../lib/crypto/bip39";
import { deriveKeysFromMnemonic, fingerprintVaultId } from "../lib/crypto/keys";
import { downloadSeedBackup } from "../lib/crypto/seedBackup";
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
import type { EnvelopeV1 } from "../lib/crypto/encrypt";
import { fetchLatestEnvelope } from "../lib/arweave/fetch";
import { isSponsorPublishEnabled } from "../lib/sponsor/config";
import {
  sponsorCheckout,
  sponsorHealth,
  sponsorMockPay,
  sponsorPublish,
  type CheckoutResponse,
} from "../lib/sponsor/client";

type Props = {
  store: TreeStore;
  onClose: () => void;
  onPublished: (info: {
    txId?: string;
    mode: "export" | "arweave" | "sponsor";
    address?: string;
    mock?: boolean;
  }) => void;
};

type Mode =
  | "intro"
  | "create-show"
  | "create-confirm"
  | "create-ready"
  | "existing"
  | "busy"
  | "fund-wait"
  | "pay";

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

function formatPrice(amountMinor: number, currency: string): string {
  const cur = currency.toUpperCase();
  if (cur === "KZT" || cur === "₸") return `${amountMinor} ₸`;
  if (cur === "USD") return `$${(amountMinor / 100).toFixed(2)}`;
  return `${amountMinor} ${cur}`;
}

export function PublishSeedModal({ store, onClose, onPublished }: Props) {
  const sponsorOn = isSponsorPublishEnabled();
  const [mode, setMode] = useState<Mode>("intro");
  const [mnemonic, setMnemonic] = useState("");
  const [confirm, setConfirm] = useState("");
  const [existing, setExisting] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [seedFileSaved, setSeedFileSaved] = useState(false);
  const [sealedEnvelope, setSealedEnvelope] = useState<EnvelopeV1 | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [priceHint, setPriceHint] = useState<string | null>(null);
  const words = useMemo(() => (mnemonic ? splitWords(mnemonic) : []), [mnemonic]);

  const seedLocked =
    mode === "create-show" ||
    mode === "create-confirm" ||
    mode === "create-ready" ||
    mode === "busy" ||
    mode === "fund-wait" ||
    mode === "pay";

  useEffect(() => {
    if (!sponsorOn) return;
    void sponsorHealth()
      .then((h) => {
        if (h.priceMinor != null && h.currency) {
          setPriceHint(formatPrice(h.priceMinor, h.currency));
        }
      })
      .catch(() => {
        setPriceHint(null);
      });
  }, [sponsorOn]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (mode === "busy") {
        e.preventDefault();
        return;
      }
      if (
        mode === "create-show" ||
        mode === "create-confirm" ||
        mode === "create-ready" ||
        mode === "fund-wait" ||
        mode === "pay"
      ) {
        e.preventDefault();
        if (!confirmDiscardSeed()) return;
        setMode("intro");
        setMnemonic("");
        setConfirm("");
        setError(null);
        setWalletAddress(null);
        setSeedFileSaved(false);
        setSealedEnvelope(null);
        setCheckout(null);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  async function sealForPhrase(phrase: string): Promise<{
    keys: ReturnType<typeof deriveKeysFromMnemonic>;
    envelope: EnvelopeV1;
  }> {
    const keys = deriveKeysFromMnemonic(phrase);
    setStatus(`Сейф ${fingerprintVaultId(keys.vaultId)}…`);
    let vault = await loadVault(keys);
    vault = putTree(vault, store);
    setStatus("Шифруем сейф ключом из 12 слов…");
    const envelope = await sealVault(keys, vault);
    return { keys, envelope };
  }

  async function runSelfFundPublish(phrase: string) {
    setMode("busy");
    setError(null);
    setWalletAddress(null);
    try {
      const { keys, envelope } = await sealForPhrase(phrase);
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
          ? " Переведите AR на адрес ниже, затем нажмите «Отправить»."
          : "";
        setError(`${result.error}${fundHint}`);
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

  async function runLocalExport(phrase: string) {
    setMode("busy");
    setError(null);
    setWalletAddress(null);
    try {
      const { envelope } = await sealForPhrase(phrase);
      downloadEnvelope(envelope);
      onPublished({ mode: "export" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMode("intro");
    }
  }

  /** Seal → checkout → pay screen (Kaspi or mock). */
  async function startSponsorFlow(phrase: string) {
    setMode("busy");
    setError(null);
    setWalletAddress(null);
    setCheckout(null);
    setSealedEnvelope(null);
    try {
      const { envelope } = await sealForPhrase(phrase);
      setSealedEnvelope(envelope);
      setStatus("Создаём сессию оплаты…");
      const session = await sponsorCheckout({
        successUrl: typeof window !== "undefined" ? window.location.href : undefined,
        cancelUrl: typeof window !== "undefined" ? window.location.href : undefined,
      });
      setCheckout(session);
      setMnemonic(phrase);
      setMode("pay");
      setStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMode("create-ready");
    }
  }

  async function confirmPaidAndPublish() {
    if (!checkout || !sealedEnvelope) {
      setError("Нет сессии оплаты или шифра.");
      return;
    }
    setMode("busy");
    setError(null);
    try {
      if (checkout.mockPayable) {
        setStatus("Подтверждаем mock-оплату…");
        await sponsorMockPay(checkout.sessionId);
      } else if (checkout.payUrl) {
        setStatus("Проверяем оплату у кассира…");
      }
      setStatus("Отправляем только шифр в сеть…");
      const result = await sponsorPublish(checkout.sessionId, sealedEnvelope);
      onPublished({
        mode: "sponsor",
        txId: result.txId,
        mock: result.mock,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMode("pay");
    }
  }

  function startCreate() {
    if (mnemonic && !confirmDiscardSeed()) return;
    setMnemonic(createMnemonic());
    setConfirm("");
    setError(null);
    setWalletAddress(null);
    setSeedFileSaved(false);
    setSealedEnvelope(null);
    setCheckout(null);
    setMode("create-show");
  }

  function onConfirmCreate(e: FormEvent) {
    e.preventDefault();
    if (normalizeMnemonic(confirm) !== normalizeMnemonic(mnemonic)) {
      setError("Фраза не совпадает.");
      return;
    }
    setError(null);
    setSeedFileSaved(false);
    setMode("create-ready");
  }

  function saveSeedFile() {
    if (normalizeMnemonic(confirm) !== normalizeMnemonic(mnemonic)) {
      setError("Сначала повторите 12 слов.");
      return;
    }
    try {
      downloadSeedBackup(mnemonic);
      setSeedFileSaved(true);
      setStatus("Файл sejire-12-words….json (схема sejire/seed/v1) скачан");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onExisting(e: FormEvent) {
    e.preventDefault();
    const phrase = normalizeMnemonic(existing);
    if (!isValidMnemonic(phrase)) {
      setError("Нужна корректная BIP-39 фраза из 12 слов.");
      return;
    }
    setMnemonic(phrase);
    if (sponsorOn) await startSponsorFlow(phrase);
    else await runSelfFundPublish(phrase);
  }

  async function exportFileOnly() {
    if (normalizeMnemonic(confirm) !== normalizeMnemonic(mnemonic)) {
      setError("Сначала повторите 12 слов — так мы убедимся, что вы их записали.");
      return;
    }
    await runLocalExport(mnemonic);
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
          {sponsorOn && (
            <>
              {" "}
              Вечность — через кассир
              {priceHint ? ` (~${priceHint})` : ""}: на сервер уходит только шифр.
            </>
          )}
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
          <form onSubmit={onConfirmCreate}>
            <p className="sub">Повторите 12 слов.</p>
            <textarea
              rows={3}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="actions">
              <button className="btn ghost" type="button" onClick={() => setMode("create-show")}>
                Назад
              </button>
              <button className="btn" type="submit">
                Далее
              </button>
            </div>
          </form>
        )}

        {mode === "create-ready" && (
          <div>
            <p className="sub">
              Слова совпали. Ключ — на бумагу или JSON. Дальше: вечность через оплату, свой AR, или
              только локальный шифр.
            </p>
            <div className="actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <button className="btn" type="button" onClick={saveSeedFile}>
                {seedFileSaved ? "12 слов · JSON ещё раз" : "12 слов · JSON"}
              </button>
              {sponsorOn && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => void startSponsorFlow(mnemonic)}
                >
                  Навсегда · оплата{priceHint ? ` ~${priceHint}` : ""}
                </button>
              )}
              <button
                className="btn ghost"
                type="button"
                onClick={() => void runSelfFundPublish(mnemonic)}
              >
                {sponsorOn ? "В сеть за свой AR (fallback)" : "Древо в децентрализованную сеть"}
              </button>
              <button className="btn ghost" type="button" onClick={() => void exportFileOnly()}>
                Зашифрованное древо · локально
              </button>
              <button className="btn ghost" type="button" onClick={() => setMode("create-confirm")}>
                Назад
              </button>
            </div>
            {seedFileSaved && status && <p className="sub">{status}</p>}
          </div>
        )}

        {mode === "pay" && checkout && (
          <div>
            <p className="sub">
              Оплата{" "}
              <strong>{formatPrice(checkout.amountMinor, checkout.currency)}</strong>
              {checkout.provider === "mock" ? " (mock-кассир, без банка)" : " через Kaspi"}. На
              кассир уходит только зашифрованный сейф — не 12 слов.
            </p>
            {checkout.payUrl && (
              <p className="sub">
                <a href={checkout.payUrl} target="_blank" rel="noopener noreferrer">
                  Открыть оплату Kaspi ↗
                </a>
              </p>
            )}
            <div className="actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <button className="btn" type="button" onClick={() => void confirmPaidAndPublish()}>
                {checkout.mockPayable ? "Оплачено (mock) · сохранить навсегда" : "Я оплатил(а) · сохранить"}
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setCheckout(null);
                  setSealedEnvelope(null);
                  setMode("create-ready");
                }}
              >
                Назад
              </button>
            </div>
          </div>
        )}

        {mode === "existing" && (
          <form onSubmit={(e) => void onExisting(e)}>
            <textarea
              rows={3}
              value={existing}
              onChange={(e) => setExisting(e.target.value)}
              placeholder="word1 word2 … word12"
              required
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <div className="actions">
              <button className="btn ghost" type="button" onClick={() => setMode("intro")}>
                Назад
              </button>
              <button className="btn" type="submit">
                {sponsorOn ? "Зашифровать и оплатить" : "Зашифровать и отправить"}
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
              На адресе из ваших 12 слов мало AR. Переведите немного AR, затем отправьте снова. Новые
              слова создавать не нужно.
            </p>
            {walletAddress && (
              <button
                type="button"
                className="publish-address"
                onClick={() => void copyAddress()}
                title="Нажмите, чтобы скопировать"
              >
                {walletAddress}
                <span className="publish-address-hint">
                  {status === "Адрес скопирован" ? "Скопировано" : "Нажмите, чтобы скопировать"}
                </span>
              </button>
            )}
            <div className="actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <button className="btn" type="button" onClick={() => void runSelfFundPublish(mnemonic)}>
                Отправить
              </button>
              {sponsorOn && (
                <button className="btn ghost" type="button" onClick={() => void startSponsorFlow(mnemonic)}>
                  Оплатить через кассир вместо AR
                </button>
              )}
              <button className="welcome-link-quiet" type="button" onClick={requestClose}>
                Закрыть
              </button>
            </div>
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
