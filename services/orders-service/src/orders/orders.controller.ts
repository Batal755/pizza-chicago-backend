import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { OrderStatus } from '@prisma/client';
import { OrdersService, CreateOrderData } from './orders.service';

// Форма позиции заказа из БД (Prisma OrderItem).
interface OrderItemEntity {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

// Форма заказа из БД (Prisma Order + items).
interface OrderEntity {
  id: string;
  userId: string | null;
  customerName: string;
  phone: string;
  address: string;
  branch: string | null;
  comment: string | null;
  status: string;
  total: number;
  items: OrderItemEntity[];
  createdAt: Date;
}

// Маппер сущности заказа из БД в proto-ответ Order.
// proto3: null -> пустая строка, createdAt -> ISO string, поля camelCase.
function toOrderReply(order: OrderEntity) {
  return {
    id: order.id,
    userId: order.userId ?? '',
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    branch: order.branch ?? '',
    comment: order.comment ?? '',
    status: order.status,
    total: order.total,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      price: item.price,
      quantity: item.quantity,
    })),
    createdAt: order.createdAt.toISOString(),
  };
}

// gRPC-контроллер заказов. Имена сервиса/методов — РОВНО как в orders.proto.
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Создание заказа. userId пустая строка '' = гость (трактуется как undefined в сервисе).
  @GrpcMethod('OrdersService', 'Create')
  async create(data: CreateOrderData) {
    const order = (await this.ordersService.create(data)) as OrderEntity;
    return toOrderReply(order);
  }

  // Заказы текущего пользователя -> { orders: [...] }.
  @GrpcMethod('OrdersService', 'FindMy')
  async findMy(data: { userId: string }) {
    const orders = (await this.ordersService.findMy(
      data.userId,
    )) as OrderEntity[];
    return { orders: orders.map(toOrderReply) };
  }

  // Все заказы (пустой status = все) -> { orders: [...] }.
  @GrpcMethod('OrdersService', 'FindAll')
  async findAll(data: { status: string }) {
    const status = data.status ? (data.status as OrderStatus) : undefined;
    const orders = (await this.ordersService.findAll(status)) as OrderEntity[];
    return { orders: orders.map(toOrderReply) };
  }

  // Смена статуса заказа -> Order.
  @GrpcMethod('OrdersService', 'UpdateStatus')
  async updateStatus(data: { id: string; status: string }) {
    const order = (await this.ordersService.updateStatus(
      data.id,
      data.status as OrderStatus,
    )) as OrderEntity;
    return toOrderReply(order);
  }
}
