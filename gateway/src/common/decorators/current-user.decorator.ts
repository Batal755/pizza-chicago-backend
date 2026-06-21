import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** Данные пользователя, извлечённые из access-токена гвардом. */
export interface CurrentUserData {
  id: string;
  role: string;
  phone: string;
}

/**
 * Декоратор @CurrentUser() — достаёт req.user, который кладут JWT-гварды.
 * Для OptionalJwtAuthGuard может вернуть undefined (анонимный запрос).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserData | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: CurrentUserData }>();
    return request.user;
  },
);
