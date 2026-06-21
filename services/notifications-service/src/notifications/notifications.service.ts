// Бизнес-логика уведомлений: определить каналы и отправить подтверждение заказа.
import { Injectable, Logger } from '@nestjs/common';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import {
  ChannelResult,
  NotifyResult,
  OrderNotification,
} from './notifications.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly email: EmailChannel,
    private readonly sms: SmsChannel,
  ) {}

  // Получить данные об успешном заказе и отправить подтверждение клиенту.
  async sendOrderConfirmation(data: OrderNotification): Promise<NotifyResult> {
    const hasEmail = Boolean(data.email && data.email.trim());
    const hasPhone = Boolean(data.phone && data.phone.trim());

    // Решаем, какие каналы запросил клиент.
    let wantEmail = false;
    let wantSms = false;
    switch (data.channel) {
      case 'email':
        wantEmail = true;
        break;
      case 'sms':
        wantSms = true;
        break;
      case 'both':
        wantEmail = true;
        wantSms = true;
        break;
      default:
        // Пусто — авто: email если есть email, sms если есть телефон.
        wantEmail = hasEmail;
        wantSms = hasPhone;
        break;
    }

    const parts: string[] = [];
    const results: ChannelResult[] = [];

    // --- Email ---
    if (wantEmail) {
      if (hasEmail) {
        const res = await this.email.send(data);
        results.push(res);
        parts.push(res.detail);
      } else {
        // Канал запрошен, но контакта нет — пропускаем, успехом не считаем.
        parts.push('email (пропущен: нет адреса)');
      }
    }

    // --- SMS ---
    if (wantSms) {
      if (hasPhone) {
        const res = await this.sms.send(data);
        results.push(res);
        parts.push(res.detail);
      } else {
        // Канал запрошен, но телефона нет — пропускаем, успехом не считаем.
        parts.push('sms (пропущен: нет телефона)');
      }
    }

    // Ни один канал не выбран/не применим.
    if (parts.length === 0) {
      const detail = 'нет доступных каналов (не указаны email/phone)';
      this.logger.warn(`Заказ ${data.orderId}: ${detail}`);
      return { ok: false, detail };
    }

    // ok=true, если сработал хотя бы один канал; ошибку одного не роняем весь вызов.
    const ok = results.some((r) => r.ok);
    const detail = parts.join(', ');
    this.logger.log(`Заказ ${data.orderId}: ${detail} (ok=${ok})`);

    return { ok, detail };
  }
}
