import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { CurrentUserData } from '../decorators/current-user.decorator';

/** Полезная нагрузка access-токена, выпущенного auth-service. */
interface AccessTokenPayload {
  sub: string;
  role: string;
  phone: string;
}

/**
 * Базовый JWT-гвард.
 * Извлекает токен из заголовка Authorization: Bearer <token>,
 * локально верифицирует его секретом JWT_ACCESS_SECRET и кладёт req.user.
 *
 * Поведение при отсутствии/невалидности токена задаётся флагом `optional`
 * у наследников: строгий гвард кидает 401, опциональный — пропускает дальше.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  // Строгий по умолчанию. Опциональный наследник переопределяет на true.
  protected readonly optional: boolean = false;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: CurrentUserData }>();

    const token = this.extractToken(request);

    // Токена нет: для опционального гварда продолжаем анонимно.
    if (!token) {
      if (this.optional) {
        request.user = undefined;
        return true;
      }
      throw new UnauthorizedException('Требуется авторизация');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      request.user = {
        id: payload.sub,
        role: payload.role,
        phone: payload.phone,
      };
      return true;
    } catch {
      // Токен невалиден/просрочен: опциональный гвард — анонимно, строгий — 401.
      if (this.optional) {
        request.user = undefined;
        return true;
      }
      throw new UnauthorizedException('Неверный или просроченный токен');
    }
  }

  /** Достаёт токен из заголовка вида "Bearer <token>". */
  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) {
      return undefined;
    }
    const [scheme, value] = header.split(' ');
    if (scheme !== 'Bearer' || !value) {
      return undefined;
    }
    return value;
  }
}
