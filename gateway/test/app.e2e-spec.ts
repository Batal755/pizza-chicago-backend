// E2E-тесты шлюза через supertest.
// Микросервисы НЕ поднимаем: gRPC-клиенты ('AUTH_PACKAGE' и т.п.) переопределяем
// заглушками вида { getService: () => serviceObj }, где методы сервиса (camelCase
// из .proto) возвращают Observable с мок-данными.

// ВАЖНО: секрет должен быть в env ДО инициализации модуля (ConfigModule снимает
// снимок env при старте). Поэтому выставляем его на самом верху файла.
process.env.JWT_ACCESS_SECRET = 'e2e-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-test-refresh-secret';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Gateway (e2e)', () => {
  let app: INestApplication;

  // Заглушка ClientGrpc: getService отдаёт объект сервиса с методами,
  // каждый из которых возвращает заранее заданные данные как Observable.
  const makeGrpcMock = (service: Record<string, unknown>) => ({
    getService: jest.fn(() => service),
  });

  // catalog: getMenu отдаёт ОБЁРТКУ { categories }, контроллер распакует в массив.
  const catalogMock = makeGrpcMock({
    getMenu: jest.fn(() =>
      of({
        categories: [
          {
            id: 'c1',
            name: 'Пиццы',
            products: [{ id: 'p1', name: 'Маргарита', price: 500 }],
          },
        ],
      }),
    ),
    getCategories: jest.fn(() => of({ categories: [] })),
    createProduct: jest.fn(() => of({})),
    updateProduct: jest.fn(() => of({})),
    deleteProduct: jest.fn(() => of({ ok: true })),
  });

  // orders: findAll отдаёт ОБЁРТКУ { orders }, контроллер распакует в массив.
  const ordersMock = makeGrpcMock({
    create: jest.fn(() => of({ id: 'o1', total: 500 })),
    findMy: jest.fn(() => of({ orders: [{ id: 'o1', total: 500 }] })),
    findAll: jest.fn(() => of({ orders: [{ id: 'o1', total: 500 }] })),
    updateStatus: jest.fn(() => of({ id: 'o1', status: 'CONFIRMED' })),
  });

  const authMock = makeGrpcMock({
    register: jest.fn(() => of({ user: { id: 'u1' }, tokens: {} })),
    login: jest.fn(() => of({ user: { id: 'u1' }, tokens: {} })),
    refresh: jest.fn(() => of({ tokens: {} })),
    me: jest.fn(() => of({ id: 'u1' })),
  });

  const supportMock = makeGrpcMock({
    create: jest.fn(() => of({ id: 't1' })),
    list: jest.fn(() => of({ tickets: [] })),
    close: jest.fn(() => of({ id: 't1', status: 'CLOSED' })),
  });

  const paymentMock = makeGrpcMock({
    createPayment: jest.fn(() =>
      of({ id: 'pay1', confirmationUrl: 'https://pay.example/pay1', status: 'pending' }),
    ),
    confirmPayment: jest.fn(() =>
      of({ id: 'pay1', orderId: 'o1', amount: 500, status: 'succeeded' }),
    ),
  });

  const notificationsMock = makeGrpcMock({
    sendOrderConfirmation: jest.fn(() => of({ ok: true, detail: '' })),
  });

  // Подписываем access-токены тем же секретом, что проверяет шлюз.
  const jwt = new JwtService({});
  const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
  const signToken = (role: string): string =>
    jwt.sign(
      { sub: 'u1', phone: '+79991234567', role },
      { secret: ACCESS_SECRET, expiresIn: '15m' },
    );

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Подменяем реальные gRPC-клиенты заглушками.
      .overrideProvider('AUTH_PACKAGE')
      .useValue(authMock)
      .overrideProvider('CATALOG_PACKAGE')
      .useValue(catalogMock)
      .overrideProvider('ORDERS_PACKAGE')
      .useValue(ordersMock)
      .overrideProvider('SUPPORT_PACKAGE')
      .useValue(supportMock)
      .overrideProvider('PAYMENT_PACKAGE')
      .useValue(paymentMock)
      .overrideProvider('NOTIFICATIONS_PACKAGE')
      .useValue(notificationsMock)
      .compile();

    app = moduleRef.createNestApplication();

    // Повторяем глобальные настройки из main.ts.
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/catalog/menu -> 200 и распакованный массив категорий', async () => {
    const res = await request(app.getHttpServer()).get('/api/catalog/menu');

    expect(res.status).toBe(200);
    // Контроллер распаковал { categories } -> массив.
    expect(res.body).toEqual([
      {
        id: 'c1',
        name: 'Пиццы',
        products: [{ id: 'p1', name: 'Маргарита', price: 500 }],
      },
    ]);
  });

  it('POST /api/auth/register с некорректным телом -> 400 (валидация)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      // name слишком короткое, phone не проходит regex, password короткий,
      // плюс лишнее поле (forbidNonWhitelisted).
      .send({ name: 'A', phone: '123', password: '1', extra: 'нельзя' });

    expect(res.status).toBe(400);
  });

  it('GET /api/orders/my без токена -> 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/orders/my');

    expect(res.status).toBe(401);
  });

  describe('GET /api/admin/orders (JWT + ADMIN)', () => {
    it('без токена -> 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/admin/orders');

      expect(res.status).toBe(401);
    });

    it('токен роли CUSTOMER -> 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${signToken('CUSTOMER')}`);

      expect(res.status).toBe(403);
    });

    it('токен роли ADMIN -> 200 и распакованный массив заказов', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${signToken('ADMIN')}`);

      expect(res.status).toBe(200);
      // Контроллер распаковал { orders } -> массив.
      expect(res.body).toEqual([{ id: 'o1', total: 500 }]);
    });
  });
});
