/**
 * Shared helpers for loading a vault before sealing a new version.
 */
import { deriveKeysFromMnemonic } from "../crypto/keys";
import {
  emptyVault,
  openEnvelope,
  openLocalVault,
  type VaultV1,
} from "../crypto/vault";
import {
  fetchEnvelopeByTx,
  fetchLatestEnvelope,
} from "../arweave/fetch";

export async function loadVaultForPublish(
  keys: ReturnType<typeof deriveKeysFromMnemonic>,
  opts?: { parentTxId?: string | null }
): Promise<VaultV1> {
  if (opts?.parentTxId) {
    try {
      const envelope = await fetchEnvelopeByTx(opts.parentTxId);
      if (envelope && envelope.vault_id === keys.vaultId) {
        return await openEnvelope(keys, envelope);
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const remote = await fetchLatestEnvelope(keys.vaultId);
    if (remote) return await openEnvelope(keys, remote.envelope);
  } catch {
    /* offline */
  }
  const local = await openLocalVault(keys);
  if (local) return local;
  return emptyVault(keys.vaultId);
}
