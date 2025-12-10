const Conf = require('conf');
const chalk = require('chalk');
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

  // Check if all required config is present
  isConfigured() {
    return !!(
      (this.has('server') && this.has('token')) ||
      (process.env.JIRA_HOST && process.env.JIRA_API_TOKEN) ||
      (process.env.JIRA_DOMAIN && process.env.JIRA_USERNAME && process.env.JIRA_API_TOKEN)
    );
  }

  // Get required configuration or throw error
  getRequiredConfig() {
    // First try JIRA_HOST environment variables (new format)
    if (process.env.JIRA_HOST && process.env.JIRA_API_TOKEN) {
      return {
        server: process.env.JIRA_HOST.startsWith('http') ?
          process.env.JIRA_HOST :
          `https://${process.env.JIRA_HOST}`,
        username: process.env.JIRA_USERNAME || '', // Empty username for token-only auth
        token: process.env.JIRA_API_TOKEN
      };
    }

    // Try legacy JIRA_DOMAIN environment variables
    if (process.env.JIRA_DOMAIN && process.env.JIRA_USERNAME && process.env.JIRA_API_TOKEN) {
      return {
        server: process.env.JIRA_DOMAIN.startsWith('http') ?
          process.env.JIRA_DOMAIN :
          `https://${process.env.JIRA_DOMAIN}`,
        username: process.env.JIRA_USERNAME,
        token: process.env.JIRA_API_TOKEN
      };
    }

    // Fall back to stored config
    if (!this.has('server') || !this.has('token')) {
      throw new Error(
        'JIRA CLI is not configured. Set configuration using:\n' +
        '  ' + chalk.yellow('jira config --server <url> --token <token>') + '\n' +
        'For Basic auth, also provide:\n' +
        '  ' + chalk.yellow('jira config --username <email>') + '\n' +
        'Or use environment variables:\n' +
        '  Bearer auth: JIRA_HOST, JIRA_API_TOKEN\n' +
        '  Basic auth: JIRA_HOST, JIRA_API_TOKEN, JIRA_USERNAME'
      );
    }

    return {
      server: this.get('server'),
      username: this.get('username') || '',
      token: this.get('token')
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
                        (process.env.JIRA_DOMAIN && process.env.JIRA_USERNAME && process.env.JIRA_API_TOKEN);

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
        console.log('Username:', chalk.green(process.env.JIRA_USERNAME || '(token auth)'));
        console.log('Token:', chalk.green('***configured***'));
      } else if (process.env.JIRA_DOMAIN) {
        console.log('Server:', chalk.green(process.env.JIRA_DOMAIN));
        console.log('Username:', chalk.green(process.env.JIRA_USERNAME));
        console.log('Token:', chalk.green('***configured***'));
      }
    }
    
    if (Object.keys(config).length > 0) {
      console.log(chalk.blue('\nFrom Config File:'));
      console.log('Server:', chalk.green(config.server || 'Not set'));
      console.log('Username:', chalk.green(config.username || '(Bearer auth)'));
      console.log('Token:', config.token ? chalk.green('Set (hidden)') : chalk.red('Not set'));
    }
    
    if (this.isConfigured()) {
      console.log('\n' + chalk.green('✓ Configuration is complete'));
    } else {
      console.log('\n' + chalk.red('✗ Configuration is incomplete'));
    }
  }

}

module.exports = Config;