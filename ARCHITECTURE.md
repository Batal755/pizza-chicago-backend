# Архитектура Pizza Chicago

Микросервисный бэкенд + фронтенд на Feature-Sliced Design.

## Карта системы

```
                  ┌─────────────────────┐
   Браузер  ───►  │   web (Next.js FSD) │  :3000
                  └──────────┬──────────┘
                             │ HTTP REST
                  ┌──────────▼──────────┐
                  │   api-gateway       │  :4000   helmet, throttler, CORS,
                  │   (Nest HTTP)       │          JWT-проверка, валидация
                  └──┬────┬────┬────┬───┘
            TCP   │    │    │    │   TCP
        ┌─────────▼┐ ┌─▼────────┐ ┌▼──────────┐ ┌▼───────────┐
        │  auth    │ │ catalog  │ │  orders   │ │  support   │
        │ :4001    │ │ :4002    │ │  :4003    │ │  :4004     │
        └────┬─────┘ └────┬─────┘ └─────┬─────┘ └─────┬──────┘
          auth_db      catalog_db    orders_db     support_db
        (Postgres, отдельная база данных на каждый сервис)
```

orders-service вызывает catalog-service (TCP) за актуальными ценами при оформлении заказа.

## Транспорт

Внутренняя связь — **gRPC** (`Transport.GRPC`). Контракты — в `proto/*.proto`,
правила подключения — в [GRPC-WIRING.md](GRPC-WIRING.md).
Шлюз держит gRPC-клиент на каждый сервис (`ClientGrpc` + `getService`).

Помимо четырёх базовых сервисов есть ещё два:
- **notifications-service** (gRPC :50055) — шлёт клиенту подтверждение заказа на email/SMS
  (вызывается из orders-service после успешного заказа; есть MOCK-режим без кредов).
- **payment-service** (gRPC :50056, БД `payment_db`) — онлайн-оплата в стиле ЮKassa
  (есть MOCK-режим). Платёж инициирует шлюз (`POST /payments`), подтверждение приходит
  вебхуком (`POST /payments/webhook`) → шлюз дёргает `orders.updateStatus` + уведомление.

> Разделы ниже про «cmd» — историческое описание контрактов; сейчас это gRPC-методы
> с теми же названиями/полями (см. `proto/`). Формы данных совпадают.

## Контракты сообщений (cmd) — единый источник правды

### auth-service (TCP 4001)
| cmd | payload | ответ |
|-----|---------|-------|
| `auth.register` | `{ name, phone, email?, password }` | `{ user, tokens }` |
| `auth.login` | `{ phone, password }` | `{ user, tokens }` |
| `auth.refresh` | `{ refreshToken }` | `{ tokens }` |
| `auth.me` | `{ userId }` | `user` |

`user = { id, name, phone, role }`
`tokens = { accessToken, refreshToken }`

### catalog-service (TCP 4002)
| cmd | payload | ответ |
|-----|---------|-------|
| `catalog.menu` | `{}` | `Category[]` (с вложенными `products`) |
| `catalog.products.byIds` | `{ ids: string[] }` | `Product[]` |

### orders-service (TCP 4003)
| cmd | payload | ответ |
|-----|---------|-------|
| `orders.create` | `{ dto, userId? }` | `Order` |
| `orders.my` | `{ userId }` | `Order[]` |

orders хранит снимок товара (`productId`, `productName`, `price`) — без межбазовых связей.

### support-service (TCP 4004)
| cmd | payload | ответ |
|-----|---------|-------|
| `support.create` | `{ dto, userId? }` | `Ticket` |

## Админ-контракты (только для роли ADMIN)

### catalog-service
| cmd | payload | ответ |
|-----|---------|-------|
| `catalog.categories` | `{}` | `Category[]` (без товаров, по sortOrder) |
| `catalog.product.create` | `{ name, description, price, imageUrl, categoryId, isAvailable? }` | `Product` |
| `catalog.product.update` | `{ id, data: {<частичные поля>} }` | `Product` |
| `catalog.product.delete` | `{ id }` | `{ ok: true }` |

