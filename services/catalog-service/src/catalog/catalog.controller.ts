// Контроллер каталога: обрабатывает gRPC-вызовы CatalogService.
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Category, Product } from '../generated/prisma/client';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // GetMenu(Empty) -> { categories: [...] } (категории с products)
  @GrpcMethod('CatalogService', 'GetMenu')
  async getMenu(): Promise<{ categories: (Category & { products: Product[] })[] }> {
    const categories = await this.catalogService.getMenu();
    return { categories };
  }

  // GetProductsByIds({ ids }) -> { products: [...] }
  @GrpcMethod('CatalogService', 'GetProductsByIds')
  async getProductsByIds(data: {
    ids: string[];
  }): Promise<{ products: Product[] }> {
    const products = await this.catalogService.getProductsByIds(data.ids ?? []);
    return { products };
  }

  // --- Админ-методы ---

  // GetCategories(Empty) -> { categories: [...] } (без products)
  @GrpcMethod('CatalogService', 'GetCategories')
  async getCategories(): Promise<{ categories: Category[] }> {
    const categories = await this.catalogService.getCategories();
    return { categories };
  }

  // CreateProduct(data) -> Product
  @GrpcMethod('CatalogService', 'CreateProduct')
  async createProduct(data: CreateProductDto): Promise<Product> {
    return this.catalogService.createProduct(data);
  }

  // UpdateProduct({ id, ...fields }) -> Product (обновление целиком)
  @GrpcMethod('CatalogService', 'UpdateProduct')
  async updateProduct(data: {
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    categoryId: string;
    isAvailable: boolean;
  }): Promise<Product> {
    const { id, ...fields } = data;
    return this.catalogService.updateProduct(id, fields);
  }

  // DeleteProduct({ id }) -> { ok: true }
  @GrpcMethod('CatalogService', 'DeleteProduct')
  async deleteProduct(data: { id: string }): Promise<{ ok: true }> {
    return this.catalogService.deleteProduct(data.id);
  }
}
