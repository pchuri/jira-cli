const createConfigCommand = require('../../bin/commands/config');

describe('ConfigCommand', () => {
  let mockFactory;
  let mockIOStreams;
  let mockConfig;
  let mockAnalytics;
  let configCommand;

  beforeEach(() => {
    mockIOStreams = {
      out: jest.fn(),
      println: jest.fn(),
      printError: jest.fn(),
      printSuccess: jest.fn(),
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      colorize: jest.fn()
    };

    mockConfig = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      has: jest.fn(),
      isConfigured: jest.fn(),
      getRequiredConfig: jest.fn(),
      testConnection: jest.fn(),
      testConfig: jest.fn(),
      displayConfig: jest.fn(),
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

    configCommand = createConfigCommand(mockFactory);
  });

  describe('command structure', () => {
    it('should create config command', () => {
      expect(configCommand.name()).toBe('config');
      expect(configCommand.description()).toContain('Manage JIRA CLI configuration');
    });

    it('should have correct alias', () => {
      expect(configCommand.aliases()).toContain('c');
    });

    it('should have options', () => {
      const options = configCommand.options;
      expect(options.length).toBeGreaterThan(0);
    });
  });

  describe('command options', () => {
    it('should have show option', () => {
      const showOption = configCommand.options.find(opt => opt.long === '--show');
      expect(showOption).toBeDefined();
      expect(showOption.short).toBe('-s');
    });

    it('should have server option', () => {
      const serverOption = configCommand.options.find(opt => opt.long === '--server');
      expect(serverOption).toBeDefined();
    });

    it('should have username option', () => {
      const usernameOption = configCommand.options.find(opt => opt.long === '--username');
      expect(usernameOption).toBeDefined();
    });

    it('should have token option', () => {
      const tokenOption = configCommand.options.find(opt => opt.long === '--token');
      expect(tokenOption).toBeDefined();
    });
  });

  describe('Bearer authentication support', () => {
    it('should allow setting config without username', async () => {
      mockConfig.isConfigured.mockReturnValue(false);

      await configCommand.parseAsync(['node', 'test',
        '--server', 'https://test.atlassian.net',
        '--token', 'testtoken'
      ]);

      expect(mockConfig.set).toHaveBeenCalledWith('server', 'https://test.atlassian.net');
      expect(mockConfig.set).toHaveBeenCalledWith('token', 'testtoken');
      expect(mockConfig.set).not.toHaveBeenCalledWith('username', expect.anything());
    });

    it('should test connection with Bearer auth config', async () => {
      mockConfig.isConfigured.mockReturnValue(true);
      mockConfig.testConfig.mockResolvedValue({
        success: true,
        user: { displayName: 'Test User' }
      });

      await configCommand.parseAsync(['node', 'test',
        '--server', 'https://test.atlassian.net',
        '--token', 'testtoken'
      ]);

      expect(mockConfig.testConfig).toHaveBeenCalled();
    });
  });
});
