const fs = require('fs');
const os = require('os');
const path = require('path');
const chalk = require('chalk');
const JiraClient = require('./jira-client');
const { expandHomePath } = require('./utils');
const { VALID_AUTH_TYPES, VALID_API_VERSIONS } = require('./config-options');

const DEFAULT_PROFILE = 'default';

// The config directory can be overridden (tests, or a future --config-dir
// flag) - read at call time rather than memoized, so overrides set after
// module load still take effect.
function getConfigDir() {
  return process.env.JIRA_CLI_CONFIG_DIR || path.join(os.homedir(), '.jira-cli');
}

function getConfigFile() {
  return path.join(getConfigDir(), 'config.json');
}

// The pre-multi-profile store, written by the `conf` package (projectName
// 'jira-cli', suffixed with conf's default projectSuffix 'nodejs'). Read
// once for a transparent one-time migration into the new format.
function legacyConfigFile() {
  const name = 'jira-cli-nodejs';
  let dir;
  if (process.platform === 'darwin') {
    dir = path.join(os.homedir(), 'Library', 'Preferences', name);
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    dir = path.join(appData, name, 'Config');
  } else {
    dir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), name);
  }
  return path.join(dir, 'config.json');
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function saveStore(data) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  } else {
    fs.chmodSync(dir, 0o700);
  }
  const file = getConfigFile();
  // Write to a temp file in the same directory and rename into place.
  // fs.renameSync is atomic on POSIX and Windows (same volume), so a crash
  // or interruption mid-write can never leave config.json truncated/corrupt
  // - the previous version stays intact until the new one is fully written.
  const tmpFile = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.chmodSync(tmpFile, 0o600);
  fs.renameSync(tmpFile, file);
}

// Reads the profile store, transparently migrating a pre-multi-profile
// `conf`-managed single config into the new shape the first time it's
// encountered. Re-read from disk on every call (not cached on the instance)
// so a set() immediately followed by a get() in the same process always
// sees the just-written value.
function loadStore() {
  const current = readJsonFile(getConfigFile());
  if (current && current.profiles) {
    return current;
  }

  const legacy = readJsonFile(legacyConfigFile());
  if (legacy && Object.keys(legacy).length > 0) {
    const migrated = { activeProfile: DEFAULT_PROFILE, profiles: { [DEFAULT_PROFILE]: legacy } };
    saveStore(migrated);
    console.error(chalk.yellow(
      `Migrated your existing configuration into profile "${DEFAULT_PROFILE}" at ${getConfigFile()}.`
    ));
    return migrated;
  }

  return null;
}

// Resolution order: an explicit profileName argument > JIRA_PROFILE env var
// > the store's activeProfile > the default profile.
function resolveProfileName(explicitProfileName, store) {
  return explicitProfileName ||
    process.env.JIRA_PROFILE ||
    (store && store.activeProfile) ||
    DEFAULT_PROFILE;
}

function getProfileObject(profileName) {
  const store = loadStore();
  const resolved = resolveProfileName(profileName, store);
  return (store && store.profiles && store.profiles[resolved]) || {};
}

class Config {
  get(key, profileName) {
    const profile = getProfileObject(profileName);
    if (key) {
      return profile[key];
    }
    return profile;
  }

  // Previously enforced by the `conf` package's ajv schema (enum validation
  // on every .set() call) before the switch to a hand-rolled JSON store -
  // re-checked here so the raw `jira config set authType|apiVersion <value>`
  // subcommand (which bypasses the CLI-level validation in
  // lib/config-options.js) can't silently write a value that later causes
  // confusing failures (e.g. an unrecognized authType silently falling back
  // to Bearer auth inside JiraClient).
  set(key, value, profileName) {
    if (key === 'authType' && !VALID_AUTH_TYPES.includes(value)) {
      throw new Error(`Invalid authType "${value}". Must be one of: ${VALID_AUTH_TYPES.join(', ')}`);
    }
    if (key === 'apiVersion' && !VALID_API_VERSIONS.includes(value)) {
      throw new Error(`Invalid apiVersion "${value}". Must be one of: ${VALID_API_VERSIONS.join(', ')}`);
    }
    const store = loadStore() || { activeProfile: null, profiles: {} };
    const resolved = resolveProfileName(profileName, store);
    if (!store.profiles[resolved]) {
      store.profiles[resolved] = {};
    }
    store.profiles[resolved][key] = value;
    // Only auto-activate when there is currently no valid active profile -
    // writing to a second, non-active profile must never silently switch
    // the active one out from under the user.
    if (!store.activeProfile || !store.profiles[store.activeProfile]) {
      store.activeProfile = resolved;
    }
    saveStore(store);
  }

