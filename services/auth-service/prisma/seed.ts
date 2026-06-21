// Сид базы данных: создаёт администратора по умолчанию через upsert.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://pizza:pizza@localhost:5432/auth_db?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Стоимость хеширования bcrypt (как и в сервисе аутентификации)
const BCRYPT_COST = 12;

async function main(): Promise<void> {
  const phone = '+79285660909';
  // Хешируем пароль администратора
  const passwordHash = await bcrypt.hash('admin123', BCRYPT_COST);

  // Создаём или обновляем администратора (идемпотентно)
  const admin = await prisma.user.upsert({
    where: { phone },
    update: {},
    create: {
      name: 'Администратор',
      phone,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`Администратор готов: ${admin.phone} (id=${admin.id})`);
}

main()
  .catch((error) => {
    console.error('Ошибка при сидировании базы данных:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
