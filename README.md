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

## Быстрый старт (одна команда)

Нужны **Node.js 20+** и **Docker**.

```bash
./scripts/setup.sh    # поднимает базу, ставит зависимости, создаёт схемы и меню
./scripts/dev.sh      # запускает всё: 4 сервиса + шлюз + сайт
```

Открыть сайт: **http://localhost:3000**

Тестовый администратор: телефон `+79285660909`, пароль `admin123`.

## Запуск вручную (по шагам)

```bash
# 1. База данных (создаёт 4 базы: auth_db, catalog_db, orders_db, support_db)
docker compose up -d

# 2. В каждом пакете (services/*, gateway, web):
cp .env.example .env
npm install

# 3. Схемы и наполнение (в каждом сервисе):
npx prisma generate && npx prisma db push
# меню и админ:
cd services/catalog-service && npm run prisma:seed
cd services/auth-service    && npm run prisma:seed

# 4. Запуск (каждый в своём терминале):
cd services/auth-service && npm run start:dev      # TCP 4001
cd services/catalog-service && npm run start:dev   # TCP 4002
cd services/orders-service && npm run start:dev    # TCP 4003
cd services/support-service && npm run start:dev   # TCP 4004
cd gateway && npm run start:dev                    # HTTP 4000
cd web && npm run dev                              # http://localhost:3000
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
