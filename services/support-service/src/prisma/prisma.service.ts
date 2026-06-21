// Обёртка над PrismaClient с подключением при старте модуля.
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Подключаемся к базе данных при инициализации модуля
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // Закрываем соединение при остановке приложения
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
