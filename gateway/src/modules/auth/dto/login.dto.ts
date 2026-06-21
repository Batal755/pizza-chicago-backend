import { Matches, IsString, MinLength } from 'class-validator';

/** Тело запроса входа. Проксируется в auth.login. */
export class LoginDto {
  // Телефон в международном формате: опциональный +, 10–15 цифр.
  @Matches(/^\+?[0-9]{10,15}$/)
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
