/** Unit + contract tests. E2E specs run separately via test/jest-e2e.json. */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['<rootDir>/test/market-data.e2e-spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coveragePathIgnorePatterns: ['/node_modules/', 'dto/market-data.dto.ts'],
};
