const fs = require('fs');
const path = require('path');
const os = require('os');
const { applyConfigOptions, hasAnyConfigOption } = require('../lib/config-options');

describe('config-options', () => {
  describe('hasAnyConfigOption', () => {
    it('should return false for an empty options object', () => {
      expect(hasAnyConfigOption({})).toBe(false);
    });

    it('should return true when any recognized flag is present', () => {
      expect(hasAnyConfigOption({ server: 'https://x.atlassian.net' })).toBe(true);
      expect(hasAnyConfigOption({ cookie: 'MRHSession=abc' })).toBe(true);
      expect(hasAnyConfigOption({ apiVersion: '2' })).toBe(true);
    });
  });

  describe('applyConfigOptions', () => {
    let config;
    let io;

    beforeEach(() => {
      config = {
        set: jest.fn(),
        isConfigured: jest.fn().mockReturnValue(false),
        testConfig: jest.fn()
      };
      io = {
        success: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        out: jest.fn()
      };
    });

    it('should set each provided field and report success, scoped to the given profile', async () => {
      await applyConfigOptions(config, io, {
        server: 'https://work.atlassian.net/',
        username: 'user@example.com',
        token: 'tok',
        cloudId: 'cloud-1'
      }, 'work');

      expect(config.set).toHaveBeenCalledWith('server', 'https://work.atlassian.net', 'work');
      expect(config.set).toHaveBeenCalledWith('username', 'user@example.com', 'work');
      expect(config.set).toHaveBeenCalledWith('token', 'tok', 'work');
      expect(config.set).toHaveBeenCalledWith('cloudId', 'cloud-1', 'work');
      expect(io.success).toHaveBeenCalledTimes(4);
    });

    it('should reject an invalid --auth-type', async () => {
      await expect(applyConfigOptions(config, io, { authType: 'invalid' })).rejects.toThrow('--auth-type must be');
      expect(config.set).not.toHaveBeenCalledWith('authType', expect.anything(), expect.anything());
    });

    it('should accept --auth-type cookie', async () => {
      await applyConfigOptions(config, io, { authType: 'cookie' });
      expect(config.set).toHaveBeenCalledWith('authType', 'cookie', undefined);
    });

    it('should reject an invalid --api-version', async () => {
      await expect(applyConfigOptions(config, io, { apiVersion: 'invalid' })).rejects.toThrow('--api-version must be');
    });

    it('should reject a --tls-client-cert pointing at a missing file', async () => {
      await expect(applyConfigOptions(config, io, { tlsClientCert: '/does/not/exist.pem' }))
        .rejects.toThrow('Client certificate file not found');
    });

    it('should accept an existing --tls-client-cert file', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-config-options-'));
      const certPath = path.join(tmpDir, 'client.pem');
      fs.writeFileSync(certPath, 'cert');

      await applyConfigOptions(config, io, { tlsClientCert: certPath });
      expect(config.set).toHaveBeenCalledWith('tlsClientCert', certPath, undefined);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should set the cookie field', async () => {
      await applyConfigOptions(config, io, { cookie: 'MRHSession=abc123' });
      expect(config.set).toHaveBeenCalledWith('cookie', 'MRHSession=abc123', undefined);
    });

    it('should test the connection and report success when the profile is complete', async () => {
      config.isConfigured.mockReturnValue(true);
      config.testConfig.mockResolvedValue({ success: true, user: { displayName: 'Test User' } });

      await applyConfigOptions(config, io, { token: 'tok' }, 'work');

      expect(config.testConfig).toHaveBeenCalledWith('work');
      expect(io.success).toHaveBeenCalledWith('Connection successful!');
      expect(io.out).toHaveBeenCalledWith('Welcome, Test User!');
    });

    it('should report a failed connection test without throwing', async () => {
      config.isConfigured.mockReturnValue(true);
      config.testConfig.mockResolvedValue({ success: false, error: 'bad credentials' });

      await applyConfigOptions(config, io, { token: 'tok' });

      expect(io.error).toHaveBeenCalledWith(expect.stringContaining('bad credentials'));
    });

    it('should not test the connection when the profile is still incomplete', async () => {
      config.isConfigured.mockReturnValue(false);

      await applyConfigOptions(config, io, { server: 'https://x.atlassian.net' });

      expect(config.testConfig).not.toHaveBeenCalled();
    });
  });
});
