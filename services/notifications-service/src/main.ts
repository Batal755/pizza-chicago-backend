// Точка входа: поднимаем notifications-service как gRPC-микросервис NestJS.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // gRPC-адрес берём из окружения, по умолчанию 0.0.0.0:50055
  const url = process.env.GRPC_URL ?? '0.0.0.0:50055';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        // package и protoPath — по контракту notifications.proto
        package: 'notifications',
        protoPath: join(process.cwd(), 'proto', 'notifications.proto'),
        url,
      },
    },
  );

  await app.listen();
  console.log(`notifications-service gRPC на ${url}`);
}

bootstrap();
