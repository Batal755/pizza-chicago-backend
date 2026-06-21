import { SetMetadata } from '@nestjs/common';

/**
 * Декоратор @Roles('ADMIN', ...) — навешивает на маршрут список допустимых ролей.
 * Метаданные читает RolesGuard, который сверяет их с request.user.role.
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
