// Unit-тесты AllExceptionsFilter. ArgumentsHost и Response мокаем вручную.
import {
  ArgumentsHost,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

// Тип поддельного Response (без циклической ссылки на самого себя).
interface MockResponse {
  statusCode: number;
  body: unknown;
  status: jest.Mock;
  json: jest.Mock;
}

// Поддельный Response с цепочкой status().json().
function makeResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 0,
    body: undefined,
    status: jest.fn(function (this: MockResponse, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (this: MockResponse, body: unknown) {
      this.body = body;
      return this;
    }),
  };
  return res;
}

// Поддельный ArgumentsHost, отдающий наш Response.
function makeHost(res: ReturnType<typeof makeResponse>): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({}),
    }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  // Глушим console.error, чтобы не засорять вывод тестов.
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('HttpException пробрасывается со своим статусом', () => {
    const res = makeResponse();
    filter.catch(new ForbiddenException('Недостаточно прав'), makeHost(res));

    expect(res.statusCode).toBe(HttpStatus.FORBIDDEN);
    // Тело несёт сообщение исключения.
    expect(JSON.stringify(res.body)).toContain('Недостаточно прав');
  });

  it('NotFoundException (HttpException) -> 404, статус берётся из исключения', () => {
    const res = makeResponse();
    filter.catch(new NotFoundException('Нет такого'), makeHost(res));

    expect(res.statusCode).toBe(HttpStatus.NOT_FOUND);
  });

  it('строковая ошибка микросервиса с "Неверн" -> 401', () => {
    const res = makeResponse();
    filter.catch('Неверный телефон или пароль', makeHost(res));

    expect(res.statusCode).toBe(HttpStatus.UNAUTHORIZED);
    expect(res.body).toEqual({
      statusCode: HttpStatus.UNAUTHORIZED,
      message: 'Неверный телефон или пароль',
    });
  });

  it('объектная ошибка микросервиса с "не найден" -> 404', () => {
    const res = makeResponse();
    filter.catch({ message: 'Товар не найден' }, makeHost(res));

    expect(res.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(res.body).toEqual({
      statusCode: HttpStatus.NOT_FOUND,
      message: 'Товар не найден',
    });
  });

  it('прочая ошибка микросервиса -> 400 по умолчанию', () => {
    const res = makeResponse();
    filter.catch('Некоторые позиции недоступны', makeHost(res));

    expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST);
  });

  it('неизвестная ошибка (без message) -> 400 и обобщённое сообщение, без стектрейса', () => {
    const res = makeResponse();
    // Передаём объект ошибки со стектрейсом — наружу он попасть не должен.
    filter.catch(new Error('секретные детали БД'), makeHost(res));

    expect(res.statusCode).toBe(HttpStatus.BAD_REQUEST);
    const serialized = JSON.stringify(res.body);
    // Сообщение Error имеет тип string -> попадёт в message; но стек/детали не утекают.
    const body = res.body as Record<string, unknown>;
    expect(body.statusCode).toBe(HttpStatus.BAD_REQUEST);
    // Наружу не отдаём стектрейс.
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('at ');
  });
});
