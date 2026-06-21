// Unit-тесты OrdersService: моки PrismaService и gRPC-клиентов catalog/notifications.
// КЛЮЧЕВОЕ: total считается по ценам ИЗ каталога, а не из dto.
import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  // Мок Prisma: операции с заказами.
  let prisma: {
    order: { create: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  };
  // Моки gRPC-методов: возвращают Observable.
  let getProductsByIds: jest.Mock;
  let sendOrderConfirmation: jest.Mock;
  // Моки ClientGrpc: getService отдаёт объект с gRPC-методами.
  let catalogClient: { getService: jest.Mock };
  let notificationsClient: { getService: jest.Mock };

  beforeEach(async () => {
    prisma = {
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    getProductsByIds = jest.fn();
    sendOrderConfirmation = jest.fn().mockReturnValue(of({ ok: true, detail: '' }));

    catalogClient = {
      getService: jest.fn().mockReturnValue({ getProductsByIds }),
    };
    notificationsClient = {
      getService: jest.fn().mockReturnValue({ sendOrderConfirmation }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'CATALOG_PACKAGE', useValue: catalogClient },
        { provide: 'NOTIFICATIONS_PACKAGE', useValue: notificationsClient },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
    // Инициализируем gRPC-сервисы (как делает NestJS перед обработкой запросов).
    service.onModuleInit();
  });

  describe('create', () => {
    it('считает total по ценам ИЗ каталога, игнорируя цену из dto', async () => {
      // Каталог отдаёт цену 500 за p1 и 300 за p2 (РАСПАКОВЫВАЕМ .products).
      getProductsByIds.mockReturnValue(
        of({
          products: [
            { id: 'p1', name: 'Маргарита', price: 500 },
            { id: 'p2', name: 'Кола', price: 300 },
          ],
        }),
      );
      prisma.order.create.mockImplementation((args) => ({
        id: 'o1',
        ...args.data,
      }));

      await service.create({
        customerName: 'Иван',
        phone: '+79991234567',
        address: 'ул. Пушкина, 1',
        // В dto цены нет вовсе — total должен опираться только на каталог.
        items: [
          { productId: 'p1', quantity: 2 },
          { productId: 'p2', quantity: 1 },
        ],
        userId: 'user-1',
      });

      // Запросили актуальные данные по уникальным id.
      expect(getProductsByIds).toHaveBeenCalledWith({ ids: ['p1', 'p2'] });

      const createArg = prisma.order.create.mock.calls[0][0];
      // total = 500*2 + 300*1 = 1300 (по ценам каталога).
      expect(createArg.data.total).toBe(1300);
      // userId проброшен, снимок позиций содержит цену и имя из каталога.
      expect(createArg.data.userId).toBe('user-1');
      expect(createArg.data.items.create).toEqual([
        { productId: 'p1', productName: 'Маргарита', price: 500, quantity: 2 },
        { productId: 'p2', productName: 'Кола', price: 300, quantity: 1 },
      ]);

      // После заказа отправили уведомление.
      expect(sendOrderConfirmation).toHaveBeenCalled();
    });

    it('если каталог не вернул какой-то id -> RpcException "Некоторые позиции недоступны"', async () => {
      // Запрошены p1 и p2, каталог вернул только p1.
      getProductsByIds.mockReturnValue(
        of({ products: [{ id: 'p1', name: 'Маргарита', price: 500 }] }),
      );

      await expect(
        service.create({
          customerName: 'Иван',
          phone: '+79991234567',
          address: 'ул. Пушкина, 1',
          items: [
            { productId: 'p1', quantity: 1 },
            { productId: 'p2', quantity: 1 },
          ],
        }),
      ).rejects.toThrow('Некоторые позиции недоступны');

      // Заказ не сохраняется.
      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('userId пустая строка (гость) -> userId = null', async () => {
      getProductsByIds.mockReturnValue(
        of({ products: [{ id: 'p1', name: 'Маргарита', price: 500 }] }),
      );
      prisma.order.create.mockImplementation((args) => ({
        id: 'o1',
        ...args.data,
      }));

      await service.create({
        customerName: 'Гость',
        phone: '+79991234567',
        address: 'ул. Пушкина, 1',
        items: [{ productId: 'p1', quantity: 1 }],
        userId: '',
      });

      expect(prisma.order.create.mock.calls[0][0].data.userId).toBeNull();
    });

    it('сбой уведомления НЕ ломает создание заказа', async () => {
      getProductsByIds.mockReturnValue(
        of({ products: [{ id: 'p1', name: 'Маргарита', price: 500 }] }),
      );
      prisma.order.create.mockImplementation((args) => ({
        id: 'o1',
        ...args.data,
      }));
      // Уведомление падает.
      sendOrderConfirmation.mockReturnValue(
        throwError(() => new Error('notifications down')),
      );

      const order = await service.create({
        customerName: 'Иван',
        phone: '+79991234567',
        address: 'ул. Пушкина, 1',
        items: [{ productId: 'p1', quantity: 1 }],
        userId: 'user-1',
      });

      // Заказ всё равно создан и возвращён.
      expect(order).toMatchObject({ id: 'o1' });
      expect(prisma.order.create).toHaveBeenCalled();
    });
  });

  describe('findMy', () => {
    it('возвращает заказы пользователя, новые сверху, с позициями', async () => {
      const orders = [{ id: 'o1' }];
      prisma.order.findMany.mockResolvedValue(orders);

      const result = await service.findMy('user-1');

      expect(result).toBe(orders);
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      });
    });
  });

  describe('updateStatus', () => {
    it('меняет статус заказа', async () => {
      const updated = { id: 'o1', status: 'CONFIRMED' };
      prisma.order.update.mockResolvedValue(updated);

      const result = await service.updateStatus('o1', 'CONFIRMED' as never);

      expect(result).toBe(updated);
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: { status: 'CONFIRMED' },
        include: { items: true },
      });
    });

    it('P2025 (заказ не найден) -> RpcException', async () => {
      const notFound = Object.assign(new Error('Not found'), {
        code: 'P2025',
      });
      prisma.order.update.mockRejectedValue(notFound);

      await expect(
        service.updateStatus('missing', 'DONE' as never),
      ).rejects.toBeInstanceOf(RpcException);
    });
  });
});