  delete(key, profileName) {
    const store = loadStore();
    if (!store) return;
    const resolved = resolveProfileName(profileName, store);
    if (store.profiles[resolved]) {
      delete store.profiles[resolved][key];
      saveStore(store);
    }
  }

  clear(profileName) {
    const store = loadStore();
    if (!store) return;
    const resolved = resolveProfileName(profileName, store);
    store.profiles[resolved] = {};
    saveStore(store);
  }

  has(key, profileName) {
    return Object.prototype.hasOwnProperty.call(getProfileObject(profileName), key);
  }

  // Like has(), but also requires the stored value to be a non-empty string.
  // Prevents configurations where a key exists but was set to '' from passing
  // validation checks (e.g. `jira config --username ''`).
  hasNonEmpty(key, profileName) {
    const v = this.get(key, profileName);
    return typeof v === 'string' && v.trim().length > 0;
  }

  // Check if all required config is present
  isConfigured(profileName) {
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
    if (!this.has('server', profileName)) return false;

    const authType = this.get('authType', profileName);

    if (authType === 'mtls') {
      return this.hasNonEmpty('tlsClientCert', profileName) && this.hasNonEmpty('tlsClientKey', profileName);
    }
    if (authType === 'basic') {
      return this.hasNonEmpty('username', profileName) && this.hasNonEmpty('token', profileName);
    }
    if (authType === 'bearer') {
      return this.hasNonEmpty('token', profileName);
    }
    if (authType === 'cookie') {
      return this.hasNonEmpty('cookie', profileName);
    }

    // Legacy config (no authType): token is sufficient; username is optional
    return this.hasNonEmpty('token', profileName);
  }

  // Validate mTLS configuration
  validateMtlsConfig(mtls) {
    const errors = [];
    if (!mtls.clientCert) {
      errors.push('mTLS requires a client certificate (--tls-client-cert or JIRA_TLS_CLIENT_CERT)');
    } else if (!fs.existsSync(expandHomePath(mtls.clientCert))) {
      errors.push(`Client certificate file not found: ${mtls.clientCert}`);
    }
    if (!mtls.clientKey) {
      errors.push('mTLS requires a client key (--tls-client-key or JIRA_TLS_CLIENT_KEY)');
    } else if (!fs.existsSync(expandHomePath(mtls.clientKey))) {
      errors.push(`Client key file not found: ${mtls.clientKey}`);
    }
    if (mtls.caCert && !fs.existsSync(expandHomePath(mtls.caCert))) {
      errors.push(`CA certificate file not found: ${mtls.caCert}`);
    }
    return errors;
  }

