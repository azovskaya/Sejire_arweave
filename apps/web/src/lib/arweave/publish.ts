import Arweave from "arweave";
import type { JWKInterface } from "arweave/web/lib/wallet";
import type { EnvelopeV1 } from "../crypto/encrypt";

const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
});

export type PublishResult =
  | { ok: true; txId: string }
  | { ok: false; error: string; needsFunds?: boolean };

/**
 * Publish encrypted vault envelope to Arweave.
 * Requires wallet with AR for the one-time endowment fee.
 */
export async function publishEnvelope(
  jwk: JWKInterface,
  envelope: EnvelopeV1
): Promise<PublishResult> {
  try {
    const data = JSON.stringify(envelope);
    const tx = await arweave.createTransaction({ data }, jwk);
    tx.addTag("Content-Type", "application/json");
    tx.addTag("App-Name", "SEJIRE");
    tx.addTag("Protocol", "sejire/v0.3");
    tx.addTag("Type", "vault-envelope");
    tx.addTag("Vault-Id", envelope.vault_id);
    tx.addTag("Schema", envelope.schema);

    await arweave.transactions.sign(tx, jwk);
    const balance = await arweave.wallets.getBalance(await arweave.wallets.jwkToAddress(jwk));
    const price = tx.reward;
    if (BigInt(balance) < BigInt(price)) {
      return {
        ok: false,
        needsFunds: true,
        error: `Недостаточно AR. Нужно ≈ ${arweave.ar.winstonToAr(price)} AR на адресе кошелька.`,
      };
    }

    const res = await arweave.transactions.post(tx);
    if (res.status !== 200 && res.status !== 208) {
      return { ok: false, error: `Arweave post failed: ${res.status} ${res.statusText}` };
    }
    return { ok: true, txId: tx.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getWalletBalanceAr(jwk: JWKInterface): Promise<string> {
  const address = await arweave.wallets.jwkToAddress(jwk);
  const winston = await arweave.wallets.getBalance(address);
  return arweave.ar.winstonToAr(winston);
}

export { arweave };
