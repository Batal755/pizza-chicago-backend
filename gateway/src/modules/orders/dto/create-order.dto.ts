import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Одна позиция заказа. */
export class OrderItemDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

/** Тело создания заказа. Проксируется в orders.create. */
export class CreateOrderDto {
  @IsString()
  @MinLength(2)
  customerName!: string;

  // Телефон в международном формате: опциональный +, 10–15 цифр.
  @Matches(/^\+?[0-9]{10,15}$/)
  phone!: string;

  @IsString()
  @MinLength(5)
  address!: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  // Минимум одна позиция; каждую валидируем как вложенный объект.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
