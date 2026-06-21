// Unit-тесты NotificationsService.
// Каналы (EmailChannel/SmsChannel) — настоящие классы, но ConfigService замокан
// с NOTIFY_MOCK='true', поэтому реальная отправка (nodemailer/fetch) подавляется
// самим mock-режимом каналов. Так мы проверяем и логику сервиса, и логику каналов.
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NotificationsService } from './notifications.service';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import { OrderNotification } from './notifications.types';

// Мокаем nodemailer целиком, чтобы убедиться: в mock-режиме письма не уходят.
jest.mock('nodemailer');

describe('NotificationsService', () => {
  let service: NotificationsService;

  // Мок ConfigService: глобальный mock-режим включён.
  const configValues: Record<string, string | undefined> = {
    NOTIFY_MOCK: 'true',
  };
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  };

  // Хелпер для сборки входного сообщения OrderNotification.
  const makeOrder = (
    over: Partial<OrderNotification> = {},
  ): OrderNotification => ({
    orderId: 'order_1',
    customerName: 'Иван',
    phone: '+79990000000',
    email: 'ivan@example.com',
    total: 500,
    channel: '',
    ...over,
  });

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        // Настоящие каналы — их mock-логика и должна подавить реальную отправку.
        EmailChannel,
        SmsChannel,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);

    // global fetch мокаем, чтобы убедиться: SMS реально не отправляется.
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    // Сбрасываем все моки между тестами.
    jest.clearAllMocks();
  });

  describe("channel 'both'", () => {
    it('с email и phone -> ok:true, detail упоминает email и sms', async () => {
      const result = await service.sendOrderConfirmation(
        makeOrder({ channel: 'both' }),
      );

      expect(result.ok).toBe(true);
      expect(result.detail).toContain('email');
      expect(result.detail).toContain('sms');
    });
  });

  describe('пропуск канала без контакта', () => {
    it("channel 'email' без email -> канал пропущен (ok:false)", async () => {
      const result = await service.sendOrderConfirmation(
        makeOrder({ channel: 'email', email: '' }),
      );

      // Канал запрошен, но адреса нет — отправки не было, успехом не считаем.
      expect(result.detail).toContain('пропущен');
      expect(result.ok).toBe(false);
    });

    it("channel 'sms' без phone -> канал пропущен (ok:false)", async () => {
      const result = await service.sendOrderConfirmation(
        makeOrder({ channel: 'sms', phone: '' }),
      );

      expect(result.detail).toContain('пропущен');
      expect(result.ok).toBe(false);
    });
  });

  describe("channel '' (авто-выбор)", () => {
    it('есть только email -> отправляется email', async () => {
      const result = await service.sendOrderConfirmation(
        makeOrder({ channel: '', phone: '' }),
      );

      expect(result.ok).toBe(true);
      expect(result.detail).toContain('email');
      expect(result.detail).not.toContain('sms');
    });

    it('есть только phone -> отправляется sms', async () => {
      const result = await service.sendOrderConfirmation(
        makeOrder({ channel: '', email: '' }),
      );

      expect(result.ok).toBe(true);
      expect(result.detail).toContain('sms');
      expect(result.detail).not.toContain('email');
    });
  });

  describe('mock-режим подавляет реальную отправку', () => {
    it('nodemailer и fetch не вызываются', async () => {
      await service.sendOrderConfirmation(makeOrder({ channel: 'both' }));

      // Email: транспорт nodemailer не создаётся в mock-режиме.
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
      // SMS: HTTP-запрос к провайдеру не выполняется.
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
