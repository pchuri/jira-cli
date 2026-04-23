const Conf = require('conf');
const chalk = require('chalk');
const fs = require('fs');
const JiraClient = require('./jira-client');

class Config {
  constructor() {
    this.config = new Conf({
      projectName: 'jira-cli',
      schema: {
        server: {
          type: 'string',
          format: 'url'
        },
        username: {
          type: 'string'
        },
        token: {
          type: 'string'
        },
        cloudId: {
          type: 'string'
        },
        authType: {
          type: 'string',
          enum: ['basic', 'bearer', 'mtls']
        },
        tlsClientCert: {
          type: 'string'
        },
        tlsClientKey: {
          type: 'string'
        },
        tlsCaCert: {
          type: 'string'
        },
        apiVersion: {
          type: 'string',
          enum: ['auto', '2', '3'],
          default: 'auto'
        }
      }
    });
  }

  get(key) {
    if (key) {
      return this.config.get(key);
    }
    return this.config.store;
  }

  set(key, value) {
    this.config.set(key, value);
  }

  delete(key) {
    this.config.delete(key);
  }

  clear() {
    this.config.clear();
  }

  has(key) {
    return this.config.has(key);
  }

  // Like has(), but also requires the stored value to be a non-empty string.
  // Prevents configurations where a key exists but was set to '' from passing
  // validation checks (e.g. `jira config --username ''`).
  hasNonEmpty(key) {
    const v = this.get(key);
    return typeof v === 'string' && v.trim().length > 0;
  }

  // Check if all required config is present
  isConfigured() {
    // Environment variables take precedence, in priority order.
    //
    // When env explicitly selects mTLS, that choice is authoritative - don't
    // fall through to the JIRA_API_TOKEN path just because a stale token is
    // still in the environment.
    if (process.env.JIRA_HOST && process.env.JIRA_AUTH_TYPE === 'mtls') {
      return Boolean(process.env.JIRA_TLS_CLIENT_CERT && process.env.JIRA_TLS_CLIENT_KEY);
    }

    if (process.env.JIRA_HOST && process.env.JIRA_API_TOKEN) return true;
    if (process.env.JIRA_DOMAIN && process.env.JIRA_USERNAME && process.env.JIRA_API_TOKEN) return true;

    // Stored config must match the selected auth mode
    if (!this.has('server')) return false;

    const authType = this.get('authType');

    if (authType === 'mtls') {
      return this.hasNonEmpty('tlsClientCert') && this.hasNonEmpty('tlsClientKey');
    }
    if (authType === 'basic') {
      return this.hasNonEmpty('username') && this.hasNonEmpty('token');
    }
    if (authType === 'bearer') {
      return this.hasNonEmpty('token');
    }

    // Legacy config (no authType): token is sufficient; username is optional
    return this.hasNonEmpty('token');
  }

  // Validate mTLS configuration
  validateMtlsConfig(mtls) {
    const errors = [];
    if (!mtls.clientCert) {
      errors.push('mTLS requires a client certificate (--tls-client-cert or JIRA_TLS_CLIENT_CERT)');
    } else if (!fs.existsSync(mtls.clientCert)) {
      errors.push(`Client certificate file not found: ${mtls.clientCert}`);
    }
    if (!mtls.clientKey) {
      errors.push('mTLS requires a client key (--tls-client-key or JIRA_TLS_CLIENT_KEY)');
    } else if (!fs.existsSync(mtls.clientKey)) {
      errors.push(`Client key file not found: ${mtls.clientKey}`);
    }
    if (mtls.caCert && !fs.existsSync(mtls.caCert)) {
      errors.push(`CA certificate file not found: ${mtls.caCert}`);
    }
    return errors;
  }

