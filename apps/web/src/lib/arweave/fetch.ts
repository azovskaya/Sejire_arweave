import type { EnvelopeV1 } from "../crypto/encrypt";

const GQL = "https://arweave.net/graphql";
const GATEWAY = "https://arweave.net";

type GqlEdge = {
  node: {
    id: string;
    block: { timestamp: number } | null;
  };
};

/**
 * Find newest SEJIRE vault envelope for vaultId on Arweave.
 */
export async function fetchLatestEnvelope(vaultId: string): Promise<{
  txId: string;
  envelope: EnvelopeV1;
} | null> {
  const query = `
    query ($vaultId: String!) {
      transactions(
        first: 5
        tags: [
          { name: "App-Name", values: ["SEJIRE"] }
          { name: "Type", values: ["vault-envelope"] }
          { name: "Vault-Id", values: [$vaultId] }
        ]
        sort: HEIGHT_DESC
      ) {
        edges { node { id block { timestamp } } }
      }
    }
  `;

  const res = await fetch(GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { vaultId } }),
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}`);
  const body = (await res.json()) as {
    data?: { transactions?: { edges: GqlEdge[] } };
    errors?: unknown;
  };
  const edges = body.data?.transactions?.edges ?? [];
  for (const edge of edges) {
    const txId = edge.node.id;
    const dataRes = await fetch(`${GATEWAY}/${txId}`);
    if (!dataRes.ok) continue;
    try {
      const envelope = (await dataRes.json()) as EnvelopeV1;
      if (envelope?.schema === "sejire/envelope/v1" && envelope.vault_id === vaultId) {
        return { txId, envelope };
      }
    } catch {
      // try next
    }
  }
  return null;
}
