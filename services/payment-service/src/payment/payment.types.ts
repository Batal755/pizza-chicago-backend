// Типы запросов/ответов gRPC по контракту proto/payment.proto.
// Поля camelCase совпадают с message в .proto.

// Запрос на создание платежа
export interface CreatePaymentRequest {
  orderId: string;
  amount: number; // сумма в рублях (целое)
  returnUrl: string; // куда вернуть пользователя после оплаты
}

// Запрос на подтверждение платежа: одно из полей (наш id ИЛИ id провайдера)
export interface ConfirmRequest {
  paymentId: string;
  providerPaymentId: string;
}

// Запрос на получение платежа: по нашему id ИЛИ по orderId
export interface GetPaymentRequest {
  id: string;
  orderId: string;
}

// Ответ-Payment по форме message Payment из .proto.
// Все поля заполнены (пустые строки вместо null), createdAt — ISO-строка.
export interface PaymentReply {
  id: string;
  orderId: string;
  amount: number;
  status: string; // pending | succeeded | canceled
  confirmationUrl: string;
  providerPaymentId: string;
  createdAt: string;
}
