#!/usr/bin/env bash
# Полная настройка проекта одной командой: база, зависимости, схемы, наполнение.
set -e
cd "$(dirname "$0")/.."

echo "==> 1/4 Поднимаю PostgreSQL (Docker)..."
docker compose up -d

echo "==> Жду готовности базы..."
until docker exec pizza_pg pg_isready -U pizza >/dev/null 2>&1; do sleep 1; done
echo "База готова."

echo "==> 2/4 Устанавливаю зависимости во всех пакетах..."
for pkg in services/auth-service services/catalog-service services/orders-service services/support-service services/notifications-service services/payment-service gateway web; do
  echo "   - $pkg"
  ( cd "$pkg" && { [ -f .env ] || cp .env.example .env; } && npm install --silent )
done

echo "==> 3/4 Создаю схемы баз данных (prisma db push)..."
# notifications-service без своей БД — пропущен.
for svc in auth-service catalog-service orders-service support-service payment-service; do
  echo "   - $svc"
  ( cd "services/$svc" && npx prisma generate >/dev/null && npx prisma db push --skip-generate )
done

echo "==> 4/4 Наполняю меню и создаю администратора..."
( cd services/catalog-service && npm run prisma:seed )
( cd services/auth-service && npm run prisma:seed )

echo ""
echo "Готово! Теперь запусти всё: ./scripts/dev.sh"
echo "Сайт откроется на http://localhost:3000"
