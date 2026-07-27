# SEJIRE

**Создание неизменяемой ткани человеческой истории.**

Протокол вечного версионного хранения родовых деревьев.  
Сначала собираете древо (я → мама/папа → бабушки/дедушки).  
**12 слов — только при отправке в Arweave.**

## Открыть приложение

**https://azovskaya.github.io/Sejire_arweave/**

Репозиторий: https://github.com/azovskaya/Sejire_arweave

## Локально

```bash
cd apps/web && npm install && npm run dev
```

Обновить GitHub Pages из этого репо:

```bash
npm run deploy:pages
```

## Структура

| Путь | Содержание |
|------|------------|
| `apps/web` | Клиент (сбор древа + публикация) |
| `docs/` | Протокол, процессы, flows |
| `ao/processes` | Lua Tree / Factory |
| `packages/schema` | JSON Schema |
| `presentation/` | Презентация |
| ветка `gh-pages` | Собранный сайт для Pages |

Подробнее: [`docs/LIVE.md`](./docs/LIVE.md) · [`docs/README.md`](./docs/README.md)
