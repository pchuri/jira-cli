const { Command } = require('commander');

function createConfigCommand(factory) {
  const command = new Command('config')
    .description('Manage JIRA CLI configuration')
    .alias('c')
    .option('-s, --show', 'show current configuration')
    .option('--server <url>', 'set JIRA server URL')
    .option('--username <username>', 'set username')
    .option('--token <token>', 'set API token')
    .option('--cloud-id <cloudId>', 'set Atlassian Cloud ID for scoped API tokens')
    .option('--auth-type <type>', 'authentication type (basic, bearer, or mtls)')
    .option('--tls-client-cert <path>', 'client certificate for mTLS authentication')
    .option('--tls-client-key <path>', 'client private key for mTLS authentication')
    .option('--tls-ca-cert <path>', 'CA certificate for mTLS authentication (optional)')
    .action(async (options) => {
      const io = factory.getIOStreams();
      const config = factory.getConfig();
      const analytics = factory.getAnalytics();

      try {
        await analytics.track('config', { action: getConfigAction(options) });

        if (options.show) {
          // Show current configuration
          config.displayConfig();
          return;
        }

        if (
          options.server ||
          options.username ||
          options.token ||
          options.cloudId ||
          options.authType ||
          options.tlsClientCert ||
          options.tlsClientKey ||
          options.tlsCaCert
        ) {
          // Set individual configuration values
          if (options.server) {
            config.set('server', options.server.replace(/\/$/, ''));
            io.success(`Server set to: ${options.server}`);
          }

          if (options.username) {
            config.set('username', options.username);
            io.success(`Username set to: ${options.username}`);
          }

          if (options.token) {
            config.set('token', options.token);
            io.success('API token updated');
          }

          if (options.cloudId) {
            config.set('cloudId', options.cloudId);
            io.success(`Cloud ID set to: ${options.cloudId} (requests will route via Atlassian Platform API Gateway)`);
          }

          if (options.authType) {
            const authType = options.authType.toLowerCase();
            if (!['basic', 'bearer', 'mtls'].includes(authType)) {
              throw new Error('--auth-type must be "basic", "bearer", or "mtls"');
            }
            config.set('authType', authType);
            io.success(`Auth type set to: ${authType}`);
          }

          // mTLS certificate configuration
          if (options.tlsClientCert) {
            const fs = require('fs');
            if (!fs.existsSync(options.tlsClientCert)) {
              throw new Error(`Client certificate file not found: ${options.tlsClientCert}`);
            }
            config.set('tlsClientCert', options.tlsClientCert);
            io.success('TLS client certificate configured');
          }

          if (options.tlsClientKey) {
            const fs = require('fs');
            if (!fs.existsSync(options.tlsClientKey)) {
              throw new Error(`Client key file not found: ${options.tlsClientKey}`);
            }
            config.set('tlsClientKey', options.tlsClientKey);
            io.success('TLS client key configured');
          }

          if (options.tlsCaCert) {
            const fs = require('fs');
            if (!fs.existsSync(options.tlsCaCert)) {
              throw new Error(`CA certificate file not found: ${options.tlsCaCert}`);
            }
            config.set('tlsCaCert', options.tlsCaCert);
            io.success('TLS CA certificate configured');
          }

          // Test connection if all required fields are present
          if (config.isConfigured()) {
            io.info('Testing connection...');
            const testResult = await config.testConfig();

            if (testResult.success) {
              io.success('Connection successful!');
              io.out(`Welcome, ${testResult.user.displayName}!`);
            } else {
              io.error(`Connection failed: ${testResult.error}`);
            }
          }
        } else {
          // No options provided - show usage
          throw new Error(
            'Configuration requires explicit options.\n\n' +
            'Bearer authentication (recommended):\n' +
            '  jira config --server <url> --token <token>\n\n' +
            'Basic authentication (optional):\n' +
            '  jira config --server <url> --username <email> --token <token>\n\n' +
            'Scoped API token (Atlassian Cloud, recommended for new tokens):\n' +
            '  jira config --server <url> --username <email> --token <scoped-token> --cloud-id <cloudId>\n\n' +
            'mTLS authentication (for self-hosted/reverse-proxied Jira):\n' +
            '  jira config --server <url> --auth-type mtls \\\n' +
            '    --tls-client-cert /path/to/client.pem \\\n' +
            '    --tls-client-key /path/to/client.key \\\n' +
            '    --tls-ca-cert /path/to/ca.pem\n\n' +
            'Or set using individual commands:\n' +
            '  jira config set server <url>\n' +
            '  jira config set token <token>\n' +
            '  jira config set username <email>  # optional for Basic auth\n' +
            '  jira config set cloudId <cloudId> # optional, enables scoped tokens\n\n' +
            'Or use environment variables:\n' +
            '  Bearer auth: export JIRA_HOST=<url> JIRA_API_TOKEN=<token>\n' +
            '  Basic auth: export JIRA_HOST=<url> JIRA_API_TOKEN=<token> JIRA_USERNAME=<email>\n' +
            '  Scoped token: also export JIRA_CLOUD_ID=<cloudId>\n' +
            '  mTLS auth: export JIRA_HOST=<url> JIRA_AUTH_TYPE=mtls \\\n' +
            '             JIRA_TLS_CLIENT_CERT=<path> JIRA_TLS_CLIENT_KEY=<path>'
          );
        }

      } catch (err) {
        io.error(`Configuration failed: ${err.message}`);
        process.exit(1);
      }
    });

  // Add subcommands
  command
    .command('get [key]')
    .description('get configuration value')
    .action(async (key) => {
      const io = factory.getIOStreams();
      const config = factory.getConfig();

      try {
        if (key) {
          const value = config.get(key);
          if (value !== undefined) {
            io.out(`${key}: ${key === 'token' ? '***' : value}`);
          } else {
            io.warn(`Configuration key '${key}' not found`);
          }
        } else {
          config.displayConfig();
        }
      } catch (err) {
        io.error(`Failed to get configuration: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('set <key> <value>')
    .description('set configuration value')
    .action(async (key, value) => {
      const io = factory.getIOStreams();
      const config = factory.getConfig();

      try {
        config.set(key, value);
        io.success(`${key} set successfully`);

        // Test connection if setting critical values
        if (['server', 'username', 'token', 'cloudId'].includes(key) && config.isConfigured()) {
          io.info('Testing connection...');
          const testResult = await config.testConfig();

          if (testResult.success) {
            io.success('Connection verified');
          } else {
            io.warn(`Configuration saved but connection test failed: ${testResult.error}`);
          }
        }
      } catch (err) {
        io.error(`Failed to set configuration: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('unset <key>')
    .description('unset configuration value')
    .action(async (key) => {
      const io = factory.getIOStreams();
      const config = factory.getConfig();

      try {
        config.delete(key);
        io.success(`${key} unset successfully`);
      } catch (err) {
        io.error(`Failed to unset configuration: ${err.message}`);
        process.exit(1);
      }
    });

  return command;
}

function getConfigAction(options) {
  if (options.show) return 'show';
  if (
    options.server ||
    options.username ||
    options.token ||
    options.cloudId ||
    options.authType ||
    options.tlsClientCert ||
    options.tlsClientKey ||
    options.tlsCaCert
  ) {
    return 'set';
  }
  return 'interactive';
}

module.exports = createConfigCommand;
