import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import type { OrderStatus } from '../generated/prisma/client';
import { firstValueFrom, Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

// Данные, которые приходят в Create (форма proto CreateOrderRequest).
export interface CreateOrderData {
  customerName: string;
  phone: string;
  address: string;
  branch?: string;
  comment?: string;
  email?: string;
  items: { productId: string; quantity: number }[];
  userId?: string;
}

// Форма товара из catalog-service (proto Product). Доверяем только этим полям — цену клиента игнорируем.
interface CatalogProduct {
  id: string;
  name: string;
  price: number;
}

// gRPC-интерфейс catalog (методы — camelCase от rpc).
interface CatalogGrpc {
  getProductsByIds(data: {
    ids: string[];
  }): Observable<{ products: CatalogProduct[] }>;
}

// gRPC-интерфейс notifications.
interface NotificationsGrpc {
  sendOrderConfirmation(data: {
    orderId: string;
    customerName: string;
    phone: string;
    email: string;
    total: number;
    channel: string;
  }): Observable<{ ok: boolean; detail: string }>;
}

@Injectable()
export class OrdersService implements OnModuleInit {
  private catalogSvc!: CatalogGrpc;
  private notificationsSvc!: NotificationsGrpc;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('CATALOG_PACKAGE') private readonly catalogClient: ClientGrpc,
    @Inject('NOTIFICATIONS_PACKAGE')
    private readonly notificationsClient: ClientGrpc,
  ) {}

  onModuleInit(): void {
    this.catalogSvc = this.catalogClient.getService<CatalogGrpc>(
      'CatalogService',
    );
    this.notificationsSvc =
      this.notificationsClient.getService<NotificationsGrpc>(
        'NotificationsService',
      );
  }

  // Создание заказа со снимком актуальных товаров из каталога.
  async create(data: CreateOrderData) {
    // userId === '' (гость) трактуем как отсутствие пользователя.
    const userId = data.userId ? data.userId : undefined;

    // Собираем уникальные id запрошенных товаров.
    const productIds = [...new Set(data.items.map((i) => i.productId))];

    // Спрашиваем у catalog актуальные данные по этим id (РАСПАКОВЫВАЕМ .products).
    const response = await firstValueFrom(
      this.catalogSvc.getProductsByIds({ ids: productIds }),
    );
    const products = response?.products ?? [];

    // Индекс товаров по id для быстрого доступа.
    const byId = new Map<string, CatalogProduct>(
      products.map((p) => [p.id, p]),
    );

    // Проверяем, что КАЖДЫЙ запрошенный товар найден в каталоге.
    const allFound = productIds.every((id) => byId.has(id));
    if (!allFound) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Некоторые позиции недоступны',
      });
    }

    // Готовим снимок позиций и считаем итог по ценам ИЗ КАТАЛОГА.
    // total = сумма (цена_из_каталога * количество) по всем позициям.
    let total = 0;
    const itemsData = data.items.map((item) => {
      // Товар точно есть — проверили выше.
      const product = byId.get(item.productId) as CatalogProduct;
      total += product.price * item.quantity;
      return {
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: item.quantity,
      };
    });

    // Сохраняем заказ вместе с позициями одной операцией.
    const order = await this.prisma.order.create({
      data: {
        userId: userId ?? null,
        customerName: data.customerName,
        phone: data.phone,
        address: data.address,
        branch: data.branch ?? null,
        comment: data.comment ?? null,
        total,
        items: {
          create: itemsData,
        },
      },
      include: { items: true },
    });

    // Уведомление после успешного создания заказа.
    // Сбой уведомления НЕ должен ломать создание заказа — логируем и продолжаем.
    try {
      await firstValueFrom(
        this.notificationsSvc.sendOrderConfirmation({
          orderId: order.id,
          customerName: order.customerName,
          phone: order.phone,
          email: data.email || '',
          total,
          channel: '',
        }),
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Не удалось отправить уведомление о заказе', order.id, error);
    }

    return order;
  }

  // Заказы пользователя: новые сверху, вместе с позициями.
  async findMy(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  // --- Админ-методы ---

  // Все заказы, новые сверху, с позициями. При наличии status — фильтр по нему.
  async findAll(status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  // Смена статуса заказа; на отсутствие заказа — RpcException.
  async updateStatus(id: string, newStatus: OrderStatus) {
    try {
      return await this.prisma.order.update({
        where: { id },
        data: { status: newStatus },
        include: { items: true },
      });
    } catch (error) {
      // P2025 — заказ для обновления не найден
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2025'
      ) {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Заказ не найден',
        });
      }
      throw error;
    }
  }
}
