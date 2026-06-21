# gRPC — правила подключения (единый стандарт)

Все микросервисы общаются по **gRPC** (вместо TCP). Контракты — в `proto/*.proto`.

## Порты (gRPC)

| сервис | gRPC url | proto package |
|--------|----------|---------------|
| auth-service | 0.0.0.0:50051 | `auth` |
| catalog-service | 0.0.0.0:50052 | `catalog` |
| orders-service | 0.0.0.0:50053 | `orders` |
| support-service | 0.0.0.0:50054 | `support` |
| notifications-service | 0.0.0.0:50055 | `notifications` |
| payment-service | 0.0.0.0:50056 | `payment` |

gateway остаётся HTTP :4000 и выступает gRPC-**клиентом** ко всем сервисам.

## Расположение proto

Источник правды — корневой `proto/`. Каждый пакет, который поднимает gRPC-сервер
или клиент, держит у себя **копию** нужных `.proto` в `<пакет>/proto/` и ссылается на неё через
`join(process.cwd(), 'proto', '<name>.proto')` (cwd = корень пакета при `npm run ...`).
Скопировать: `cp ../../proto/<name>.proto ./proto/` (для сервиса) или `cp ../proto/<name>.proto ./proto/` (для gateway).

## Зависимости (добавить в package.json каждого gRPC-пакета)

```
"@grpc/grpc-js": "^1.11.3",
"@grpc/proto-loader": "^0.7.13"
```
(`@nestjs/microservices` уже есть.)

## Сервер: bootstrap микросервиса (src/main.ts)

```ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'auth', // <- из .proto
      protoPath: join(process.cwd(), 'proto', 'auth.proto'),
      url: process.env.GRPC_URL ?? '0.0.0.0:50051',
    },
  });
  await app.listen();
  console.log('auth-service gRPC на', process.env.GRPC_URL ?? '0.0.0.0:50051');
}
bootstrap();
```

## Сервер: контроллер (@GrpcMethod)

Имя сервиса и метода — РОВНО как в .proto. Возвращаемый объект — по форме message
(поля camelCase — совпадают с нашими .proto). Ответы-обёртки возвращай как объект:
`GetMenu` -> `{ categories: [...] }`, `FindMy` -> `{ orders: [...] }`, и т.д.

```ts
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @GrpcMethod('AuthService', 'Register')
  register(data: { name: string; phone: string; email: string; password: string }) {
    return this.auth.register(data); // -> { user, tokens }
  }
}
```

Ошибки: `throw new RpcException({ code: status.NOT_FOUND, message: 'Заказ не найден' })`
(`import { status } from '@grpc/grpc-js'`). Для бизнес-ошибок можно `status.INVALID_ARGUMENT`.

## Клиент: подключение (gateway и orders-service)

```ts
// в *.module.ts
ClientsModule.registerAsync([
  {
    name: 'AUTH_PACKAGE',
    useFactory: (config: ConfigService) => ({
      transport: Transport.GRPC,
      options: {
        package: 'auth',
        protoPath: join(process.cwd(), 'proto', 'auth.proto'),
        url: config.get<string>('AUTH_GRPC_URL') ?? 'localhost:50051',
      },
    }),
    inject: [ConfigService],
  },
]),
```

```ts
// в сервисе-потребителе
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

interface AuthGrpc {
  register(data: any): Observable<any>;
  login(data: any): Observable<any>;
  // ... методы как rpc в .proto, имена в camelCase
}

@Injectable()
export class AuthProxy implements OnModuleInit {
  private svc!: AuthGrpc;
  constructor(@Inject('AUTH_PACKAGE') private readonly client: ClientGrpc) {}
  onModuleInit() {
    this.svc = this.client.getService<AuthGrpc>('AuthService'); // <- имя service из .proto
  }
  register(dto: any) {
    return firstValueFrom(this.svc.register(dto));
  }
}
```

Имена методов в клиентском интерфейсе — camelCase от rpc (`Register` -> `register`,
`GetMenu` -> `getMenu`, `GetProductsByIds` -> `getProductsByIds`).

## Важно для gateway (сохранить REST-контракт фронтенда)

Фронтенд ждёт массивы, а gRPC отдаёт обёртки. Gateway РАСПАКОВЫВАЕТ:
- `GET /catalog/menu` -> вернуть `response.categories` (а не весь объект)
- `GET /orders/my`, `GET /admin/orders` -> `response.orders`
- `GET /admin/categories` -> `response.categories`
- `GET /admin/tickets` -> `response.tickets`

Маппинг ошибок gRPC -> HTTP в AllExceptionsFilter: у ошибки gRPC есть `code` (число)
и `details`/`message`. NOT_FOUND(5)->404, INVALID_ARGUMENT(3)->400, UNAUTHENTICATED(16)->401,
иначе 400. Наружу — только message, без стектрейса.

## Связи между сервисами

- orders-service — gRPC-клиент к **catalog** (цены), **notifications** (письмо/смс после заказа),
  и к **payment** не ходит напрямую (платёж инициирует gateway).
- gateway — gRPC-клиент ко **всем** сервисам.
- payment-service подтверждение платежа -> gateway -> orders.updateStatus + notifications.
