// Unit-тесты SupportService: мок PrismaService. Реальная БД не используется.
import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';
import { SupportService } from './support.service';

describe('SupportService', () => {
  let service: SupportService;
  // Мок Prisma: операции с обращениями.
  let prisma: { supportTicket: { create: jest.Mock; findMany: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      supportTicket: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(SupportService);
  });

  describe('create', () => {
    it('создаёт обращение с userId, когда он передан', async () => {
      const ticket = { id: 't1' };
      prisma.supportTicket.create.mockResolvedValue(ticket);

      const result = await service.create(
        { name: 'Иван', contact: '+79991234567', message: 'Где мой заказ?' },
        'user-1',
      );

      expect(result).toBe(ticket);
      expect(prisma.supportTicket.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: 'Иван',
          contact: '+79991234567',
          message: 'Где мой заказ?',
        },
      });
    });

    it('userId необязателен (гость) -> userId = null', async () => {
      prisma.supportTicket.create.mockResolvedValue({ id: 't1' });

      await service.create(
        { name: 'Гость', contact: 'mail@example.com', message: 'Вопрос' },
        undefined,
      );

      expect(prisma.supportTicket.create.mock.calls[0][0].data.userId).toBeNull();
    });
  });

  describe('list', () => {
    it('возвращает все обращения, новые сверху', async () => {
      const tickets = [{ id: 't1' }];
      prisma.supportTicket.findMany.mockResolvedValue(tickets);

      const result = await service.list();

      expect(result).toBe(tickets);
      expect(prisma.supportTicket.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('close', () => {
    it('закрывает обращение -> status CLOSED', async () => {
      const closed = { id: 't1', status: 'CLOSED' };
      prisma.supportTicket.update.mockResolvedValue(closed);

      const result = await service.close('t1');

      expect(result).toBe(closed);
      expect(prisma.supportTicket.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'CLOSED' },
      });
    });

    it('P2025 (не найдено) -> RpcException', async () => {
      const notFound = Object.assign(new Error('Not found'), { code: 'P2025' });
      prisma.supportTicket.update.mockRejectedValue(notFound);

      await expect(service.close('missing')).rejects.toBeInstanceOf(RpcException);
    });
  });
});
