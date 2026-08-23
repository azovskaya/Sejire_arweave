/**
 * Payment providers: mock (dev) and Kaspi (merchant later).
 */

import { createSessionId, type PaymentSession, type SessionStore } from "./sessions";

export type CheckoutResult = {
  sessionId: string;
  amountMinor: number;
  currency: string;
  provider: string;
  /** Kaspi/deep-link when live; null in mock */
  payUrl: string | null;
  /** mock only — client can confirm without bank */
  mockPayable: boolean;
};

export async function createCheckoutSession(
  store: SessionStore,
  opts: {
    provider: string;
    amountMinor: number;
    currency: string;
    vaultId: string;
    kaspiMerchantToken?: string;
    successUrl?: string;
    cancelUrl?: string;
  }
): Promise<CheckoutResult> {
  const provider = (opts.provider || "mock").toLowerCase();
  const vaultId = (opts.vaultId || "").trim();
  if (vaultId.length < 8) throw new Error("missing_vault_id");
  const id = createSessionId();
  const session: PaymentSession = {
    id,
    status: "pending",
    amountMinor: opts.amountMinor,
    currency: opts.currency,
    provider,
    vaultId,
    createdAt: Date.now(),
  };
  await store.put(session);

  if (provider === "mock") {
    return {
      sessionId: id,
      amountMinor: opts.amountMinor,
      currency: opts.currency,
      provider: "mock",
      payUrl: null,
      mockPayable: true,
    };
  }

  if (provider === "kaspi") {
    if (!opts.kaspiMerchantToken) {
      const err = new Error("kaspi_merchant_not_configured");
      (err as Error & { code?: string }).code = "kaspi_merchant_not_configured";
      throw err;
    }
    // Placeholder for Kaspi Pay Business API order create.
    // When merchant exists: create invoice → return payUrl (QR / deep link).
    void opts.successUrl;
    void opts.cancelUrl;
    const err = new Error("kaspi_api_not_wired");
    (err as Error & { code?: string }).code = "kaspi_api_not_wired";
    throw err;
  }

  const err = new Error("unknown_provider");
  (err as Error & { code?: string }).code = "unknown_provider";
  throw err;
}

export async function markSessionPaid(
  store: SessionStore,
  sessionId: string,
  opts: { allowMock: boolean; provider: string }
): Promise<PaymentSession> {
  const session = await store.get(sessionId);
  if (!session) throw new Error("session_not_found");
  if (session.status === "paid" || session.status === "consumed") return session;
  if (session.provider === "mock" && !opts.allowMock) {
    throw new Error("mock_pay_disabled");
  }
  if (session.provider !== "mock" && opts.provider === "mock") {
    throw new Error("provider_mismatch");
  }
  const next: PaymentSession = {
    ...session,
    status: "paid",
    paidAt: Date.now(),
  };
  await store.put(next);
  return next;
}

export async function assertSessionPaid(
  store: SessionStore,
  sessionId: string,
  expectedAmount: number,
  expectedVaultId?: string
): Promise<PaymentSession> {
  const session = await store.get(sessionId);
  if (!session) throw new Error("session_not_found");
  if (expectedVaultId && session.vaultId !== expectedVaultId) {
    throw new Error("vault_mismatch");
  }
  if (session.status === "consumed" && session.txId) return session;
  if (session.status !== "paid" && session.status !== "consumed") {
    throw new Error("not_paid");
  }
  if (session.amountMinor !== expectedAmount) {
    throw new Error("amount_mismatch");
  }
  return session;
}