### orders-service
| cmd | payload | ответ |
|-----|---------|-------|
| `orders.all` | `{ status? }` | `Order[]` (все, новые сверху, с items) |
| `orders.updateStatus` | `{ id, status }` | `Order` |

### support-service
| cmd | payload | ответ |
|-----|---------|-------|
| `support.list` | `{}` | `Ticket[]` (новые сверху) |
| `support.close` | `{ id }` | `Ticket` |

## REST API шлюза (префикс `/api`)

| метод | путь | защита | проксирует |
|-------|------|--------|------------|
| POST | `/auth/register` | — (throttle строгий) | `auth.register` |
| POST | `/auth/login` | — (throttle строгий) | `auth.login` |
| POST | `/auth/refresh` | — | `auth.refresh` |
| GET | `/auth/me` | JWT | `auth.me` |
| GET | `/catalog/menu` | — | `catalog.menu` |
| POST | `/orders` | JWT опционально | `orders.create` |
| GET | `/orders/my` | JWT | `orders.my` |
| POST | `/support` | JWT опционально | `support.create` |
| GET | `/admin/orders` | JWT + ADMIN | `orders.all` |
| PATCH | `/admin/orders/:id/status` | JWT + ADMIN | `orders.updateStatus` |
| GET | `/admin/categories` | JWT + ADMIN | `catalog.categories` |
| POST | `/admin/products` | JWT + ADMIN | `catalog.product.create` |
| PATCH | `/admin/products/:id` | JWT + ADMIN | `catalog.product.update` |
| DELETE | `/admin/products/:id` | JWT + ADMIN | `catalog.product.delete` |
| GET | `/admin/tickets` | JWT + ADMIN | `support.list` |
| PATCH | `/admin/tickets/:id/close` | JWT + ADMIN | `support.close` |

Защита админки: `JwtAuthGuard` + `RolesGuard` (`@Roles('ADMIN')`), роль берётся из JWT.
`OrderStatus`: NEW, CONFIRMED, COOKING, DELIVERING, DONE, CANCELLED.

## Безопасность (стандарты)

- Пароли — bcrypt (cost 12), наружу `passwordHash` не отдаётся никогда.
- JWT: access 15 мин (`JWT_ACCESS_SECRET`), refresh 7 дней (`JWT_REFRESH_SECRET`).
- Шлюз проверяет access-токен локально (без похода в auth-сервис).
- `helmet`, `compression`, CORS только на `WEB_ORIGIN`.
- `@nestjs/throttler`: общий лимит + ужесточённый на `/auth/*`.
- `ValidationPipe({ whitelist:true, forbidNonWhitelisted:true, transform:true })`.
- Глобальный фильтр исключений — наружу не утекают стектрейсы и детали БД.
- Секреты только через `.env`, в коде значений нет.
- База данных на каждый сервис изолирована (database-per-service).

## Порты и базы

| компонент | порт | база |
|-----------|------|------|
| web | 3000 | — |
| gateway | 4000 (HTTP) | — |
| auth-service | 4001 (TCP) | `auth_db` |
| catalog-service | 4002 (TCP) | `catalog_db` |
| orders-service | 4003 (TCP) | `orders_db` |
| support-service | 4004 (TCP) | `support_db` |
| postgres | 5432 | 4 базы |

## Frontend — Feature-Sliced Design

```
web/src/
├── app/        # роутинг Next.js (тонкие обёртки над views) + провайдеры
├── views/      # FSD-слой pages: композиция страниц (home, login, ...)
├── widgets/    # header, footer, menu-catalog, cart-drawer
├── features/   # auth, cart, create-order, support-form
├── entities/   # product, category, order, user (session)
└── shared/     # ui-kit, api-client, config, lib
```

Импорты строго вниз по слоям: app → views → widgets → features → entities → shared.
Состояние корзины и сессии — Zustand. Запросы — единый клиент в `shared/api`.
```
