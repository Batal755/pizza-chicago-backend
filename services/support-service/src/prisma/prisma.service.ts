// Обёртка над PrismaClient с подключением при старте модуля.
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Дефолт под локальный Postgres из docker-compose (на случай отсутствия .env).
const DEFAULT_DATABASE_URL =
  'postgresql://pizza:pizza@localhost:5432/support_db?schema=public';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    const connectionString =
      config.get<string>('DATABASE_URL') ?? DEFAULT_DATABASE_URL;
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  // Подключаемся к базе данных при инициализации модуля
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // Закрываем соединение при остановке приложения
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
