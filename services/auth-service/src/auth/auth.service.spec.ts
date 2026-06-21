// Unit-тесты AuthService: моки PrismaService, JwtService и ConfigService.
// Реальная БД и сеть не используются.
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  // Мок Prisma: только то, что вызывает сервис.
  let prisma: { user: { create: jest.Mock; findUnique: jest.Mock } };
  // Мок JwtService: подпись возвращает предсказуемые строки.
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  // Мок ConfigService: секреты всегда заданы (иначе signTokens бросит RpcException).
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    jwt = {
      // Возвращаем разные токены для access/refresh по порядку вызовов.
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token'),
      verifyAsync: jest.fn(),
    };
    config = {
      // Любой ключ -> непустой секрет.
      get: jest.fn().mockReturnValue('test-secret'),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('register', () => {
    it('хэширует пароль и НЕ возвращает passwordHash', async () => {
      // Шпионим за bcrypt.hash, чтобы убедиться в хэшировании.
      const hashSpy = jest
        .spyOn(bcrypt, 'hash')
        .mockResolvedValue('hashed-password' as never);

      prisma.user.create.mockResolvedValue({
        id: 'u1',
        name: 'Иван',
        phone: '+79991234567',
        email: null,
        passwordHash: 'hashed-password',
        role: 'CUSTOMER',
      });

      const result = await service.register({
        name: 'Иван',
        phone: '+79991234567',
        password: 'secret123',
      });

      // Пароль был захэширован перед сохранением.
      expect(hashSpy).toHaveBeenCalledWith('secret123', 12);
      // В data.create ушёл именно хэш, а не сырой пароль.
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: 'hashed-password' }),
        }),
      );

      // Наружу — безопасный пользователь без passwordHash.
      expect(result.user).toEqual({
        id: 'u1',
        name: 'Иван',
        phone: '+79991234567',
        role: 'CUSTOMER',
      });
      expect((result.user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      // Токены сгенерированы.
      expect(result.tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('дубликат телефона (P2002) -> RpcException', async () => {
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed' as never);

      // Ошибка нарушения уникальности: распознаётся по коду P2002.
      const dupError = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['phone'] },
      });
      prisma.user.create.mockRejectedValue(dupError);

      await expect(
        service.register({
          name: 'Иван',
          phone: '+79991234567',
          password: 'secret123',
        }),
      ).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe('login', () => {
    it('неверный пароль -> RpcException', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'Иван',
        phone: '+79991234567',
        passwordHash: 'hashed',
        role: 'CUSTOMER',
      });
      // bcrypt.compare возвращает false — пароль не совпал.
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.login({ phone: '+79991234567', password: 'wrong' }),
      ).rejects.toBeInstanceOf(RpcException);
    });

    it('несуществующий телефон -> RpcException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ phone: '+70000000000', password: 'whatever' }),
      ).rejects.toBeInstanceOf(RpcException);
    });

    it('успешный вход возвращает { user, tokens } без passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'Иван',
        phone: '+79991234567',
        passwordHash: 'hashed',
        role: 'CUSTOMER',
      });
      // Пароль совпал.
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.login({
        phone: '+79991234567',
        password: 'secret123',
      });

      expect(result.user).toEqual({
        id: 'u1',
        name: 'Иван',
        phone: '+79991234567',
        role: 'CUSTOMER',
      });
      expect((result.user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result.tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });
});
