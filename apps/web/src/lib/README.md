# `apps/web/src/lib` — Local protocol engine

Зеркало правил Tree Process для Phase 1 (без кошелька).

| File | Role |
|------|------|
| `types.ts` | TypeScript model = schema commit/person |
| `treeEngine.ts` | create / commit / history / tombstone / persistence |
| `treeEngine.selftest.ts` | Protocol invariant checks |

## Mapping to AO

| Engine API | AO Action |
|------------|-----------|
| `createTree` | Factory `SpawnTree` + Tree `Init` (local combined) |
| `commitDraft` | `Commit` |
| `listHistory` | `History` |
| `getHead` / `getCommit` | `GetHead` / `GetCommit` |
| `removeDraftPerson` | draft tombstone → later `Commit` |
| `loadDraftFromCommit` | historical continue (client-only) |

Normative behavior: [`docs/processes/TREE.md`](../../../../docs/processes/TREE.md).

If engine and Lua diverge, **Lua + PROTOCOL win** — fix the engine.
