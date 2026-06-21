// Канал доставки по email через nodemailer.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ChannelResult, OrderNotification } from '../notifications.types';

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);

  constructor(private readonly config: ConfigService) {}

  // Признак режима без реальной отправки (глобальный флаг).
  private get mockEnabled(): boolean {
    return this.config.get<string>('NOTIFY_MOCK') === 'true';
  }

  // Все ли SMTP-креды на месте, чтобы реально слать письма.
  private get hasCreds(): boolean {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    return Boolean(host && user && pass);
  }

  // Отправить подтверждение заказа на email.
  async send(data: OrderNotification): Promise<ChannelResult> {
    const subject = 'Ваш заказ принят';
    const text =
      `Здравствуйте, ${data.customerName}!\n` +
      `Ваш заказ №${data.orderId} принят.\n` +
      `Сумма к оплате: ${data.total} ₽.\n` +
      `Спасибо, что выбрали Pizza Chicago!`;

    // Mock-режим: либо включён глобально, либо нет кредов — реально не шлём.
    if (this.mockEnabled || !this.hasCreds) {
      this.logger.log(
        `[MOCK email] -> ${data.email} | "${subject}" | заказ ${data.orderId}`,
      );
      return { ok: true, detail: 'email (mock)' };
    }

    try {
      const transport = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
        // secure=true только для порта 465 (SMTPS)
        secure: Number(this.config.get<string>('SMTP_PORT') ?? 587) === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });

      await transport.sendMail({
        from:
          this.config.get<string>('MAIL_FROM') ??
          'Pizza Chicago <no-reply@pizza-chicago.example>',
        to: data.email,
        subject,
        text,
      });

      return { ok: true, detail: 'email' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Ошибка отправки email: ${message}`);
      return { ok: false, detail: `email (ошибка: ${message})` };
    }
  }
}
