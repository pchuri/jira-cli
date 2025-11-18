module.exports = {
  testEnvironment: 'node',
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'lib/**/*.js',
    'bin/**/*.js',
    '!bin/index.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
