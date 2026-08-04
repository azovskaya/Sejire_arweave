# ADR-0006 — Fiat-sponsored Arweave publish + permaweb UI

- **Status:** Proposed → Accepted for Phase 3.5
- **Date:** 2026-07-27
- **Supersedes (partially):** ADR-0001 “no app backend” — a **thin sponsor edge** is allowed; it never receives the BIP-39 seed.

## Context

Users must not buy AR tokens. Product goal: click **В Arweave** → pay **$3 by card** → encrypted vault is permanently stored. The SPA itself should also live on the permaweb (not only GitHub Pages).

Naive scheme (user card → our bank → we manually top up Arweave) works but is slow, operationally heavy, and easy to desync from publish events.

## Decision

### A. Site hosting (decentralized)

1. Keep GitHub Pages as a **mirror / bootstrap** during transition.
2. Deploy `apps/web/dist` to Arweave via **Turbo + permaweb-deploy**.
3. Point an **ArNS** name (e.g. `sejire`) at the latest manifest TX.
4. Fund site redeploys from the **project Turbo wallet** (treasury), not from end users.

### B. Vault publish (user pays $3, we sponsor storage)

**Invariant:** 12 words never leave the device (see `SEED_ACCESS.md`).

**MVP flow (recommended):**

```
Client                         Stripe              Sponsor edge              Turbo / Arweave
  |                              |                      |                         |
  | seal vault locally           |                      |                         |
  | create Checkout ($3)  ------>|                      |                         |
  | pay card                     |                      |                         |
  | <---- success + session_id --|                      |                         |
  | POST envelope + session_id ------------------------>|                         |
  |                              |   verify paid ------>|                         |
  |                              |                      | upload envelope ------->|
  |                              |                      |<------ txId ------------|
  |<----------------------------- txId -----------------|                         |
```

- Client encrypts with keys from the seed (**seed stays local**).
- Sponsor edge verifies Stripe `session_id` / PaymentIntent is paid **exactly once**.
- Edge uploads the sealed envelope with the **project Turbo wallet**.
- Tags stay the same (`App-Name`, `Vault-Id`, …) so restore-by-phrase still works via GraphQL.

**Price:** fixed **USD 3.00** covers typical vault size (≪ $0.10 storage), Stripe fees (~3%+$0.30), Turbo top-up overhead, and margin / site endowment amortisation.

### C. Why not “fund the user’s AR address”

Possible, but worse for UX and ops: AR volatility, wait for confirmation, user still sees crypto balances. Rejected for MVP.

### D. Better-than-MVP (Phase 3.6)

**Turbo Credit Share Approval:** after payment, edge shares credits to the user’s derived address; client uploads with the user JWK so the data item is user-signed. Same fiat UX, stronger on-chain attribution. Schedule after MVP is live.

## Consequences

- Need a tiny backend (Cloudflare Worker / similar) with secrets: Stripe, Turbo/JWK.
- ADR-0001 amended: “no SEJIRE business backend” → “no SEJIRE backend that touches seeds or plaintext trees”.
- Abuse controls: one publish per successful payment; size cap; rate limit by card fingerprint / IP.
- Refunds: if upload fails after payment, auto-retry then Stripe refund.

## Non-goals (this ADR)

- Users buying AR / connecting Wander / ArConnect for publish.
- Server-side access to mnemonics or plaintext genealogy.
- Replacing local draft storage.
