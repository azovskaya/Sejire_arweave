# SEJIRE Documentation Index

Техническая документация протокола вечного версионного хранения генеалогических деревьев.

## Быстрая навигация

| Документ | Назначение |
|----------|------------|
| [ARCHITECTURE.ru.md](./ARCHITECTURE.ru.md) | Системная архитектура AO-first |
| [PROTOCOL.md](./PROTOCOL.md) | Спецификация протокола (нормативная) |
| [GLOSSARY.ru.md](./GLOSSARY.ru.md) | Термины |
| [VERIFICATION.ru.md](./VERIFICATION.ru.md) | Сверка с экосистемой Arweave/AO (2026) |
| [processes/](./processes/) | Логика каждого AO-процесса и хендлера |
| [flows/](./flows/) | Пользовательские и системные сценарии |
| [adr/](./adr/) | Architecture Decision Records |
| [security/](./security/) | Угрозы, ключи, инварианты |
| [roadmap/PHASES.ru.md](./roadmap/PHASES.ru.md) | Фазы внедрения |

## Принцип документации

1. **Норматив** (`PROTOCOL.md`, schemas) — источник истины.
2. **Процессы** (`processes/*.md` + `ao/processes/*.lua`) — код и описание 1:1.
3. **Потоки** (`flows/*.md`) — как пользователь и система взаимодействуют.
4. **ADR** — почему выбрали так, а не иначе.

Любое изменение хендлера AO **обязано** обновить:
- Lua-файл
- `processes/<NAME>.md`
- `processes/MESSAGE_CATALOG.md`
- JSON Schema в `packages/schema/` при смене payload
