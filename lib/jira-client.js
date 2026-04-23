const axios = require('axios');
const fs = require('fs');
const https = require('https');

class JiraClient {
  constructor(config) {
    this.config = config;
    this.baseURL = config.server;
    this.apiVersionMode = this.normalizeApiVersionMode(config.apiVersion || process.env.JIRA_API_VERSION);
    this.apiVersion = this.apiVersionMode === 'auto' ? 3 : this.apiVersionMode;
    this.authTypeExplicit = typeof config.authType === 'string' && config.authType.length > 0;
    this.authType = (config.authType || (config.username ? 'basic' : 'bearer')).toLowerCase();
    this.mtls = config.mtls;

    // Fail fast when the caller explicitly selected basic auth but provided no
    // username - previously this silently fell through to Bearer auth, which
    // is surprising and can mask misconfiguration.
    if (this.authTypeExplicit && this.authType === 'basic' && (!config.username || config.username === '')) {
      throw new Error(
        'Basic auth requires a username. Set one with:\n' +
        '  jira config --username <email>\n' +
        'Or switch auth types with:\n' +
        '  jira config --auth-type bearer'
      );
    }
    this.axiosConfigKeys = new Set([
      'adapter',
      'auth',
      'baseURL',
      'data',
      'decompress',
      'headers',
      'httpAgent',
      'httpsAgent',
      'maxBodyLength',
      'maxContentLength',
      'maxRedirects',
      'onDownloadProgress',
      'onUploadProgress',
      'params',
      'paramsSerializer',
      'proxy',
      'responseEncoding',
      'responseType',
      'signal',
      'timeout',
      'timeoutErrorMessage',
      'transformRequest',
      'transformResponse',
      'transitional',
      'url',
      'validateStatus',
      'withCredentials',
      'xsrfCookieName',
      'xsrfHeaderName'
    ]);

    // Support basic, bearer, and mTLS auth
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    let auth = null;

    // Build auth header based on auth type
    const authHeader = this.buildAuthHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    } else if (this.authType === 'basic') {
      // Basic auth uses axios's `auth` option instead of a manual header
      auth = {
        username: config.username,
        password: config.token
      };
    }

    // Build HTTPS agent for mTLS
    const httpsAgent = this.buildHttpsAgent();
    
    this.clientV2 = this.createApiClient(2, { auth, headers, httpsAgent });
    this.clientV3 = this.createApiClient(3, { auth, headers, httpsAgent });
    this.agileClient = this.createAgileClient({ auth, headers, httpsAgent });
  }

  buildAuthHeader() {
    if (this.authType === 'mtls') {
      return null; // mTLS uses client certificates, no Authorization header
    }
    if (this.authType === 'basic') {
      return null; // Basic auth uses axios's auth option instead
    }
    // Bearer auth (explicit or inferred from an empty username)
    if (!this.config.token) {
      return null;
    }
    return `Bearer ${this.config.token}`;
  }

  buildHttpsAgent() {
    if (!this.mtls) {
      return null;
    }

    const options = {};

    if (this.mtls.caCert) {
      if (!fs.existsSync(this.mtls.caCert)) {
        throw new Error(`CA certificate file not found: ${this.mtls.caCert}`);
      }
      options.ca = fs.readFileSync(this.mtls.caCert);
    }
    if (this.mtls.clientCert) {
      if (!fs.existsSync(this.mtls.clientCert)) {
        throw new Error(`Client certificate file not found: ${this.mtls.clientCert}`);
      }
      options.cert = fs.readFileSync(this.mtls.clientCert);
    }
    if (this.mtls.clientKey) {
      if (!fs.existsSync(this.mtls.clientKey)) {
        throw new Error(`Client key file not found: ${this.mtls.clientKey}`);
      }
      options.key = fs.readFileSync(this.mtls.clientKey);
    }

    if (Object.keys(options).length === 0) {
      return null;
    }

    return new https.Agent(options);
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

  // Remote links
  async getRemoteLinks(issueKey, options = {}) {
    const params = {};
    if (options.globalId) params.globalId = options.globalId;
    const response = await this.requestApi('get', `/issue/${issueKey}/remotelink`, { params });
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') return [data];
    return [];
  }

  async getRemoteLink(issueKey, linkId) {
    const response = await this.requestApi('get', `/issue/${issueKey}/remotelink/${linkId}`);
    return response.data;
  }

  async addRemoteLink(issueKey, linkData) {
    const response = await this.requestApi('post', `/issue/${issueKey}/remotelink`, linkData);
    return response.data;
  }

  async updateRemoteLink(issueKey, linkId, linkData) {
    const response = await this.requestApi('put', `/issue/${issueKey}/remotelink/${linkId}`, linkData);
    return response.data;
  }

  async deleteRemoteLink(issueKey, linkId) {
    await this.requestApi('delete', `/issue/${issueKey}/remotelink/${linkId}`);
    return true;
  }

  normalizeApiVersionMode(apiVersion) {
    if (!apiVersion) return 'auto';
    if (apiVersion === 'auto') return 'auto';
    if (apiVersion === 2 || apiVersion === '2') return 2;
    if (apiVersion === 3 || apiVersion === '3') return 3;
    return 'auto';
  }

  createApiClient(version, { auth, headers, httpsAgent }) {
    const clientOptions = {
      baseURL: `${this.baseURL}/rest/api/${version}`,
      auth,
      headers
    };
    if (httpsAgent) {
      clientOptions.httpsAgent = httpsAgent;
    }
    const client = axios.create(clientOptions);
    client.interceptors.response.use(
      response => response,
      error => Promise.reject(this.toJiraError(error))
    );
    return client;
  }

  createAgileClient({ auth, headers, httpsAgent }) {
    const clientOptions = {
      baseURL: `${this.baseURL}/rest/agile/1.0`,
      auth,
      headers
    };
    if (httpsAgent) {
      clientOptions.httpsAgent = httpsAgent;
    }
    const client = axios.create(clientOptions);
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
    if (status === 401) {
      if (this.authType === 'mtls') {
        return 'Authentication failed. Please verify your client certificate, client key, and CA certificate are correct and trusted by the server.';
      }
      return 'Authentication failed. Please check your credentials.';
    }
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
    if (typeof error.message === 'string' && error.message.includes('Please migrate to')) return true;
    if (typeof error.message === 'string' && error.message.includes('/rest/api/')) return true;
    return false;
  }

  isNonJsonResponse(response) {
    const contentType = response.headers?.['content-type'] || '';
    if (contentType.includes('text/html')) return true;
    if (typeof response.data === 'string') return true;
    return false;
  }

  async requestApi(method, url, dataOrConfig) {
    const axiosConfig = this.normalizeAxiosArgs(method, dataOrConfig);
    const preferred = this.apiVersion;

    try {
      const response = await this.getApiClient(preferred).request({ method, url, ...axiosConfig });
      if (this.apiVersionMode === 'auto' && this.isNonJsonResponse(response)) {
        const fallbackVersion = preferred === 3 ? 2 : 3;
        const fallbackResponse = await this.getApiClient(fallbackVersion).request({ method, url, ...axiosConfig });
        this.apiVersion = fallbackVersion;
        return fallbackResponse;
      }
      return response;
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

    const hasConfigShape =
      dataOrConfig &&
      typeof dataOrConfig === 'object' &&
      !Array.isArray(dataOrConfig) &&
      Object.keys(dataOrConfig).some(key => this.axiosConfigKeys.has(key));

    if (hasConfigShape) return dataOrConfig;
    return { data: dataOrConfig };
  }
}

module.exports = JiraClient;
