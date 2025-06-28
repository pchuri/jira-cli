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
      (this.has('server') && this.has('username') && this.has('token')) ||
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
    if (!this.has('server') || !this.has('username') || !this.has('token')) {
      throw new Error(
        'JIRA CLI is not configured. Run ' + 
        chalk.yellow('jira init') + 
        ' to set up your connection.'
      );
    }

    return {
      server: this.get('server'),
      username: this.get('username'),
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
      console.log('Run ' + chalk.cyan('jira init') + ' to set up your JIRA connection.');
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
      console.log('Username:', chalk.green(config.username || 'Not set'));
      console.log('Token:', config.token ? chalk.green('Set (hidden)') : chalk.red('Not set'));
    }
    
    if (this.isConfigured()) {
      console.log('\n' + chalk.green('✓ Configuration is complete'));
    } else {
      console.log('\n' + chalk.red('✗ Configuration is incomplete'));
    }
  }

  // Interactive configuration setup
  async interactiveSetup() {
    const inquirer = require('inquirer');
    
    console.log(chalk.bold('\nJIRA CLI Configuration Setup'));
    console.log('Please provide your JIRA connection details:\n');

    const questions = [
      {
        type: 'input',
        name: 'server',
        message: 'JIRA Server URL (e.g., https://yourcompany.atlassian.net):',
        default: this.get('server'),
        validate: (input) => {
          if (!input) return 'Server URL is required';
          try {
            new URL(input);
            return true;
          } catch (error) {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'input',
        name: 'username',
        message: 'Username (email):',
        default: this.get('username'),
        validate: (input) => input ? true : 'Username is required'
      },
      {
        type: 'password',
        name: 'token',
        message: 'API Token (create at: https://id.atlassian.com/manage-profile/security/api-tokens):',
        validate: (input) => input ? true : 'API Token is required'
      }
    ];

    try {
      const answers = await inquirer.prompt(questions);
      
      // Save configuration
      this.set('server', answers.server.replace(/\/$/, '')); // Remove trailing slash
      this.set('username', answers.username);
      this.set('token', answers.token);

      console.log(chalk.green('\n✓ Configuration saved!'));
      
      // Test the connection
      console.log(chalk.blue('\nTesting connection...'));
      const testResult = await this.testConfig();
      
      if (testResult.success) {
        console.log(chalk.green('✓ Connection successful!'));
        console.log(`Welcome, ${testResult.user.displayName}!`);
      } else {
        console.log(chalk.red('✗ Connection failed:'), testResult.error);
        console.log(chalk.yellow('Please check your configuration and try again.'));
      }

    } catch (error) {
      console.error(chalk.red('Configuration setup failed:'), error.message);
    }
  }
}

module.exports = Config;