  // Get required configuration or throw error
  getRequiredConfig() {
    const cloudId = process.env.JIRA_CLOUD_ID || this.get('cloudId') || '';

    // First check for mTLS environment variables
    if (process.env.JIRA_HOST && process.env.JIRA_AUTH_TYPE === 'mtls') {
      const mtls = {
        clientCert: process.env.JIRA_TLS_CLIENT_CERT,
        clientKey: process.env.JIRA_TLS_CLIENT_KEY,
        caCert: process.env.JIRA_TLS_CA_CERT
      };
      const errors = this.validateMtlsConfig(mtls);
      if (errors.length > 0) {
        throw new Error('mTLS configuration error:\n  ' + errors.join('\n  '));
      }
      return {
        server: process.env.JIRA_HOST.startsWith('http') ?
          process.env.JIRA_HOST :
          `https://${process.env.JIRA_HOST}`,
        authType: 'mtls',
        mtls,
        apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion') || 'auto'
      };
    }

    // Try JIRA_HOST environment variables (new format)
    if (process.env.JIRA_HOST && process.env.JIRA_API_TOKEN) {
      return {
        server: process.env.JIRA_HOST.startsWith('http') ?
          process.env.JIRA_HOST :
          `https://${process.env.JIRA_HOST}`,
        username: process.env.JIRA_USERNAME || '', // Empty username for token-only auth
        token: process.env.JIRA_API_TOKEN,
        cloudId,
        authType: process.env.JIRA_USERNAME ? 'basic' : 'bearer',
        apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion') || 'auto'
      };
    }

    // Try legacy JIRA_DOMAIN environment variables
    if (process.env.JIRA_DOMAIN && process.env.JIRA_USERNAME && process.env.JIRA_API_TOKEN) {
      return {
        server: process.env.JIRA_DOMAIN.startsWith('http') ?
          process.env.JIRA_DOMAIN :
          `https://${process.env.JIRA_DOMAIN}`,
        username: process.env.JIRA_USERNAME,
        token: process.env.JIRA_API_TOKEN,
        cloudId,
        authType: 'basic',
        apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion') || 'auto'
      };
    }

    // Fall back to stored config - check for mTLS first
    if (this.has('server') && this.get('authType') === 'mtls') {
      const mtls = {
        clientCert: this.get('tlsClientCert'),
        clientKey: this.get('tlsClientKey'),
        caCert: this.get('tlsCaCert')
      };
      const errors = this.validateMtlsConfig(mtls);
      if (errors.length > 0) {
        throw new Error('mTLS configuration error:\n  ' + errors.join('\n  '));
      }
      return {
        server: this.get('server'),
        authType: 'mtls',
        mtls,
        apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion') || 'auto'
      };
    }

    // Explicit basic auth requires both username and token - fail fast rather
    // than silently falling back to bearer.
    if (this.has('server') && this.get('authType') === 'basic') {
      const missing = [];
      if (!this.hasNonEmpty('username')) missing.push('username (--username <email>)');
      if (!this.hasNonEmpty('token')) missing.push('token (--token <token>)');
      if (missing.length > 0) {
        throw new Error(
          'Basic auth configuration is incomplete. Missing: ' + missing.join(', ') + '.\n' +
          'Set with:\n' +
          '  ' + chalk.yellow('jira config --username <email> --token <token>') + '\n' +
          'Or switch auth types with:\n' +
          '  ' + chalk.yellow('jira config --auth-type bearer')
        );
      }
      return {
        server: this.get('server'),
        username: this.get('username'),
        token: this.get('token'),
        authType: 'basic',
        apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion') || 'auto'
      };
    }

    // Standard token-based config (explicit bearer or legacy inference)
    if (!this.has('server') || !this.hasNonEmpty('token')) {
      throw new Error(
        'JIRA CLI is not configured. Set configuration using:\n' +
        '  ' + chalk.yellow('jira config --server <url> --token <token>') + '\n' +
        'For Basic auth, also provide:\n' +
        '  ' + chalk.yellow('jira config --username <email>') + '\n' +
        'For scoped API tokens (Atlassian Cloud), also provide:\n' +
        '  ' + chalk.yellow('jira config --cloud-id <cloudId>') + '\n' +
        'For mTLS auth:\n' +
        '  ' + chalk.yellow('jira config --server <url> --auth-type mtls --tls-client-cert <path> --tls-client-key <path>') + '\n' +
        'Or use environment variables:\n' +
        '  Bearer auth: JIRA_HOST, JIRA_API_TOKEN\n' +
        '  Basic auth: JIRA_HOST, JIRA_API_TOKEN, JIRA_USERNAME\n' +
        '  Scoped token: add JIRA_CLOUD_ID\n' +
        '  mTLS auth: JIRA_HOST, JIRA_AUTH_TYPE=mtls, JIRA_TLS_CLIENT_CERT, JIRA_TLS_CLIENT_KEY'
      );
    }

    const authType = this.get('authType') || (this.get('username') ? 'basic' : 'bearer');
    return {
      server: this.get('server'),
      username: this.get('username') || '',
      token: this.get('token'),
      cloudId,
      authType,
      apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion') || 'auto'
    };
  }

