/**
 * Upload sealed envelope to Arweave via Turbo (treasury JWK).
 * Mock mode returns a deterministic fake tx id when TURBO_JWK is absent.
 */

import type { EnvelopeLike } from "./envelope";

export type UploadResult = { txId: string; mock: boolean };

function mockTxId(vaultId: string): string {
  // 43-char arweave-like id for UI/testing only
  const base = vaultId.replace(/[^a-zA-Z0-9_-]/g, "x").padEnd(43, "0");
  return `mock_${base.slice(0, 38)}`;
}

export async function uploadEnvelope(
  envelope: EnvelopeLike,
  opts: { turboJwk?: string; allowMockUpload: boolean }
): Promise<UploadResult> {
  if (!opts.turboJwk) {
    if (!opts.allowMockUpload) {
      throw new Error("turbo_not_configured");
    }
    return { txId: mockTxId(String(envelope.vault_id || "vault")), mock: true };
  }

  // Live Turbo path — wire @ardrive/turbo-sdk when treasury is ready.
  // Keep tags identical to apps/web publish.ts for GraphQL restore.
  void opts.turboJwk;
  throw new Error("turbo_sdk_not_wired");
}

export const ARWEAVE_TAGS = [
  ["Content-Type", "application/json"],
  ["App-Name", "SEJIRE"],
  ["Protocol", "sejire/v0.3"],
  ["Type", "vault-envelope"],
] as const;
