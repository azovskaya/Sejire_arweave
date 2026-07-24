# SEJIRE

**Создание неизменяемой ткани человеческой истории.**

Децентрализованный AO-протокол версионных генеалогических деревьев на **Arweave + AO (HyperBEAM)**.

Инвариант: **каждое дополнение = новый immutable commit**; прошлые версии всегда читаемы.

## Репозиторий

| Путь | Содержание |
|------|------------|
| [`presentation/`](./presentation/) | Инвесторская презентация |
| [`docs/VERIFICATION.ru.md`](./docs/VERIFICATION.ru.md) | Сверка тезисов с экосистемой (2026) |
| [`docs/ARCHITECTURE.ru.md`](./docs/ARCHITECTURE.ru.md) | AO-first архитектура |
| [`ao/processes/tree.lua`](./ao/processes/tree.lua) | AO process: Commit / History / GetHead |
| [`apps/web/`](./apps/web/) | MVP-редактор с версионностью (local engine) |
| [`packages/schema/`](./packages/schema/) | JSON Schema commit/v1 |

## Быстрый старт

```bash
# Презентация
python3 -m http.server 4173 --directory .
# http://localhost:4173/presentation/

# Редактор древа
cd apps/web && npm install && npm run dev
```

## Стек

- **Логика:** AO Process (Lua) — без Node/Postgres бэкенда
- **Сообщения:** HyperBEAM (дешёвые апдейты, HTTP state)
- **Медиа:** Arweave TX, в AO только ссылки
- **Имена:** ArNS (`family.ar.io`)
- **Кошелёк:** ArConnect / Wander (Phase 2)

## Протокол версий

```
v1 ──► v2 ──► v3 (HEAD)
 ▲      ▲
 └── всегда можно открыть и увидеть, что было раньше
```

Удаление персоны = tombstone в **новом** commit, история не стирается.
