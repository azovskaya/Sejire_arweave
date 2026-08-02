import { useState } from "react";
import type { FormEvent } from "react";
import { isValidMnemonic, normalizeMnemonic } from "../lib/crypto/bip39";
import { deriveKeysFromMnemonic, fingerprintVaultId } from "../lib/crypto/keys";
import type { EnvelopeV1 } from "../lib/crypto/encrypt";
import { openEnvelope, openLocalVault } from "../lib/crypto/vault";
import { fetchLatestEnvelope } from "../lib/arweave/fetch";
import { saveDraftTree, loadDraftTree } from "../lib/draftStorage";
import { defaultGuide, saveGuide } from "../lib/guide";
import { pickHomeFocus } from "../lib/pedigree";
import { activePersons } from "../lib/treeEngine";

type Props = {
  onRestored: () => void;
  onBack: () => void;
};

export function RestoreSeed({ onRestored, onBack }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function finishWithVault(vault: { active_tree_id: string | null; trees: Record<string, import("../lib/types").TreeStore> }) {
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
    onRestored();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const phrase = normalizeMnemonic(input);
    if (!isValidMnemonic(phrase)) {
      setError("Нужны 12 корректных английских слов BIP-39.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const keys = deriveKeysFromMnemonic(phrase);
      setStatus("Локальный сейф…");
      let vault = await openLocalVault(keys);
      if (!vault) {
        setStatus(`Ищем в Arweave (${fingerprintVaultId(keys.vaultId)})…`);
        const remote = await fetchLatestEnvelope(keys.vaultId);
        if (!remote) throw new Error("Сейф не найден локально и в Arweave");
        vault = await openEnvelope(keys, remote.envelope);
      }
      await finishWithVault(vault);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function onFile(file: File) {
    const phrase = normalizeMnemonic(input);
    if (!isValidMnemonic(phrase)) {
      setError("Сначала введите 12 слов для расшифровки файла.");
      return;
    }
    setBusy(true);
    try {
      const keys = deriveKeysFromMnemonic(phrase);
      const envelope = JSON.parse(await file.text()) as EnvelopeV1;
      const vault = await openEnvelope(keys, envelope);
      await finishWithVault(vault);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="hero-create" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1>SEJIRE</h1>
      <form className="panel" style={{ textAlign: "left", width: "100%" }} onSubmit={(e) => void onSubmit(e)}>
        <h2>Открыть опубликованное древо</h2>
        <p className="sub">12 слов — только для уже отправленного в Arweave сейфа (или envelope-файла).</p>
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
        <label className="full" style={{ marginTop: "0.75rem" }}>
          Или envelope-файл
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </label>
        {error && (
          <p className="form-error">
            {/mismatch|decrypt|JSON/i.test(error)
              ? "Не удалось открыть сейф: проверьте 12 слов или файл envelope."
              : error}
          </p>
        )}
      </form>
    </section>
  );
}
