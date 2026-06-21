import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Дефолт под локальный Postgres из docker-compose (на случай отсутствия .env).
const DEFAULT_DATABASE_URL =
  'postgresql://pizza:pizza@localhost:5432/orders_db?schema=public';

// Обёртка над PrismaClient: управляет подключением по жизненному циклу Nest.
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

  // Подключаемся к БД при старте модуля.
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // Аккуратно закрываем соединение при остановке.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
