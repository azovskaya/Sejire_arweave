/**
 * SEJIRE sponsor edge — Cloudflare Worker skeleton.
 *
 * Responsibilities:
 *  - Create Stripe Checkout sessions ($3 publish)
 *  - Verify payment and upload sealed vault envelopes via Turbo
 *  - NEVER accept or handle BIP-39 mnemonics / plaintext trees
 *
 * Secrets (wrangler secret put …):
 *  - STRIPE_SECRET_KEY
 *  - STRIPE_WEBHOOK_SECRET
 *  - TURBO_JWK          (project treasury JWK JSON)
 *
 * Vars:
 *  - PUBLISH_PRICE_USD = "300" (cents)
 *  - MAX_ENVELOPE_BYTES = "524288"
 *  - APP_ORIGIN         = "https://azovskaya.github.io"
 */
export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  TURBO_JWK: string;
  PUBLISH_PRICE_USD: string;
  MAX_ENVELOPE_BYTES: string;
  APP_ORIGIN: string;
  /** sessionId → txId */
  IDEMPOTENCY: KVNamespace;
}

type Json = Record<string, unknown>;

function cors(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function json(env: Env, status: number, body: Json): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(env.APP_ORIGIN || "*"),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(env.APP_ORIGIN || "*") });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/v1/checkout" && request.method === "POST") {
        return createCheckout(request, env);
      }
      if (url.pathname === "/v1/publish" && request.method === "POST") {
        return publishEnvelope(request, env);
      }
      if (url.pathname === "/v1/health") {
        return json(env, 200, { ok: true, service: "sejire-sponsor" });
      }
      return json(env, 404, { ok: false, error: "not_found" });
    } catch (e) {
      return json(env, 500, {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
};

async function createCheckout(request: Request, env: Env): Promise<Response> {
  const priceCents = Number(env.PUBLISH_PRICE_USD || "300");
  // Wire Stripe Checkout Session here (priceCents, success/cancel URLs from body).
  // Placeholder keeps deployable without live keys during scaffold phase.
  void request;
  return json(env, 501, {
    ok: false,
    error: "stripe_not_configured",
    hint: "Set STRIPE_SECRET_KEY and implement Checkout Session creation",
    priceCents,
  });
}

async function publishEnvelope(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    stripeSessionId?: string;
    envelope?: unknown;
  };

  if (!body.stripeSessionId || !body.envelope) {
    return json(env, 400, { ok: false, error: "missing_fields" });
  }

  const existing = await env.IDEMPOTENCY.get(body.stripeSessionId);
  if (existing) {
    return json(env, 200, { ok: true, txId: existing, idempotent: true });
  }

  const payload = JSON.stringify(body.envelope);
  const maxBytes = Number(env.MAX_ENVELOPE_BYTES || "524288");
  if (payload.length > maxBytes) {
    return json(env, 413, { ok: false, error: "envelope_too_large" });
  }

  // 1) Verify Stripe session is paid (and amount == PUBLISH_PRICE_USD)
  // 2) Upload via @ardrive/turbo-sdk with project JWK
  // 3) KV put sessionId → txId
  void env.TURBO_JWK;
  return json(env, 501, {
    ok: false,
    error: "turbo_not_configured",
    hint: "Verify Stripe session, then Turbo.uploadFile sealed envelope",
  });
}