  // Get required configuration or throw error
  getRequiredConfig(profileName) {
    const cloudId = process.env.JIRA_CLOUD_ID || this.get('cloudId', profileName) || '';
    // A raw session cookie, sent alongside the normal auth header on every
    // request regardless of authType. Needed for on-prem instances behind
    // an SSO gateway (e.g. F5 BIG-IP APM) that gates on a live gateway
    // session cookie before the request ever reaches Jira - the PAT/Basic
    // header alone never gets through such a gateway.
    const cookie = process.env.JIRA_COOKIE || this.get('cookie', profileName) || '';

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
        cookie,
        apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion', profileName) || 'auto'
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
        cookie,
        authType: process.env.JIRA_USERNAME ? 'basic' : 'bearer',
        apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion', profileName) || 'auto'
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
        cookie,
        authType: 'basic',
        apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion', profileName) || 'auto'
      };
    }

    // A profile explicitly named (via --profile, JIRA_PROFILE, or a stored
    // activeProfile) that simply doesn't exist is a different problem than
    // "nothing configured at all" - disambiguate before falling through to
    // the generic not-configured error below.
    const store = loadStore();
    const resolved = resolveProfileName(profileName, store);
    if (store && store.profiles && !store.profiles[resolved]) {
      const available = Object.keys(store.profiles);
      throw new Error(
        `Profile "${resolved}" not found.` +
        (available.length > 0 ? ` Available profiles: ${available.join(', ')}.` : '') +
        '\nCreate it with:\n  ' + chalk.yellow(`jira profile add ${resolved} --server <url> --token <token>`) +
        '\nOr list existing profiles with:\n  ' + chalk.yellow('jira profile list')
      );
    }

    // Fall back to stored config - check for mTLS first
    if (this.has('server', profileName) && this.get('authType', profileName) === 'mtls') {
      const mtls = {
        clientCert: this.get('tlsClientCert', profileName),
        clientKey: this.get('tlsClientKey', profileName),
        caCert: this.get('tlsCaCert', profileName)
      };
      const errors = this.validateMtlsConfig(mtls);
      if (errors.length > 0) {
        throw new Error('mTLS configuration error:\n  ' + errors.join('\n  '));
      }
      return {
        server: this.get('server', profileName),
        authType: 'mtls',
        mtls,
        cookie,
        apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion', profileName) || 'auto'
      };
    }

    // Cookie-only auth: no Authorization header at all, relying entirely on
    // an already-authenticated session cookie (e.g. supplied by a local
    // reverse proxy that terminates SSO on the client's behalf). Some
    // instances accept this at the application layer; others (observed for
    // at least one on-prem Jira Data Center instance) still require a PAT
    // even with a valid session cookie - that isn't something this CLI can
    // detect in advance, so the failure (if any) surfaces as a normal 401
    // from testConfig()/API calls rather than being blocked here.
    if (this.has('server', profileName) && this.get('authType', profileName) === 'cookie') {
      if (!this.hasNonEmpty('cookie', profileName)) {
        throw new Error(
          'Cookie auth configuration is incomplete. Missing: cookie (--cookie <value>).\n' +
          'Set with:\n' +
          '  ' + chalk.yellow('jira config --auth-type cookie --cookie <value>')
        );
      }
      return {
        server: this.get('server', profileName),
        authType: 'cookie',
        cookie,
        apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion', profileName) || 'auto'
      };
    }

    // Explicit basic auth requires both username and token - fail fast rather
    // than silently falling back to bearer.
    if (this.has('server', profileName) && this.get('authType', profileName) === 'basic') {
      const missing = [];
      if (!this.hasNonEmpty('username', profileName)) missing.push('username (--username <email>)');
      if (!this.hasNonEmpty('token', profileName)) missing.push('token (--token <token>)');
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
        server: this.get('server', profileName),
        username: this.get('username', profileName),
        token: this.get('token', profileName),
        cloudId,
        cookie,
        authType: 'basic',
        apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion', profileName) || 'auto'
      };
    }

    // Standard token-based config (explicit bearer or legacy inference)
    if (!this.has('server', profileName) || !this.hasNonEmpty('token', profileName)) {
      throw new Error(
        'JIRA CLI is not configured. Set configuration using:\n' +
        '  ' + chalk.yellow('jira config --server <url> --token <token>') + '\n' +
        'For Basic auth, also provide:\n' +
        '  ' + chalk.yellow('jira config --username <email>') + '\n' +
        'For scoped API tokens (Atlassian Cloud), also provide:\n' +
        '  ' + chalk.yellow('jira config --cloud-id <cloudId>') + '\n' +
        'For mTLS auth:\n' +
        '  ' + chalk.yellow('jira config --server <url> --auth-type mtls --tls-client-cert <path> --tls-client-key <path>') + '\n' +
        'For cookie-only auth (e.g. via a local SSO-terminating proxy):\n' +
        '  ' + chalk.yellow('jira config --server <url> --auth-type cookie --cookie <value>') + '\n' +
        'Or use environment variables:\n' +
        '  Bearer auth: JIRA_HOST, JIRA_API_TOKEN\n' +
        '  Basic auth: JIRA_HOST, JIRA_API_TOKEN, JIRA_USERNAME\n' +
        '  Scoped token: add JIRA_CLOUD_ID\n' +
        '  mTLS auth: JIRA_HOST, JIRA_AUTH_TYPE=mtls, JIRA_TLS_CLIENT_CERT, JIRA_TLS_CLIENT_KEY\n' +
        'For multiple profiles:\n' +
        '  ' + chalk.yellow('jira profile add <name> --server <url> --token <token>')
      );
    }

    const authType = this.get('authType', profileName) || (this.get('username', profileName) ? 'basic' : 'bearer');
    return {
      server: this.get('server', profileName),
      username: this.get('username', profileName) || '',
      token: this.get('token', profileName),
      cloudId,
      cookie,
      authType,
      apiVersion: process.env.JIRA_API_VERSION || this.get('apiVersion', profileName) || 'auto'
    };
  }

  // Create JIRA client with current config
  createClient(profileName) {
    const config = this.getRequiredConfig(profileName);
    return new JiraClient(config);
  }

  // Test current configuration
  async testConfig(profileName) {
    try {
      const client = this.createClient(profileName);
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
  displayConfig(profileName) {
    const store = loadStore();
    const resolved = resolveProfileName(profileName, store);
    const config = this.get(undefined, profileName);
    const hasEnvConfig = (process.env.JIRA_HOST && process.env.JIRA_API_TOKEN) ||
                        (process.env.JIRA_DOMAIN && process.env.JIRA_USERNAME && process.env.JIRA_API_TOKEN) ||
                        (process.env.JIRA_HOST && process.env.JIRA_AUTH_TYPE === 'mtls');

    if (Object.keys(config).length === 0 && !hasEnvConfig) {
      console.log(chalk.yellow('No configuration found.'));
      console.log('Run ' + chalk.cyan('jira config --server <url> --username <email> --token <token>') + ' to set up your JIRA connection.');
      return;
    }

    console.log(chalk.bold(`\nCurrent JIRA Configuration (profile: ${resolved}):`));

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
      } else if (authType === 'cookie') {
        console.log('Cookie:', config.cookie ? chalk.green('***configured***') : chalk.red('Not set'));
      } else {
        console.log('Username:', chalk.green(config.username || '(Bearer auth)'));
        console.log('Token:', config.token ? chalk.green('Set (hidden)') : chalk.red('Not set'));
        if (config.cloudId) {
          console.log('Cloud ID:', chalk.green(config.cloudId));
          console.log('Routing:', chalk.green('Atlassian Platform API Gateway (scoped token)'));
        }
      }
      console.log('API Version:', chalk.green(config.apiVersion || 'auto'));
      if (authType !== 'cookie') {
        console.log('Session Cookie:', config.cookie ? chalk.green('***configured***') : chalk.gray('Not set'));
      }
    }

    if (this.isConfigured(profileName)) {
      console.log('\n' + chalk.green('✓ Configuration is complete'));
    } else {
      console.log('\n' + chalk.red('✗ Configuration is incomplete'));
    }
  }

  // List all configured profiles
  listProfiles() {
    const store = loadStore();
    if (!store || !store.profiles || Object.keys(store.profiles).length === 0) {
      return { activeProfile: null, profiles: [] };
    }
    return {
      activeProfile: store.activeProfile,
      profiles: Object.keys(store.profiles).map(name => ({
        name,
        active: name === store.activeProfile,
        server: store.profiles[name].server,
        authType: store.profiles[name].authType || (store.profiles[name].username ? 'basic' : 'bearer')
      }))
    };
  }

  // Switch the active profile
  setActiveProfile(name) {
    const store = loadStore();
    if (!store || !store.profiles || !store.profiles[name]) {
      const available = store && store.profiles ? Object.keys(store.profiles) : [];
      throw new Error(
        `Profile "${name}" not found.` +
        (available.length > 0 ? ` Available profiles: ${available.join(', ')}` : ' No profiles configured yet.')
      );
    }
    store.activeProfile = name;
    saveStore(store);
  }

  // Permanently remove a profile
  deleteProfile(name) {
    const store = loadStore();
    if (!store || !store.profiles || !store.profiles[name]) {
      throw new Error(`Profile "${name}" not found.`);
    }
    if (Object.keys(store.profiles).length === 1) {
      throw new Error('Cannot delete the only remaining profile.');
    }
    delete store.profiles[name];
    if (store.activeProfile === name) {
      store.activeProfile = Object.keys(store.profiles)[0];
    }
    saveStore(store);
  }

  isValidProfileName(name) {
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }
}

module.exports = Config;
