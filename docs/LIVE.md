# Живые ссылки SEJIRE

Всё открывается **из репозитория** через GitHub Pages.

## Приложение (строить древо)

**https://azovskaya.github.io/Sejire_arweave/**

Источник деплоя: ветка [`gh-pages`](https://github.com/azovskaya/Sejire_arweave/tree/gh-pages) этого же репозитория.

## Репозиторий

- Код: https://github.com/azovskaya/Sejire_arweave  
- Документация в коде: [`docs/`](https://github.com/azovskaya/Sejire_arweave/tree/main/docs)  
- Настройки Pages: branch `gh-pages` / root  

## Как обновляется сайт

1. Меняем `apps/web`  
2. `npm run build`  
3. Содержимое `apps/web/dist` публикуется в ветку `gh-pages`  
4. GitHub Pages отдаёт https://azovskaya.github.io/Sejire_arweave/

Скрипт: `npm run deploy:pages` (корень репозитория).
