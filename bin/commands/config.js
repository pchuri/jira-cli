const { Command } = require('commander');
const { applyConfigOptions, hasAnyConfigOption } = require('../../lib/config-options');

// Profile selection for this command comes exclusively from the root
// program's global `--profile <name>` option (see bin/root.js), which is
// turned into the JIRA_PROFILE env var in its preAction hook and read
// lazily by Config methods. A command-local `--profile` option is
// deliberately NOT declared here: Commander does not merge a child's local
// option with an identically-named option on an ancestor - whichever level
// declares it closest to the root wins, silently emptying every other
// level's own `.opts()` for that key. Declaring it only once, on the root
// program, avoids that trap while still parsing correctly no matter where
// `--profile` appears on the command line (`jira --profile x config ...`,
// `jira config --profile x ...`, `jira config get key --profile x`, ...).
function createConfigCommand(factory) {
  const command = new Command('config')
    .description('Manage JIRA CLI configuration')
    .alias('c')
    .option('-s, --show', 'show current configuration')
    .option('--server <url>', 'set JIRA server URL')
    .option('--username <username>', 'set username')
    .option('--token <token>', 'set API token')
    .option('--cloud-id <cloudId>', 'set Atlassian Cloud ID for scoped API tokens')
    .option('--auth-type <type>', 'authentication type (basic, bearer, mtls, or cookie)')
    .option('--tls-client-cert <path>', 'client certificate for mTLS authentication')
    .option('--tls-client-key <path>', 'client private key for mTLS authentication')
    .option('--tls-ca-cert <path>', 'CA certificate for mTLS authentication (optional)')
    .option('--api-version <version>', 'JIRA REST API version to use (auto, 2, or 3)')
    .option('--cookie <cookie>', 'raw session cookie sent alongside auth (for SSO-gated on-prem instances)')
    .action(async (options) => {
      const io = factory.getIOStreams();
      const config = factory.getConfig();
      const analytics = factory.getAnalytics();

      try {
        await analytics.track('config', { action: getConfigAction(options) });

        if (options.show) {
          config.displayConfig();
          return;
        }

        if (hasAnyConfigOption(options)) {
          await applyConfigOptions(config, io, options);
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
            'Multiple profiles (e.g. more than one JIRA instance):\n' +
            '  jira config --profile <name> --server <url> --token <token>\n' +
            '  jira profile add <name> --server <url> --token <token>\n' +
            '  jira profile list\n' +
            '  jira profile use <name>\n\n' +
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
            io.out(`${key}: ${key === 'token' || key === 'cookie' ? '***' : value}`);
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
  if (hasAnyConfigOption(options)) return 'set';
  return 'interactive';
}

module.exports = createConfigCommand;
