// Сервис поддержки: бизнес-логика работы с обращениями.
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { PrismaService } from '../prisma/prisma.service';
import { SupportTicket } from '../generated/prisma/client';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  // Создаём новое обращение в поддержку; userId необязателен (гость)
  create(dto: CreateTicketDto, userId?: string): Promise<SupportTicket> {
    return this.prisma.supportTicket.create({
      data: {
        userId: userId ?? null,
        name: dto.name,
        contact: dto.contact,
        message: dto.message,
      },
    });
  }

  // --- Админ-методы ---

  // Все обращения, новые сверху
  list(): Promise<SupportTicket[]> {
    return this.prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // Закрыть обращение (status = CLOSED); на отсутствие — RpcException
  async close(id: string): Promise<SupportTicket> {
    try {
      return await this.prisma.supportTicket.update({
        where: { id },
        data: { status: 'CLOSED' },
      });
    } catch (error) {
      // P2025 — обращение для обновления не найдено
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2025'
      ) {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Обращение не найдено',
        });
      }
      throw error;
    }
  }
}
