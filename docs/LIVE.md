# Живые ссылки SEJIRE

## Канон (цель)

**https://sejire.ar.io** — сайт на Arweave (имя купить навсегда; привязка после деплоя).  
Решения: [`LOCKED_DECISIONS.ru.md`](./LOCKED_DECISIONS.ru.md).

## Зеркало сейчас (GitHub Pages)

**https://azovskaya.github.io/Sejire_arweave/**

Источник деплоя: ветка [`gh-pages`](https://github.com/azovskaya/Sejire_arweave/tree/gh-pages) этого же репозитория.

## Репозиторий

- Код: https://github.com/azovskaya/Sejire_arweave  
- Документация в коде: [`docs/`](https://github.com/azovskaya/Sejire_arweave/tree/main/docs)  
- Настройки Pages: branch `gh-pages` / root  

## Как обновляется зеркало Pages

1. Меняем `apps/web`  
2. `npm run build`  
3. Содержимое `apps/web/dist` публикуется в ветку `gh-pages`  
4. GitHub Pages отдаёт https://azovskaya.github.io/Sejire_arweave/

Скрипт: `npm run deploy:pages` (корень репозитория).

## Открыть уже сохранённый сейф

Только 12 слов + приложение (предпочтительно с Arweave). Банк и кассир **не нужны**. См. flow 07 и LOCKED_DECISIONS §4.
