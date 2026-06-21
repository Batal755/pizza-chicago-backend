// Сервис оплаты: бизнес-логика создания/подтверждения/получения платежей.
// Интеграция с ЮKassa (YooKassa) с режимом MOCK для работы без ключей.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Payment } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConfirmRequest,
  CreatePaymentRequest,
  GetPaymentRequest,
  PaymentReply,
} from './payment.types';

// Минимальная форма ответа ЮKassa, которая нам нужна.
interface YooKassaPaymentResponse {
  id: string;
  confirmation?: {
    confirmation_url?: string;
  };
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Создать платёж: запись в БД (status=pending), затем mock или реальный ЮKassa.
  async createPayment(data: CreatePaymentRequest): Promise<PaymentReply> {
    // 1. Создаём запись платежа в статусе pending
    const payment = await this.prisma.payment.create({
      data: {
        orderId: data.orderId,
        amount: data.amount,
        status: 'pending',
      },
    });

    // 2. Выбираем режим: mock или боевой вызов ЮKassa
    if (this.isMock()) {
      return this.fillMockConfirmation(payment, data.returnUrl);
    }

    // 3. Боевой режим: создаём платёж в ЮKassa и сохраняем результат
    return this.createYooKassaPayment(payment, data);
  }

  // Подтвердить платёж: ищем по нашему id или id провайдера, помечаем succeeded.
  async confirmPayment(data: ConfirmRequest): Promise<PaymentReply> {
    const payment = await this.findForConfirm(data);
    if (!payment) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Платёж не найден',
      });
    }

    // В mock-режиме просто помечаем succeeded; в бою сюда приходим после вебхука.
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'succeeded' },
    });

    return this.toReply(updated);
  }

  // Получить платёж по нашему id или по orderId.
  async getPayment(data: GetPaymentRequest): Promise<PaymentReply> {
    let payment: Payment | null = null;

    if (data.id) {
      payment = await this.prisma.payment.findUnique({
        where: { id: data.id },
      });
    } else if (data.orderId) {
      // По orderId берём самый свежий платёж
      payment = await this.prisma.payment.findFirst({
        where: { orderId: data.orderId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!payment) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Платёж не найден',
      });
    }

    return this.toReply(payment);
  }

  // --- Вспомогательное ---

  // Режим mock включён, если PAYMENT_MOCK=true ИЛИ не заданы ключи ЮKassa.
  private isMock(): boolean {
    const mockFlag = this.config.get<string>('PAYMENT_MOCK');
    const shopId = this.config.get<string>('YOOKASSA_SHOP_ID');
    const secretKey = this.config.get<string>('YOOKASSA_SECRET_KEY');
    return mockFlag === 'true' || !shopId || !secretKey;
  }

  // Поиск платежа для подтверждения: по нашему paymentId или id провайдера.
  private async findForConfirm(data: ConfirmRequest): Promise<Payment | null> {
    if (data.paymentId) {
      return this.prisma.payment.findUnique({ where: { id: data.paymentId } });
    }
    if (data.providerPaymentId) {
      return this.prisma.payment.findFirst({
        where: { providerPaymentId: data.providerPaymentId },
      });
    }
    return null;
  }

  // MOCK: генерируем фейковый providerPaymentId и confirmationUrl, сохраняем.
  private async fillMockConfirmation(
    payment: Payment,
    returnUrl: string,
  ): Promise<PaymentReply> {
    const base = returnUrl || 'http://localhost:3000';
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: `mock_${payment.id}`,
        confirmationUrl: `${base}/pay/mock/${payment.id}`,
      },
    });
    return this.toReply(updated);
  }

  // Боевой режим: POST https://api.yookassa.ru/v3/payments через global fetch.
  private async createYooKassaPayment(
    payment: Payment,
    data: CreatePaymentRequest,
  ): Promise<PaymentReply> {
    const shopId = this.config.get<string>('YOOKASSA_SHOP_ID') ?? '';
    const secretKey = this.config.get<string>('YOOKASSA_SECRET_KEY') ?? '';
    // Basic-авторизация: base64("shopId:secretKey")
    const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

    const body = {
      amount: {
        // ЮKassa ждёт строку с двумя знаками после точки
        value: `${data.amount}.00`,
        currency: 'RUB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: data.returnUrl,
      },
      metadata: { orderId: data.orderId },
    };

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        // Ключ идемпотентности — используем id нашего платежа
        'Idempotence-Key': payment.id,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new RpcException({
        code: status.INTERNAL,
        message: `Ошибка ЮKassa: ${response.status} ${details}`,
      });
    }

    const result = (await response.json()) as YooKassaPaymentResponse;

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: result.id,
        confirmationUrl: result.confirmation?.confirmation_url ?? null,
      },
    });

    return this.toReply(updated);
  }

  // Приводим запись Payment к форме message Payment (без null, createdAt -> ISO).
  private toReply(payment: Payment): PaymentReply {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      status: payment.status,
      confirmationUrl: payment.confirmationUrl ?? '',
      providerPaymentId: payment.providerPaymentId ?? '',
      createdAt: payment.createdAt.toISOString(),
    };
  }
}
