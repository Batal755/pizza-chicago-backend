# Миграция на Prisma 7 (рецепт для всех сервисов с БД)

Касается: auth-service, catalog-service, orders-service, support-service, payment-service.
(gateway и notifications-service БД не используют — их не трогаем.)

Prisma 7 — крупный релиз. Главные изменения (по офиц. документации):
1. Новый генератор `prisma-client` (без Rust) вместо `prisma-client-js`. Обязателен `output`.
2. Драйвер-адаптер обязателен: PostgreSQL → `@prisma/adapter-pg` + `pg`.
3. `prisma.config.ts` в корне пакета задаёт schema, миграции, seed и datasource.url.
   Переменные окружения больше НЕ грузятся сами — нужен `import "dotenv/config"`.
4. Клиент генерируется НЕ в node_modules, импорт из `output`.
5. seed запускается только явно (`prisma db seed`), путь к нему — в `prisma.config.ts`.

## package.json (в каждом сервисе с БД)

Поднять/добавить:
```
"dependencies": {
  "@prisma/client": "^7.8.0",
  "@prisma/adapter-pg": "^7.8.0",
  "pg": "^8.13.1",
  "dotenv": "^16.4.7",
  ...остальное без изменений
},
"devDependencies": {
  "prisma": "^7.8.0",
  "tsx": "^4.19.2",
  "@types/pg": "^8.11.10",
  ...
}
```
Убрать старый `ts-node` если он был только под seed. Убрать ключ `"prisma": { "seed": ... }` из package.json (теперь в prisma.config.ts).
Скрипты:
```
"prisma:generate": "prisma generate",
"db:push": "prisma db push",
"db:setup": "prisma generate && prisma db push",   // для auth/catalog добавить: " && prisma db seed"
"prisma:seed": "prisma db seed"
```

## prisma/schema.prisma

Заменить блок generator и убрать url из datasource:
```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```
Модели/enum'ы НЕ менять (Bytes/неявных m2m/full-text у нас нет — ломающих изменений по схеме нет).

## prisma.config.ts (НОВЫЙ файл, в корне пакета — рядом с package.json)

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts", // только там, где есть seed (auth, catalog)
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```
Где seed нет — секцию `migrations.seed` можно опустить (оставить только `path`).

## src/prisma/prisma.service.ts

Клиент создаётся через драйвер-адаптер, строка подключения — из ConfigService,
с РАЗУМНЫМ ДЕФОЛТОМ (чтобы сервис стартовал даже без .env, подключаясь к локальной БД).
DEFAULT_DATABASE_URL у каждого сервиса свой (своя база).

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Дефолт под локальный Postgres из docker-compose (на случай отсутствия .env).
const DEFAULT_DATABASE_URL =
  'postgresql://pizza:pizza@localhost:5432/auth_db?schema=public'; // <- ПОМЕНЯТЬ имя базы под сервис

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const connectionString =
      config.get<string>('DATABASE_URL') ?? DEFAULT_DATABASE_URL;
    super({ adapter: new PrismaPg({ connectionString }) });
  }
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```
Базы по сервисам: auth_db / catalog_db / orders_db / support_db / payment_db.
ConfigModule.forRoot({isGlobal:true}) уже подключён в app.module — ConfigService доступен.

## Импорты по всему коду

- `PrismaClient` — из `'../generated/prisma/client'` (путь относительно файла; из src/prisma → `../generated/prisma/client`, из src/<домен> → `../generated/prisma/client`, из prisma/seed.ts → `../src/generated/prisma/client`).
- НЕ импортировать `Prisma`/enum'ы из `@prisma/client`. Вместо этого:
  - enum-значения заменить строковыми литералами: `role: 'ADMIN'`, `status: 'CLOSED'`, `status: 'CONFIRMED'` и т.п. (Prisma принимает строковые литералы для enum-полей).
  - обработку ошибок «не найдено» делать по коду, без namespace `Prisma`:
    ```ts
    catch (e) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === 'P2025') {
        throw new RpcException({ code: status.NOT_FOUND, message: 'Не найдено' });
      }
      throw e;
    }
    ```
    (аналогично P2002 для дубликатов в auth — code === 'P2002').

## prisma/seed.ts (только auth, catalog)

```ts
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://pizza:pizza@localhost:5432/<db>?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
// ...логика seed без изменений, enum-значения — строковыми литералами ('ADMIN')
```

## Тесты

Юнит-тесты мокают PrismaService и не зависят от реального клиента — менять минимально.
Если в тестах есть импорт `Prisma`/enum из `@prisma/client` — заменить на литералы/код-проверки.

## .gitignore

`generated/` уже игнорируется (покрывает `src/generated/`). Клиент генерируется локально.
