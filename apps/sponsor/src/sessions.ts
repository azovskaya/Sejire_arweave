/**
 * Payment session store — Cloudflare KV in prod, in-memory for mock/dev.
 */

export type SessionStatus = "pending" | "paid" | "consumed";

export type PaymentSession = {
  id: string;
  status: SessionStatus;
  amountMinor: number;
  currency: string;
  provider: string;
  createdAt: number;
  paidAt?: number;
  txId?: string;
};

export interface SessionStore {
  get(id: string): Promise<PaymentSession | null>;
  put(session: PaymentSession): Promise<void>;
}

const memory = new Map<string, PaymentSession>();

export function memorySessionStore(): SessionStore {
  return {
    async get(id) {
      return memory.get(id) ?? null;
    },
    async put(session) {
      memory.set(session.id, session);
    },
  };
}

export function kvSessionStore(kv: KVNamespace): SessionStore {
  return {
    async get(id) {
      const raw = await kv.get(id);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as PaymentSession;
      } catch {
        // Legacy: sessionId → txId string
        return {
          id,
          status: "consumed",
          amountMinor: 0,
          currency: "USD",
          provider: "legacy",
          createdAt: 0,
          txId: raw,
        };
      }
    },
    async put(session) {
      await kv.put(session.id, JSON.stringify(session));
    },
  };
}

export function createSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `sej_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
