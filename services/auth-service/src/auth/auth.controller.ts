// Контроллер gRPC-методов auth-service.
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // rpc Register (RegisterRequest) returns (AuthResponse) -> { user, tokens }
  @GrpcMethod('AuthService', 'Register')
  register(data: RegisterDto) {
    return this.authService.register(data);
  }

  // rpc Login (LoginRequest) returns (AuthResponse) -> { user, tokens }
  @GrpcMethod('AuthService', 'Login')
  login(data: LoginDto) {
    return this.authService.login(data);
  }

  // rpc Refresh (RefreshRequest) returns (TokensResponse) -> { tokens }
  @GrpcMethod('AuthService', 'Refresh')
  refresh(data: RefreshDto) {
    return this.authService.refresh(data);
  }

  // rpc Me (MeRequest) returns (User) -> user
  @GrpcMethod('AuthService', 'Me')
  me(data: { userId: string }) {
    return this.authService.me(data.userId);
  }
}