  // Create JIRA client with current config
  createClient() {
    const config = this.getRequiredConfig();
    return new JiraClient(config);
  }

  // Test current configuration
  async testConfig() {
    try {
      const client = this.createClient();
      const result = await client.testConnection();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Display current configuration (without sensitive data)
  displayConfig() {
    const config = this.get();
    const hasEnvConfig = (process.env.JIRA_HOST && process.env.JIRA_API_TOKEN) ||
                        (process.env.JIRA_DOMAIN && process.env.JIRA_USERNAME && process.env.JIRA_API_TOKEN) ||
                        (process.env.JIRA_HOST && process.env.JIRA_AUTH_TYPE === 'mtls');

    if (Object.keys(config).length === 0 && !hasEnvConfig) {
      console.log(chalk.yellow('No configuration found.'));
      console.log('Run ' + chalk.cyan('jira config --server <url> --username <email> --token <token>') + ' to set up your JIRA connection.');
      return;
    }

    console.log(chalk.bold('\nCurrent JIRA Configuration:'));

    if (hasEnvConfig) {
      console.log(chalk.blue('\nFrom Environment Variables:'));
      if (process.env.JIRA_HOST) {
        console.log('Server:', chalk.green(process.env.JIRA_HOST));
        if (process.env.JIRA_AUTH_TYPE === 'mtls') {
          console.log('Auth Type:', chalk.green('mTLS (client certificate)'));
          console.log('Client Cert:', chalk.green(process.env.JIRA_TLS_CLIENT_CERT || 'Not set'));
          console.log('Client Key:', chalk.green(process.env.JIRA_TLS_CLIENT_KEY ? '***configured***' : 'Not set'));
          if (process.env.JIRA_TLS_CA_CERT) {
            console.log('CA Cert:', chalk.green(process.env.JIRA_TLS_CA_CERT));
          }
        } else {
          console.log('Username:', chalk.green(process.env.JIRA_USERNAME || '(token auth)'));
          console.log('Token:', chalk.green('***configured***'));
          if (process.env.JIRA_CLOUD_ID) {
            console.log('Cloud ID:', chalk.green(process.env.JIRA_CLOUD_ID));
            console.log('Routing:', chalk.green('Atlassian Platform API Gateway (scoped token)'));
          }
        }
        console.log('API Version:', chalk.green(process.env.JIRA_API_VERSION || 'auto'));
      } else if (process.env.JIRA_DOMAIN) {
        console.log('Server:', chalk.green(process.env.JIRA_DOMAIN));
        console.log('Username:', chalk.green(process.env.JIRA_USERNAME));
        console.log('Token:', chalk.green('***configured***'));
        if (process.env.JIRA_CLOUD_ID) {
          console.log('Cloud ID:', chalk.green(process.env.JIRA_CLOUD_ID));
          console.log('Routing:', chalk.green('Atlassian Platform API Gateway (scoped token)'));
        }
        console.log('API Version:', chalk.green(process.env.JIRA_API_VERSION || 'auto'));
      }
    }

    if (Object.keys(config).length > 0) {
      console.log(chalk.blue('\nFrom Config File:'));
      console.log('Server:', chalk.green(config.server || 'Not set'));
      const authType = config.authType || (config.username ? 'basic' : 'bearer');
      console.log('Auth Type:', chalk.green(authType));
      if (authType === 'mtls') {
        console.log('Client Cert:', chalk.green(config.tlsClientCert || 'Not set'));
        console.log('Client Key:', config.tlsClientKey ? chalk.green('***configured***') : chalk.red('Not set'));
        if (config.tlsCaCert) {
          console.log('CA Cert:', chalk.green(config.tlsCaCert));
        }
      } else {
        console.log('Username:', chalk.green(config.username || '(Bearer auth)'));
        console.log('Token:', config.token ? chalk.green('Set (hidden)') : chalk.red('Not set'));
        if (config.cloudId) {
          console.log('Cloud ID:', chalk.green(config.cloudId));
          console.log('Routing:', chalk.green('Atlassian Platform API Gateway (scoped token)'));
        }
      }
      console.log('API Version:', chalk.green(config.apiVersion || 'auto'));
    }

    if (this.isConfigured()) {
      console.log('\n' + chalk.green('✓ Configuration is complete'));
    } else {
      console.log('\n' + chalk.red('✗ Configuration is incomplete'));
    }
  }

}

module.exports = Config;
