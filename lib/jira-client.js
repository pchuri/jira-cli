const axios = require('axios');

class JiraClient {
  constructor(config) {
    this.config = config;
    this.baseURL = config.server;
    this.apiVersionMode = this.normalizeApiVersionMode(config.apiVersion || process.env.JIRA_API_VERSION);
    this.apiVersion = this.apiVersionMode === 'auto' ? 3 : this.apiVersionMode;

    // Support both token and basic auth
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    let auth = null;
    
    // If username is empty or not provided, use token-only auth
    if (!config.username || config.username === '') {
      headers['Authorization'] = `Bearer ${config.token}`;
    } else {
      // Use basic auth with username and token
      auth = {
        username: config.username,
        password: config.token
      };
    }
    
    this.clientV2 = this.createApiClient(2, { auth, headers });
    this.clientV3 = this.createApiClient(3, { auth, headers });
    this.agileClient = this.createAgileClient({ auth, headers });
  }

  // Test connection
  async testConnection() {
    try {
      const response = await this.requestApi('get', '/myself');
      return {
        success: true,
        user: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Issues
  async getIssue(issueKey) {
    const response = await this.requestApi('get', `/issue/${issueKey}`);
    return response.data;
  }

  async searchIssues(jql, options = {}) {
    const params = {
      jql,
      startAt: options.startAt || 0,
      maxResults: options.maxResults || 50,
      fields: options.fields || ['summary', 'status', 'assignee', 'created', 'updated']
    };

    const { response } = await this.requestSearch({ params });
    return response.data;
  }

  async createIssue(issueData) {
    const response = await this.requestApi('post', '/issue', issueData);
    return response.data;
  }

  async updateIssue(issueKey, updateData) {
    const response = await this.requestApi('put', `/issue/${issueKey}`, updateData);
    return response.data;
  }

  async deleteIssue(issueKey) {
    await this.requestApi('delete', `/issue/${issueKey}`);
    return true;
  }

  // Projects
  async getProjects() {
    const response = await this.requestApi('get', '/project');
    return response.data;
  }

  async getProject(projectKey) {
    const response = await this.requestApi('get', `/project/${projectKey}`);
    return response.data;
  }

  // Sprints (requires Agile API)
  async getSprints(boardId) {
    const response = await this.agileClient.get(`/board/${boardId}/sprint`);
    return response.data;
  }

  async getBoards() {
    const response = await this.agileClient.get('/board');
    return response.data;
  }

  // Issue types
  async getIssueTypes() {
    const response = await this.requestApi('get', '/issuetype');
    return response.data;
  }

  // Statuses
  async getStatuses() {
    const response = await this.requestApi('get', '/status');
    return response.data;
  }

  // Users
  async searchUsers(query) {
    const preferred = this.apiVersion;
    const paramsByVersion = version => (version === 3 ? { query } : { username: query });

    try {
      const response = await this.getApiClient(preferred).get('/user/search', { params: paramsByVersion(preferred) });
      return response.data;
    } catch (error) {
      if (this.apiVersionMode !== 'auto' || !this.shouldFallbackApiVersion(error)) throw error;

      const fallbackVersion = preferred === 3 ? 2 : 3;
      const response = await this.getApiClient(fallbackVersion).get('/user/search', { params: paramsByVersion(fallbackVersion) });
      this.apiVersion = fallbackVersion;
      return response.data;
    }
  }

  // Comments
  async getComments(issueKey) {
    const response = await this.requestApi('get', `/issue/${issueKey}/comment`);
    return response.data;
  }

  async addComment(issueKey, body, options = {}) {
    const commentData = {
      body: body
    };

    // Add visibility if internal flag is set
    if (options.internal) {
      commentData.visibility = {
        type: 'role',
        value: 'Administrators'
      };
    }

    const response = await this.requestApi('post', `/issue/${issueKey}/comment`, commentData);
    return response.data;
  }

  async updateComment(commentId, body) {
    const commentData = {
      body: body
    };

    const response = await this.requestApi('put', `/comment/${commentId}`, commentData);
    return response.data;
  }

  async deleteComment(commentId) {
    await this.requestApi('delete', `/comment/${commentId}`);
    return true;
  }

  normalizeApiVersionMode(apiVersion) {
    if (!apiVersion) return 'auto';
    if (apiVersion === 'auto') return 'auto';
    if (apiVersion === 2 || apiVersion === '2') return 2;
    if (apiVersion === 3 || apiVersion === '3') return 3;
    return 'auto';
  }

  createApiClient(version, { auth, headers }) {
    const client = axios.create({
      baseURL: `${this.baseURL}/rest/api/${version}`,
      auth,
      headers
    });
    client.interceptors.response.use(
      response => response,
      error => Promise.reject(this.toJiraError(error))
    );
    return client;
  }

  createAgileClient({ auth, headers }) {
    const client = axios.create({
      baseURL: `${this.baseURL}/rest/agile/1.0`,
      auth,
      headers
    });
    client.interceptors.response.use(
      response => response,
      error => Promise.reject(this.toJiraError(error))
    );
    return client;
  }

  toJiraError(error) {
    if (error.response) {
      const { status, data } = error.response;

      const jiraError = new Error(this.formatJiraErrorMessage(status, data));
      jiraError.status = status;
      jiraError.data = data;
      jiraError.method = error.config?.method;
      jiraError.url = error.config?.url;
      return jiraError;
    }

    if (error.request) {
      const jiraError = new Error('Network error. Please check your connection and server URL.');
      jiraError.request = error.request;
      return jiraError;
    }

    return error instanceof Error ? error : new Error(String(error));
  }

  formatJiraErrorMessage(status, data) {
    if (status === 401) return 'Authentication failed. Please check your credentials.';
    if (status === 403) return 'Access denied. You don\'t have permission to perform this action.';
    if (status === 404) return 'Resource not found.';
    return data?.errorMessages ? data.errorMessages.join(', ') : 'API request failed';
  }

  getApiClient(version) {
    return version === 2 ? this.clientV2 : this.clientV3;
  }

  shouldFallbackApiVersion(error) {
    if (!error || typeof error !== 'object') return false;
    if (error.status === 404 || error.status === 410) return true;
    if (typeof error.message === 'string' && error.message.includes('requested API has been removed')) return true;
    if (typeof error.message === 'string' && error.message.includes('/rest/api/3/search/jql')) return true;
    return false;
  }

  async requestApi(method, url, dataOrConfig) {
    const axiosConfig = this.normalizeAxiosArgs(method, dataOrConfig);
    const preferred = this.apiVersion;

    try {
      return await this.getApiClient(preferred).request({ method, url, ...axiosConfig });
    } catch (error) {
      if (this.apiVersionMode !== 'auto' || !this.shouldFallbackApiVersion(error)) throw error;

      const fallbackVersion = preferred === 3 ? 2 : 3;
      const response = await this.getApiClient(fallbackVersion).request({ method, url, ...axiosConfig });
      this.apiVersion = fallbackVersion;
      return response;
    }
  }

  async requestSearch({ params }) {
    const preferred = this.apiVersion;
    const urlByVersion = version => (version === 3 ? '/search/jql' : '/search');

    try {
      const response = await this.getApiClient(preferred).get(urlByVersion(preferred), { params });
      return { apiVersion: preferred, response };
    } catch (error) {
      if (this.apiVersionMode !== 'auto' || !this.shouldFallbackApiVersion(error)) throw error;

      const fallbackVersion = preferred === 3 ? 2 : 3;
      const response = await this.getApiClient(fallbackVersion).get(urlByVersion(fallbackVersion), { params });
      this.apiVersion = fallbackVersion;
      return { apiVersion: fallbackVersion, response };
    }
  }

  normalizeAxiosArgs(method, dataOrConfig) {
    const lowerMethod = method.toLowerCase();
    const expectsBody = ['post', 'put', 'patch'].includes(lowerMethod);

    if (!expectsBody) {
      return dataOrConfig && typeof dataOrConfig === 'object' ? dataOrConfig : {};
    }

    const hasConfigShape = dataOrConfig && typeof dataOrConfig === 'object' && !Array.isArray(dataOrConfig) && (
      Object.prototype.hasOwnProperty.call(dataOrConfig, 'params') ||
      Object.prototype.hasOwnProperty.call(dataOrConfig, 'headers') ||
      Object.prototype.hasOwnProperty.call(dataOrConfig, 'timeout')
    );

    if (hasConfigShape) return dataOrConfig;
    return { data: dataOrConfig };
  }
}

module.exports = JiraClient;
