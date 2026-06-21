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
import { firstValueFrom, Observable } from 'rxjs';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';

/** gRPC-интерфейс OrdersService (имена методов — camelCase от rpc в orders.proto). */
interface OrdersGrpc {
  create(data: Record<string, unknown>): Observable<unknown>;
  findMy(data: { userId: string }): Observable<{ orders: unknown[] }>;
}

/** REST-эндпоинты заказов. Проксируют в orders-service по gRPC. */
@Controller('orders')
export class OrdersController implements OnModuleInit {
  private svc!: OrdersGrpc;

  constructor(@Inject('ORDERS_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.svc = this.client.getService<OrdersGrpc>('OrdersService');
  }

  // JWT опционально: оформить заказ может и гость, и авторизованный.
  // orders.proto Create принимает поля напрямую — передаём плоский объект.
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: CurrentUserData | undefined,
  ): Promise<unknown> {
    return firstValueFrom(
      this.svc.create({ ...dto, userId: user?.id ?? '' }),
    );
  }

  // JWT обязателен: список заказов привязан к пользователю из токена.
  // Распаковка: gRPC отдаёт { orders }, фронт ждёт массив.
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async my(@CurrentUser() user: CurrentUserData): Promise<unknown> {
    const res = await firstValueFrom(this.svc.findMy({ userId: user.id }));
    return res.orders;
  }
}
