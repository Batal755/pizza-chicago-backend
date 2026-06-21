// Канал доставки по SMS через HTTP-провайдера (global fetch).
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelResult, OrderNotification } from '../notifications.types';

@Injectable()
export class SmsChannel {
  private readonly logger = new Logger(SmsChannel.name);

  constructor(private readonly config: ConfigService) {}

  // Признак режима без реальной отправки (глобальный флаг).
  private get mockEnabled(): boolean {
    return this.config.get<string>('NOTIFY_MOCK') === 'true';
  }

  // Есть ли креды SMS-провайдера, чтобы реально слать сообщения.
  private get hasCreds(): boolean {
    const url = this.config.get<string>('SMS_PROVIDER_URL');
    const key = this.config.get<string>('SMS_API_KEY');
    return Boolean(url && key);
  }

  // Отправить подтверждение заказа по SMS.
  async send(data: OrderNotification): Promise<ChannelResult> {
    const message =
      `Pizza Chicago: заказ №${data.orderId} принят. ` +
      `Сумма ${data.total} руб. Спасибо, ${data.customerName}!`;

    // Mock-режим: либо включён глобально, либо нет кредов — реально не шлём.
    if (this.mockEnabled || !this.hasCreds) {
      this.logger.log(
        `[MOCK sms] -> ${data.phone} | "${message}" | заказ ${data.orderId}`,
      );
      return { ok: true, detail: 'sms (mock)' };
    }

    try {
      const url = this.config.get<string>('SMS_PROVIDER_URL') as string;
      const apiKey = this.config.get<string>('SMS_API_KEY') as string;
      const sender = this.config.get<string>('SMS_SENDER') ?? 'PizzaChicago';

      // POST на провайдера; формат тела — общий, ключ передаём в заголовке.
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          to: data.phone,
          from: sender,
          text: message,
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          detail: `sms (ошибка: HTTP ${response.status})`,
        };
      }

      return { ok: true, detail: 'sms' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Ошибка отправки SMS: ${message}`);
      return { ok: false, detail: `sms (ошибка: ${message})` };
    }
  }
}
