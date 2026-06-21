// Модуль уведомлений: gRPC-контроллер + сервис + каналы доставки.
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailChannel, SmsChannel],
})
export class NotificationsModule {}
