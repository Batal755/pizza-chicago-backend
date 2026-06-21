// Корневой модуль приложения payment-service.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    // Глобальная конфигурация из .env, доступна во всех модулях
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PaymentModule,
  ],
})
export class AppModule {}
