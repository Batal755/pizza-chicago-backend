// Корневой модуль приложения.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    // Глобальная конфигурация из .env
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SupportModule,
  ],
})
export class AppModule {}
