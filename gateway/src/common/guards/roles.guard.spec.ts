// Unit-тесты RolesGuard. Reflector и ExecutionContext мокаем вручную.
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

// Утилита: собирает поддельный ExecutionContext с заданным request.user.
function makeContext(user?: { role: string }): ExecutionContext {
  const request = { user };
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('нет метаданных roles -> пропускает (true)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(makeContext({ role: 'CUSTOMER' }))).toBe(true);
  });

  it('пустой список ролей -> пропускает (true)', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(makeContext({ role: 'CUSTOMER' }))).toBe(true);
  });

  it('требуется ADMIN и роль пользователя ADMIN -> пропускает (true)', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(guard.canActivate(makeContext({ role: 'ADMIN' }))).toBe(true);
  });

  it('требуется ADMIN, а роль иная -> ForbiddenException', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(makeContext({ role: 'CUSTOMER' }))).toThrow(
      ForbiddenException,
    );
  });

  it('требуется ADMIN, а пользователя нет -> ForbiddenException', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
