import { IsEnum } from 'class-validator';

/** Допустимые статусы заказа (синхронизировано с orders-service). */
export enum OrderStatus {
  NEW = 'NEW',
  CONFIRMED = 'CONFIRMED',
  COOKING = 'COOKING',
  DELIVERING = 'DELIVERING',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

/** Данные для смены статуса заказа (admin → orders.updateStatus). */
export class UpdateOrderStatusDto {
  // Новый статус заказа — только из перечисления OrderStatus.
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
