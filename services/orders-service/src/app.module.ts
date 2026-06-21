import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { OrdersModule } from './orders/orders.module';

// Корневой модуль приложения.
@Module({
  imports: [
    // ConfigModule глобально, чтобы env был доступен везде.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    OrdersModule,
  ],
})
export class AppModule {}
