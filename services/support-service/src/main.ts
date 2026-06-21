// Точка входа: поднимаем support-service как gRPC-микросервис NestJS.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // gRPC url берём из окружения, по умолчанию 0.0.0.0:50054
  const url = process.env.GRPC_URL ?? '0.0.0.0:50054';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'support',
        protoPath: join(process.cwd(), 'proto', 'support.proto'),
        url,
      },
    },
  );

  await app.listen();
  console.log('support-service gRPC на', url);
}

bootstrap();
