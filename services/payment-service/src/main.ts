// Точка входа: поднимаем payment-service как gRPC-микросервис NestJS.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // gRPC-адрес берём из окружения, по умолчанию 0.0.0.0:50056
  const url = process.env.GRPC_URL ?? '0.0.0.0:50056';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        // package и protoPath — из proto/payment.proto
        package: 'payment',
        protoPath: join(process.cwd(), 'proto', 'payment.proto'),
        url,
      },
    },
  );

  await app.listen();
  console.log('payment-service gRPC на', url);
}

bootstrap();
