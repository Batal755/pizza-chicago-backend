// Точка входа: поднимаем catalog-service как gRPC-микросервис NestJS.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const url = process.env.GRPC_URL ?? '0.0.0.0:50052';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'catalog',
        protoPath: join(process.cwd(), 'proto', 'catalog.proto'),
        url,
      },
    },
  );

  await app.listen();
  console.log('catalog-service gRPC на', url);
}

bootstrap();
