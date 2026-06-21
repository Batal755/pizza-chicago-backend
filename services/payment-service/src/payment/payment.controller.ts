// Контроллер оплаты: обрабатывает gRPC-вызовы по контракту payment.proto.
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentService } from './payment.service';
import {
  ConfirmRequest,
  CreatePaymentRequest,
  GetPaymentRequest,
  PaymentReply,
} from './payment.types';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // Создать платёж по заказу -> Payment (с confirmationUrl)
  @GrpcMethod('PaymentService', 'CreatePayment')
  createPayment(data: CreatePaymentRequest): Promise<PaymentReply> {
    return this.paymentService.createPayment(data);
  }

  // Подтвердить платёж (после вебхука провайдера) -> Payment
  @GrpcMethod('PaymentService', 'ConfirmPayment')
  confirmPayment(data: ConfirmRequest): Promise<PaymentReply> {
    return this.paymentService.confirmPayment(data);
  }

  // Получить платёж по id или orderId -> Payment
  @GrpcMethod('PaymentService', 'GetPayment')
  getPayment(data: GetPaymentRequest): Promise<PaymentReply> {
    return this.paymentService.getPayment(data);
  }
}
