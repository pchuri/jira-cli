const Config = require('../lib/config');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Config', () => {
  let config;

  beforeEach(() => {
    config = new Config();
    // Clear any existing config and environment variables
    config.clear();
    delete process.env.JIRA_HOST;
    delete process.env.JIRA_DOMAIN;
    delete process.env.JIRA_USERNAME;
    delete process.env.JIRA_API_TOKEN;
    delete process.env.JIRA_AUTH_TYPE;
    delete process.env.JIRA_TLS_CLIENT_CERT;
    delete process.env.JIRA_TLS_CLIENT_KEY;
    delete process.env.JIRA_TLS_CA_CERT;
  });

  describe('constructor', () => {
    it('should create Config instance', () => {
      expect(config).toBeInstanceOf(Config);
      expect(config.config).toBeDefined();
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
});
