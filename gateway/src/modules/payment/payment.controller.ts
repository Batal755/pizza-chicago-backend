import {
  Body,
  Controller,
  Inject,
  OnModuleInit,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';

/** Платёж по форме payment.proto. */
interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  confirmationUrl: string;
  providerPaymentId: string;
  createdAt: string;
}

/** gRPC-интерфейс PaymentService (camelCase от rpc в payment.proto). */
interface PaymentGrpc {
  createPayment(data: {
    orderId: string;
    amount: number;
    returnUrl: string;
  }): Observable<Payment>;
  confirmPayment(data: {
    paymentId?: string;
    providerPaymentId?: string;
  }): Observable<Payment>;
}

/** gRPC-интерфейс OrdersService (нужен метод смены статуса). */
interface OrdersGrpc {
  updateStatus(data: { id: string; status: string }): Observable<unknown>;
}

/** gRPC-интерфейс NotificationsService. */
interface NotificationsGrpc {
  sendOrderConfirmation(data: {
    orderId: string;
    customerName: string;
    phone: string;
    email: string;
    total: number;
    channel: string;
  }): Observable<unknown>;
}

/** REST-эндпоинты онлайн-оплаты. Проксируют в payment-service по gRPC. */
@Controller('payments')
export class PaymentController implements OnModuleInit {
  private payment!: PaymentGrpc;
  private orders!: OrdersGrpc;
  private notifications!: NotificationsGrpc;

  constructor(
    @Inject('PAYMENT_PACKAGE') private readonly paymentClient: ClientGrpc,
    @Inject('ORDERS_PACKAGE') private readonly ordersClient: ClientGrpc,
    @Inject('NOTIFICATIONS_PACKAGE')
    private readonly notificationsClient: ClientGrpc,
  ) {}

  onModuleInit(): void {
    this.payment = this.paymentClient.getService<PaymentGrpc>('PaymentService');
    this.orders = this.ordersClient.getService<OrdersGrpc>('OrdersService');
    this.notifications =
      this.notificationsClient.getService<NotificationsGrpc>(
        'NotificationsService',
      );
  }

  // Создание платежа. JWT опционально (оплатить может и гость).
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async create(@Body() dto: CreatePaymentDto): Promise<unknown> {
    const payment = await firstValueFrom(
      this.payment.createPayment({
        orderId: dto.orderId,
        amount: dto.amount,
        returnUrl: dto.returnUrl ?? '',
      }),
    );
    return {
      confirmationUrl: payment.confirmationUrl,
      paymentId: payment.id,
      status: payment.status,
    };
  }

  // Вебхук провайдера. БЕЗ JWT (публичный), тело произвольной формы.
  // Body НЕ типизируем DTO, иначе ValidationPipe (whitelist) вырежет поля.
  @Post('webhook')
  async webhook(@Body() body: any): Promise<{ ok: true }> {
    // ЮKassa: body.object.id; мок-провайдер: body.providerPaymentId.
    const providerPaymentId: string =
      body?.object?.id ?? body?.providerPaymentId ?? '';

    const payment = await firstValueFrom(
      this.payment.confirmPayment({ providerPaymentId }),
    );

    await this.postProcess(payment);
    return { ok: true };
  }

  // Подтверждение платежа по нашему id (для МОК-демо без реального вебхука).
  // JWT опционально.
  @UseGuards(OptionalJwtAuthGuard)
  @Post('confirm/:id')
  async confirm(@Param('id') id: string): Promise<{ ok: true }> {
    const payment = await firstValueFrom(
      this.payment.confirmPayment({ paymentId: id }),
    );

    await this.postProcess(payment);
    return { ok: true };
  }

  /**
   * Постобработка успешного платежа: перевести заказ в CONFIRMED и уведомить
   * клиента. Уведомление не критично — оборачиваем в try/catch.
   */
  private async postProcess(payment: Payment): Promise<void> {
    if (payment.status !== 'succeeded') {
      return;
    }

    await firstValueFrom(
      this.orders.updateStatus({ id: payment.orderId, status: 'CONFIRMED' }),
    );

    try {
      await firstValueFrom(
        this.notifications.sendOrderConfirmation({
          orderId: payment.orderId,
          customerName: '',
          phone: '',
          email: '',
          total: payment.amount,
          channel: '',
        }),
      );
    } catch (err) {
      // Сбой уведомления не должен ломать подтверждение оплаты.
      console.error('[PaymentController] sendOrderConfirmation failed', err);
    }
  }
}
