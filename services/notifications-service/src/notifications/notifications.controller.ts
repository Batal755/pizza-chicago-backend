// gRPC-контроллер notifications-service.
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';
import { NotifyResult, OrderNotification } from './notifications.types';

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // Имя service и метода — РОВНО как в notifications.proto.
  @GrpcMethod('NotificationsService', 'SendOrderConfirmation')
  sendOrderConfirmation(data: OrderNotification): Promise<NotifyResult> {
    return this.notifications.sendOrderConfirmation(data);
  }
}
