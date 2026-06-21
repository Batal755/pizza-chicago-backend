#!/usr/bin/env bash
# Запуск всей системы локально: 4 сервиса + шлюз + сайт.
# Остановить всё — Ctrl+C.
cd "$(dirname "$0")/.."

# При выходе глушим все дочерние процессы.
trap 'echo ""; echo "Останавливаю..."; kill 0' EXIT

echo "Запускаю микросервисы, шлюз и сайт..."
( cd services/auth-service          && npm run start:dev ) &
( cd services/catalog-service       && npm run start:dev ) &
( cd services/orders-service        && npm run start:dev ) &
( cd services/support-service       && npm run start:dev ) &
( cd services/notifications-service && npm run start:dev ) &
( cd services/payment-service       && npm run start:dev ) &
( cd gateway                        && npm run start:dev ) &
( cd web                            && npm run dev ) &

echo ""
echo "  Сайт:  http://localhost:3000"
echo "  API:   http://localhost:4000/api"
echo ""
wait
