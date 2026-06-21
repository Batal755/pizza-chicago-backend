// Конфигурация Jest для unit-тестов notifications-service.
module.exports = {
  // Транспилируем TypeScript на лету через ts-jest.
  preset: 'ts-jest',
  // Тесты выполняются в окружении Node (не браузер).
  testEnvironment: 'node',
  // Корень проекта и каталог поиска тестов.
  rootDir: '.',
  roots: ['<rootDir>/src'],
  // Расширения модулей, которые Jest умеет разрешать.
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Берём только файлы вида *.spec.ts.
  testRegex: '.spec.ts$',
  // Подгружаем reflect-metadata до тестов — нужно для DI/декораторов Nest.
  setupFiles: ['reflect-metadata'],
  // Сбор покрытия с исходников сервиса.
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '<rootDir>/coverage',
};
