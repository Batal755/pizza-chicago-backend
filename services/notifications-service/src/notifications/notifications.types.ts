// Общие типы контракта notifications.proto.
// Поля приходят в camelCase — ровно как в .proto (proto-loader их не меняет).

// Канал доставки из контракта.
export type Channel = 'email' | 'sms' | 'both' | '';

// Входящее gRPC-сообщение OrderNotification.
export interface OrderNotification {
  orderId: string;
  customerName: string;
  phone: string;
  email: string;
  total: number;
  channel: Channel;
}

// Ответ NotifyResult.
export interface NotifyResult {
  ok: boolean;
  detail: string;
}

// Результат работы одного канала доставки.
export interface ChannelResult {
  // Удалось ли отправить (включая mock-режим — он считается успехом).
  ok: boolean;
  // Человекочитаемое описание для поля detail.
  detail: string;
}
