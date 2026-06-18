const axios = require('axios');
const fs = require('fs');
const https = require('https');
const { expandHomePath } = require('./utils');

const ATLASSIAN_GATEWAY_HOST = 'https://api.atlassian.com';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 3;
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN'
]);

function readPositiveIntEnv(name, fallback, { allowZero = false } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (allowZero ? parsed < 0 : parsed <= 0) return fallback;
  return parsed;
}

function getTimeoutMs() {
  return readPositiveIntEnv('JIRA_CLI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
}

function getMaxRetries() {
  return readPositiveIntEnv('JIRA_CLI_MAX_RETRIES', DEFAULT_MAX_RETRIES, { allowZero: true });
}

class JiraClient {
  constructor(config) {
    this.config = config;
    this.baseURL = config.server;
    this.cloudId = (config.cloudId || '').trim();
    this.useGateway = this.cloudId.length > 0;
    this.gatewayBase = this.useGateway
      ? `${ATLASSIAN_GATEWAY_HOST}/ex/jira/${this.cloudId}`
      : null;
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
      const caPath = expandHomePath(this.mtls.caCert);
      if (!fs.existsSync(caPath)) {
        throw new Error(`CA certificate file not found: ${this.mtls.caCert}`);
      }
      options.ca = fs.readFileSync(caPath);
    }
    if (this.mtls.clientCert) {
      const certPath = expandHomePath(this.mtls.clientCert);
      if (!fs.existsSync(certPath)) {
        throw new Error(`Client certificate file not found: ${this.mtls.clientCert}`);
      }
      options.cert = fs.readFileSync(certPath);
    }
    if (this.mtls.clientKey) {
      const keyPath = expandHomePath(this.mtls.clientKey);
      if (!fs.existsSync(keyPath)) {
        throw new Error(`Client key file not found: ${this.mtls.clientKey}`);
      }
      options.key = fs.readFileSync(keyPath);
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
    const buildData = version => {
      const commentData = { body: this.formatCommentBody(body, version) };
      if (options.internal) {
        commentData.visibility = { type: 'role', value: 'Administrators' };
      }
      return commentData;
    };

    return this.requestCommentWrite('post', `/issue/${issueKey}/comment`, buildData);
  }

  async updateComment(commentId, body) {
    const buildData = version => ({ body: this.formatCommentBody(body, version) });
    return this.requestCommentWrite('put', `/comment/${commentId}`, buildData);
  }

  // Comment bodies are version-specific: v3 (Jira Cloud) requires Atlassian
  // Document Format while v2 accepts plain text. requestApi() can't be reused
  // here because its fallback replays the same payload, so the body is rebuilt
  // per version - mirroring the per-version handling in searchUsers().
  async requestCommentWrite(method, url, buildData) {
    const preferred = this.apiVersion;
    const fallbackVersion = preferred === 3 ? 2 : 3;

    try {
      const response = await this.getApiClient(preferred).request({ method, url, data: buildData(preferred) });
      // Mirror requestApi(): some Data Center/SSO setups answer an unsupported
      // v3 endpoint with a 200 text/html page instead of an error, so a non-JSON
      // success must still fall back to v2.
      if (this.apiVersionMode === 'auto' && this.isNonJsonResponse(response)) {
        const fallbackResponse = await this.getApiClient(fallbackVersion).request({ method, url, data: buildData(fallbackVersion) });
        this.apiVersion = fallbackVersion;
        return fallbackResponse.data;
      }
      return response.data;
    } catch (error) {
      const canFallback = this.shouldFallbackApiVersion(error) || this.isCommentBodyRejection(error);
      if (this.apiVersionMode !== 'auto' || !canFallback) throw error;

      const response = await this.getApiClient(fallbackVersion).request({ method, url, data: buildData(fallbackVersion) });
      this.apiVersion = fallbackVersion;
      return response.data;
    }
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

  buildApiBaseUrl(suffix) {
    const root = this.useGateway ? this.gatewayBase : this.baseURL;
    return `${root}${suffix}`;
  }

  createApiClient(version, { auth, headers, httpsAgent }) {
    return this.createAxiosClient({
      baseURL: this.buildApiBaseUrl(`/rest/api/${version}`),
      auth,
      headers,
      httpsAgent
    });
  }

  createAgileClient({ auth, headers, httpsAgent }) {
    return this.createAxiosClient({
      baseURL: this.buildApiBaseUrl('/rest/agile/1.0'),
      auth,
      headers,
      httpsAgent
    });
  }

  createAxiosClient({ baseURL, auth, headers, httpsAgent }) {
    const clientOptions = {
      baseURL,
      auth,
      headers,
      timeout: getTimeoutMs()
    };
    if (httpsAgent) {
      clientOptions.httpsAgent = httpsAgent;
    }
    const client = axios.create(clientOptions);
    this.attachResilienceInterceptor(client);
    return client;
  }

  attachResilienceInterceptor(client) {
    client.interceptors.response.use(
      response => response,
      async error => {
        const config = error && error.config;
        const maxRetries = getMaxRetries();

        if (config && maxRetries > 0 && this.shouldRetry(error)) {
          config.__retryCount = config.__retryCount || 0;
          if (config.__retryCount < maxRetries) {
            config.__retryCount += 1;
            const delayMs = this.computeRetryDelay(error, config.__retryCount);
            await this.sleep(delayMs);
            return client.request(config);
          }
        }

        return Promise.reject(this.toJiraError(error));
      }
    );
  }

  shouldRetry(error) {
    if (!error) return false;
    if (error.response) {
      const status = error.response.status;
      return status === 429 || (status >= 500 && status < 600);
    }
    if (error.code && RETRYABLE_NETWORK_CODES.has(error.code)) return true;
    return false;
  }

  computeRetryDelay(error, attempt) {
    if (error && error.response && error.response.status === 429) {
      const headers = error.response.headers || {};
      const retryAfter = parseInt(headers['retry-after'] || headers['Retry-After'] || '', 10);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        return retryAfter * 1000;
      }
    }
    return 1000 * Math.pow(2, attempt - 1);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
      const base = 'Authentication failed. Please check your credentials.';
      if (this.useGateway) {
        return base +
          '\nUsing scoped API token via Atlassian Platform API Gateway.' +
          '\n  - Verify the token has the required Jira scopes (e.g., read:jira-work, write:jira-work)' +
          '\n  - Verify your Cloud ID is correct' +
          '\n  - Verify the email matches the account that created the token';
      }
      return base;
    }
    if (status === 403) return 'Access denied. You don\'t have permission to perform this action.';
    if (status === 404) return 'Resource not found.';
    return this.extractErrorDetail(data) || 'API request failed';
  }

  extractErrorDetail(data) {
    if (!data || typeof data !== 'object') {
      return typeof data === 'string' ? data : '';
    }
    if (Array.isArray(data.errorMessages) && data.errorMessages.length > 0) {
      return data.errorMessages.join(', ');
    }
    if (data.errors && typeof data.errors === 'object') {
      const parts = Object.entries(data.errors).map(([field, message]) => `${field}: ${message}`);
      if (parts.length > 0) return parts.join(', ');
    }
    return '';
  }

  getApiClient(version) {
    return version === 2 ? this.clientV2 : this.clientV3;
  }

  formatCommentBody(body, version) {
    // v3 requires Atlassian Document Format; v2 accepts plain text. A body that
    // is already an object (pre-built ADF) is passed through untouched.
    if (version === 3 && typeof body === 'string') return this.toADF(body);
    return body;
  }

  toADF(text) {
    const source = text == null ? '' : String(text);
    const content = source.split(/\n{2,}/).map(block => {
      const nodes = [];
      block.split('\n').forEach((line, index) => {
        if (index > 0) nodes.push({ type: 'hardBreak' });
        if (line.length > 0) nodes.push({ type: 'text', text: line });
      });
      return nodes.length > 0 ? { type: 'paragraph', content: nodes } : { type: 'paragraph' };
    });

    return { type: 'doc', version: 1, content };
  }

  isCommentBodyRejection(error) {
    if (!error || error.status !== 400) return false;
    const commentError = error.data?.errors?.comment;
    return typeof commentError === 'string' && commentError.length > 0;
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
