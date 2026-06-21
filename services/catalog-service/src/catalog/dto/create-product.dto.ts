// DTO для создания товара каталога (админка).
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductDto {
  // Название товара
  @IsString()
  @IsNotEmpty()
  name!: string;

  // Описание товара
  @IsString()
  @IsNotEmpty()
  description!: string;

  // Цена в минимальных единицах (копейках), неотрицательная
  @IsInt()
  @Min(0)
  price!: number;

  // Ссылка на изображение
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  // Идентификатор категории
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  // Доступность товара (необязательно, по умолчанию true в схеме)
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
