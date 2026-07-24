# SEJIRE Architecture v2 — AO-first, versioned trees

> Цель: самая сильная децентрализованная система сохранения и дополнения древа предков.  
> Инвариант: **каждое дополнение = новый immutable commit**; прошлые версии всегда читаемы.

Сверка с реальностью экосистемы: [`VERIFICATION.ru.md`](./VERIFICATION.ru.md).

---

## Продуктовый инвариант (Git для генеалогии)

```
v0 (genesis) ──► v1 ──► v2 ──► v3 (HEAD)
                 │       │
                 └───────┴── любой commit можно открыть как «дерево на момент T»
```

- `Commit` никогда не мутирует предыдущий снимок.
- `HEAD` — указатель на последний commit.
- UI всегда показывает: текущее дерево + ленту версий + diff «что изменилось».
- Даже «удаление» персоны в UI = **новый commit**, где персона помечена `tombstone` (история не стирается).

---

## Стек (целевой)

| Компонент | Выбор | Почему |
|-----------|-------|--------|
| Логика / ACL / граф | **AO Process (Lua)** | Автономный actor; holographic state; без вашего Node-бэкенда |
| Сообщения / дешёвые апдейты | **AO + HyperBEAM** | Не платим L1 AR за каждое имя; HTTP-доступ к state |
| Медиа | **Arweave data items** | Вечные TX ID; в AO только ссылки |
| Фронт | **React (Vite), деплой на permaweb** | UI сменяем; данные живут в AO |
| Кошелёк | **ArConnect / Wander** | Подпись `Commit` / ownership |
| Имена семей | **ArNS** (`family.ar.io`) | Красивые вечные URL через ar.io mesh |
| Локальный черновик | **IndexedDB** | Бесплатно до первой on-chain фиксации |

---

## Модель данных

### Commit (immutable)

```json
{
  "schema": "sejire/commit/v1",
  "tree_id": "…",
  "commit_id": "c_…",
  "parent_commit_id": "c_prev | null",
  "version": 3,
  "author": "arweave-address",
  "created_at": "2026-07-24T12:00:00Z",
  "message": "Добавлен Аян Бекмуратов",
  "snapshot": {
    "persons": { "p1": { "id": "p1", "name": "…", "born": "…", "parents": [], "media": [], "tombstone": false } },
    "edges_note": "parents[] suffices for graph"
  }
}
```

Полный snapshot на каждый commit (для родословных — мелкий JSON) проще дельт: любой version читается за O(1) без rebase.

### AO Process state

```lua
Tree = {
  id, title, owners = {},
  head = commit_id | nil,
  commits = { [commit_id] = Commit },
  versions = { [n] = commit_id }  -- быстрый индекс
}
```

Handlers:

| Action | Эффект |
|--------|--------|
| `Info` | метаданные + HEAD |
| `GetHead` | актуальный snapshot |
| `GetCommit` | snapshot по `Commit-Id` |
| `History` | список версий (id, parent, message, author, time) |
| `Commit` | новый snapshot (требует owner signature) |
| `AddOwner` / `RemoveOwner` | ACL (только owner) |

Вычисления родства (`CommonAncestors`, `Degree`) — handlers поверх `GetHead` или любого commit (Phase 2).

---

## Двухуровневое хранение

```
[AO Process]          имена, даты, parents[], tombstones, media refs, history
       │
       └── media[] → ar://TXID   (фото, сканы, аудио)  на Permaweb
```

Граф = гранит. Медиа = вечные блобы по ссылке.

---

## Поток пользователя

1. Создать кошелёк / подключить Wander.
2. `Spawn` AO process «семейное древо» (или factory process).
3. Редактировать черновик локально (IndexedDB).
4. **Зафиксировать** → `Action=Commit` (новый version).
5. Открыть историю → выбрать v1…vN → увидеть прошлое дерево.
6. (Опционально) привязать ArNS undername `sejire/<family>`.

---

## Фазы

### Phase 1 (сейчас в репо) — Local + AO blueprint
- JSON schema commit/v1
- Lua process `ao/processes/tree.lua`
- Web MVP: редактор + **обязательная версионность** (local engine = тот же протокол)

### Phase 2 — On-chain
- Deploy process через `aos` / HyperBEAM
- ArConnect signing
- Чтение HEAD через HyperBEAM HTTP

### Phase 3 — Product polish
- Kinship queries в AO
- ArNS family names
- Permaweb deploy UI
- Партнёрский read-API (публичные gateways, без своего бэкенда)

---

## Почему это «совершеннее» Web2-генеалогии

1. **Невозможно тихо переписать прошлое** — только новый commit.
2. **Невозможно «убить сервис» и стереть деревья** — process + Arweave.
3. **Владение ключом = владение деревом** — не аккаунт компании.
4. **Аудит для потомков** — хронология сбора, не только итог.
5. **Стоимость** — pay-per-commit, не monthly cloud.

Код: `ao/processes/tree.lua`, `apps/web`, `packages/schema`.
