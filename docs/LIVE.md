# Живые ссылки SEJIRE

## Почему не открывается `https://azovskaya.github.io/Sejire_arweave/`

GitHub Pages **ещё не включён** в настройках репозитория (сайт возвращает 404).  
Ветка `gh-pages` уже существует, но без переключателя Pages GitHub не публикует `*.github.io`.

Токен облачного агента **не имеет права** включить Pages (API отвечает 403). Это может сделать только владелец репо в UI.

### Включить github.io за 30 секунд

1. Откройте https://github.com/azovskaya/Sejire_arweave/settings/pages  
2. **Build and deployment → Source:** `Deploy from a branch`  
3. Branch: **`gh-pages`** / folder: **`/ (root)`** → Save  
4. Подождите 1–2 минуты  

После этого заработает: **https://azovskaya.github.io/Sejire_arweave/**

---

## Рабочие ссылки прямо сейчас

### 1) Стабильный CDN (рекомендуется)

https://cdn.jsdelivr.net/gh/azovskaya/Sejire_arweave@gh-pages/index.html

Если CDN кэширует старое — откройте по commit:

https://cdn.jsdelivr.net/gh/azovskaya/Sejire_arweave@70547888eb6e5db5d1394942c1fe442d4c2c1149/index.html

Зеркало: https://raw.githack.com/azovskaya/Sejire_arweave/gh-pages/index.html

### 2) Временный туннель агента (пока сессия жива)

Смотрите актуальный URL в ответе агента / `docs/LIVE.md` после рестарта.

---

## Как пользоваться

1. Создать сейф → записать **12 слов**  
2. Создать древо → добавить людей → «Зафиксировать версию»  
3. «Экспорт» или «В вечность» (AR) для доступа с другого устройства  
