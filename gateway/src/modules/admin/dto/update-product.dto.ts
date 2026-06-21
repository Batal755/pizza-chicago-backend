import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Данные для обновления товара (admin → catalog.product.update).
 * Все поля повторяют CreateProductDto, но опциональны (частичное обновление).
 * Поля описаны вручную, без @nestjs/mapped-types, чтобы не тянуть зависимость.
 */
export class UpdateProductDto {
  // Название товара, минимум 1 символ.
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  // Описание товара.
  @IsOptional()
  @IsString()
  description?: string;

  // Цена в минимальных единицах, целое число ≥ 1.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  price?: number;

  // Ссылка на изображение товара.
  @IsOptional()
  @IsString()
  imageUrl?: string;

  // Идентификатор категории.
  @IsOptional()
  @IsString()
  categoryId?: string;

  // Доступность товара.
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
