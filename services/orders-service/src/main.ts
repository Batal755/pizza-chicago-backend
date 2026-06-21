import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

// Точка входа: поднимаем gRPC-микросервис заказов.
async function bootstrap(): Promise<void> {
  const url = process.env.GRPC_URL ?? '0.0.0.0:50053';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'orders',
        protoPath: join(process.cwd(), 'proto', 'orders.proto'),
        url,
      },
    },
  );

  await app.listen();
  // eslint-disable-next-line no-console
  console.log('orders-service gRPC на', url);
}

void bootstrap();
