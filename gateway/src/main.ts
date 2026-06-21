import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Безопасные HTTP-заголовки.
  app.use(helmet());
  // Сжатие ответов.
  app.use(compression());

  // CORS только для разрешённого источника (фронтенд), с куками/credentials.
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  // Общий префикс всех REST-маршрутов.
  app.setGlobalPrefix('api');

  // Глобальная валидация: только описанные поля, лишние — ошибка, с трансформацией типов.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Глобальный фильтр: маппинг ошибок микросервисов, сокрытие внутренних деталей.
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API-шлюз запущен на порту ${port}`);
}

void bootstrap();
