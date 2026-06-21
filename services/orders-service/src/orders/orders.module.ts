import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

// Модуль заказов. Регистрирует gRPC-клиентов к catalog (цены) и notifications (письмо после заказа).
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'CATALOG_PACKAGE',
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'catalog',
            protoPath: join(process.cwd(), 'proto', 'catalog.proto'),
            url: config.get<string>('CATALOG_GRPC_URL') ?? 'localhost:50052',
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'NOTIFICATIONS_PACKAGE',
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'notifications',
            protoPath: join(process.cwd(), 'proto', 'notifications.proto'),
            url:
              config.get<string>('NOTIFICATIONS_GRPC_URL') ??
              'localhost:50055',
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
