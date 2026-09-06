// Test setup file
global.console = {
  ...console,
  // Suppress console.log during tests
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
