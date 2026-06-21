import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/** Тело создания платежа. Проксируется в payment.createPayment. */
export class CreatePaymentDto {
  // Идентификатор заказа, который оплачивают.
  @IsString()
  orderId!: string;

  // Сумма в минимальных единицах (копейках/центах), целое число ≥ 1.
  @IsInt()
  @Min(1)
  amount!: number;

  // URL возврата после оплаты (опционально).
  @IsOptional()
  @IsString()
  returnUrl?: string;
}
