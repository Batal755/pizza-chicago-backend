import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Опциональный JWT-гвард.
 * Наследует логику базового, но НЕ кидает ошибку при отсутствии/невалидности
 * токена — просто пропускает запрос дальше с req.user = undefined.
 */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  protected readonly optional = true;
}
