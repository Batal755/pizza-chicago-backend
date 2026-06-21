// Бизнес-логика каталога: чтение меню и товаров из базы.
import { Injectable } from '@nestjs/common';
import { Prisma, Category, Product } from '@prisma/client';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

// Полный набор полей товара для обновления (proto3 шлёт все поля).
type UpdateProductFields = {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  categoryId: string;
  isAvailable: boolean;
};

// Категория с вложенным списком доступных товаров
type CategoryWithProducts = Category & { products: Product[] };

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // Полное меню: категории по sortOrder, внутри — только доступные товары по name
  async getMenu(): Promise<CategoryWithProducts[]> {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { isAvailable: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  // Товары по списку id — возвращаем только доступные
  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.product.findMany({
      where: {
        id: { in: ids },
        isAvailable: true,
      },
    });
  }

  // --- Админ-методы ---

  // Все категории без товаров, по sortOrder
  async getCategories(): Promise<Category[]> {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Создание товара
  async createProduct(dto: CreateProductDto): Promise<Product> {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
        categoryId: dto.categoryId,
        // isAvailable не задаём явно, если не пришёл — сработает default из схемы
        ...(dto.isAvailable !== undefined
          ? { isAvailable: dto.isAvailable }
          : {}),
      },
    });
  }

  // Обновление товара целиком по id (proto3 присылает все поля)
  async updateProduct(
    id: string,
    data: UpdateProductFields,
  ): Promise<Product> {
    try {
      return await this.prisma.product.update({
        where: { id },
        data,
      });
    } catch (error) {
      // P2025 — запись для обновления не найдена
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Товар не найден',
        });
      }
      throw error;
    }
  }

  // Удаление товара по id
  async deleteProduct(id: string): Promise<{ ok: true }> {
    try {
      await this.prisma.product.delete({
        where: { id },
      });
      return { ok: true };
    } catch (error) {
      // P2025 — запись для удаления не найдена
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Товар не найден',
        });
      }
      throw error;
    }
  }
}
