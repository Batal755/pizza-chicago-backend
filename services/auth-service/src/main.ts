// Точка входа: поднимаем auth-service как gRPC-микросервис NestJS.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const url = process.env.GRPC_URL ?? '0.0.0.0:50051';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'auth',
        protoPath: join(process.cwd(), 'proto', 'auth.proto'),
        url,
      },
    },
  );

  await app.listen();
  console.log('auth-service gRPC на', url);
}

bootstrap();
