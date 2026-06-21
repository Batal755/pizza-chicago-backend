// Корневой модуль приложения.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    // Глобальная конфигурация из .env
    ConfigModule.forRoot({ isGlobal: true }),
    NotificationsModule,
  ],
})
export class AppModule {}
