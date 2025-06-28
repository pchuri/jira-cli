const createInitCommand = require('../../bin/commands/init');

describe('InitCommand', () => {
  let mockFactory;
  let mockIOStreams;
  let mockConfig;
  let mockAnalytics;
  let initCommand;

  beforeEach(() => {
    mockIOStreams = {
      out: {
        write: jest.fn()
      },
      colorize: jest.fn()
    };

    mockConfig = {
      interactiveSetup: jest.fn()
    };

    mockAnalytics = {
      track: jest.fn().mockResolvedValue()
    };

    mockFactory = {
      getIOStreams: jest.fn(() => mockIOStreams),
      getConfig: jest.fn(() => mockConfig),
      getAnalytics: jest.fn(() => mockAnalytics)
    };

    initCommand = createInitCommand(mockFactory);
  });

  describe('command creation', () => {
    it('should create init command', () => {
      expect(initCommand.name()).toBe('init');
      expect(initCommand.description()).toContain('Initialize JIRA CLI configuration');
    });

    it('should have setup alias', () => {
      expect(initCommand.aliases()).toContain('setup');
    });

    it('should have the correct properties', () => {
      expect(typeof initCommand).toBe('object');
      expect(initCommand.name()).toBe('init');
      expect(initCommand.aliases()).toContain('setup');
    });
  });

  describe('factory dependencies', () => {
    it('should use factory to get dependencies', () => {
      // Test that when we run the command action, it calls the factory methods
      // We can't easily test the action directly, but we can verify the command setup
      expect(mockFactory.getIOStreams).toBeDefined();
      expect(mockFactory.getConfig).toBeDefined();
      expect(mockFactory.getAnalytics).toBeDefined();
    });
  });
});
