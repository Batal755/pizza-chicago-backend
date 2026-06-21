import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

/** Данные для создания товара (admin → catalog.product.create). */
export class CreateProductDto {
  // Название товара, минимум 1 символ.
  @IsString()
  @MinLength(1)
  name!: string;

  // Описание товара.
  @IsString()
  description!: string;

  // Цена в минимальных единицах (копейках/центах), целое число ≥ 1.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  price!: number;

  // Ссылка на изображение товара.
  @IsString()
  imageUrl!: string;

  // Идентификатор категории, к которой относится товар.
  @IsString()
  categoryId!: string;

  // Доступность товара (опционально, по умолчанию решает catalog-service).
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
