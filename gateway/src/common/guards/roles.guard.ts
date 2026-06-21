import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CurrentUserData } from '../decorators/current-user.decorator';

/**
 * Гвард проверки роли.
 * Читает метаданные 'roles' (с уровня обработчика и класса) через Reflector
 * и сверяет их с request.user.role, который заполняет JwtAuthGuard.
 *
 * Логика:
 *  - метаданных 'roles' нет → ограничений нет, пропускаем;
 *  - роли заданы, но пользователя нет или его роль не входит в список → 403.
 *
 * Рассчитан на использование ПОСЛЕ JwtAuthGuard (тот уже положил request.user).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Собираем требуемые роли с обработчика и класса.
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(
      'roles',
      [context.getHandler(), context.getClass()],
    );

    // Метаданных нет — маршрут не ограничен по ролям.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: CurrentUserData }>();
    const user = request.user;

    // Пользователя нет или его роль не входит в список — доступ запрещён.
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав');
    }

    return true;
  }
}
