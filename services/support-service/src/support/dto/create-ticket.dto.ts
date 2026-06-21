// DTO создания обращения в поддержку с валидацией class-validator.
import { IsString, MinLength } from 'class-validator';

// Данные обращения, приходящие с сайта
export class CreateTicketDto {
  @IsString({ message: 'Имя должно быть строкой' })
  @MinLength(2, { message: 'Имя должно быть не короче 2 символов' })
  name!: string;

  @IsString({ message: 'Контакт должен быть строкой' })
  @MinLength(5, { message: 'Контакт должен быть не короче 5 символов' })
  contact!: string;

  @IsString({ message: 'Сообщение должно быть строкой' })
  @MinLength(5, { message: 'Сообщение должно быть не короче 5 символов' })
  message!: string;
}
