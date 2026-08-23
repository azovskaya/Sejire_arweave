/**
 * SEJIRE sponsor edge — Cloudflare Worker cashier.
 *
 * Responsibilities:
 *  - Create payment sessions (mock or Kaspi Pay Business)
 *  - Verify payment and upload sealed vault envelopes via Turbo (treasury)
 *  - NEVER accept or handle BIP-39 mnemonics / plaintext trees
 *
 * Secrets (wrangler secret put …):
 *  - KASPI_MERCHANT_TOKEN   (when merchant exists)
 *  - TURBO_JWK              (project treasury JWK JSON)
 *
 * Vars:
 *  - PAYMENT_PROVIDER     = "mock" | "kaspi"
 *  - PUBLISH_PRICE_MINOR  = "1500" (e.g. 1500 ₸) or cents
 *  - PUBLISH_CURRENCY     = "KZT" | "USD"
 *  - MAX_ENVELOPE_BYTES   = "524288"
 *  - APP_ORIGIN           = comma-separated allowed origins
 */
import { cashierGuardError } from "./cashierGuard";
import { assertSafeEnvelope, envelopeByteLength } from "./envelope";
import { mapKaspiStatus, verifyKaspiWebhook } from "./kaspi";
import {
  assertSessionPaid,
  createCheckoutSession,
  markSessionPaid,
  syncKaspiSession,
  type KaspiRuntime,
} from "./payments";
import {
  findSessionByOrderId,
  kvSessionStore,
  memorySessionStore,
  type SessionStore,
} from "./sessions";
import { uploadEnvelope } from "./upload";

export interface Env {
  KASPI_MERCHANT_TOKEN?: string;
  TURBO_JWK?: string;
  PAYMENT_PROVIDER: string;
  PUBLISH_PRICE_MINOR: string;
  PUBLISH_CURRENCY: string;
  /** @deprecated use PUBLISH_PRICE_MINOR */
  PUBLISH_PRICE_USD?: string;
  MAX_ENVELOPE_BYTES: string;
  APP_ORIGIN: string;
  IDEMPOTENCY?: KVNamespace;
  KASPI_API_BASE?: string;
  KASPI_TRADE_POINT_ID?: string;
}

type Json = Record<string, unknown>;

function allowedOrigin(env: Env, request: Request): string {
  const reqOrigin = request.headers.get("Origin") || "";
  const list = (env.APP_ORIGIN || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.includes("*")) return reqOrigin || "*";
  if (reqOrigin && list.includes(reqOrigin)) return reqOrigin;
  return list[0] || "*";
}

function cors(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function json(origin: string, status: number, body: Json): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(origin),
  });
}

function priceMinor(env: Env): number {
  if (env.PUBLISH_PRICE_MINOR) return Number(env.PUBLISH_PRICE_MINOR);
  if (env.PUBLISH_PRICE_USD) return Number(env.PUBLISH_PRICE_USD);
  return 1500;
}

function getStore(env: Env): SessionStore {
  if (env.IDEMPOTENCY) {
    return kvSessionStore(env.IDEMPOTENCY);
  }
  return memorySessionStore();
}

