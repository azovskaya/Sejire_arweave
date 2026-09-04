/**
 * Sponsor cashier selftest — run without Cloudflare.
 * npm run test -C apps/sponsor  (via tsx)
 */
import { assertSafeEnvelope, envelopeByteLength } from "./envelope";
import { cashierGuardError } from "./cashierGuard";
import { createKaspiInvoice, mapKaspiStatus, signKaspiParams, verifyKaspiWebhook } from "./kaspi";
import {
  assertSessionPaid,
  createCheckoutSession,
  markSessionPaid,
  syncKaspiSession,
} from "./payments";
import { findSessionByOrderId, memorySessionStore } from "./sessions";
import { parseTreasuryJwk } from "./turbo";
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
    vaultId: goodEnvelope.vault_id,
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
      vaultId: goodEnvelope.vault_id,
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

  try {
    await assertSessionPaid(store, checkout.sessionId, 1500, "other-vault-id-xx");
    throw new Error("vault mismatch should fail");
  } catch (e) {
    assert(e instanceof Error && e.message === "vault_mismatch", "vault bound to session");
    n += 1;
  }

  assert(
    cashierGuardError({ PAYMENT_PROVIDER: "mock", TURBO_JWK: '{"kty":"RSA"}' })?.error ===
      "mock_forbidden_with_treasury",
    "mock + treasury"
  );
  n += 1;
  assert(
    cashierGuardError({ PAYMENT_PROVIDER: "kaspi" })?.error === "kv_required",
    "kaspi needs KV"
  );
  n += 1;
  assert(
    cashierGuardError({ PAYMENT_PROVIDER: "mock" }) === null,
    "mock without treasury ok"
  );
  n += 1;

  try {
    await createCheckoutSession(store, {
      provider: "mock",
      amountMinor: 1500,
      currency: "KZT",
      vaultId: "",
    });
    throw new Error("empty vaultId should fail");
  } catch (e) {
    assert(e instanceof Error && e.message === "missing_vault_id", "checkout needs vault");
    n += 1;
  }


  const hmac = await signKaspiParams({ amount: "1500", orderId: "sej_1" }, "key");
  assert(typeof hmac === "string" && hmac.length === 64, "kaspi hmac");
  n += 1;
  assert(mapKaspiStatus("APPROVED") === "paid", "kaspi approved");
  n += 1;

  const kaspiStore = memorySessionStore();
  const kaspiPay = await createCheckoutSession(kaspiStore, {
    provider: "kaspi",
    amountMinor: 1500,
    currency: "KZT",
    vaultId: goodEnvelope.vault_id,
    kaspiMerchantToken: "secret",
    kaspi: {
      apiBase: "https://pay.kaspi.kz/api/v2",
      apiKey: "secret",
      description: "test",
      createInvoice: async () => ({
        orderId: "sej_k1",
        payUrl: "https://pay.kaspi.kz/pay/demo",
      }),
      fetchStatus: async () => "paid" as const,
    },
  });
  assert(Boolean(kaspiPay.payUrl) && kaspiPay.mockPayable === false, "kaspi invoice url");
  n += 1;
  const synced = await syncKaspiSession(kaspiStore, kaspiPay.sessionId, {
    apiBase: "https://pay.kaspi.kz/api/v2",
    apiKey: "secret",
    description: "test",
    fetchStatus: async () => "paid" as const,
  });
  assert(synced.session.status === "paid", "kaspi poll marks paid");
  n += 1;
  const signed = await signKaspiParams(
    { amount: "1500", orderId: "sej_k1", status: "APPROVED" },
    "secret"
  );
  assert(
    await verifyKaspiWebhook({ amount: "1500", orderId: "sej_k1", status: "APPROVED", signature: signed }, "secret"),
    "webhook hmac"
  );
  n += 1;

  const invoice = await createKaspiInvoice(
    {
      apiBase: "https://pay.kaspi.kz/api/v2",
      apiKey: "secret",
      amountTenge: 1500,
      orderId: "sej_inv",
      description: "test",
    },
    async (url, init) => {
      assert(String(url).endsWith("/orders/create"), "kaspi create path");
      const body = JSON.parse(String(init?.body || "{}")) as { signature?: string };
      assert(typeof body.signature === "string" && body.signature.length === 64, "invoice hmac sent");
      return new Response(
        JSON.stringify({ paymentUrl: "https://pay.kaspi.kz/pay/x", orderId: "kaspi_rewritten" }),
        { status: 200 }
      );
    }
  );
  assert(invoice.payUrl.startsWith("https://") && invoice.orderId === "kaspi_rewritten", "invoice parse");
  n += 1;

  const indexed = memorySessionStore();
  const withKaspi = await createCheckoutSession(indexed, {
    provider: "kaspi",
    amountMinor: 1500,
    currency: "KZT",
    vaultId: goodEnvelope.vault_id,
    kaspiMerchantToken: "secret",
    kaspi: {
      apiBase: "https://pay.kaspi.kz/api/v2",
      apiKey: "secret",
      description: "test",
      createInvoice: async () => ({
        orderId: "kaspi_other",
        payUrl: "https://pay.kaspi.kz/pay/y",
      }),
    },
  });
  const found = await findSessionByOrderId(indexed, "kaspi_other");
  assert(found?.id === withKaspi.sessionId, "kaspi order index");
  n += 1;

  try {
    parseTreasuryJwk("not-json");
    throw new Error("invalid jwk should fail");
  } catch (e) {
    assert(e instanceof Error && e.message === "turbo_jwk_invalid", "turbo jwk parse");
    n += 1;
  }

  const { memoryOpsStore, recordPaid, recordSaved, toPublicOps, assertNoSecretsInPublic } =
    await import("./opsLedger");
  const ops = memoryOpsStore();
  await recordPaid(ops, "salt", {
    sessionId: "sej_aaa",
    amountMinor: 1500,
    currency: "KZT",
    provider: "mock",
    at: 1_700_000_000_000,
  });
  await recordSaved(ops, "salt", {
    sessionId: "sej_aaa",
    vaultId: "vault-one-xxxxxxxx",
    at: 1_700_000_000_100,
  });
  await recordPaid(ops, "salt", {
    sessionId: "sej_bbb",
    amountMinor: 1500,
    currency: "KZT",
    provider: "kaspi",
    at: 1_700_000_100_000,
  });
  await recordSaved(ops, "salt", {
    sessionId: "sej_bbb",
    vaultId: "vault-one-xxxxxxxx",
    at: 1_700_000_100_100,
  });
  await recordPaid(ops, "salt", {
    sessionId: "sej_aaa",
    amountMinor: 1500,
    currency: "KZT",
    provider: "mock",
  });
  const pub = toPublicOps(await ops.load(), "KZT");
  assert(pub.trees === 1, "one unique tree");
  n += 1;
  assert(pub.saves === 2, "two saves");
  n += 1;
  assert(pub.paidCount === 2, "two payments");
  n += 1;
  assert(pub.created.length === 1 && typeof pub.created[0].at === "string", "one created time");
  n += 1;
  assertNoSecretsInPublic(pub);
  n += 1;
  const dumped = JSON.stringify(pub);
  assert(!dumped.includes("vault-one"), "no vault id in admin payload");
  n += 1;
  assert(!dumped.includes("sej_aaa"), "no session id in admin payload");
  n += 1;

  const { authorizeAdmin } = await import("./adminAuth");
  const off = authorizeAdmin(new Request("https://x/v1/admin/overview"), {});
  assert(off === "off", "admin off without token");
  n += 1;
  const env = { ADMIN_TOKEN: "a".repeat(16) };
  const denied = authorizeAdmin(new Request("https://x/v1/admin/overview"), env);
  assert(denied === "unauthorized", "admin denied");
  n += 1;
  const ok = authorizeAdmin(
    new Request("https://x/v1/admin/overview", {
      headers: { Authorization: `Bearer ${"a".repeat(16)}` },
    }),
    env
  );
  assert(ok === "ok", "admin bearer");
  n += 1;

  console.log(`sponsor.selftest: ${n} asserts ok`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
