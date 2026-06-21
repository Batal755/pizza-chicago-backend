// Кросс-платформенная настройка (Windows / macOS / Linux): node scripts/setup.mjs
// Поднимает БД, создаёт .env, ставит зависимости, генерит Prisma-клиент, создаёт схемы, наполняет меню.
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit', shell: true });
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const ALL = [
  'gateway',
  'services/auth-service',
  'services/catalog-service',
  'services/orders-service',
  'services/support-service',
  'services/notifications-service',
  'services/payment-service',
];
const PRISMA = [
  'services/auth-service',
  'services/catalog-service',
  'services/orders-service',
  'services/support-service',
  'services/payment-service',
];
const SEED = ['services/catalog-service', 'services/auth-service'];

console.log('==> 1/5 Поднимаю PostgreSQL (Docker)...');
run('docker compose up -d', root);

console.log('==> Жду готовности базы...');
let ready = false;
for (let i = 0; i < 30 && !ready; i++) {
  try {
    execSync('docker exec pizza_pg pg_isready -U pizza', { stdio: 'ignore', shell: true });
    ready = true;
  } catch {
    sleep(1000);
  }
}
console.log(ready ? 'База готова.' : 'Не дождался базы — продолжаю, но шаги с БД могут упасть.');

console.log('==> 2/5 .env во всех пакетах...');
for (const p of ALL) {
  const dir = join(root, p);
  const env = join(dir, '.env');
  const ex = join(dir, '.env.example');
  if (!existsSync(env) && existsSync(ex)) {
    copyFileSync(ex, env);
    console.log('   .env создан:', p);
  }
}

console.log('==> 3/5 Устанавливаю зависимости...');
for (const p of ALL) {
  console.log('   npm install:', p);
  run('npm install', join(root, p));
}

console.log('==> 4/5 Prisma: генерация клиента и схемы БД...');
for (const p of PRISMA) {
  console.log('   prisma generate + db push:', p);
  run('npm run prisma:generate', join(root, p));
  run('npm run db:push', join(root, p));
}

console.log('==> 5/5 Наполняю меню и создаю администратора...');
for (const p of SEED) {
  console.log('   seed:', p);
  run('npm run prisma:seed', join(root, p));
}

console.log('\nГотово! Запусти всё: npm run dev');
console.log('Шлюз: http://localhost:4000/api   (фронтенд — в отдельном репозитории)');
