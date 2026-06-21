import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/** Числовые коды статусов gRPC, которые маппим явно. */
const GRPC_STATUS = {
  INVALID_ARGUMENT: 3,
  NOT_FOUND: 5,
  PERMISSION_DENIED: 7,
  UNAUTHENTICATED: 16,
} as const;

/**
 * Глобальный фильтр исключений.
 *
 * Задачи:
 *  - HttpException-ы (валидация, гварды и т.п.) пробрасывать как есть.
 *  - Ошибки gRPC (есть числовой code и message/details) маппить по коду.
 *  - Прочие ошибки микросервисов (строка/объект с message) маппить по тексту.
 *  - Наружу НЕ отдавать стектрейсы и внутренние детали;
 *    полную ошибку логировать только в console.error.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Полную ошибку — только в логи сервера, наружу не утекает.
    console.error('[AllExceptionsFilter]', exception);

    // 1. Стандартные HttpException пробрасываем как есть.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(this.normalizeHttpBody(exception, status));
      return;
    }

    // 2. Ошибка gRPC: есть числовой code -> маппим по коду.
    const grpcStatus = this.mapGrpcStatus(exception);
    if (grpcStatus !== undefined) {
      response.status(grpcStatus).json({
        statusCode: grpcStatus,
        message: this.extractMessage(exception),
      });
      return;
    }

    // 3. Прочая ошибка микросервиса: достаём текст сообщения и маппим по нему.
    const message = this.extractMessage(exception);
    const status = this.mapStatus(message);

    response.status(status).json({
      statusCode: status,
      message,
    });
  }

  /**
   * Маппинг ошибки gRPC -> HTTP по числовому коду.
   * Возвращает undefined, если у ошибки нет числового code (не gRPC).
   */
  private mapGrpcStatus(exception: unknown): number | undefined {
    if (!exception || typeof exception !== 'object') {
      return undefined;
    }
    const code = (exception as { code?: unknown }).code;
    if (typeof code !== 'number') {
      return undefined;
    }
    switch (code) {
      case GRPC_STATUS.NOT_FOUND:
        return HttpStatus.NOT_FOUND;
      case GRPC_STATUS.INVALID_ARGUMENT:
        return HttpStatus.BAD_REQUEST;
      case GRPC_STATUS.UNAUTHENTICATED:
        return HttpStatus.UNAUTHORIZED;
      case GRPC_STATUS.PERMISSION_DENIED:
        return HttpStatus.FORBIDDEN;
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }

  /** Приводит тело HttpException к единому виду, не раскрывая лишнего. */
  private normalizeHttpBody(
    exception: HttpException,
    status: number,
  ): Record<string, unknown> {
    const body = exception.getResponse();
    if (typeof body === 'string') {
      return { statusCode: status, message: body };
    }
    // body уже объект (например, ответ ValidationPipe) — отдаём его.
    return body as Record<string, unknown>;
  }

  /** Достаёт человекочитаемое сообщение из произвольной ошибки сервиса. */
  private extractMessage(exception: unknown): string {
    if (typeof exception === 'string') {
      return exception;
    }
    if (exception && typeof exception === 'object') {
      const maybe = exception as { message?: unknown; details?: unknown };
      // У gRPC-ошибок details содержит чистый текст (без префикса кода),
      // тогда как message выглядит как "5 NOT_FOUND: ...". Предпочитаем details.
      if (typeof maybe.details === 'string' && maybe.details.length > 0) {
        return maybe.details;
      }
      if (typeof maybe.message === 'string' && maybe.message.length > 0) {
        return maybe.message;
      }
    }
    // Дефолт: без внутренних деталей.
    return 'Внутренняя ошибка сервиса';
  }

  /** Подбирает HTTP-код по тексту сообщения от микросервиса. */
  private mapStatus(message: string): number {
    const lower = message.toLowerCase();

    // 401 — проблемы аутентификации/авторизации.
    if (message.includes('Неверн') || lower.includes('unauthorized')) {
      return HttpStatus.UNAUTHORIZED;
    }
    // 404 — сущность не найдена.
    if (message.includes('не найден')) {
      return HttpStatus.NOT_FOUND;
    }
    // По умолчанию — 400 Bad Request.
    return HttpStatus.BAD_REQUEST;
  }
}
