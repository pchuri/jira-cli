const { Command } = require('commander');

function createConfigCommand(factory) {
  const command = new Command('config')
    .description('Manage JIRA CLI configuration')
    .alias('c')
    .option('-s, --show', 'show current configuration')
    .option('--server <url>', 'set JIRA server URL')
    .option('--username <username>', 'set username')
    .option('--token <token>', 'set API token')
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

        if (options.server || options.username || options.token) {
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
            'Or set using individual commands:\n' +
            '  jira config set server <url>\n' +
            '  jira config set token <token>\n' +
            '  jira config set username <email>  # optional for Basic auth\n\n' +
            'Or use environment variables:\n' +
            '  Bearer auth: export JIRA_HOST=<url> JIRA_API_TOKEN=<token>\n' +
            '  Basic auth: export JIRA_HOST=<url> JIRA_API_TOKEN=<token> JIRA_USERNAME=<email>'
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
        if (['server', 'username', 'token'].includes(key) && config.isConfigured()) {
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
  if (options.server || options.username || options.token) return 'set';
  return 'interactive';
}

module.exports = createConfigCommand;
