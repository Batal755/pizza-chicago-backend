// Unit-тесты PaymentService: мок PrismaService и ConfigService.
// Режим PAYMENT_MOCK включён (ConfigService возвращает 'true' и пустые ключи ЮKassa),
// поэтому реальная БД и реальный HTTP-вызов ЮKassa не используются.
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;

  // Мок Prisma: только методы модели payment, которые использует сервис.
  let prisma: {
    payment: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  // Значения конфигурации для mock-режима: флаг включён, ключи ЮKassa пустые.
  const configValues: Record<string, string | undefined> = {
    PAYMENT_MOCK: 'true',
    YOOKASSA_SHOP_ID: '',
    YOOKASSA_SECRET_KEY: '',
  };

  // Мок ConfigService.get(key) -> значение из словаря выше.
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  };

  beforeEach(async () => {
    // Базовая фиксированная дата — createdAt должен быть настоящим Date (см. toReply).
    const createdAt = new Date('2026-06-20T10:00:00.000Z');

    prisma = {
      payment: {
        // create возвращает запись pending без providerPaymentId/confirmationUrl.
        create: jest.fn(
          ({
            data,
          }: {
            data: { orderId: string; amount: number; status: string };
          }) =>
          Promise.resolve({
            id: 'pay_1',
            orderId: data.orderId,
            amount: data.amount,
            status: data.status,
            providerPaymentId: null,
            confirmationUrl: null,
            createdAt,
          }),
        ),
        // update «эхом» применяет переданные поля к записи —
        // так в результате видно ровно то, что записал сервис.
        update: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) =>
          Promise.resolve({
            id: where.id,
            orderId: 'order_1',
            amount: 500,
            status: 'pending',
            providerPaymentId: null,
            confirmationUrl: null,
            createdAt,
            ...data,
          }),
        ),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(PaymentService);

    // global fetch мокаем, чтобы убедиться: в mock-режиме он не вызывается.
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    // Сбрасываем все моки между тестами.
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('создаёт запись pending, проставляет mock_* providerPaymentId и confirmationUrl', async () => {
      const result = await service.createPayment({
        orderId: 'order_1',
        amount: 500,
        returnUrl: 'http://shop.example',
      });

      // 1. Запись создаётся в статусе pending.
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: { orderId: 'order_1', amount: 500, status: 'pending' },
      });

      // 2. В mock-режиме сервис записывает providerPaymentId вида mock_* и confirmationUrl.
      const updateArg = prisma.payment.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 'pay_1' });
      expect(updateArg.data.providerPaymentId).toBe('mock_pay_1');
      expect(updateArg.data.confirmationUrl).toBe(
        'http://shop.example/pay/mock/pay_1',
      );

      // 3. Возвращается итоговый платёж с этими полями (createdAt -> ISO).
      expect(result.id).toBe('pay_1');
      expect(result.status).toBe('pending');
      expect(result.providerPaymentId).toMatch(/^mock_/);
      expect(result.confirmationUrl).toBe(
        'http://shop.example/pay/mock/pay_1',
      );
      expect(result.createdAt).toBe('2026-06-20T10:00:00.000Z');
    });

    it('в mock-режиме НЕ обращается к ЮKassa через fetch', async () => {
      await service.createPayment({
        orderId: 'order_1',
        amount: 500,
        returnUrl: 'http://shop.example',
      });

      // Реальный HTTP-вызов провайдера не должен выполняться.
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('confirmPayment', () => {
    it('по paymentId находит платёж и помечает его succeeded', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay_1',
        orderId: 'order_1',
        amount: 500,
        status: 'pending',
        providerPaymentId: 'mock_pay_1',
        confirmationUrl: 'http://shop.example/pay/mock/pay_1',
        createdAt: new Date('2026-06-20T10:00:00.000Z'),
      });

      const result = await service.confirmPayment({
        paymentId: 'pay_1',
        providerPaymentId: '',
      });

      // Поиск по нашему id.
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'pay_1' },
      });
      // Статус переведён в succeeded.
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_1' },
        data: { status: 'succeeded' },
      });
      expect(result.status).toBe('succeeded');
    });

    it('по providerPaymentId находит платёж через findFirst и помечает succeeded', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay_2',
        orderId: 'order_2',
        amount: 700,
        status: 'pending',
        providerPaymentId: 'mock_pay_2',
        confirmationUrl: '',
        createdAt: new Date('2026-06-20T10:00:00.000Z'),
      });

      // paymentId пустой -> срабатывает ветка поиска по providerPaymentId.
      const result = await service.confirmPayment({
        paymentId: '',
        providerPaymentId: 'mock_pay_2',
      });

      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { providerPaymentId: 'mock_pay_2' },
      });
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_2' },
        data: { status: 'succeeded' },
      });
      expect(result.status).toBe('succeeded');
    });

    it('платёж не найден -> RpcException', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmPayment({ paymentId: 'missing', providerPaymentId: '' }),
      ).rejects.toBeInstanceOf(RpcException);

      // update не вызывается, если платёж не найден.
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('getPayment', () => {
    it('находит платёж по нашему id', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay_1',
        orderId: 'order_1',
        amount: 500,
        status: 'succeeded',
        providerPaymentId: 'mock_pay_1',
        confirmationUrl: '',
        createdAt: new Date('2026-06-20T10:00:00.000Z'),
      });

      const result = await service.getPayment({ id: 'pay_1', orderId: '' });

      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'pay_1' },
      });
      expect(result.id).toBe('pay_1');
      expect(result.status).toBe('succeeded');
    });

    it('находит самый свежий платёж по orderId', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay_9',
        orderId: 'order_1',
        amount: 500,
        status: 'pending',
        providerPaymentId: '',
        confirmationUrl: '',
        createdAt: new Date('2026-06-20T10:00:00.000Z'),
      });

      // id пустой -> срабатывает ветка поиска по orderId.
      const result = await service.getPayment({ id: '', orderId: 'order_1' });

      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { orderId: 'order_1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result.id).toBe('pay_9');
    });

    it('платёж не найден -> RpcException', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.getPayment({ id: 'missing', orderId: '' }),
      ).rejects.toBeInstanceOf(RpcException);
    });
  });
});
