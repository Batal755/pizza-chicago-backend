// Сервис-обёртка над PrismaClient: управляет жизненным циклом подключения.
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Подключаемся к базе при старте модуля
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // Корректно закрываем соединение при остановке модуля
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
