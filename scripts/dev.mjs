// Кросс-платформенный запуск всего бэкенда: node scripts/dev.mjs
// 6 микросервисов + шлюз. Остановить — Ctrl+C.
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SERVICES = [
  ['auth', 'services/auth-service'],
  ['catalog', 'services/catalog-service'],
  ['orders', 'services/orders-service'],
  ['support', 'services/support-service'],
  ['notify', 'services/notifications-service'],
  ['payment', 'services/payment-service'],
  ['gateway', 'gateway'],
];

const children = SERVICES.map(([name, dir]) => {
  const child = spawn('npm', ['run', 'start:dev'], {
    cwd: join(root, dir),
    shell: true,
  });
  const tag = `[${name}] `;
  child.stdout.on('data', (d) => process.stdout.write(tag + d.toString().replace(/\n(?!$)/g, '\n' + tag)));
  child.stderr.on('data', (d) => process.stderr.write(tag + d.toString()));
  child.on('exit', (code) => console.log(`${tag}завершился (код ${code})`));
  return child;
});

console.log('Бэкенд запускается. Шлюз: http://localhost:4000/api');
console.log('Фронтенд запускается отдельно (репозиторий pizza-chicago-frontend: npm run dev).\n');

const shutdown = () => {
  for (const c of children) c.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
