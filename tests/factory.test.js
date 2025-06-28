const Factory = require('../lib/factory');
const JiraClient = require('../lib/jira-client');
const Config = require('../lib/config');
const IOStreams = require('../lib/iostreams');

describe('Factory', () => {
  let factory;

  beforeEach(() => {
    factory = new Factory();
  });

  describe('constructor', () => {
    it('should create factory instance', () => {
      expect(factory).toBeInstanceOf(Factory);
      expect(factory._ioStreams).toBeNull();
      expect(factory._config).toBeNull();
      expect(factory._jiraClient).toBeNull();
      expect(factory._analytics).toBeNull();
    });
  });

  describe('getIOStreams', () => {
    it('should create and cache IOStreams instance', () => {
      const iostreams = factory.getIOStreams();
      
      expect(iostreams).toBeInstanceOf(IOStreams);
      expect(factory._ioStreams).toBe(iostreams);
    });

    it('should return cached instance on subsequent calls', () => {
      const iostreams1 = factory.getIOStreams();
      const iostreams2 = factory.getIOStreams();
      
      expect(iostreams1).toBe(iostreams2);
    });
  });

  describe('getConfig', () => {
    it('should create and cache Config instance', () => {
      const config = factory.getConfig();
      
      expect(config).toBeInstanceOf(Config);
      expect(factory._config).toBe(config);
    });

    it('should return cached instance on subsequent calls', () => {
      const config1 = factory.getConfig();
      const config2 = factory.getConfig();
      
      expect(config1).toBe(config2);
    });
  });

  describe('getJiraClient', () => {
    it('should create and cache JiraClient instance when config is available', async () => {
      // Mock the config to return valid config
      const mockConfig = factory.getConfig();
      mockConfig.getRequiredConfig = jest.fn().mockResolvedValue({
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        token: 'test-token'
      });

      const client = await factory.getJiraClient();
      
      expect(client).toBeInstanceOf(JiraClient);
      expect(factory._jiraClient).toBe(client);
    });

    it('should return cached instance on subsequent calls', async () => {
      const mockConfig = factory.getConfig();
      mockConfig.getRequiredConfig = jest.fn().mockResolvedValue({
        host: 'https://test.atlassian.net',
        email: 'test@example.com',
        token: 'test-token'
      });

      const client1 = await factory.getJiraClient();
      const client2 = await factory.getJiraClient();
      
      expect(client1).toBe(client2);
    });
  });

  describe('canPrompt', () => {
    it('should return result from IOStreams canPrompt method', () => {
      const iostreams = factory.getIOStreams();
      iostreams.canPrompt = jest.fn().mockReturnValue(true);

      const result = factory.canPrompt();

      expect(result).toBe(true);
      expect(iostreams.canPrompt).toHaveBeenCalled();
    });
  });

  describe('getBrowser', () => {
    it('should return browser object with browse method', () => {
      const browser = factory.getBrowser();

      expect(browser).toBeDefined();
      expect(typeof browser.browse).toBe('function');
    });
  });
});
