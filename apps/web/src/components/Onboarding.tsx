import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createMnemonic, isValidMnemonic, normalizeMnemonic, splitWords } from "../lib/crypto/bip39";
import { deriveKeysFromMnemonic, fingerprintVaultId } from "../lib/crypto/keys";
import type { SejireKeys } from "../lib/crypto/keys";
import type { EnvelopeV1 } from "../lib/crypto/encrypt";
import { emptyVault, openEnvelope, openLocalVault } from "../lib/crypto/vault";
import type { VaultV1 } from "../lib/crypto/vault";
import { fetchLatestEnvelope } from "../lib/arweave/fetch";

type Props = {
  onUnlocked: (keys: SejireKeys, vault: VaultV1) => void;
};

type Mode = "home" | "create-show" | "create-confirm" | "restore";

export function Onboarding({ onUnlocked }: Props) {
  const [mode, setMode] = useState<Mode>("home");
  const [mnemonic, setMnemonic] = useState("");
  const [confirm, setConfirm] = useState("");
  const [restoreInput, setRestoreInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const words = useMemo(() => (mnemonic ? splitWords(mnemonic) : []), [mnemonic]);

  const startCreate = () => {
    setError(null);
    setMnemonic(createMnemonic());
    setConfirm("");
    setMode("create-show");
  };

  const unlockWithMnemonic = useCallback(
    async (phrase: string, opts?: { allowEmpty?: boolean }) => {
      setBusy(true);
      setError(null);
      try {
        const keys = deriveKeysFromMnemonic(phrase);

        setStatus("Ищем локальный сейф…");
        let vault = await openLocalVault(keys);
        if (vault) {
          onUnlocked(keys, vault);
          return;
        }

        setStatus("Ищем сейф в Arweave по Vault-Id…");
        try {
          const remote = await fetchLatestEnvelope(keys.vaultId);
          if (remote) {
            vault = await openEnvelope(keys, remote.envelope);
            onUnlocked(keys, vault);
            return;
          }
        } catch {
          // network optional at unlock
        }

        if (opts?.allowEmpty) {
          onUnlocked(keys, emptyVault(keys.vaultId));
          return;
        }

        setError(
          `Сейф ${fingerprintVaultId(keys.vaultId)} не найден локально и в сети. Создайте новый или загрузите файл envelope.`
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        setStatus("");
      }
    },
    [onUnlocked]
  );

  const onConfirmCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (normalizeMnemonic(confirm) !== normalizeMnemonic(mnemonic)) {
      setError("Фраза не совпадает. Введите 12 слов точно как показано.");
      return;
    }
    await unlockWithMnemonic(mnemonic, { allowEmpty: true });
  };

  const onRestore = async (e: FormEvent) => {
    e.preventDefault();
    const phrase = normalizeMnemonic(restoreInput);
    if (!isValidMnemonic(phrase)) {
      setError("Неверная BIP-39 фраза (нужно ровно 12 английских слов).");
      return;
    }
    await unlockWithMnemonic(phrase);
  };

  const onImportFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const phrase = normalizeMnemonic(restoreInput);
      if (!isValidMnemonic(phrase)) {
        setError("Сначала введите 12 слов — ими расшифровывается файл.");
        return;
      }
      const keys = deriveKeysFromMnemonic(phrase);
      const envelope = JSON.parse(await file.text()) as EnvelopeV1;
      const vault = await openEnvelope(keys, envelope);
      onUnlocked(keys, vault);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открыть файл");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="hero-create" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1>SEJIRE</h1>
      <p>Вечное древо рода. Доступ с любой точки мира — по 12 словам. Без аккаунтов и паролей сервиса.</p>

      {mode === "home" && (
        <div className="create-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <button className="btn" type="button" onClick={startCreate}>
            Создать новый сейф (12 слов)
          </button>
          <button className="btn ghost" type="button" onClick={() => setMode("restore")}>
            У меня уже есть 12 слов
          </button>
        </div>
      )}

      {mode === "create-show" && (
        <div className="panel" style={{ textAlign: "left", width: "100%" }}>
          <h2>Запишите фразу</h2>
          <p className="sub">
            Это единственный ключ. Кто знает 12 слов — откроет древо. Кто потерял — не восстановит.
          </p>
          <ol className="seed-grid">
            {words.map((w, i) => (
              <li key={`${w}-${i}`}>
                <span>{i + 1}.</span> {w}
              </li>
            ))}
          </ol>
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setMode("home")}>
              Назад
            </button>
            <button className="btn" type="button" onClick={() => setMode("create-confirm")}>
              Я записал(а) — подтвердить
            </button>
          </div>
        </div>
      )}

      {mode === "create-confirm" && (
        <form className="panel" style={{ textAlign: "left", width: "100%" }} onSubmit={onConfirmCreate}>
          <h2>Подтвердите фразу</h2>
          <p className="sub">Введите 12 слов через пробел в том же порядке.</p>
          <textarea
            rows={3}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="word1 word2 … word12"
            required
          />
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setMode("create-show")}>
              Назад
            </button>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Открываем…" : "Открыть сейф"}
            </button>
          </div>
        </form>
      )}

      {mode === "restore" && (
        <form className="panel" style={{ textAlign: "left", width: "100%" }} onSubmit={onRestore}>
          <h2>Восстановление</h2>
          <p className="sub">
            Введите 12 слов. Клиент найдёт сейф локально или в Arweave по Vault-Id, выведенному из фразы.
          </p>
          <textarea
            rows={3}
            value={restoreInput}
            onChange={(e) => setRestoreInput(e.target.value)}
            placeholder="word1 word2 … word12"
            required
          />
          <div className="actions">
            <button className="btn ghost" type="button" onClick={() => setMode("home")}>
              Назад
            </button>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? status || "Ищем…" : "Открыть"}
            </button>
          </div>
          <label className="full" style={{ marginTop: "0.75rem" }}>
            Или загрузить envelope-файл
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
              }}
            />
          </label>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
      {busy && status && <p className="sub">{status}</p>}
    </section>
  );
}
