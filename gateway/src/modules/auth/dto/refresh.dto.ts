import { IsString, MinLength } from 'class-validator';

/** Тело запроса обновления токенов. Проксируется в auth.refresh. */
export class RefreshDto {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
