// Test setup file
global.console = {
  ...console,
  // Suppress console.log during tests
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock conf for tests
jest.mock('conf', () => {
  return class MockConf {
    constructor() {
      this.store = {};
    }
    
    get(key) {
      return key ? this.store[key] : this.store;
    }
    
    set(key, value) {
      this.store[key] = value;
    }
    
    has(key) {
      return key in this.store;
    }
    
    delete(key) {
      delete this.store[key];
    }
    
    clear() {
      this.store = {};
    }
  };
});
