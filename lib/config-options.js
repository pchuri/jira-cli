const fs = require('fs');
const { expandHomePath } = require('./utils');

const VALID_AUTH_TYPES = ['basic', 'bearer', 'mtls'];
const VALID_API_VERSIONS = ['auto', '2', '3'];

// Shared by `jira config [--profile <name>] --server ...` and
// `jira profile add <name> --server ...` - both are entry points into the
// same non-interactive flag-application logic, applied to whichever profile
// name is passed in (undefined means "the active profile").
function hasAnyConfigOption(options) {
  return Boolean(
    options.server || options.username || options.token || options.cloudId ||
    options.authType || options.tlsClientCert || options.tlsClientKey || options.tlsCaCert ||
    options.apiVersion || options.cookie
  );
}

async function applyConfigOptions(config, io, options, profileName) {
  if (options.server) {
    config.set('server', options.server.replace(/\/$/, ''), profileName);
    io.success(`Server set to: ${options.server}`);
  }

  if (options.username) {
    config.set('username', options.username, profileName);
    io.success(`Username set to: ${options.username}`);
  }

  if (options.token) {
    config.set('token', options.token, profileName);
    io.success('API token updated');
  }

  if (options.cloudId) {
    config.set('cloudId', options.cloudId, profileName);
    io.success(`Cloud ID set to: ${options.cloudId} (requests will route via Atlassian Platform API Gateway)`);
  }

  if (options.authType) {
    const authType = options.authType.toLowerCase();
    if (!VALID_AUTH_TYPES.includes(authType)) {
      throw new Error('--auth-type must be "basic", "bearer", or "mtls"');
    }
    config.set('authType', authType, profileName);
    io.success(`Auth type set to: ${authType}`);
  }

  // mTLS certificate configuration
  if (options.tlsClientCert) {
    if (!fs.existsSync(expandHomePath(options.tlsClientCert))) {
      throw new Error(`Client certificate file not found: ${options.tlsClientCert}`);
    }
    config.set('tlsClientCert', options.tlsClientCert, profileName);
    io.success('TLS client certificate configured');
  }

  if (options.tlsClientKey) {
    if (!fs.existsSync(expandHomePath(options.tlsClientKey))) {
      throw new Error(`Client key file not found: ${options.tlsClientKey}`);
    }
    config.set('tlsClientKey', options.tlsClientKey, profileName);
    io.success('TLS client key configured');
  }

  if (options.tlsCaCert) {
    if (!fs.existsSync(expandHomePath(options.tlsCaCert))) {
      throw new Error(`CA certificate file not found: ${options.tlsCaCert}`);
    }
    config.set('tlsCaCert', options.tlsCaCert, profileName);
    io.success('TLS CA certificate configured');
  }

  if (options.apiVersion) {
    const apiVersion = options.apiVersion.toLowerCase();
    if (!VALID_API_VERSIONS.includes(apiVersion)) {
      throw new Error('--api-version must be "auto", "2", or "3"');
    }
    config.set('apiVersion', apiVersion, profileName);
    io.success(`API version set to: ${apiVersion}`);
  }

  if (options.cookie) {
    config.set('cookie', options.cookie, profileName);
    io.success('Session cookie configured');
  }

  // Test connection if all required fields are present
  if (config.isConfigured(profileName)) {
    io.info('Testing connection...');
    const testResult = await config.testConfig(profileName);

    if (testResult.success) {
      io.success('Connection successful!');
      io.out(`Welcome, ${testResult.user.displayName}!`);
    } else {
      io.error(`Connection failed: ${testResult.error}`);
    }
  }
}

module.exports = { applyConfigOptions, hasAnyConfigOption, VALID_AUTH_TYPES, VALID_API_VERSIONS };
