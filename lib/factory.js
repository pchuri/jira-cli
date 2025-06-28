/**
 * Factory pattern for creating command dependencies
 * Inspired by gh CLI's cmdutil.Factory
 */

const IOStreams = require('./iostreams');
const Config = require('./config');
const JiraClient = require('./jira-client');
const Analytics = require('./analytics');

class Factory {
  constructor() {
    this._ioStreams = null;
    this._config = null;
    this._jiraClient = null;
    this._analytics = null;
  }

  /**
   * Get IOStreams instance
   * @returns {IOStreams}
   */
  getIOStreams() {
    if (!this._ioStreams) {
      this._ioStreams = new IOStreams();
    }
    return this._ioStreams;
  }

  /**
   * Get Config instance
   * @returns {Config}
   */
  getConfig() {
    if (!this._config) {
      this._config = new Config();
    }
    return this._config;
  }

  /**
   * Get JIRA Client instance
   * @returns {JiraClient}
   */
  async getJiraClient() {
    if (!this._jiraClient) {
      const config = this.getConfig();
      const jiraConfig = await config.getRequiredConfig();
      this._jiraClient = new JiraClient(jiraConfig);
    }
    return this._jiraClient;
  }

  /**
   * Get Analytics instance
   * @returns {Analytics}
   */
  getAnalytics() {
    if (!this._analytics) {
      this._analytics = new Analytics();
    }
    return this._analytics;
  }

  /**
   * Check if we can prompt the user (TTY available)
   * @returns {boolean}
   */
  canPrompt() {
    return this.getIOStreams().canPrompt();
  }

  /**
   * Create a browser instance for opening URLs
   * @returns {Object}
   */
  getBrowser() {
    return {
      browse: (url) => {
        const { spawn } = require('child_process');
        const open = process.platform === 'darwin' ? 'open' : 
          process.platform === 'win32' ? 'start' : 'xdg-open';
        spawn(open, [url], { detached: true, stdio: 'ignore' });
      }
    };
  }
}

module.exports = Factory;
