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
// Only safe, read-only methods are replayed automatically. A failed write may
// already have been applied by the server, so it is never resent.
const RETRYABLE_METHODS = new Set(['get', 'head', 'options']);
// Comment pagination: page size requested per call and a hard page bound so a
// misbehaving server can never cause unbounded traversal.
const COMMENT_PAGE_SIZE = 100;
const COMMENT_MAX_PAGES = 500;

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

    // Attach a raw session cookie alongside the normal auth header,
    // independent of authType. Needed for on-prem instances sitting behind
    // an SSO gateway (e.g. F5 BIG-IP APM) that gates on a live gateway
    // session cookie before the request ever reaches Jira - the PAT/Basic
    // header alone never gets past such a gateway.
    if (config.cookie) {
      headers['Cookie'] = config.cookie;
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
    if (this.authType === 'cookie') {
      return null; // Cookie-only auth: no Authorization header, session cookie carries auth
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

  // One bounded page of search results; never traverses all pages implicitly.
  // Pagination is version specific:
  //   - v3 (Jira Cloud enhanced search, GET /search/jql): cursor paging with
  //     `nextPageToken` / `isLast`; `total` may be omitted and is never invented.
  //   - v2 (GET /search, Server/Data Center): offset paging with `startAt` / `total`.
  // A v3 cursor is never sent to v2 and a positive v2 offset is never silently
  // dropped on v3: both fail with a clear error instead.
  async searchIssues(jql, options = {}) {
    const request = {
      jql,
      maxResults: options.maxResults || 50,
      fields: options.fields || ['summary', 'status', 'assignee', 'created', 'updated'],
      startAt: this.normalizeSearchStartAt(options.startAt),
      nextPageToken: this.normalizeSearchPageToken(options.nextPageToken)
    };

    const { apiVersion, response } = await this.requestSearch(request);
    return this.validateSearchPage(apiVersion, request, response.data);
  }

  normalizeSearchStartAt(startAt) {
    if (startAt === undefined || startAt === null || startAt === '') return 0;
    const value = typeof startAt === 'string' && /^\d+$/.test(startAt.trim()) ? Number(startAt.trim()) : startAt;
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid startAt offset: ${JSON.stringify(startAt)}. Use a non-negative integer.`);
    }
    return value;
  }

  normalizeSearchPageToken(token) {
    if (token === undefined || token === null) return undefined;
    if (typeof token !== 'string' || token.trim() === '' || !this.isSafePageToken(token)) {
      throw new Error('Invalid nextPageToken: expected the opaque token printed by a previous search page.');
    }
    return token;
  }

  // Tokens are opaque, but they are only ever passed as request data and shown
  // to the user; reject whitespace/control characters and absurd lengths.
  isSafePageToken(token) {
    return typeof token === 'string' && token.length > 0 && token.length <= 8192 &&
      /^[\x21-\x7e]+$/.test(token);
  }

  searchParamsForVersion(version, request) {
    const base = { jql: request.jql, maxResults: request.maxResults, fields: request.fields };
    if (version === 3) {
      if (request.startAt > 0) {
        const err = new Error(
          'Offset paging (startAt) is not supported by the Jira Cloud v3 enhanced search API ' +
          '(/rest/api/3/search/jql). Use the nextPageToken from the previous page instead.'
        );
        err.code = 'JIRA_SEARCH_PAGINATION_UNSUPPORTED';
        throw err;
      }
      return request.nextPageToken ? { ...base, nextPageToken: request.nextPageToken } : base;
    }
    if (request.nextPageToken) {
      const err = new Error(
        'nextPageToken is a Jira Cloud v3 enhanced search cursor and cannot be used with the ' +
        'v2 /rest/api/2/search API. Use startAt offset paging on v2.'
      );
      err.code = 'JIRA_SEARCH_PAGINATION_UNSUPPORTED';
      throw err;
    }
    return { jql: request.jql, startAt: request.startAt, maxResults: request.maxResults, fields: request.fields };
  }

  validateSearchPage(apiVersion, request, data) {
    if (apiVersion !== 3 || !data || typeof data !== 'object') return data;
    const token = data.nextPageToken;
    if (data.isLast === false) {
      if (!this.isSafePageToken(token)) {
        throw new Error('Jira returned a search page with isLast=false but without a usable nextPageToken; results are incomplete.');
      }
      if (request.nextPageToken && token === request.nextPageToken) {
        throw new Error('Jira returned the same nextPageToken that was requested; refusing to repeat the same search page.');
      }
    } else if (token !== undefined && token !== null && data.isLast !== true) {
      // A token without isLast still means "more"; validate it the same way.
      if (!this.isSafePageToken(token)) {
        throw new Error('Jira returned an unusable nextPageToken; results are incomplete.');
      }
      if (request.nextPageToken && token === request.nextPageToken) {
        throw new Error('Jira returned the same nextPageToken that was requested; refusing to repeat the same search page.');
      }
    }
    return data;
  }

  async createIssue(issueData) {
    const response = await this.requestApi('post', '/issue', version => this.formatIssueData(issueData, version));
    return response.data;
  }

  async updateIssue(issueKey, updateData) {
    const response = await this.requestApi('put', `/issue/${issueKey}`, version => this.formatIssueData(updateData, version));
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
  // Returns ALL comments in the same shape as one Jira comment page
  // ({ comments: [...], startAt, maxResults, total }). Pages are fetched with
  // startAt/maxResults until `total` (or isLast) says the list is complete.
  // Traversal is bounded and must make forward progress: a repeated comment id,
  // an empty page while comments remain, or too many pages is an explicit
  // incomplete-result error rather than a silently truncated list.
  async getComments(issueKey) {
    const url = `/issue/${issueKey}/comment`;
    const comments = [];
    const seenIds = new Set();
    let first = null;
    let startAt = 0;

    for (let page = 0; ; page++) {
      if (page >= COMMENT_MAX_PAGES) {
        throw this.incompleteCommentsError(issueKey, `stopped after ${COMMENT_MAX_PAGES} pages`, comments.length);
      }
      const response = await this.requestApi('get', url, { params: { startAt, maxResults: COMMENT_PAGE_SIZE } });
      const data = response.data;
      if (!data || typeof data !== 'object' || !Array.isArray(data.comments)) {
        if (page === 0) return data;
        throw this.incompleteCommentsError(issueKey, `page at startAt=${startAt} had no comments array`, comments.length);
      }
      if (first === null) first = data;
      if (Number.isInteger(data.startAt) && data.startAt !== startAt) {
        throw this.incompleteCommentsError(issueKey, `requested startAt=${startAt} but received startAt=${data.startAt}`, comments.length);
      }

      for (const comment of data.comments) {
        const id = comment && comment.id != null ? String(comment.id) : null;
        if (id !== null) {
          if (seenIds.has(id)) {
            throw this.incompleteCommentsError(issueKey, `comment ${id} was returned twice (repeated page)`, comments.length);
          }
          seenIds.add(id);
        }
        comments.push(comment);
      }

      const total = Number.isSafeInteger(data.total) && data.total >= 0 ? data.total : null;
      if (data.isLast === true) break;
      if (total !== null) {
        if (comments.length >= total) break;
      } else if (data.isLast !== false) {
        // No paging metadata at all: a single, complete response.
        break;
      }
      if (data.comments.length === 0) {
        const remaining = total !== null ? `${total - comments.length} of ${total}` : 'more';
        throw this.incompleteCommentsError(issueKey, `empty page at startAt=${startAt} while ${remaining} comments remain`, comments.length);
      }
      startAt += data.comments.length;
    }

    const result = { ...first, comments };
    if ('startAt' in first) result.startAt = 0;
    if ('maxResults' in first) result.maxResults = comments.length;
    if ('total' in first) result.total = comments.length;
    if ('isLast' in first) result.isLast = true;
    return result;
  }

  incompleteCommentsError(issueKey, reason, fetched) {
    const err = new Error(`Could not fetch the complete comment list for ${issueKey}: ${reason} (${fetched} comments fetched).`);
    err.code = 'JIRA_INCOMPLETE_COMMENTS';
    return err;
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

  async updateComment(issueKey, commentId, body) {
    if (!issueKey || !commentId || body === undefined) {
      throw new Error('Issue key, comment ID, and body are required to update a comment.');
    }
    const buildData = version => ({ body: this.formatCommentBody(body, version) });
    return this.requestCommentWrite('put', `/issue/${issueKey}/comment/${commentId}`, buildData);
  }

  // Comment bodies are version-specific: v3 (Jira Cloud) requires Atlassian
  // Document Format while v2 accepts plain text. Rebuild the body per version
  // and additionally handle Jira's comment-specific body rejection response.
  async requestCommentWrite(method, url, buildData) {
    const preferred = this.apiVersion;
    const fallbackVersion = preferred === 3 ? 2 : 3;

    try {
      const response = await this.getApiClient(preferred).request({ method, url, data: buildData(preferred) });
      // A 2xx non-JSON (e.g. proxy/SSO HTML) answer to a write is ambiguous:
      // the write may already be committed, so it must never be replayed.
      if (this.apiVersionMode === 'auto' && this.isNonJsonResponse(response)) {
        throw this.ambiguousWriteResponseError(method, response);
      }
      return response.data;
    } catch (error) {
      if (error && error.noVersionFallback) throw error;
      const canFallback = this.shouldFallbackApiVersion(error) || this.isCommentBodyRejection(error);
      if (this.apiVersionMode !== 'auto' || !canFallback || this.isAmbiguousWriteFailure(method, error)) throw error;

      const response = await this.getApiClient(fallbackVersion).request({ method, url, data: buildData(fallbackVersion) });
      this.apiVersion = fallbackVersion;
      return response.data;
    }
  }

  async deleteComment(issueKey, commentId) {
    if (!issueKey || !commentId) {
      throw new Error('Issue key and comment ID are required to delete a comment.');
    }
    await this.requestApi('delete', `/issue/${issueKey}/comment/${commentId}`);
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

        if (config && maxRetries > 0 && this.isRetryableMethod(config.method) && this.shouldRetry(error)) {
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

  isRetryableMethod(method) {
    return RETRYABLE_METHODS.has(String(method || 'get').toLowerCase());
  }

  // A write that failed at the transport level or with a 5xx may already be
  // committed server-side; replaying it on another API version could
  // duplicate it, so such failures must not trigger version fallback.
  isAmbiguousWriteFailure(method, error) {
    if (this.isRetryableMethod(method)) return false;
    const status = error && error.status;
    return typeof status !== 'number' || status >= 500;
  }

  // Raw body is intentionally not attached (may be a large/sensitive page).
  ambiguousWriteResponseError(method, response) {
    const err = new Error(`Ambiguous non-JSON ${response.status} response to ${String(method).toUpperCase()} write; it may have been applied and was not replayed on another API version.`);
    err.code = 'JIRA_AMBIGUOUS_WRITE_RESPONSE';
    err.status = response.status;
    err.noVersionFallback = true;
    return err;
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

  formatIssueData(data, version) {
    // Keep the caller's text intact so a v2 fallback does not receive v3 ADF.
    // Omitted descriptions, null (clear), and pre-built ADF pass through.
    if (version !== 3 || typeof data?.fields?.description !== 'string') return data;
    return {
      ...data,
      fields: { ...data.fields, description: this.toADF(data.fields.description) }
    };
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
    // Axios represents a successful no-content response as an empty string.
    // It is not an HTML/SSO response and must never replay a completed write.
    if (response.status === 204 || response.status === 205) return false;
    if (response.status >= 200 && response.status < 300 &&
        (response.data === '' || response.data == null)) return false;
    const contentType = response.headers?.['content-type'] || '';
    if (contentType.includes('text/html')) return true;
    if (typeof response.data === 'string') return true;
    return false;
  }

  async requestApi(method, url, dataOrConfig) {
    // Version-dependent payloads must be rebuilt for each attempted API.
    const configForVersion = version => this.normalizeAxiosArgs(method,
      typeof dataOrConfig === 'function' ? dataOrConfig(version) : dataOrConfig);
    const preferred = this.apiVersion;

    try {
      const response = await this.getApiClient(preferred).request({ method, url, ...configForVersion(preferred) });
      if (this.apiVersionMode === 'auto' && this.isNonJsonResponse(response)) {
        if (!this.isRetryableMethod(method)) throw this.ambiguousWriteResponseError(method, response);
        const fallbackVersion = preferred === 3 ? 2 : 3;
        const fallbackResponse = await this.getApiClient(fallbackVersion).request({ method, url, ...configForVersion(fallbackVersion) });
        this.apiVersion = fallbackVersion;
        return fallbackResponse;
      }
      return response;
    } catch (error) {
      if (error && error.noVersionFallback) throw error;
      if (this.apiVersionMode !== 'auto' || !this.shouldFallbackApiVersion(error)) throw error;
      if (this.isAmbiguousWriteFailure(method, error)) throw error;

      const fallbackVersion = preferred === 3 ? 2 : 3;
      const response = await this.getApiClient(fallbackVersion).request({ method, url, ...configForVersion(fallbackVersion) });
      this.apiVersion = fallbackVersion;
      return response;
    }
  }

  // Search params are rebuilt per API version (see searchParamsForVersion), so a
  // version fallback never carries a v3 cursor to v2 or a v2 offset to v3. When
  // the request cannot be expressed on the fallback version, the original error
  // is surfaced instead of silently changing the requested page.
  async requestSearch(request) {
    const urlByVersion = version => (version === 3 ? '/search/jql' : '/search');

    // In auto mode a continuation request names its pagination scheme: a cursor
    // only exists on v3 and a positive offset only on v2, so go straight to that
    // version (no cross-version fallback) and fail clearly if it is unavailable.
    const required = request.nextPageToken ? 3 : (request.startAt > 0 ? 2 : null);
    if (this.apiVersionMode === 'auto' && required !== null) {
      const params = this.searchParamsForVersion(required, request);
      try {
        const response = await this.getApiClient(required).get(urlByVersion(required), { params });
        this.apiVersion = required;
        return { apiVersion: required, response };
      } catch (error) {
        if (!this.shouldFallbackApiVersion(error)) throw error;
        const err = new Error(required === 3
          ? 'nextPageToken requires the Jira Cloud v3 enhanced search API (/rest/api/3/search/jql), which this server does not provide. Use startAt offset paging instead.'
          : 'startAt offset paging requires the v2 search API (/rest/api/2/search), which this server does not provide. Use the nextPageToken from the previous page instead.');
        err.code = 'JIRA_SEARCH_PAGINATION_UNSUPPORTED';
        err.status = error.status;
        err.cause = error;
        throw err;
      }
    }

    const preferred = this.apiVersion;
    const params = this.searchParamsForVersion(preferred, request);

    try {
      const response = await this.getApiClient(preferred).get(urlByVersion(preferred), { params });
      return { apiVersion: preferred, response };
    } catch (error) {
      if (this.apiVersionMode !== 'auto' || !this.shouldFallbackApiVersion(error)) throw error;

      const fallbackVersion = preferred === 3 ? 2 : 3;
      let fallbackParams;
      try {
        fallbackParams = this.searchParamsForVersion(fallbackVersion, request);
      } catch {
        // The requested page cannot be expressed on the fallback version.
        throw error;
      }
      const response = await this.getApiClient(fallbackVersion).get(urlByVersion(fallbackVersion), { params: fallbackParams });
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
