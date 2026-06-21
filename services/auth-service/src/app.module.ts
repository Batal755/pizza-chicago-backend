// Корневой модуль приложения.
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // Глобальная конфигурация из .env
    ConfigModule.forRoot({ isGlobal: true }),
    // JWT-модуль; секреты и TTL задаём вручную при подписи в AuthService
    JwtModule.register({}),
    PrismaModule,
    AuthModule,
  ],
})
export class AppModule {}
