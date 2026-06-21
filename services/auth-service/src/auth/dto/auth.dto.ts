// DTO входящих сообщений с валидацией class-validator.
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

// Регулярное выражение для телефона: опциональный + и 10–15 цифр
const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

// Регистрация нового пользователя
export class RegisterDto {
  @IsString({ message: 'Имя должно быть строкой' })
  @MinLength(1, { message: 'Имя обязательно' })
  name!: string;

  @Matches(PHONE_REGEX, {
    message: 'Телефон должен содержать от 10 до 15 цифр (опционально с +)',
  })
  phone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email' })
  email?: string;

  @IsString({ message: 'Пароль должен быть строкой' })
  @MinLength(6, { message: 'Пароль должен быть не короче 6 символов' })
  password!: string;
}

// Вход по телефону и паролю
export class LoginDto {
  @Matches(PHONE_REGEX, {
    message: 'Телефон должен содержать от 10 до 15 цифр (опционально с +)',
  })
  phone!: string;

  @IsString({ message: 'Пароль должен быть строкой' })
  @MinLength(6, { message: 'Пароль должен быть не короче 6 символов' })
  password!: string;
}

// Обновление пары токенов по refresh-токену
export class RefreshDto {
  @IsString({ message: 'refreshToken должен быть строкой' })
  @MinLength(1, { message: 'refreshToken обязателен' })
  refreshToken!: string;
}
