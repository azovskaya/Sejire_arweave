/**
 * SEJIRE sponsor edge — Cloudflare Worker cashier.
 *
 * Responsibilities:
 *  - Create payment sessions (mock now; Kaspi Pay Business later)
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
import { assertSafeEnvelope, envelopeByteLength } from "./envelope";
import {
  assertSessionPaid,
  createCheckoutSession,
  markSessionPaid,
} from "./payments";
import { kvSessionStore, memorySessionStore, type SessionStore } from "./sessions";
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
      return json(origin, 404, { ok: false, error: "not_found" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status =
        msg === "session_not_found" || msg === "not_paid" || msg === "forbidden_field"
          ? 400
          : msg === "envelope_too_large"
            ? 413
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
  let body: { successUrl?: string; cancelUrl?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const provider = (env.PAYMENT_PROVIDER || "mock").toLowerCase();
  try {
    const result = await createCheckoutSession(store, {
      provider,
      amountMinor: priceMinor(env),
      currency: env.PUBLISH_CURRENCY || "KZT",
      kaspiMerchantToken: env.KASPI_MERCHANT_TOKEN,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
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

  const amount = priceMinor(env);
  const session = await assertSessionPaid(store, sessionId, amount);
  if (session.txId) {
    return json(origin, 200, { ok: true, txId: session.txId, idempotent: true });
  }

  const provider = (env.PAYMENT_PROVIDER || "mock").toLowerCase();
  const uploaded = await uploadEnvelope(envelope, {
    turboJwk: env.TURBO_JWK,
    allowMockUpload: provider === "mock",
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
