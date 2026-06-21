import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/** Тело запроса регистрации. Проксируется в auth.register. */
export class RegisterDto {
  @IsString()
  @MinLength(2)
  name!: string;

  // Телефон в международном формате: опциональный +, 10–15 цифр.
  @Matches(/^\+?[0-9]{10,15}$/)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
