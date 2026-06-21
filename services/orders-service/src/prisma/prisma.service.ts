import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Обёртка над PrismaClient: управляет подключением по жизненному циклу Nest.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Подключаемся к БД при старте модуля.
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // Аккуратно закрываем соединение при остановке.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
