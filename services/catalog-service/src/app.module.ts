// Корневой модуль приложения catalog-service.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [
    // Глобальная конфигурация из .env, доступна во всех модулях
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CatalogModule,
  ],
})
export class AppModule {}
