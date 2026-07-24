# Фазы внедрения SEJIRE

## Phase 0 — Документация и презентация ✅

- Investor deck (`presentation/`)
- Protocol + ADR + flows + process docs
- Verification vs ecosystem

## Phase 1 — Local versioned engine ✅

- `apps/web` editor with commit history
- `treeEngine` mirrors protocol rules
- Schemas + Lua Tree/Factory blueprints
- Tests: `npm run test:engine`

## Phase 2 — Seed access + eternal envelope ✅ (product path)

- BIP-39 create / restore (12 words)
- AES-GCM vault encryption on device
- Deterministic `vaultId` recovery
- Local encrypted cache
- Arweave publish/fetch by `Vault-Id` tag
- Export/import envelope file (works offline / without AR)
- Docs: `SEED_ACCESS.md`, flow 07
- Tests: `npm run test:crypto`

## Phase 3 — Product hardening

- Live AO Tree/Factory wiring via aoconnect (process commits on-chain)
- Media upload helper (Turbo/Irys)
- ArNS family names
- Multi-owner UX + Shamir recovery
- Permaweb deploy of UI
- Kinship query handlers in AO

## Phase 4 — Ecosystem

- Import from GEDCOM
- Public heritage trees (opt-in)
- Indexer for discovery
- Mobile wallet deep links

Критерий «готово для пользователя с 12 словами»:
1. Создать сейф и записать фразу
2. Добавить людей, зафиксировать версии
3. Опубликовать / экспортировать
4. На другом устройстве открыть **только** фразой (или фраза + envelope файл)
