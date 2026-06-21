// Бизнес-логика аутентификации: регистрация, вход, обновление токенов, профиль.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';

// Стоимость хеширования bcrypt
const BCRYPT_COST = 12;

// Безопасное представление пользователя (без passwordHash)
interface PublicUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
}

// Пара токенов
interface Tokens {
  accessToken: string;
  refreshToken: string;
}

// Полезная нагрузка JWT
interface JwtPayload {
  sub: string;
  phone: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Регистрация нового пользователя
  async register(
    dto: RegisterDto,
  ): Promise<{ user: PublicUser; tokens: Tokens }> {
    // Хешируем пароль перед сохранением
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          phone: dto.phone,
          email: dto.email ?? null,
          passwordHash,
        },
      });
    } catch (error) {
      // P2002 — нарушение уникальности (телефон или email уже заняты)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[] | undefined) ?? [];
        if (target.includes('email')) {
          throw new RpcException({
            code: status.ALREADY_EXISTS,
            message: 'Пользователь с таким email уже существует',
          });
        }
        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message: 'Пользователь с таким телефоном уже существует',
        });
      }
      throw error;
    }

    const tokens = await this.signTokens(user);
    return { user: this.toPublicUser(user), tokens };
  }

  // Вход по телефону и паролю
  async login(dto: LoginDto): Promise<{ user: PublicUser; tokens: Tokens }> {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    // Не уточняем, что именно неверно — телефон или пароль
    if (!user) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Неверный телефон или пароль',
      });
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Неверный телефон или пароль',
      });
    }

    const tokens = await this.signTokens(user);
    return { user: this.toPublicUser(user), tokens };
  }

  // Обновление пары токенов по refresh-токену
  async refresh(dto: RefreshDto): Promise<{ tokens: Tokens }> {
    let payload: JwtPayload;
    try {
      // Проверяем refresh-токен соответствующим секретом
      payload = await this.jwt.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.getRequiredSecret('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Недействительный или просроченный refresh-токен',
      });
    }

    // Убеждаемся, что пользователь всё ещё существует
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Пользователь не найден',
      });
    }

    const tokens = await this.signTokens(user);
    return { tokens };
  }

  // Получение профиля пользователя по идентификатору
  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Пользователь не найден',
      });
    }
    return this.toPublicUser(user);
  }

  // Генерация пары токенов (access + refresh)
  private async signTokens(user: User): Promise<Tokens> {
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      role: user.role,
    };

    // Подписываем токены отдельными секретами и сроками жизни
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.getRequiredSecret('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.getRequiredSecret('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL') ?? '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // Извлекаем секрет из конфигурации; падаем, если он не задан
  private getRequiredSecret(key: string): string {
    const secret = this.config.get<string>(key);
    if (!secret) {
      throw new RpcException({
        code: status.INTERNAL,
        message: `Не задан секрет ${key}`,
      });
    }
    return secret;
  }

  // Приводим запись пользователя к безопасному виду без passwordHash
  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    };
  }
}
