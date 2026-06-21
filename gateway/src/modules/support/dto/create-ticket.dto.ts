import { IsString, MinLength } from 'class-validator';

/** Тело создания обращения в поддержку. Проксируется в support.create. */
export class CreateTicketDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(5)
  contact!: string;

  @IsString()
  @MinLength(5)
  message!: string;
}
