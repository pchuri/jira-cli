const createConfigCommand = require('../../bin/commands/config');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

    it('should have cloud-id option', () => {
      const cloudIdOption = configCommand.options.find(opt => opt.long === '--cloud-id');
      expect(cloudIdOption).toBeDefined();
    });

    it('should have auth-type option', () => {
      const authTypeOption = configCommand.options.find(opt => opt.long === '--auth-type');
      expect(authTypeOption).toBeDefined();
    });

    it('should have tls-client-cert option', () => {
      const opt = configCommand.options.find(o => o.long === '--tls-client-cert');
      expect(opt).toBeDefined();
    });

    it('should have tls-client-key option', () => {
      const opt = configCommand.options.find(o => o.long === '--tls-client-key');
      expect(opt).toBeDefined();
    });

    it('should have tls-ca-cert option', () => {
      const opt = configCommand.options.find(o => o.long === '--tls-ca-cert');
      expect(opt).toBeDefined();
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

  describe('scoped API token (--cloud-id) support', () => {
    it('should set cloudId when --cloud-id is provided', async () => {
      mockConfig.isConfigured.mockReturnValue(false);

      await configCommand.parseAsync(['node', 'test',
        '--server', 'https://test.atlassian.net',
        '--username', 'test@example.com',
        '--token', 'scoped-token',
        '--cloud-id', 'abcd-1234'
      ]);

      expect(mockConfig.set).toHaveBeenCalledWith('cloudId', 'abcd-1234');
    });

    it('should accept --cloud-id alone without other flags', async () => {
      mockConfig.isConfigured.mockReturnValue(false);

      await configCommand.parseAsync(['node', 'test',
        '--cloud-id', 'abcd-1234'
      ]);

      expect(mockConfig.set).toHaveBeenCalledWith('cloudId', 'abcd-1234');
    });
  });

  describe('mTLS authentication support', () => {
    let tmpDir;
    let certPath;
    let keyPath;
    let caPath;
    let exitSpy;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-config-cmd-mtls-'));
      certPath = path.join(tmpDir, 'client.pem');
      keyPath = path.join(tmpDir, 'client.key');
      caPath = path.join(tmpDir, 'ca.pem');
      fs.writeFileSync(certPath, 'cert');
      fs.writeFileSync(keyPath, 'key');
      fs.writeFileSync(caPath, 'ca');
      exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      exitSpy.mockRestore();
    });

    it('should set authType=mtls and store cert/key/ca paths', async () => {
      mockConfig.isConfigured.mockReturnValue(false);

      await configCommand.parseAsync(['node', 'test',
        '--server', 'https://jira.example.com',
        '--auth-type', 'mtls',
        '--tls-client-cert', certPath,
        '--tls-client-key', keyPath,
        '--tls-ca-cert', caPath
      ]);

      expect(mockConfig.set).toHaveBeenCalledWith('authType', 'mtls');
      expect(mockConfig.set).toHaveBeenCalledWith('tlsClientCert', certPath);
      expect(mockConfig.set).toHaveBeenCalledWith('tlsClientKey', keyPath);
      expect(mockConfig.set).toHaveBeenCalledWith('tlsCaCert', caPath);
    });

    it('should reject invalid --auth-type values', async () => {
      mockConfig.isConfigured.mockReturnValue(false);

      await configCommand.parseAsync(['node', 'test',
        '--auth-type', 'invalid'
      ]);

      expect(mockIOStreams.error).toHaveBeenCalledWith(
        expect.stringContaining('--auth-type must be')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockConfig.set).not.toHaveBeenCalledWith('authType', expect.anything());
    });

    it('should error when --tls-client-cert points to a missing file', async () => {
      mockConfig.isConfigured.mockReturnValue(false);

      await configCommand.parseAsync(['node', 'test',
        '--tls-client-cert', '/definitely/does/not/exist/cert.pem'
      ]);

      expect(mockIOStreams.error).toHaveBeenCalledWith(
        expect.stringContaining('Client certificate file not found')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockConfig.set).not.toHaveBeenCalledWith('tlsClientCert', expect.anything());
    });

    it('should error when --tls-client-key points to a missing file', async () => {
      mockConfig.isConfigured.mockReturnValue(false);

      await configCommand.parseAsync(['node', 'test',
        '--tls-client-key', '/definitely/does/not/exist/client.key'
      ]);

      expect(mockIOStreams.error).toHaveBeenCalledWith(
        expect.stringContaining('Client key file not found')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
