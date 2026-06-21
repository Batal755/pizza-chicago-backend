// Сид базы данных: создаёт администратора по умолчанию через upsert.
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
      role: Role.ADMIN,
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
