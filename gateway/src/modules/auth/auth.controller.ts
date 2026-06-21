import {
  Body,
  Controller,
  Get,
  Inject,
  OnModuleInit,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Throttle } from '@nestjs/throttler';
import { firstValueFrom, Observable } from 'rxjs';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';

/** gRPC-интерфейс AuthService (имена методов — camelCase от rpc в auth.proto). */
interface AuthGrpc {
  register(data: RegisterDto): Observable<unknown>;
  login(data: LoginDto): Observable<unknown>;
  refresh(data: RefreshDto): Observable<unknown>;
  me(data: { userId: string }): Observable<unknown>;
}

/** REST-эндпоинты аутентификации. Проксируют в auth-service по gRPC. */
@Controller('auth')
export class AuthController implements OnModuleInit {
  private svc!: AuthGrpc;

  constructor(@Inject('AUTH_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.svc = this.client.getService<AuthGrpc>('AuthService');
  }

  // Строгий throttle: 10 запросов в минуту против перебора.
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<unknown> {
    return firstValueFrom(this.svc.register(dto));
  }

  // Строгий throttle: защита от подбора пароля.
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<unknown> {
    return firstValueFrom(this.svc.login(dto));
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshDto): Promise<unknown> {
    return firstValueFrom(this.svc.refresh(dto));
  }

  // JWT обязателен: id берём из проверенного токена, не из тела запроса.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: CurrentUserData): Promise<unknown> {
    return firstValueFrom(this.svc.me({ userId: user.id }));
  }
}
