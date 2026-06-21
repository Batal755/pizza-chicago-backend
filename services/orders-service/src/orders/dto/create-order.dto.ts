import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Одна позиция в запросе на создание заказа.
// Клиент присылает только productId и количество — цену сервис берёт сам из catalog.
export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

// DTO создания заказа.
export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  // Телефон: + и 10–15 цифр (международный формат).
  @IsString()
  @Matches(/^\+?\d{10,15}$/, {
    message: 'Телефон должен содержать от 10 до 15 цифр',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  // Минимум одна позиция; каждую валидируем вложенно.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
