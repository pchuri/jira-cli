const Config = require('../lib/config');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Config', () => {
  let config;
  let fakeHome;
  let homedirSpy;

  beforeEach(() => {
    // Config reads/writes under os.homedir() (both the new ~/.jira-cli store
    // and, as a migration fallback, the old conf-managed location) - mock it
    // to a fresh throwaway directory so tests never touch, or accidentally
    // pick up, the real machine's config.
    fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-cli-fakehome-'));
    homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(fakeHome);
    config = new Config();
    delete process.env.JIRA_HOST;
    delete process.env.JIRA_DOMAIN;
    delete process.env.JIRA_USERNAME;
    delete process.env.JIRA_API_TOKEN;
    delete process.env.JIRA_CLOUD_ID;
    delete process.env.JIRA_COOKIE;
    delete process.env.JIRA_AUTH_TYPE;
    delete process.env.JIRA_TLS_CLIENT_CERT;
    delete process.env.JIRA_TLS_CLIENT_KEY;
    delete process.env.JIRA_TLS_CA_CERT;
    delete process.env.JIRA_PROFILE;
    delete process.env.JIRA_CLI_CONFIG_DIR;
  });

  afterEach(() => {
    homedirSpy.mockRestore();
    fs.rmSync(fakeHome, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create Config instance', () => {
      expect(config).toBeInstanceOf(Config);
    });
  });

  describe('basic functionality', () => {
    it('should have get method', () => {
      expect(typeof config.get).toBe('function');
    });

    it('should have set method', () => {
      expect(typeof config.set).toBe('function');
    });

    it('should have delete method', () => {
      expect(typeof config.delete).toBe('function');
    });

    it('should have clear method', () => {
      expect(typeof config.clear).toBe('function');
    });

    it('should have has method', () => {
      expect(typeof config.has).toBe('function');
    });

    it('should have isConfigured method', () => {
      expect(typeof config.isConfigured).toBe('function');
    });

    it('should have getRequiredConfig method', () => {
      expect(typeof config.getRequiredConfig).toBe('function');
    });
  });

  describe('configuration management', () => {
    it('should initially report as not configured', () => {
      expect(config.isConfigured()).toBe(false);
    });

    it('should allow setting and getting configuration', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('username', 'testuser');
      config.set('token', 'testtoken');
      
      expect(config.get('server')).toBe('https://test.atlassian.net');
      expect(config.get('username')).toBe('testuser');
      expect(config.get('token')).toBe('testtoken');
    });

    it('should report as configured when all required fields are set', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('username', 'testuser');
      config.set('token', 'testtoken');
      
      expect(config.isConfigured()).toBe(true);
    });

    it('should allow clearing configuration', () => {
      config.set('server', 'https://test.atlassian.net');
      config.clear();
      
      expect(config.isConfigured()).toBe(false);
      expect(config.has('server')).toBe(false);
    });

    it('should check if key exists with has method', () => {
      expect(config.has('server')).toBe(false);
      
      config.set('server', 'https://test.atlassian.net');
      expect(config.has('server')).toBe(true);
    });

    it('should allow deleting specific keys', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('username', 'testuser');
      
      expect(config.has('server')).toBe(true);
      config.delete('server');
      expect(config.has('server')).toBe(false);
      expect(config.has('username')).toBe(true);
    });

    it('should get all config when no key specified', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('username', 'testuser');
      
      const allConfig = config.get();
      expect(allConfig).toHaveProperty('server', 'https://test.atlassian.net');
      expect(allConfig).toHaveProperty('username', 'testuser');
    });
  });

  describe('environment variable support', () => {
    it('should report as configured with JIRA_HOST environment variables', () => {
      process.env.JIRA_HOST = 'https://test.atlassian.net';
      process.env.JIRA_API_TOKEN = 'testtoken';
      
      expect(config.isConfigured()).toBe(true);
    });

    it('should report as configured with legacy JIRA_DOMAIN environment variables', () => {
      process.env.JIRA_DOMAIN = 'https://test.atlassian.net';
      process.env.JIRA_USERNAME = 'testuser';
      process.env.JIRA_API_TOKEN = 'testtoken';
      
      expect(config.isConfigured()).toBe(true);
    });

    it('should get config from JIRA_HOST environment variables', () => {
      process.env.JIRA_HOST = 'https://test.atlassian.net';
      process.env.JIRA_API_TOKEN = 'testtoken';
      
      const envConfig = config.getRequiredConfig();
      expect(envConfig.server).toBe('https://test.atlassian.net');
      expect(envConfig.token).toBe('testtoken');
      expect(envConfig.username).toBe('');
    });

    it('should get config from legacy environment variables', () => {
      process.env.JIRA_DOMAIN = 'test.atlassian.net';
      process.env.JIRA_USERNAME = 'testuser';
      process.env.JIRA_API_TOKEN = 'testtoken';
      
      const envConfig = config.getRequiredConfig();
      expect(envConfig.server).toBe('https://test.atlassian.net');
      expect(envConfig.username).toBe('testuser');
      expect(envConfig.token).toBe('testtoken');
    });
  });

  describe('error handling', () => {
    it('should throw error when getting required config if not configured', () => {
      expect(() => config.getRequiredConfig()).toThrow('JIRA CLI is not configured');
    });

    it('should get required config from stored values', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('username', 'testuser');
      config.set('token', 'testtoken');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.server).toBe('https://test.atlassian.net');
      expect(requiredConfig.username).toBe('testuser');
      expect(requiredConfig.token).toBe('testtoken');
    });
  });

  describe('Bearer authentication support', () => {
    it('should report as configured when server and token are set without username', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('token', 'testtoken');

      expect(config.isConfigured()).toBe(true);
    });

    it('should get required config without username (Bearer auth)', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('token', 'testtoken');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.server).toBe('https://test.atlassian.net');
      expect(requiredConfig.username).toBe('');
      expect(requiredConfig.token).toBe('testtoken');
    });

    it('should support both auth modes in stored config', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('token', 'testtoken');
      let bearerConfig = config.getRequiredConfig();
      expect(bearerConfig.username).toBe('');

      config.set('username', 'testuser');
      let basicConfig = config.getRequiredConfig();
      expect(basicConfig.username).toBe('testuser');
    });

    it('should switch to Bearer auth when username is deleted', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('username', 'testuser');
      config.set('token', 'testtoken');

      config.delete('username');

      const bearerConfig = config.getRequiredConfig();
      expect(bearerConfig.username).toBe('');
      expect(config.isConfigured()).toBe(true);
    });

    it('should infer basic auth for legacy config without explicit authType', () => {
      // Legacy stored config predating the --auth-type flag: only server,
      // username, and token. getRequiredConfig() must still infer basic auth
      // instead of defaulting to bearer.
      config.set('server', 'https://test.atlassian.net');
      config.set('username', 'testuser');
      config.set('token', 'testtoken');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.authType).toBe('basic');
      expect(requiredConfig.username).toBe('testuser');
      expect(requiredConfig.token).toBe('testtoken');
    });
  });

  describe('scoped API token (cloudId) support', () => {
    it('should default cloudId to empty string when not set', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('token', 'testtoken');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.cloudId).toBe('');
    });

    it('should return cloudId from stored config', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('username', 'test@example.com');
      config.set('token', 'scoped-token');
      config.set('cloudId', 'abcd-1234');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.cloudId).toBe('abcd-1234');
    });

    it('should prefer JIRA_CLOUD_ID env var over stored config', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('token', 'testtoken');
      config.set('cloudId', 'stored-cloud-id');
      process.env.JIRA_CLOUD_ID = 'env-cloud-id';

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.cloudId).toBe('env-cloud-id');
    });

    it('should pick up cloudId via JIRA_CLOUD_ID alongside JIRA_HOST env vars', () => {
      process.env.JIRA_HOST = 'https://test.atlassian.net';
      process.env.JIRA_API_TOKEN = 'scoped-token';
      process.env.JIRA_CLOUD_ID = 'env-cloud-id';

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.cloudId).toBe('env-cloud-id');
      expect(requiredConfig.server).toBe('https://test.atlassian.net');
    });

    it('should include cloudId in the explicit basic-auth getRequiredConfig output', () => {
      // The explicit-basic-auth branch was previously dropping cloudId, which
      // meant scoped tokens would silently route around the gateway whenever
      // the user pinned authType=basic. This test guards that integration.
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('username', 'test@example.com');
      config.set('token', 'scoped-token');
      config.set('cloudId', 'abcd-1234');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.authType).toBe('basic');
      expect(requiredConfig.cloudId).toBe('abcd-1234');
      expect(requiredConfig.username).toBe('test@example.com');
      expect(requiredConfig.token).toBe('scoped-token');
    });
  });

  describe('SSO gateway session cookie support', () => {
    it('should default cookie to empty string when not set', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('token', 'testtoken');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.cookie).toBe('');
    });

    it('should return cookie from stored config (bearer/legacy branch)', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('token', 'testtoken');
      config.set('cookie', 'MRHSession=abc123');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.cookie).toBe('MRHSession=abc123');
    });

    it('should include cookie in the explicit basic-auth getRequiredConfig output', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('username', 'test@example.com');
      config.set('token', 'testtoken');
      config.set('cookie', 'MRHSession=abc123');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.authType).toBe('basic');
      expect(requiredConfig.cookie).toBe('MRHSession=abc123');
    });

    it('should include cookie in the mTLS getRequiredConfig output', () => {
      const certPath = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-cookie-mtls-'));
      const clientCert = path.join(certPath, 'client.pem');
      const clientKey = path.join(certPath, 'client.key');
      fs.writeFileSync(clientCert, 'cert');
      fs.writeFileSync(clientKey, 'key');

      config.set('server', 'https://test.example.com');
      config.set('authType', 'mtls');
      config.set('tlsClientCert', clientCert);
      config.set('tlsClientKey', clientKey);
      config.set('cookie', 'MRHSession=abc123');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.authType).toBe('mtls');
      expect(requiredConfig.cookie).toBe('MRHSession=abc123');

      fs.rmSync(certPath, { recursive: true, force: true });
    });

    it('should prefer JIRA_COOKIE env var over stored config', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('token', 'testtoken');
      config.set('cookie', 'stored-cookie');
      process.env.JIRA_COOKIE = 'env-cookie';

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.cookie).toBe('env-cookie');
    });

    it('should pick up cookie via JIRA_COOKIE alongside JIRA_HOST env vars', () => {
      process.env.JIRA_HOST = 'https://test.atlassian.net';
      process.env.JIRA_API_TOKEN = 'testtoken';
      process.env.JIRA_COOKIE = 'env-cookie';

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.cookie).toBe('env-cookie');
    });
  });

  describe('mTLS authentication support', () => {
    let tmpDir;
    let certPath;
    let keyPath;
    let caPath;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-config-mtls-'));
      certPath = path.join(tmpDir, 'client.pem');
      keyPath = path.join(tmpDir, 'client.key');
      caPath = path.join(tmpDir, 'ca.pem');
      fs.writeFileSync(certPath, 'client-cert');
      fs.writeFileSync(keyPath, 'client-key');
      fs.writeFileSync(caPath, 'ca-cert');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should report as configured with mTLS environment variables', () => {
      process.env.JIRA_HOST = 'https://jira.example.com';
      process.env.JIRA_AUTH_TYPE = 'mtls';
      process.env.JIRA_TLS_CLIENT_CERT = certPath;
      process.env.JIRA_TLS_CLIENT_KEY = keyPath;

      expect(config.isConfigured()).toBe(true);
    });

    it('should get mTLS config from environment variables', () => {
      process.env.JIRA_HOST = 'https://jira.example.com';
      process.env.JIRA_AUTH_TYPE = 'mtls';
      process.env.JIRA_TLS_CLIENT_CERT = certPath;
      process.env.JIRA_TLS_CLIENT_KEY = keyPath;
      process.env.JIRA_TLS_CA_CERT = caPath;

      const mtlsConfig = config.getRequiredConfig();
      expect(mtlsConfig.server).toBe('https://jira.example.com');
      expect(mtlsConfig.authType).toBe('mtls');
      expect(mtlsConfig.mtls.clientCert).toBe(certPath);
      expect(mtlsConfig.mtls.clientKey).toBe(keyPath);
      expect(mtlsConfig.mtls.caCert).toBe(caPath);
      expect(mtlsConfig.token).toBeUndefined();
    });

    it('should report as configured with mTLS stored config', () => {
      config.set('server', 'https://jira.example.com');
      config.set('authType', 'mtls');
      config.set('tlsClientCert', certPath);
      config.set('tlsClientKey', keyPath);

      expect(config.isConfigured()).toBe(true);
    });

    it('should get mTLS config from stored config', () => {
      config.set('server', 'https://jira.example.com');
      config.set('authType', 'mtls');
      config.set('tlsClientCert', certPath);
      config.set('tlsClientKey', keyPath);
      config.set('tlsCaCert', caPath);

      const mtlsConfig = config.getRequiredConfig();
      expect(mtlsConfig.server).toBe('https://jira.example.com');
      expect(mtlsConfig.authType).toBe('mtls');
      expect(mtlsConfig.mtls.clientCert).toBe(certPath);
      expect(mtlsConfig.mtls.clientKey).toBe(keyPath);
      expect(mtlsConfig.mtls.caCert).toBe(caPath);
    });

    it('should throw error for mTLS with missing client cert', () => {
      process.env.JIRA_HOST = 'https://jira.example.com';
      process.env.JIRA_AUTH_TYPE = 'mtls';
      process.env.JIRA_TLS_CLIENT_KEY = keyPath;

      expect(() => config.getRequiredConfig()).toThrow('mTLS requires a client certificate');
    });

    it('should throw error for mTLS with missing client key', () => {
      process.env.JIRA_HOST = 'https://jira.example.com';
      process.env.JIRA_AUTH_TYPE = 'mtls';
      process.env.JIRA_TLS_CLIENT_CERT = certPath;

      expect(() => config.getRequiredConfig()).toThrow('mTLS requires a client key');
    });

    it('should throw error for mTLS with nonexistent cert file', () => {
      process.env.JIRA_HOST = 'https://jira.example.com';
      process.env.JIRA_AUTH_TYPE = 'mtls';
      process.env.JIRA_TLS_CLIENT_CERT = '/nonexistent/client.pem';
      process.env.JIRA_TLS_CLIENT_KEY = keyPath;

      expect(() => config.getRequiredConfig()).toThrow('Client certificate file not found');
    });

    it('should validate mTLS config correctly', () => {
      const validMtls = {
        clientCert: certPath,
        clientKey: keyPath,
        caCert: caPath
      };
      expect(config.validateMtlsConfig(validMtls)).toEqual([]);

      const invalidMtls = {
        clientCert: '/nonexistent/cert.pem',
        clientKey: keyPath
      };
      const errors = config.validateMtlsConfig(invalidMtls);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('not found');
    });

    it('should report as not configured when authType is mtls but cert/key are missing', () => {
      // Previously, isConfigured() only checked (server && token) and would
      // return true for an mTLS config with a stale token, even though
      // getRequiredConfig() would then throw on the missing cert.
      config.set('server', 'https://jira.example.com');
      config.set('authType', 'mtls');
      config.set('token', 'stale-token');

      expect(config.isConfigured()).toBe(false);
    });

    it('should report as configured for mTLS without a token', () => {
      config.set('server', 'https://jira.example.com');
      config.set('authType', 'mtls');
      config.set('tlsClientCert', certPath);
      config.set('tlsClientKey', keyPath);

      expect(config.isConfigured()).toBe(true);
    });

    it('should report as not configured when env mTLS is incomplete even if JIRA_API_TOKEN is set', () => {
      // When JIRA_AUTH_TYPE=mtls is set, that choice is authoritative.
      // Previously, a stale JIRA_API_TOKEN would cause isConfigured() to
      // return true via the JIRA_HOST + JIRA_API_TOKEN fallback even when
      // the required client cert/key env vars were missing.
      process.env.JIRA_HOST = 'https://jira.example.com';
      process.env.JIRA_AUTH_TYPE = 'mtls';
      process.env.JIRA_API_TOKEN = 'stale-token';
      // Intentionally omit JIRA_TLS_CLIENT_CERT / JIRA_TLS_CLIENT_KEY

      expect(config.isConfigured()).toBe(false);
    });

    it('should report as configured for env mTLS when all required vars are set, even with a stale token', () => {
      process.env.JIRA_HOST = 'https://jira.example.com';
      process.env.JIRA_AUTH_TYPE = 'mtls';
      process.env.JIRA_TLS_CLIENT_CERT = certPath;
      process.env.JIRA_TLS_CLIENT_KEY = keyPath;
      process.env.JIRA_API_TOKEN = 'stale-token';

      expect(config.isConfigured()).toBe(true);
    });

    it('should report as not configured for partial env mTLS (cert only) even with a stale JIRA_API_TOKEN', () => {
      // Partial mTLS env (client cert set but client key missing) must not
      // fall through to the JIRA_HOST + JIRA_API_TOKEN path.
      process.env.JIRA_HOST = 'https://jira.example.com';
      process.env.JIRA_AUTH_TYPE = 'mtls';
      process.env.JIRA_TLS_CLIENT_CERT = certPath;
      process.env.JIRA_API_TOKEN = 'stale-token';
      // Intentionally omit JIRA_TLS_CLIENT_KEY

      expect(config.isConfigured()).toBe(false);
    });

    it('should let env mTLS override a complete stored basic-auth config', () => {
      // Env selects mTLS authoritatively. Even if stored config is a fully
      // valid basic-auth setup, an incomplete env mTLS selection should report
      // the CLI as not configured rather than silently using the stored config.
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('username', 'testuser');
      config.set('token', 'testtoken');

      process.env.JIRA_HOST = 'https://jira.example.com';
      process.env.JIRA_AUTH_TYPE = 'mtls';
      // No cert/key in env

      expect(config.isConfigured()).toBe(false);
    });

    it('should report as not configured when stored mTLS cert/key are empty strings', () => {
      config.set('server', 'https://jira.example.com');
      config.set('authType', 'mtls');
      config.set('tlsClientCert', '');
      config.set('tlsClientKey', '');

      expect(config.isConfigured()).toBe(false);
    });
  });

  describe('empty-value validation', () => {
    it('should report as not configured when stored basic auth has an empty username', () => {
      // has() only checks key presence; an empty string previously slipped
      // through. isConfigured() should now require non-empty values.
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('username', '');
      config.set('token', 'testtoken');

      expect(config.isConfigured()).toBe(false);
    });

    it('should report as not configured when stored basic auth has an empty token', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('username', 'testuser');
      config.set('token', '');

      expect(config.isConfigured()).toBe(false);
    });

    it('should throw from getRequiredConfig when explicit basic auth has an empty username', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('username', '');
      config.set('token', 'testtoken');

      expect(() => config.getRequiredConfig()).toThrow(/Missing: username/);
    });

    it('should throw from getRequiredConfig when explicit basic auth has an empty token', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('username', 'testuser');
      config.set('token', '');

      expect(() => config.getRequiredConfig()).toThrow(/Missing: token/);
    });

    it('should report as not configured when stored bearer auth has an empty token', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'bearer');
      config.set('token', '');

      expect(config.isConfigured()).toBe(false);
    });

    it('should report as not configured when legacy stored config has an empty token', () => {
      // Legacy config (no explicit authType) with an empty token should not
      // pass isConfigured() either.
      config.set('server', 'https://test.atlassian.net');
      config.set('token', '');

      expect(config.isConfigured()).toBe(false);
    });

    it('should report as not configured when stored bearer auth has a whitespace-only token', () => {
      // End-to-end check that the hasNonEmpty helper is actually wired into
      // isConfigured() for the bearer branch - a future change that skips the
      // helper would be caught here.
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'bearer');
      config.set('token', '   ');

      expect(config.isConfigured()).toBe(false);
    });

    it('should report as not configured for legacy stored config with username set but empty token', () => {
      // Legacy config (no explicit authType) that looks like basic auth but
      // has an empty token must not slip through the final `hasNonEmpty('token')`
      // check at the end of isConfigured().
      config.set('server', 'https://test.atlassian.net');
      config.set('username', 'testuser');
      config.set('token', '');

      expect(config.isConfigured()).toBe(false);
    });

    it('should expose a hasNonEmpty helper that rejects empty and whitespace-only strings', () => {
      config.set('username', '');
      expect(config.hasNonEmpty('username')).toBe(false);

      config.set('username', '   ');
      expect(config.hasNonEmpty('username')).toBe(false);

      config.set('username', 'testuser');
      expect(config.hasNonEmpty('username')).toBe(true);

      expect(config.hasNonEmpty('nonexistent')).toBe(false);
    });
  });

  describe('explicit basic auth validation', () => {
    it('should report as not configured when authType is basic but username is missing', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('token', 'testtoken');

      expect(config.isConfigured()).toBe(false);
    });

    it('should report as not configured when authType is basic but token is missing', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('username', 'testuser');

      expect(config.isConfigured()).toBe(false);
    });

    it('should throw from getRequiredConfig when explicit basic auth has no username', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('token', 'testtoken');

      expect(() => config.getRequiredConfig()).toThrow(/Basic auth/);
      expect(() => config.getRequiredConfig()).toThrow(/Missing: username/);
    });

    it('should throw from getRequiredConfig when explicit basic auth has no token', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('username', 'testuser');

      expect(() => config.getRequiredConfig()).toThrow(/Basic auth/);
      expect(() => config.getRequiredConfig()).toThrow(/Missing: token/);
    });

    it('should return basic auth config when all fields are present', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'basic');
      config.set('username', 'testuser');
      config.set('token', 'testtoken');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.authType).toBe('basic');
      expect(requiredConfig.username).toBe('testuser');
      expect(requiredConfig.token).toBe('testtoken');
    });
  });

  describe('explicit bearer auth', () => {
    it('should report as configured with explicit bearer authType, server, and token', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'bearer');
      config.set('token', 'testtoken');

      expect(config.isConfigured()).toBe(true);
    });

    it('should report as not configured with explicit bearer authType but no token', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'bearer');

      expect(config.isConfigured()).toBe(false);
    });

    it('should return bearer auth config from getRequiredConfig', () => {
      config.set('server', 'https://test.atlassian.net');
      config.set('authType', 'bearer');
      config.set('token', 'testtoken');

      const requiredConfig = config.getRequiredConfig();
      expect(requiredConfig.authType).toBe('bearer');
      expect(requiredConfig.token).toBe('testtoken');
    });
  });

  describe('multi-profile isolation', () => {
    it('should keep two profiles fully separate', () => {
      config.set('server', 'https://default.atlassian.net', 'default');
      config.set('token', 'default-token', 'default');
      config.set('server', 'https://work.atlassian.net', 'work');
      config.set('token', 'work-token', 'work');

      expect(config.get('server', 'default')).toBe('https://default.atlassian.net');
      expect(config.get('server', 'work')).toBe('https://work.atlassian.net');
      expect(config.getRequiredConfig('default').server).toBe('https://default.atlassian.net');
      expect(config.getRequiredConfig('work').server).toBe('https://work.atlassian.net');
    });

    it('should default to the active profile when no profileName is given', () => {
      config.set('server', 'https://work.atlassian.net', 'work');
      config.set('token', 'work-token', 'work');
      config.setActiveProfile('work');

      expect(config.get('server')).toBe('https://work.atlassian.net');
      expect(config.getRequiredConfig().server).toBe('https://work.atlassian.net');
    });

    it('should not switch the active profile when writing to a non-active one', () => {
      config.set('server', 'https://default.atlassian.net');
      config.set('token', 'default-token');
      config.set('server', 'https://work.atlassian.net', 'work');

      const { activeProfile } = config.listProfiles();
      expect(activeProfile).toBe('default');
    });
  });

  describe('profile management', () => {
    it('should report no profiles when nothing is configured', () => {
      expect(config.listProfiles()).toEqual({ activeProfile: null, profiles: [] });
    });

    it('should list profiles with the active marker', () => {
      config.set('server', 'https://default.atlassian.net');
      config.set('token', 'default-token');
      config.set('server', 'https://work.atlassian.net', 'work');
      config.set('token', 'work-token', 'work');

      const { activeProfile, profiles } = config.listProfiles();
      expect(activeProfile).toBe('default');
      expect(profiles).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'default', active: true, server: 'https://default.atlassian.net' }),
        expect.objectContaining({ name: 'work', active: false, server: 'https://work.atlassian.net' })
      ]));
    });

    it('should switch the active profile with setActiveProfile', () => {
      config.set('server', 'https://default.atlassian.net');
      config.set('token', 'default-token');
      config.set('server', 'https://work.atlassian.net', 'work');
      config.set('token', 'work-token', 'work');

      config.setActiveProfile('work');
      expect(config.listProfiles().activeProfile).toBe('work');
    });

    it('should throw a clear error when switching to a nonexistent profile', () => {
      config.set('server', 'https://default.atlassian.net');
      config.set('token', 'default-token');

      expect(() => config.setActiveProfile('doesnotexist')).toThrow(/not found/);
    });

    it('should delete a non-active profile', () => {
      config.set('server', 'https://default.atlassian.net');
      config.set('token', 'default-token');
      config.set('server', 'https://work.atlassian.net', 'work');
      config.set('token', 'work-token', 'work');

      config.deleteProfile('work');
      expect(config.listProfiles().profiles.map(p => p.name)).toEqual(['default']);
    });

    it('should reassign the active profile when the active one is deleted', () => {
      config.set('server', 'https://default.atlassian.net');
      config.set('token', 'default-token');
      config.set('server', 'https://work.atlassian.net', 'work');
      config.set('token', 'work-token', 'work');
      config.setActiveProfile('work');

      config.deleteProfile('work');
      expect(config.listProfiles().activeProfile).toBe('default');
    });

    it('should refuse to delete the only remaining profile', () => {
      config.set('server', 'https://default.atlassian.net');
      config.set('token', 'default-token');

      expect(() => config.deleteProfile('default')).toThrow('Cannot delete the only remaining profile.');
    });

    it('should throw when deleting a nonexistent profile', () => {
      config.set('server', 'https://default.atlassian.net');
      config.set('token', 'default-token');

      expect(() => config.deleteProfile('doesnotexist')).toThrow(/not found/);
    });

    it('should validate profile names', () => {
      expect(config.isValidProfileName('work')).toBe(true);
      expect(config.isValidProfileName('work-2')).toBe(true);
      expect(config.isValidProfileName('work_2')).toBe(true);
      expect(config.isValidProfileName('work 2')).toBe(false);
      expect(config.isValidProfileName('work/2')).toBe(false);
    });

    it('should throw a "not found" error with available profiles listed from getRequiredConfig', () => {
      config.set('server', 'https://default.atlassian.net');
      config.set('token', 'default-token');

      expect(() => config.getRequiredConfig('doesnotexist')).toThrow(/Profile "doesnotexist" not found/);
      expect(() => config.getRequiredConfig('doesnotexist')).toThrow(/default/);
    });
  });

  describe('JIRA_PROFILE env var resolution', () => {
    it('should resolve the profile named by JIRA_PROFILE when no explicit profileName is passed', () => {
      config.set('server', 'https://default.atlassian.net');
      config.set('token', 'default-token');
      config.set('server', 'https://work.atlassian.net', 'work');
      config.set('token', 'work-token', 'work');

      process.env.JIRA_PROFILE = 'work';

      expect(config.getRequiredConfig().server).toBe('https://work.atlassian.net');
    });

    it('should let an explicit profileName argument override JIRA_PROFILE', () => {
      config.set('server', 'https://default.atlassian.net');
      config.set('token', 'default-token');
      config.set('server', 'https://work.atlassian.net', 'work');
      config.set('token', 'work-token', 'work');

      process.env.JIRA_PROFILE = 'work';

      expect(config.getRequiredConfig('default').server).toBe('https://default.atlassian.net');
    });
  });

  describe('legacy conf-store migration', () => {
    function legacyDirFor(fakeHomeDir) {
      if (process.platform === 'darwin') {
        return path.join(fakeHomeDir, 'Library', 'Preferences', 'jira-cli-nodejs');
      }
      if (process.platform === 'win32') {
        return path.join(fakeHomeDir, 'AppData', 'Roaming', 'jira-cli-nodejs', 'Config');
      }
      return path.join(fakeHomeDir, '.config', 'jira-cli-nodejs');
    }

    it('migrates an existing conf-managed store into the "default" profile on first read', () => {
      const legacyDir = legacyDirFor(fakeHome);
      fs.mkdirSync(legacyDir, { recursive: true });
      fs.writeFileSync(
        path.join(legacyDir, 'config.json'),
        JSON.stringify({ server: 'https://legacy.atlassian.net', token: 'legacy-token', apiVersion: '2' })
      );

      const fresh = new Config();
      const required = fresh.getRequiredConfig();
      expect(required.server).toBe('https://legacy.atlassian.net');
      expect(required.token).toBe('legacy-token');
      expect(required.apiVersion).toBe('2');

      const { activeProfile, profiles } = fresh.listProfiles();
      expect(activeProfile).toBe('default');
      expect(profiles.map(p => p.name)).toEqual(['default']);

      // Migrated in place, and the legacy file is left untouched as a safety net.
      expect(fs.existsSync(path.join(fakeHome, '.jira-cli', 'config.json'))).toBe(true);
      expect(fs.existsSync(path.join(legacyDir, 'config.json'))).toBe(true);
    });

    it('does not migrate an empty legacy file', () => {
      const legacyDir = legacyDirFor(fakeHome);
      fs.mkdirSync(legacyDir, { recursive: true });
      fs.writeFileSync(path.join(legacyDir, 'config.json'), JSON.stringify({}));

      const fresh = new Config();
      expect(fresh.listProfiles()).toEqual({ activeProfile: null, profiles: [] });
    });
  });
});
