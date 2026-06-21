// Конфигурация Jest для unit-тестов шлюза (гварды, фильтры).
// E2E-тесты вынесены в отдельный конфиг test/jest-e2e.json.
module.exports = {
  // Транспилируем TypeScript на лету через ts-jest.
  preset: 'ts-jest',
  // Тесты выполняются в окружении Node.
  testEnvironment: 'node',
  // Корень проекта и каталог поиска unit-тестов — только src.
  rootDir: '.',
  roots: ['<rootDir>/src'],
  // Расширения модулей, которые Jest умеет разрешать.
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Берём только файлы вида *.spec.ts (e2e-spec под src не лежат).
  testRegex: '.spec.ts$',
  // Подгружаем reflect-metadata до тестов — нужно для DI/декораторов Nest.
  setupFiles: ['reflect-metadata'],
  // Сбор покрытия с исходников шлюза.
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '<rootDir>/coverage',
};
