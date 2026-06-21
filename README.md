# Pizza Chicago — сайт пиццерии

Сайт с онлайн-заказом для сети пиццерий Pizza Chicago (Махачкала).
Микросервисный бэкенд + фронтенд на Feature-Sliced Design.

Полная схема и контракты — в [ARCHITECTURE.md](ARCHITECTURE.md).

## Стек

- **Фронтенд:** Next.js 14 (App Router), Feature-Sliced Design, Zustand — папка `web/`
- **Шлюз:** NestJS (HTTP) — helmet, throttler, CORS, JWT, валидация — папка `gateway/`
- **Микросервисы (NestJS, связь по gRPC — см. [GRPC-WIRING.md](GRPC-WIRING.md)):**
  - `auth-service` (:50051) — регистрация, вход, JWT (access + refresh), bcrypt
  - `catalog-service` (:50052) — категории и меню
  - `orders-service` (:50053) — заказы (берёт цены из каталога, шлёт уведомление)
  - `support-service` (:50054) — обращения в поддержку
  - `notifications-service` (:50055) — письмо/СМС о заказе (есть MOCK-режим)
  - `payment-service` (:50056) — онлайн-оплата в стиле ЮKassa (есть MOCK-режим)
- **База:** PostgreSQL, отдельная база данных на каждый сервис (кроме notifications)
- **Контракты gRPC:** `proto/*.proto`

## Быстрый старт (кросс-платформенно: Windows / macOS / Linux)

Нужны **Node.js 20.19+ / 22.12+ / 24+** (требование Prisma 7) и **Docker**.

```bash
npm run setup    # БД + .env + зависимости + Prisma-клиент + схемы + меню
npm run dev      # запускает весь бэкенд: 6 сервисов + шлюз
```

Фронтенд — в отдельном репозитории `pizza-chicago-frontend` (там `npm install && npm run dev`).

Шлюз: **http://localhost:4000/api**. Тестовый админ: `+79285660909` / `admin123`.

> На macOS/Linux есть и bash-аналоги: `./scripts/setup.sh`, `./scripts/dev.sh`.
> На Windows используйте именно `npm run setup` / `npm run dev`.

## Prisma 7

Сервисы с БД используют **Prisma 7**: новый генератор `prisma-client` (клиент генерируется
в `src/generated/prisma`, в гите не хранится), драйвер-адаптер `@prisma/adapter-pg`,
конфиг в `prisma.config.ts`. Поэтому **перед первым запуском обязательно** `npm run setup`
(он делает `prisma generate`) — иначе сборка не найдёт сгенерированный клиент.

## Запуск вручную (по шагам)

```bash
# 1. База данных (создаёт базы: auth_db, catalog_db, orders_db, support_db, payment_db)
docker compose up -d

# 2. В каждом пакете (services/*, gateway):
cp .env.example .env
npm install

# 3. Схема + клиент (в каждом сервисе с БД):
npm run prisma:generate && npm run db:push
# меню и админ:
cd services/catalog-service && npm run prisma:seed
cd services/auth-service    && npm run prisma:seed

# 4. Запуск (каждый в своём терминале), gRPC-порты 50051..50056:
cd services/auth-service && npm run start:dev
cd services/catalog-service && npm run start:dev
cd services/orders-service && npm run start:dev
cd services/support-service && npm run start:dev
cd services/notifications-service && npm run start:dev
cd services/payment-service && npm run start:dev
cd gateway && npm run start:dev                    # HTTP 4000
```

## Структура

```
pizza-chicago/
├── web/                  # фронтенд Next.js (Feature-Sliced Design)
│   └── src/{app,views,widgets,features,entities,shared}
├── gateway/              # API-шлюз (точка входа, вся защита)
├── services/
│   ├── auth-service/     # авторизация
│   ├── catalog-service/  # меню
│   ├── orders-service/   # заказы
│   └── support-service/  # поддержка
├── infra/                # инициализация PostgreSQL (4 базы)
├── scripts/              # setup.sh, dev.sh — автоматизация
├── demo-html/            # быстрая демо-версия одним файлом (для показа заказчику)
├── docker-compose.yml
└── ARCHITECTURE.md
```

## Важно про фото

Фото пицц сейчас временные (Unsplash) — заменить на снимки самой пиццерии:
поменять ссылки `imageUrl` в `services/catalog-service/prisma/seed.ts`.

## Демо для показа заказчику

`demo-html/index.html` — сайт одним файлом, открывается в браузере без установки.
Удобно показать с телефона на встрече, пока основной проект разрабатывается.
