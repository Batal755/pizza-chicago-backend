// Unit-тесты CatalogService: мок PrismaService. Реальная БД не используется.
import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  // Мок Prisma: категории и товары.
  let prisma: {
    category: { findMany: jest.Mock };
    product: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      category: { findMany: jest.fn() },
      product: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(CatalogService);
  });

  describe('getMenu', () => {
    it('читает категории по sortOrder с вложенными доступными товарами по name', async () => {
      const menu = [{ id: 'c1', name: 'Пиццы', products: [] }];
      prisma.category.findMany.mockResolvedValue(menu);

      const result = await service.getMenu();

      expect(result).toBe(menu);
      // Проверяем контракт запроса: сортировка категорий и include с фильтром/сортировкой товаров.
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        orderBy: { sortOrder: 'asc' },
        include: {
          products: {
            where: { isAvailable: true },
            orderBy: { name: 'asc' },
          },
        },
      });
    });
  });

  describe('getProductsByIds', () => {
    it('пустой массив -> [] без обращения к БД', async () => {
      const result = await service.getProductsByIds([]);

      expect(result).toEqual([]);
      // Ранний выход: запрос к Prisma не выполняется.
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('возвращает только доступные товары по списку id', async () => {
      const products = [{ id: 'p1', name: 'Маргарита', price: 500 }];
      prisma.product.findMany.mockResolvedValue(products);

      const result = await service.getProductsByIds(['p1', 'p2']);

      expect(result).toBe(products);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1', 'p2'] }, isAvailable: true },
      });
    });
  });

  describe('createProduct', () => {
    it('создаёт товар; isAvailable не передаётся, если не задан', async () => {
      const created = { id: 'p1' };
      prisma.product.create.mockResolvedValue(created);

      const result = await service.createProduct({
        name: 'Маргарита',
        description: 'Классика',
        price: 500,
        imageUrl: 'http://img/1.png',
        categoryId: 'c1',
      });

      expect(result).toBe(created);
      const arg = prisma.product.create.mock.calls[0][0];
      // isAvailable отсутствует -> сработает default схемы.
      expect(arg.data.isAvailable).toBeUndefined();
      expect(arg.data).toEqual(
        expect.objectContaining({ name: 'Маргарита', price: 500, categoryId: 'c1' }),
      );
    });

    it('передаёт isAvailable, если он задан явно', async () => {
      prisma.product.create.mockResolvedValue({ id: 'p1' });

      await service.createProduct({
        name: 'Пепперони',
        description: 'Острая',
        price: 600,
        imageUrl: 'http://img/2.png',
        categoryId: 'c1',
        isAvailable: false,
      });

      const arg = prisma.product.create.mock.calls[0][0];
      expect(arg.data.isAvailable).toBe(false);
    });
  });

  describe('updateProduct', () => {
    it('обновляет товар целиком по id', async () => {
      const fields = {
        name: 'Новое имя',
        description: 'Новое описание',
        price: 700,
        imageUrl: 'http://img/3.png',
        categoryId: 'c1',
        isAvailable: true,
      };
      const updated = { id: 'p1', ...fields };
      prisma.product.update.mockResolvedValue(updated);

      const result = await service.updateProduct('p1', fields);

      expect(result).toBe(updated);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: fields,
      });
    });

    it('P2025 (не найден) -> RpcException', async () => {
      const notFound = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.22.0',
      });
      prisma.product.update.mockRejectedValue(notFound);

      await expect(
        service.updateProduct('missing', {
          name: 'X',
          description: 'X',
          price: 100,
          imageUrl: 'http://img/x.png',
          categoryId: 'c1',
          isAvailable: true,
        }),
      ).rejects.toBeInstanceOf(RpcException);
    });
  });

  describe('deleteProduct', () => {
    it('успешное удаление -> { ok: true }', async () => {
      prisma.product.delete.mockResolvedValue({ id: 'p1' });

      const result = await service.deleteProduct('p1');

      expect(result).toEqual({ ok: true });
      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });

    it('P2025 (не найден) -> RpcException', async () => {
      const notFound = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.22.0',
      });
      prisma.product.delete.mockRejectedValue(notFound);

      await expect(service.deleteProduct('missing')).rejects.toBeInstanceOf(
        RpcException,
      );
    });
  });
});
