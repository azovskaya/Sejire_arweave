# Фазы внедрения SEJIRE

## Phase 0 — Документация и презентация ✅

- Investor deck (`presentation/`)
- Protocol + ADR + flows + process docs
- Verification vs ecosystem

## Phase 1 — Local versioned engine ✅ (in progress)

- `apps/web` editor with commit history
- `treeEngine` mirrors protocol rules
- Schemas + Lua Tree/Factory blueprints
- Tests: `npm run test:engine`

## Phase 2 — On-chain wiring

- Deploy Factory + Tree via `aos` / HyperBEAM
- ArConnect/Wander connect in UI
- Real `Commit` messages
- Media upload helper (Turbo/Irys)
- Encryption option (opt-in)

## Phase 3 — Product hardening

- Kinship query handlers in AO
- ArNS family names
- Multi-owner UX + recovery
- Permaweb deploy of UI
- Partner read API (gateway-only)

## Phase 4 — Ecosystem

- Import from GEDCOM
- Public heritage trees
- Indexer for discovery (optional AO process)
- Mobile wallet deep links

Критерий готовности каждой фазы: обновлённые docs + тесты + работающий flow из `docs/flows/`.