function kaspiRuntime(
  env: Env,
  urls?: { successUrl?: string; cancelUrl?: string }
): KaspiRuntime | undefined {
  const apiKey = env.KASPI_MERCHANT_TOKEN;
  if (!apiKey) return undefined;
  return {
    apiBase: env.KASPI_API_BASE || "https://pay.kaspi.kz/api/v2",
    apiKey,
    tradePointId: env.KASPI_TRADE_POINT_ID,
    description: "SEJIRE — вечный сейф на Arweave",
    returnUrl: urls?.successUrl,
    failUrl: urls?.cancelUrl,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(env, request);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const url = new URL(request.url);
    const store = getStore(env);

    try {
      if (url.pathname === "/v1/health" && request.method === "GET") {
        return json(origin, 200, {
          ok: true,
          service: "sejire-sponsor",
          provider: (env.PAYMENT_PROVIDER || "mock").toLowerCase(),
          currency: env.PUBLISH_CURRENCY || "KZT",
          priceMinor: priceMinor(env),
          kaspiReady: Boolean(env.KASPI_MERCHANT_TOKEN),
          treasuryReady: Boolean(env.TURBO_JWK),
        });
      }
      if (url.pathname === "/v1/checkout" && request.method === "POST") {
        return createCheckout(request, env, store, origin);
      }
      if (url.pathname === "/v1/mock-pay" && request.method === "POST") {
        return mockPay(request, env, store, origin);
      }
      if (url.pathname === "/v1/publish" && request.method === "POST") {
        return publishEnvelope(request, env, store, origin);
      }
      if (url.pathname === "/v1/session" && request.method === "GET") {
        return readSession(url, env, store, origin);
      }
      if (url.pathname === "/v1/kaspi-webhook" && request.method === "POST") {
        return kaspiWebhook(request, env, store, origin);
      }
      return json(origin, 404, { ok: false, error: "not_found" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status =
        msg === "session_not_found" ||
        msg === "not_paid" ||
        msg === "forbidden_field" ||
        msg === "missing_vault_id" ||
        msg === "vault_mismatch"
          ? 400
          : msg === "envelope_too_large"
            ? 413
            : msg === "mock_forbidden_with_treasury" || msg === "kv_required"
              ? 503
              : 500;
      return json(origin, status, { ok: false, error: msg });
    }
  },
};

async function createCheckout(
  request: Request,
  env: Env,
  store: SessionStore,
  origin: string
): Promise<Response> {
  const blocked = cashierGuardError(env);
  if (blocked) return json(origin, blocked.status, { ok: false, error: blocked.error });

  let body: { successUrl?: string; cancelUrl?: string; vaultId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const vaultId = (body.vaultId || "").trim();
  if (vaultId.length < 8) {
    return json(origin, 400, { ok: false, error: "missing_vault_id" });
  }

  const provider = (env.PAYMENT_PROVIDER || "mock").toLowerCase();
  try {
    const result = await createCheckoutSession(store, {
      provider,
      amountMinor: priceMinor(env),
      currency: env.PUBLISH_CURRENCY || "KZT",
      vaultId,
      kaspiMerchantToken: env.KASPI_MERCHANT_TOKEN,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      kaspi: kaspiRuntime(env, body),
    });
    return json(origin, 200, { ok: true, ...result });
  } catch (e) {
    const code = e instanceof Error ? e.message : String(e);
    const status = code.includes("not_configured") || code.includes("not_wired") ? 501 : 400;
    return json(origin, status, {
      ok: false,
      error: code,
      hint:
        code === "kaspi_merchant_not_configured"
          ? "Нужен ИП/ТОО + Kaspi для бизнеса; до этого PAYMENT_PROVIDER=mock"
          : undefined,
      priceMinor: priceMinor(env),
      currency: env.PUBLISH_CURRENCY || "KZT",
    });
  }
}

async function mockPay(
  request: Request,
  env: Env,
  store: SessionStore,
  origin: string
): Promise<Response> {
  const blocked = cashierGuardError(env);
  if (blocked) return json(origin, blocked.status, { ok: false, error: blocked.error });
  if ((env.PAYMENT_PROVIDER || "mock").toLowerCase() !== "mock") {
    return json(origin, 403, { ok: false, error: "mock_pay_disabled" });
  }
  const body = (await request.json()) as { sessionId?: string };
  if (!body.sessionId) {
    return json(origin, 400, { ok: false, error: "missing_session" });
  }
  const session = await markSessionPaid(store, body.sessionId, {
    allowMock: true,
    provider: "mock",
  });
  return json(origin, 200, {
    ok: true,
    sessionId: session.id,
    status: session.status,
  });
}

async function publishEnvelope(
  request: Request,
  env: Env,
  store: SessionStore,
  origin: string
): Promise<Response> {
  const body = (await request.json()) as {
    sessionId?: string;
    /** @deprecated Stripe-era alias */
    stripeSessionId?: string;
    envelope?: unknown;
    /** Previous vault TX (same Vault-Id) — optional chain link. */
    parentTxId?: string | null;
  };

  const sessionId = body.sessionId || body.stripeSessionId;
  if (!sessionId || !body.envelope) {
    return json(origin, 400, { ok: false, error: "missing_fields" });
  }

  let envelope;
  try {
    envelope = assertSafeEnvelope(body.envelope);
  } catch (e) {
    return json(origin, 400, {
      ok: false,
      error: e instanceof Error ? e.message : "invalid_envelope",
    });
  }

  const maxBytes = Number(env.MAX_ENVELOPE_BYTES || "524288");
  if (envelopeByteLength(envelope) > maxBytes) {
    return json(origin, 413, { ok: false, error: "envelope_too_large" });
  }

  const blocked = cashierGuardError(env);
  if (blocked) return json(origin, blocked.status, { ok: false, error: blocked.error });

  const amount = priceMinor(env);
  const kaspi = kaspiRuntime(env);
  if (kaspi) {
    await syncKaspiSession(store, sessionId, kaspi).catch(() => undefined);
  }
  const session = await assertSessionPaid(store, sessionId, amount, envelope.vault_id);
  if (session.txId) {
    return json(origin, 200, { ok: true, txId: session.txId, idempotent: true });
  }

  const provider = (env.PAYMENT_PROVIDER || "mock").toLowerCase();
  const uploaded = await uploadEnvelope(envelope, {
    turboJwk: env.TURBO_JWK,
    allowMockUpload: provider === "mock",
    parentTxId: body.parentTxId ?? null,
    updatedAt: new Date().toISOString(),
  });

  const next = {
    ...session,
    status: "consumed" as const,
    txId: uploaded.txId,
  };
  await store.put(next);

  return json(origin, 200, {
    ok: true,
    txId: uploaded.txId,
    mock: uploaded.mock,
    vaultId: envelope.vault_id,
  });
}

async function readSession(
  url: URL,
  env: Env,
  store: SessionStore,
  origin: string
): Promise<Response> {
  const sessionId = url.searchParams.get("sessionId") || "";
  if (!sessionId) return json(origin, 400, { ok: false, error: "missing_session" });
  const kaspi = kaspiRuntime(env);
  if (kaspi) {
    await syncKaspiSession(store, sessionId, kaspi).catch(() => undefined);
  }
  const session = await store.get(sessionId);
  if (!session) return json(origin, 404, { ok: false, error: "session_not_found" });
  return json(origin, 200, {
    ok: true,
    sessionId: session.id,
    status: session.status,
    provider: session.provider,
    paid: session.status === "paid" || session.status === "consumed",
  });
}

async function kaspiWebhook(
  request: Request,
  env: Env,
  store: SessionStore,
  origin: string
): Promise<Response> {
  const token = env.KASPI_MERCHANT_TOKEN;
  if (!token) return json(origin, 503, { ok: false, error: "kaspi_merchant_not_configured" });
  const blocked = cashierGuardError(env);
  if (blocked) return json(origin, blocked.status, { ok: false, error: blocked.error });
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(origin, 400, { ok: false, error: "invalid_json" });
  }
  const okSig = await verifyKaspiWebhook(body, token);
  if (!okSig) return json(origin, 400, { ok: false, error: "bad_webhook_signature" });
  const orderId = String(body.orderId || body.order_id || "");
  if (!orderId) return json(origin, 400, { ok: false, error: "missing_order" });
  const session = await findSessionByOrderId(store, orderId);
  if (!session) return json(origin, 404, { ok: false, error: "session_not_found" });
  if (body.amount != null && Math.round(Number(body.amount)) !== session.amountMinor) {
    return json(origin, 400, { ok: false, error: "amount_mismatch" });
  }
  if (mapKaspiStatus(body.status) === "paid") {
    await markSessionPaid(store, session.id, { allowMock: false, provider: "kaspi" });
  } else {
    const kaspi = kaspiRuntime(env);
    if (kaspi) {
      await syncKaspiSession(store, session.id, kaspi).catch(() => undefined);
    }
  }
  return json(origin, 200, { ok: true, received: true });
}
