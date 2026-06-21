import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  OnModuleInit,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/** gRPC-интерфейс OrdersService. */
interface OrdersGrpc {
  findAll(data: { status: string }): Observable<{ orders: unknown[] }>;
  updateStatus(data: { id: string; status: string }): Observable<unknown>;
}

/** gRPC-интерфейс CatalogService. */
interface CatalogGrpc {
  getCategories(data: Record<string, never>): Observable<{ categories: unknown[] }>;
  createProduct(data: Record<string, unknown>): Observable<unknown>;
  updateProduct(data: Record<string, unknown>): Observable<unknown>;
  deleteProduct(data: { id: string }): Observable<unknown>;
}

/** gRPC-интерфейс SupportService. */
interface SupportGrpc {
  list(data: Record<string, never>): Observable<{ tickets: unknown[] }>;
  close(data: { id: string }): Observable<unknown>;
}

/**
 * Админ-эндпоинты. Проксируют в orders/catalog/support по gRPC.
 * Каждый маршрут защищён парой гвардов: JwtAuthGuard (наполняет request.user)
 * + RolesGuard, и требует роль ADMIN через @Roles('ADMIN').
 */
@Controller('admin')
export class AdminController implements OnModuleInit {
  private orders!: OrdersGrpc;
  private catalog!: CatalogGrpc;
  private support!: SupportGrpc;

  constructor(
    @Inject('ORDERS_PACKAGE') private readonly ordersClient: ClientGrpc,
    @Inject('CATALOG_PACKAGE') private readonly catalogClient: ClientGrpc,
    @Inject('SUPPORT_PACKAGE') private readonly supportClient: ClientGrpc,
  ) {}

  onModuleInit(): void {
    this.orders = this.ordersClient.getService<OrdersGrpc>('OrdersService');
    this.catalog = this.catalogClient.getService<CatalogGrpc>('CatalogService');
    this.support = this.supportClient.getService<SupportGrpc>('SupportService');
  }

  // --- Заказы ---

  // Все заказы, опционально с фильтром по статусу. Распаковка: { orders } -> массив.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('orders')
  async ordersList(@Query('status') status?: string): Promise<unknown> {
    const res = await firstValueFrom(
      this.orders.findAll({ status: status ?? '' }),
    );
    return res.orders;
  }

  // Смена статуса заказа.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('orders/:id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<unknown> {
    return firstValueFrom(
      this.orders.updateStatus({ id, status: dto.status }),
    );
  }

  // --- Каталог ---

  // Список категорий (без товаров). Распаковка: { categories } -> массив.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('categories')
  async categories(): Promise<unknown> {
    const res = await firstValueFrom(this.catalog.getCategories({}));
    return res.categories;
  }

  // Создание товара.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('products')
  async createProduct(@Body() dto: CreateProductDto): Promise<unknown> {
    return firstValueFrom(this.catalog.createProduct({ ...dto }));
  }

  // Обновление товара (частичное). Плоский объект { id, ...dto }.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<unknown> {
    return firstValueFrom(this.catalog.updateProduct({ id, ...dto }));
  }

  // Удаление товара.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('products/:id')
  async deleteProduct(@Param('id') id: string): Promise<unknown> {
    return firstValueFrom(this.catalog.deleteProduct({ id }));
  }

  // --- Поддержка ---

  // Список обращений (новые сверху). Распаковка: { tickets } -> массив.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('tickets')
  async tickets(): Promise<unknown> {
    const res = await firstValueFrom(this.support.list({}));
    return res.tickets;
  }

  // Закрытие обращения.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('tickets/:id/close')
  async closeTicket(@Param('id') id: string): Promise<unknown> {
    return firstValueFrom(this.support.close({ id }));
  }
}
