/**
 * Sponsor cashier selftest — run without Cloudflare.
 * npm run test -C apps/sponsor  (via tsx)
 */
import { assertSafeEnvelope, envelopeByteLength } from "./envelope";
import {
  assertSessionPaid,
  createCheckoutSession,
  markSessionPaid,
} from "./payments";
import { memorySessionStore } from "./sessions";
import { uploadEnvelope } from "./upload";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const goodEnvelope = {
  schema: "sejire/envelope/v1" as const,
  vault_id: "abcd1234efgh5678",
  cipher: "aes-gcm-256" as const,
  kdf: "hkdf-sha256" as const,
  iv: "AAAA",
  ciphertext: "Zm9vYmFyYmF6cXV4",
  protocol: "sejire/v0.3" as const,
};

async function main() {
  let n = 0;

  // envelope safety
  assertSafeEnvelope(goodEnvelope);
  n += 1;
  try {
    assertSafeEnvelope({ ...goodEnvelope, mnemonic: "abandon abandon" });
    throw new Error("should reject mnemonic");
  } catch (e) {
    assert(e instanceof Error && e.message === "forbidden_field", "forbid mnemonic");
    n += 1;
  }
  try {
    assertSafeEnvelope({ ...goodEnvelope, trees: [] });
    throw new Error("should reject trees");
  } catch (e) {
    assert(e instanceof Error && e.message === "forbidden_field", "forbid trees");
    n += 1;
  }
  assert(envelopeByteLength(goodEnvelope) > 50, "byte length");
  n += 1;

  // mock checkout → pay → publish upload
  const store = memorySessionStore();
  const checkout = await createCheckoutSession(store, {
    provider: "mock",
    amountMinor: 1500,
    currency: "KZT",
  });
  assert(checkout.mockPayable && checkout.sessionId.startsWith("sej_"), "checkout mock");
  n += 1;

  await markSessionPaid(store, checkout.sessionId, { allowMock: true, provider: "mock" });
  const paid = await assertSessionPaid(store, checkout.sessionId, 1500);
  assert(paid.status === "paid", "paid");
  n += 1;

  const up = await uploadEnvelope(goodEnvelope, { allowMockUpload: true });
  assert(up.mock && up.txId.startsWith("mock_"), "mock upload");
  n += 1;

  // kaspi without token
  try {
    await createCheckoutSession(store, {
      provider: "kaspi",
      amountMinor: 1500,
      currency: "KZT",
    });
    throw new Error("kaspi should fail");
  } catch (e) {
    assert(
      e instanceof Error && e.message === "kaspi_merchant_not_configured",
      "kaspi guard"
    );
    n += 1;
  }

  // idempotent consume
  paid.txId = up.txId;
  paid.status = "consumed";
  await store.put(paid);
  const again = await assertSessionPaid(store, checkout.sessionId, 1500);
  assert(again.txId === up.txId, "idempotent tx");
  n += 1;

  console.log(`sponsor.selftest: ${n} asserts ok`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
