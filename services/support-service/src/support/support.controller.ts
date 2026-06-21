// gRPC-контроллер support-service (service SupportService из support.proto).
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { SupportTicket } from '../generated/prisma/client';
import { SupportService } from './support.service';

// Входящие данные rpc Create (CreateTicketRequest); userId — proto3 string ('' = гость)
interface CreateTicketData {
  name: string;
  contact: string;
  message: string;
  userId: string;
}

// Форма message Ticket из .proto (поля camelCase, createdAt — строка)
interface TicketReply {
  id: string;
  userId: string;
  name: string;
  contact: string;
  message: string;
  status: string;
  createdAt: string;
}

@Controller()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // rpc Create(CreateTicketRequest) -> Ticket
  @GrpcMethod('SupportService', 'Create')
  async create(data: CreateTicketData): Promise<TicketReply> {
    // proto3: пустая строка userId трактуется как отсутствие (гость)
    const ticket = await this.supportService.create(
      { name: data.name, contact: data.contact, message: data.message },
      data.userId || undefined,
    );
    return toTicketReply(ticket);
  }

  // rpc List(Empty) -> TicketsResponse { tickets } — новые сверху
  @GrpcMethod('SupportService', 'List')
  async list(): Promise<{ tickets: TicketReply[] }> {
    const tickets = await this.supportService.list();
    return { tickets: tickets.map(toTicketReply) };
  }

  // rpc Close(IdRequest) -> Ticket (status CLOSED; P2025 -> RpcException NOT_FOUND)
  @GrpcMethod('SupportService', 'Close')
  async close(data: { id: string }): Promise<TicketReply> {
    const ticket = await this.supportService.close(data.id);
    return toTicketReply(ticket);
  }
}

// Маппинг Prisma-сущности в форму proto-message Ticket
function toTicketReply(ticket: SupportTicket): TicketReply {
  return {
    id: ticket.id,
    userId: ticket.userId ?? '', // proto3 string не несёт null
    name: ticket.name,
    contact: ticket.contact,
    message: ticket.message,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
  };
}
