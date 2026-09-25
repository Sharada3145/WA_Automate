process.env.USE_MOCK_REDIS = 'true';
process.env.USE_MOCK_WHATSAPP = 'true';

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  clearMocks: true,
};
