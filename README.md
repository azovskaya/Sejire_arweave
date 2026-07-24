# SEJIRE

**Создание неизменяемой ткани человеческой истории.**

Децентрализованный AO-протокол **версионных** генеалогических деревьев  
(Arweave + AO / HyperBEAM).

> Каждое дополнение = новый immutable commit. Прошлое всегда читаемо.

## Структура репозитория

```
docs/                 Техническая документация (старт: docs/README.md)
  PROTOCOL.md         Норматив протокола
  processes/          Логика Tree / Factory + message catalog
  flows/              Сценарии пользователя
  adr/                Architecture Decision Records
  security/           Threat model, ключи
  roadmap/            Фазы
ao/processes/         Lua AO processes (код = docs/processes/*)
apps/web/             MVP-редактор (local engine = зеркало протокола)
packages/schema/      JSON Schema + messages.catalog.json
presentation/         Инвесторская презентация
```

## Документация

| Раздел | Ссылка |
|--------|--------|
| Индекс | [docs/README.md](./docs/README.md) |
| Протокол | [docs/PROTOCOL.md](./docs/PROTOCOL.md) |
| Tree process | [docs/processes/TREE.md](./docs/processes/TREE.md) |
| Factory process | [docs/processes/FACTORY.md](./docs/processes/FACTORY.md) |
| Чеклист синхронизации | [docs/CHECKLIST.md](./docs/CHECKLIST.md) |
| Верификация экосистемы | [docs/VERIFICATION.ru.md](./docs/VERIFICATION.ru.md) |

## Быстрый старт

```bash
# Документация / презентация
python3 -m http.server 4173 --directory .
# http://localhost:4173/presentation/
# http://localhost:4173/docs/

# Редактор
cd apps/web && npm install && npm run dev
npm run test:engine
```

## Процессы (кратко)

1. **Factory** — `SpawnTree` / `ListTrees`
2. **Tree** — `Init` → `Commit` → `History` / `GetCommit`
3. Медиа — upload на Arweave, в commit только `media.tx`

Подробности и коды ошибок — в `docs/processes/`.
