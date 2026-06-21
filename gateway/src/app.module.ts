import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './common/guards/optional-jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AdminController } from './modules/admin/admin.controller';
import { AuthController } from './modules/auth/auth.controller';
import { CatalogController } from './modules/catalog/catalog.controller';
import { OrdersController } from './modules/orders/orders.controller';
import { PaymentController } from './modules/payment/payment.controller';
import { SupportController } from './modules/support/support.controller';

@Module({
  imports: [
    // Конфиг доступен глобально, .env читается автоматически.
    ConfigModule.forRoot({ isGlobal: true }),

    // Глобальный лимит запросов: 100 за 60 секунд.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // JwtModule без секрета: секрет передаём явно в verifyAsync внутри гвардов.
    JwtModule.register({}),

    // gRPC-клиенты на все 6 микросервисов. URL — из env с дефолтами.
    ClientsModule.registerAsync([
      {
        name: 'AUTH_PACKAGE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'auth',
            protoPath: join(process.cwd(), 'proto', 'auth.proto'),
            url: config.get<string>('AUTH_GRPC_URL') ?? 'localhost:50051',
          },
        }),
      },
      {
        name: 'CATALOG_PACKAGE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'catalog',
            protoPath: join(process.cwd(), 'proto', 'catalog.proto'),
            url: config.get<string>('CATALOG_GRPC_URL') ?? 'localhost:50052',
          },
        }),
      },
      {
        name: 'ORDERS_PACKAGE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'orders',
            protoPath: join(process.cwd(), 'proto', 'orders.proto'),
            url: config.get<string>('ORDERS_GRPC_URL') ?? 'localhost:50053',
          },
        }),
      },
      {
        name: 'SUPPORT_PACKAGE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'support',
            protoPath: join(process.cwd(), 'proto', 'support.proto'),
            url: config.get<string>('SUPPORT_GRPC_URL') ?? 'localhost:50054',
          },
        }),
      },
      {
        name: 'NOTIFICATIONS_PACKAGE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'notifications',
            protoPath: join(process.cwd(), 'proto', 'notifications.proto'),
            url: config.get<string>('NOTIFICATIONS_GRPC_URL') ?? 'localhost:50055',
          },
        }),
      },
      {
        name: 'PAYMENT_PACKAGE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'payment',
            protoPath: join(process.cwd(), 'proto', 'payment.proto'),
            url: config.get<string>('PAYMENT_GRPC_URL') ?? 'localhost:50056',
          },
        }),
      },
    ]),
  ],
  controllers: [
    AuthController,
    CatalogController,
    OrdersController,
    SupportController,
    AdminController,
    PaymentController,
  ],
  providers: [
    // Глобальный throttler-гвард на все маршруты.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // JWT-гварды как провайдеры — для надёжного разрешения зависимостей.
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    // Гвард проверки роли — для @UseGuards(JwtAuthGuard, RolesGuard).
    RolesGuard,
  ],
})
export class AppModule {}
