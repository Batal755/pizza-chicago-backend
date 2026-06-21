import {
  Body,
  Controller,
  Inject,
  OnModuleInit,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';

/** gRPC-интерфейс SupportService (имена методов — camelCase от rpc в support.proto). */
interface SupportGrpc {
  create(data: Record<string, unknown>): Observable<unknown>;
}

/** REST-эндпоинты поддержки. Проксируют в support-service по gRPC. */
@Controller('support')
export class SupportController implements OnModuleInit {
  private svc!: SupportGrpc;

  constructor(@Inject('SUPPORT_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.svc = this.client.getService<SupportGrpc>('SupportService');
  }

  // JWT опционально: обращение может оставить и гость.
  // support.proto Create принимает поля напрямую — передаём плоский объект.
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: CurrentUserData | undefined,
  ): Promise<unknown> {
    return firstValueFrom(
      this.svc.create({
        name: dto.name,
        contact: dto.contact,
        message: dto.message,
        userId: user?.id ?? '',
      }),
    );
  }
}
