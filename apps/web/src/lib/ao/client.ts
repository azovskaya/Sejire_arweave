/**
 * AO client (Phase 3) — ready for live HyperBEAM wiring.
 * Spec: docs/processes/TREE.md, docs/processes/FACTORY.md
 *
 * Today the product vault path uses encrypted Arweave envelopes + local engine.
 * This module is the bridge to autonomous Tree/Factory processes.
 */

export type AoEndpoints = {
  mu?: string;
  cu?: string;
  gateway?: string;
  hbNode?: string;
};

export const DEFAULT_AO: AoEndpoints = {
  hbNode: "https://push.forward.computer",
  gateway: "https://arweave.net",
};

export type TreeCommitPayload = {
  message?: string;
  parent_commit_id?: string | null;
  title?: string;
  snapshot: { persons: Record<string, unknown> };
};

/**
 * Placeholder API — swap to @permaweb/aoconnect message/spawn when process IDs are configured.
 * Keeps UI and docs aligned before mainnet process deployment.
 */
export async function probeHyperBeam(processId: string, endpoints: AoEndpoints = DEFAULT_AO) {
  const base = endpoints.hbNode ?? DEFAULT_AO.hbNode!;
  const url = `${base}/${processId}~process@1.0/compute/sejire`;
  const res = await fetch(url);
  return { ok: res.ok, status: res.status, url };
}

export function describeAoStatus() {
  return {
    phase: 3,
    mode: "bridge",
    note: "Vault access works via BIP-39 + Arweave envelopes. AO Tree commits activate when FACTORY/TREE process IDs are set.",
  };
}
