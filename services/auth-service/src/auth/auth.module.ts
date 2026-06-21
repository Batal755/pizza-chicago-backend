// Модуль аутентификации: контроллер сообщений + сервис.
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  // Регистрируем JwtModule пустым: секрет и TTL указываем вручную при подписи
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
