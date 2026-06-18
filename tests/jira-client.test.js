const JiraClient = require('../lib/jira-client');

// Mock configuration for testing
const mockConfig = {
  server: 'https://test.atlassian.net',
  username: 'test@example.com',
  token: 'test-token'
};

describe('JiraClient', () => {
  let client;

  beforeEach(() => {
    client = new JiraClient(mockConfig);
  });

  describe('constructor', () => {
    test('should create client with correct config', () => {
      expect(client.config).toEqual(mockConfig);
      expect(client.baseURL).toBe(mockConfig.server);
      expect(client.clientV2.defaults.auth).toEqual({
        username: mockConfig.username,
        password: mockConfig.token
      });
      expect(client.clientV3.defaults.auth).toEqual({
        username: mockConfig.username,
        password: mockConfig.token
      });
    });

    test('should set up axios clients with correct base URL', () => {
      expect(client.clientV2.defaults.baseURL).toBe(`${mockConfig.server}/rest/api/2`);
      expect(client.clientV3.defaults.baseURL).toBe(`${mockConfig.server}/rest/api/3`);
    });

    test('should create client with Bearer auth when username is empty', () => {
      const bearerConfig = {
        server: 'https://test.atlassian.net',
        username: '',
        token: 'test-token'
      };

      const bearerClient = new JiraClient(bearerConfig);

      expect(bearerClient.config).toEqual(bearerConfig);
      expect(bearerClient.baseURL).toBe(bearerConfig.server);
      expect(bearerClient.clientV2.defaults.auth).toBeNull();
      expect(bearerClient.clientV3.defaults.auth).toBeNull();
      expect(bearerClient.clientV2.defaults.headers['Authorization']).toBe('Bearer test-token');
      expect(bearerClient.clientV3.defaults.headers['Authorization']).toBe('Bearer test-token');
    });

    test('should create client with Bearer auth when username is missing', () => {
      const bearerConfig = {
        server: 'https://test.atlassian.net',
        token: 'test-token'
      };

      const bearerClient = new JiraClient(bearerConfig);

      expect(bearerClient.clientV2.defaults.auth).toBeNull();
      expect(bearerClient.clientV3.defaults.auth).toBeNull();
      expect(bearerClient.clientV2.defaults.headers['Authorization']).toBe('Bearer test-token');
      expect(bearerClient.clientV3.defaults.headers['Authorization']).toBe('Bearer test-token');
    });

    test('should create client with Basic auth when username is provided', () => {
      const basicConfig = {
        server: 'https://test.atlassian.net',
        username: 'test@example.com',
        token: 'test-token'
      };

      const basicClient = new JiraClient(basicConfig);

      expect(basicClient.clientV2.defaults.auth).toEqual({
        username: basicConfig.username,
        password: basicConfig.token
      });
      expect(basicClient.clientV3.defaults.auth).toEqual({
        username: basicConfig.username,
        password: basicConfig.token
      });
      expect(basicClient.clientV2.defaults.headers['Authorization']).toBeUndefined();
      expect(basicClient.clientV3.defaults.headers['Authorization']).toBeUndefined();
    });

    test('should route through Atlassian Platform API Gateway when cloudId is set', () => {
      const scopedConfig = {
        server: 'https://test.atlassian.net',
        username: 'test@example.com',
        token: 'scoped-token',
        cloudId: 'abcd-1234-cloud-id'
      };

      const scopedClient = new JiraClient(scopedConfig);

      expect(scopedClient.useGateway).toBe(true);
      expect(scopedClient.cloudId).toBe('abcd-1234-cloud-id');
      expect(scopedClient.clientV2.defaults.baseURL).toBe(
        'https://api.atlassian.com/ex/jira/abcd-1234-cloud-id/rest/api/2'
      );
      expect(scopedClient.clientV3.defaults.baseURL).toBe(
        'https://api.atlassian.com/ex/jira/abcd-1234-cloud-id/rest/api/3'
      );
      expect(scopedClient.agileClient.defaults.baseURL).toBe(
        'https://api.atlassian.com/ex/jira/abcd-1234-cloud-id/rest/agile/1.0'
      );
    });

    test('should keep direct routing when cloudId is empty or missing', () => {
      const directConfig = {
        server: 'https://test.atlassian.net',
        username: 'test@example.com',
        token: 'classic-token',
        cloudId: ''
      };

      const directClient = new JiraClient(directConfig);

      expect(directClient.useGateway).toBe(false);
      expect(directClient.clientV2.defaults.baseURL).toBe('https://test.atlassian.net/rest/api/2');
      expect(directClient.clientV3.defaults.baseURL).toBe('https://test.atlassian.net/rest/api/3');
      expect(directClient.agileClient.defaults.baseURL).toBe('https://test.atlassian.net/rest/agile/1.0');
    });

    test('should preserve auth credentials when routing through gateway', () => {
      const scopedConfig = {
        server: 'https://test.atlassian.net',
        username: 'test@example.com',
        token: 'scoped-token',
        cloudId: 'abcd-1234'
      };

      const scopedClient = new JiraClient(scopedConfig);

      expect(scopedClient.clientV3.defaults.auth).toEqual({
        username: 'test@example.com',
        password: 'scoped-token'
      });
    });

    test('should throw when explicit basic auth is used with an empty username', () => {
      // Previously an explicit authType=basic with no username silently fell
      // back to Bearer auth, masking misconfiguration.
      const badConfig = {
        server: 'https://test.atlassian.net',
        authType: 'basic',
        username: '',
        token: 'test-token'
      };

      expect(() => new JiraClient(badConfig)).toThrow(/Basic auth/);
      expect(() => new JiraClient(badConfig)).toThrow(/username/i);
    });

    test('should throw when explicit basic auth is used without a username property', () => {
      const badConfig = {
        server: 'https://test.atlassian.net',
        authType: 'basic',
        token: 'test-token'
      };

      expect(() => new JiraClient(badConfig)).toThrow(/Basic auth/);
    });

    test('should still use Bearer auth for legacy config with empty username and no explicit authType', () => {
      // Confirms the fail-fast only fires for *explicit* basic auth; legacy
      // configs without an authType keep their previous inference behavior.
      const legacyConfig = {
        server: 'https://test.atlassian.net',
        username: '',
        token: 'test-token'
      };

      const legacyClient = new JiraClient(legacyConfig);

      expect(legacyClient.authType).toBe('bearer');
      expect(legacyClient.clientV2.defaults.headers['Authorization']).toBe('Bearer test-token');
    });
  });

  describe('API methods', () => {
    // Mock axios client
    beforeEach(() => {
      client.clientV3.request = jest.fn();
      client.clientV3.get = jest.fn();
    });

    test('getIssue should make correct API call', async () => {
      const mockIssue = { key: 'TEST-1', fields: { summary: 'Test Issue' } };
      client.clientV3.request.mockResolvedValue({ data: mockIssue });

      const result = await client.getIssue('TEST-1');

      expect(client.clientV3.request).toHaveBeenCalledWith({ method: 'get', url: '/issue/TEST-1' });
      expect(result).toEqual(mockIssue);
    });

    test('searchIssues should make correct API call with JQL', async () => {
      const mockSearch = { issues: [], total: 0 };
      client.clientV3.get.mockResolvedValue({ data: mockSearch });

      const result = await client.searchIssues('project = TEST');

      expect(client.clientV3.get).toHaveBeenCalledWith('/search/jql', {
        params: {
          jql: 'project = TEST',
          startAt: 0,
          maxResults: 50,
          fields: ['summary', 'status', 'assignee', 'created', 'updated']
        }
      });
      expect(result).toEqual(mockSearch);
    });

    test('createIssue should make correct API call', async () => {
      const mockResponse = { key: 'TEST-2', id: '10001' };
      const issueData = {
        fields: {
          project: { key: 'TEST' },
          summary: 'New Issue',
          issuetype: { id: '10001' }
        }
      };
      
      client.clientV3.request.mockResolvedValue({ data: mockResponse });

      const result = await client.createIssue(issueData);

      expect(client.clientV3.request).toHaveBeenCalledWith({ method: 'post', url: '/issue', data: issueData });
      expect(result).toEqual(mockResponse);
    });

    test('getProjects should make correct API call', async () => {
      const mockProjects = [{ key: 'TEST', name: 'Test Project' }];
      client.clientV3.request.mockResolvedValue({ data: mockProjects });

      const result = await client.getProjects();

      expect(client.clientV3.request).toHaveBeenCalledWith({ method: 'get', url: '/project' });
      expect(result).toEqual(mockProjects);
    });

    test('getComments should make correct API call', async () => {
      const mockComments = { 
        comments: [
          { id: '10000', body: 'Test comment', author: { displayName: 'Test User' } }
        ]
      };
      client.clientV3.request.mockResolvedValue({ data: mockComments });

      const result = await client.getComments('TEST-1');

      expect(client.clientV3.request).toHaveBeenCalledWith({ method: 'get', url: '/issue/TEST-1/comment' });
      expect(result).toEqual(mockComments);
    });

    test('addComment should send ADF body on v3', async () => {
      const mockComment = { id: '10001', body: 'New comment' };
      client.clientV3.request.mockResolvedValue({ data: mockComment });

      const result = await client.addComment('TEST-1', 'New comment');

      expect(client.clientV3.request).toHaveBeenCalledWith({ method: 'post', url: '/issue/TEST-1/comment', data: {
        body: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New comment' }] }]
        }
      } });
      expect(result).toEqual(mockComment);
    });

    test('addComment with internal flag should include visibility', async () => {
      const mockComment = { id: '10001', body: 'Internal comment' };
      client.clientV3.request.mockResolvedValue({ data: mockComment });

      const result = await client.addComment('TEST-1', 'Internal comment', { internal: true });

      expect(client.clientV3.request).toHaveBeenCalledWith({ method: 'post', url: '/issue/TEST-1/comment', data: {
        body: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Internal comment' }] }]
        },
        visibility: {
          type: 'role',
          value: 'Administrators'
        }
      } });
      expect(result).toEqual(mockComment);
    });

    test('addComment sends plain text body when pinned to v2', async () => {
      const v2Client = new JiraClient({ ...mockConfig, apiVersion: 2 });
      v2Client.clientV2.request = jest.fn().mockResolvedValue({ data: { id: '10001' } });

      await v2Client.addComment('TEST-1', 'Plain text');

      expect(v2Client.clientV2.request).toHaveBeenCalledWith({ method: 'post', url: '/issue/TEST-1/comment', data: { body: 'Plain text' } });
    });

    test('addComment falls back to v2 plain text when v3 rejects the body', async () => {
      const adfRejection = Object.assign(new Error('Comment body is not valid!'), {
        status: 400,
        data: { errorMessages: [], errors: { comment: 'Comment body is not valid!' } }
      });
      client.clientV3.request.mockRejectedValue(adfRejection);
      client.clientV2.request = jest.fn().mockResolvedValue({ data: { id: '10001' } });

      const result = await client.addComment('TEST-1', 'New comment');

      expect(client.clientV2.request).toHaveBeenCalledWith({ method: 'post', url: '/issue/TEST-1/comment', data: { body: 'New comment' } });
      expect(client.apiVersion).toBe(2);
      expect(result).toEqual({ id: '10001' });
    });

    test('addComment does not fall back on unrelated 400 errors', async () => {
      const badRequest = Object.assign(new Error('Bad request'), { status: 400, data: {} });
      client.clientV3.request.mockRejectedValue(badRequest);
      client.clientV2.request = jest.fn();

      await expect(client.addComment('TEST-1', 'New comment')).rejects.toBe(badRequest);
      expect(client.clientV2.request).not.toHaveBeenCalled();
    });

    test('updateComment should send ADF body on v3', async () => {
      const mockComment = { id: '10000', body: 'Updated comment' };
      client.clientV3.request.mockResolvedValue({ data: mockComment });

      const result = await client.updateComment('10000', 'Updated comment');

      expect(client.clientV3.request).toHaveBeenCalledWith({ method: 'put', url: '/comment/10000', data: {
        body: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated comment' }] }]
        }
      } });
      expect(result).toEqual(mockComment);
    });

    test('deleteComment should make correct API call', async () => {
      client.clientV3.request.mockResolvedValue({});

      const result = await client.deleteComment('10000');

      expect(client.clientV3.request).toHaveBeenCalledWith({ method: 'delete', url: '/comment/10000' });
      expect(result).toBe(true);
    });

    test('getRemoteLinks should make correct API call', async () => {
      const mockLinks = [{ id: 10000, object: { url: 'https://example.com', title: 'Example' } }];
      client.clientV3.request.mockResolvedValue({ data: mockLinks });

      const result = await client.getRemoteLinks('TEST-1');

      expect(client.clientV3.request).toHaveBeenCalledWith({
        method: 'get',
        url: '/issue/TEST-1/remotelink',
        params: {}
      });
      expect(result).toEqual(mockLinks);
    });

    test('getRemoteLinks should pass globalId filter when provided', async () => {
      const mockLinks = [{ id: 10000 }];
      client.clientV3.request.mockResolvedValue({ data: mockLinks });

      await client.getRemoteLinks('TEST-1', { globalId: 'https://example.com/resource' });

      expect(client.clientV3.request).toHaveBeenCalledWith({
        method: 'get',
        url: '/issue/TEST-1/remotelink',
        params: { globalId: 'https://example.com/resource' }
      });
    });

    test('getRemoteLinks should wrap single-object responses in an array', async () => {
      const singleLink = { id: 10000, object: { url: 'https://example.com' } };
      client.clientV3.request.mockResolvedValue({ data: singleLink });

      const result = await client.getRemoteLinks('TEST-1', { globalId: 'https://example.com' });

      expect(result).toEqual([singleLink]);
    });

    test('getRemoteLinks should return empty array for null/undefined data', async () => {
      client.clientV3.request.mockResolvedValue({ data: null });

      const result = await client.getRemoteLinks('TEST-1');

      expect(result).toEqual([]);
    });

    test('getRemoteLink should make correct API call', async () => {
      const mockLink = {
        id: 10001,
        globalId: 'https://example.com/resource',
        object: { url: 'https://example.com/resource', title: 'Example' }
      };
      client.clientV3.request.mockResolvedValue({ data: mockLink });

      const result = await client.getRemoteLink('TEST-1', '10001');

      expect(client.clientV3.request).toHaveBeenCalledWith({
        method: 'get',
        url: '/issue/TEST-1/remotelink/10001'
      });
      expect(result).toEqual(mockLink);
    });

    test('addRemoteLink should make correct API call', async () => {
      const payload = {
        globalId: 'https://example.com/resource',
        relationship: 'relates to',
        object: { url: 'https://example.com/resource', title: 'Example' }
      };
      const mockResponse = { id: 10001, self: 'https://test.atlassian.net/rest/api/3/issue/TEST-1/remotelink/10001' };
      client.clientV3.request.mockResolvedValue({ data: mockResponse });

      const result = await client.addRemoteLink('TEST-1', payload);

      expect(client.clientV3.request).toHaveBeenCalledWith({
        method: 'post',
        url: '/issue/TEST-1/remotelink',
        data: payload
      });
      expect(result).toEqual(mockResponse);
    });

    test('updateRemoteLink should make correct API call', async () => {
      const payload = { object: { url: 'https://example.com/new', title: 'Updated' } };
      client.clientV3.request.mockResolvedValue({ data: {} });

      await client.updateRemoteLink('TEST-1', '10001', payload);

      expect(client.clientV3.request).toHaveBeenCalledWith({
        method: 'put',
        url: '/issue/TEST-1/remotelink/10001',
        data: payload
      });
    });

    test('deleteRemoteLink should make correct API call', async () => {
      client.clientV3.request.mockResolvedValue({});

      const result = await client.deleteRemoteLink('TEST-1', '10001');

      expect(client.clientV3.request).toHaveBeenCalledWith({
        method: 'delete',
        url: '/issue/TEST-1/remotelink/10001'
      });
      expect(result).toBe(true);
    });
  });

  // Error handling tests
  describe('error handling', () => {
    test('should handle axios errors', async () => {
      // Test that errors are properly propagated
      const error = new Error('Network error');
      client.clientV3.request = jest.fn().mockRejectedValue(error);

      await expect(client.getIssue('TEST-1')).rejects.toThrow('Network error');
    });
  });

  // mTLS authentication tests
  describe('mTLS authentication', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    let tmpDir;
    let certPath;
    let keyPath;
    let caPath;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-mtls-'));
      certPath = path.join(tmpDir, 'client.pem');
      keyPath = path.join(tmpDir, 'client.key');
      caPath = path.join(tmpDir, 'ca.pem');
      fs.writeFileSync(certPath, 'client-cert');
      fs.writeFileSync(keyPath, 'client-key');
      fs.writeFileSync(caPath, 'ca-cert');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('should create client with mTLS auth without Authorization header', () => {
      const mtlsConfig = {
        server: 'https://jira.example.com',
        authType: 'mtls',
        mtls: {
          caCert: caPath,
          clientCert: certPath,
          clientKey: keyPath
        }
      };

      const mtlsClient = new JiraClient(mtlsConfig);

      expect(mtlsClient.authType).toBe('mtls');
      expect(mtlsClient.clientV2.defaults.headers['Authorization']).toBeUndefined();
      expect(mtlsClient.clientV3.defaults.headers['Authorization']).toBeUndefined();
      expect(mtlsClient.clientV2.defaults.httpsAgent).toBeDefined();
      expect(mtlsClient.clientV3.defaults.httpsAgent).toBeDefined();
    });

    test('should configure httpsAgent with certificate files', () => {
      const mtlsConfig = {
        server: 'https://jira.example.com',
        authType: 'mtls',
        mtls: {
          caCert: caPath,
          clientCert: certPath,
          clientKey: keyPath
        }
      };

      const mtlsClient = new JiraClient(mtlsConfig);

      expect(mtlsClient.clientV2.defaults.httpsAgent.options.ca.toString()).toBe('ca-cert');
      expect(mtlsClient.clientV2.defaults.httpsAgent.options.cert.toString()).toBe('client-cert');
      expect(mtlsClient.clientV2.defaults.httpsAgent.options.key.toString()).toBe('client-key');
    });

    test('should work without CA certificate (optional)', () => {
      const mtlsConfig = {
        server: 'https://jira.example.com',
        authType: 'mtls',
        mtls: {
          clientCert: certPath,
          clientKey: keyPath
        }
      };

      const mtlsClient = new JiraClient(mtlsConfig);

      expect(mtlsClient.clientV2.defaults.httpsAgent.options.cert.toString()).toBe('client-cert');
      expect(mtlsClient.clientV2.defaults.httpsAgent.options.key.toString()).toBe('client-key');
      expect(mtlsClient.clientV2.defaults.httpsAgent.options.ca).toBeUndefined();
    });

    test('should throw error for missing client certificate file', () => {
      const mtlsConfig = {
        server: 'https://jira.example.com',
        authType: 'mtls',
        mtls: {
          clientCert: '/nonexistent/client.pem',
          clientKey: keyPath
        }
      };

      expect(() => new JiraClient(mtlsConfig)).toThrow('Client certificate file not found');
    });

    test('should throw error for missing client key file', () => {
      const mtlsConfig = {
        server: 'https://jira.example.com',
        authType: 'mtls',
        mtls: {
          clientCert: certPath,
          clientKey: '/nonexistent/client.key'
        }
      };

      expect(() => new JiraClient(mtlsConfig)).toThrow('Client key file not found');
    });

    test('should provide certificate hints for 401 errors with mTLS', () => {
      const mtlsConfig = {
        server: 'https://jira.example.com',
        authType: 'mtls',
        mtls: {
          clientCert: certPath,
          clientKey: keyPath
        }
      };

      const mtlsClient = new JiraClient(mtlsConfig);
      const errorMessage = mtlsClient.formatJiraErrorMessage(401, {});

      expect(errorMessage).toContain('client certificate');
    });
  });

  describe('resilience', () => {
    describe('timeout', () => {
      const ORIGINAL_TIMEOUT = process.env.JIRA_CLI_TIMEOUT_MS;

      afterEach(() => {
        if (ORIGINAL_TIMEOUT === undefined) {
          delete process.env.JIRA_CLI_TIMEOUT_MS;
        } else {
          process.env.JIRA_CLI_TIMEOUT_MS = ORIGINAL_TIMEOUT;
        }
      });

      test('defaults to 30000ms when env var unset', () => {
        delete process.env.JIRA_CLI_TIMEOUT_MS;
        const c = new JiraClient(mockConfig);
        expect(c.clientV3.defaults.timeout).toBe(30000);
        expect(c.clientV2.defaults.timeout).toBe(30000);
        expect(c.agileClient.defaults.timeout).toBe(30000);
      });

      test('respects JIRA_CLI_TIMEOUT_MS env override', () => {
        process.env.JIRA_CLI_TIMEOUT_MS = '5000';
        const c = new JiraClient(mockConfig);
        expect(c.clientV3.defaults.timeout).toBe(5000);
      });

      test('falls back to default for invalid env values', () => {
        process.env.JIRA_CLI_TIMEOUT_MS = 'not-a-number';
        const c = new JiraClient(mockConfig);
        expect(c.clientV3.defaults.timeout).toBe(30000);
      });

      test('falls back to default for non-positive env values', () => {
        process.env.JIRA_CLI_TIMEOUT_MS = '0';
        const c = new JiraClient(mockConfig);
        expect(c.clientV3.defaults.timeout).toBe(30000);
      });
    });

    describe('shouldRetry', () => {
      test('retries on 429', () => {
        expect(client.shouldRetry({ response: { status: 429 } })).toBe(true);
      });

      test('retries on 5xx', () => {
        expect(client.shouldRetry({ response: { status: 500 } })).toBe(true);
        expect(client.shouldRetry({ response: { status: 503 } })).toBe(true);
        expect(client.shouldRetry({ response: { status: 599 } })).toBe(true);
      });

      test('does not retry on 4xx other than 429', () => {
        expect(client.shouldRetry({ response: { status: 400 } })).toBe(false);
        expect(client.shouldRetry({ response: { status: 401 } })).toBe(false);
        expect(client.shouldRetry({ response: { status: 404 } })).toBe(false);
      });

      test('retries on retryable network error codes', () => {
        expect(client.shouldRetry({ code: 'ECONNRESET' })).toBe(true);
        expect(client.shouldRetry({ code: 'ETIMEDOUT' })).toBe(true);
        expect(client.shouldRetry({ code: 'ECONNABORTED' })).toBe(true);
        expect(client.shouldRetry({ code: 'ENOTFOUND' })).toBe(true);
        expect(client.shouldRetry({ code: 'EAI_AGAIN' })).toBe(true);
      });

      test('does not retry on unknown network error codes', () => {
        expect(client.shouldRetry({ code: 'EWHATEVER' })).toBe(false);
      });

      test('does not retry without response or code', () => {
        expect(client.shouldRetry({})).toBe(false);
        expect(client.shouldRetry(null)).toBe(false);
      });
    });

    describe('computeRetryDelay', () => {
      test('uses exponential backoff: 1s, 2s, 4s', () => {
        expect(client.computeRetryDelay({ response: { status: 503 } }, 1)).toBe(1000);
        expect(client.computeRetryDelay({ response: { status: 503 } }, 2)).toBe(2000);
        expect(client.computeRetryDelay({ response: { status: 503 } }, 3)).toBe(4000);
      });

      test('respects Retry-After header on 429 (lowercase)', () => {
        const error = { response: { status: 429, headers: { 'retry-after': '7' } } };
        expect(client.computeRetryDelay(error, 1)).toBe(7000);
      });

      test('respects Retry-After header on 429 (capitalized)', () => {
        const error = { response: { status: 429, headers: { 'Retry-After': '12' } } };
        expect(client.computeRetryDelay(error, 1)).toBe(12000);
      });

      test('falls back to exponential backoff when Retry-After missing on 429', () => {
        const error = { response: { status: 429, headers: {} } };
        expect(client.computeRetryDelay(error, 2)).toBe(2000);
      });

      test('ignores Retry-After on non-429 responses', () => {
        const error = { response: { status: 503, headers: { 'retry-after': '99' } } };
        expect(client.computeRetryDelay(error, 1)).toBe(1000);
      });
    });

    describe('retry interceptor', () => {
      const ORIGINAL_MAX = process.env.JIRA_CLI_MAX_RETRIES;
      let sleepSpy;

      beforeEach(() => {
        sleepSpy = jest.spyOn(JiraClient.prototype, 'sleep').mockResolvedValue();
      });

      afterEach(() => {
        sleepSpy.mockRestore();
        if (ORIGINAL_MAX === undefined) {
          delete process.env.JIRA_CLI_MAX_RETRIES;
        } else {
          process.env.JIRA_CLI_MAX_RETRIES = ORIGINAL_MAX;
        }
      });

      function makeAdapterClient() {
        const c = new JiraClient(mockConfig);
        const adapter = jest.fn();
        c.clientV3.defaults.adapter = adapter;
        return { c, adapter };
      }

      function networkErrorAdapter(config, code) {
        const err = new Error('Network error');
        err.code = code;
        err.config = config;
        return Promise.reject(err);
      }

      function httpErrorAdapter(config, status, headers = {}, data = {}) {
        const err = new Error('Request failed with status code ' + status);
        err.config = config;
        err.response = { status, headers, data, statusText: 'err', config };
        err.isAxiosError = true;
        return Promise.reject(err);
      }

      function okResponse(config) {
        return Promise.resolve({
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
          data: { key: 'TEST-1' }
        });
      }

      test('retries on 503 and eventually succeeds', async () => {
        const { c, adapter } = makeAdapterClient();
        adapter
          .mockImplementationOnce(config => httpErrorAdapter(config, 503))
          .mockImplementationOnce(config => okResponse(config));

        const result = await c.getIssue('TEST-1');

        expect(result).toEqual({ key: 'TEST-1' });
        expect(adapter).toHaveBeenCalledTimes(2);
        expect(sleepSpy).toHaveBeenCalledWith(1000);
      });

      test('retries on 429 with Retry-After delay', async () => {
        const { c, adapter } = makeAdapterClient();
        adapter
          .mockImplementationOnce(config => httpErrorAdapter(config, 429, { 'retry-after': '3' }))
          .mockImplementationOnce(config => okResponse(config));

        await c.getIssue('TEST-1');

        expect(sleepSpy).toHaveBeenCalledWith(3000);
      });

      test('retries on retryable network errors', async () => {
        const { c, adapter } = makeAdapterClient();
        adapter
          .mockImplementationOnce(config => networkErrorAdapter(config, 'ECONNRESET'))
          .mockImplementationOnce(config => okResponse(config));

        await c.getIssue('TEST-1');

        expect(adapter).toHaveBeenCalledTimes(2);
      });

      test('gives up after exhausting max retries and rejects', async () => {
        const { c, adapter } = makeAdapterClient();
        adapter.mockImplementation(config => httpErrorAdapter(config, 503));

        await expect(c.getIssue('TEST-1')).rejects.toBeDefined();
        expect(adapter).toHaveBeenCalledTimes(4); // initial + 3 retries
      });

      test('does not retry on 404', async () => {
        const { c, adapter } = makeAdapterClient();
        adapter.mockImplementation(config => httpErrorAdapter(config, 404));

        await expect(c.getIssue('TEST-1')).rejects.toThrow('Resource not found');
        expect(adapter).toHaveBeenCalledTimes(1);
      });

      test('respects JIRA_CLI_MAX_RETRIES=0 (no retries)', async () => {
        process.env.JIRA_CLI_MAX_RETRIES = '0';
        const { c, adapter } = makeAdapterClient();
        adapter.mockImplementation(config => httpErrorAdapter(config, 503));

        await expect(c.getIssue('TEST-1')).rejects.toBeDefined();
        expect(adapter).toHaveBeenCalledTimes(1);
      });

      test('uses exponential backoff between retries', async () => {
        const { c, adapter } = makeAdapterClient();
        adapter.mockImplementation(config => httpErrorAdapter(config, 503));

        await expect(c.getIssue('TEST-1')).rejects.toBeDefined();

        expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000);
        expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
        expect(sleepSpy).toHaveBeenNthCalledWith(3, 4000);
      });
    });
  });

  describe('toADF', () => {
    test('wraps plain text in a single paragraph', () => {
      expect(client.toADF('hello')).toEqual({
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }]
      });
    });

    test('splits blank-line-separated blocks into paragraphs', () => {
      const adf = client.toADF('first\n\nsecond');
      expect(adf.content).toEqual([
        { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'second' }] }
      ]);
    });

    test('keeps single newlines as hard breaks within a paragraph', () => {
      const adf = client.toADF('line one\nline two');
      expect(adf.content).toEqual([
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'line one' },
            { type: 'hardBreak' },
            { type: 'text', text: 'line two' }
          ]
        }
      ]);
    });

    test('represents empty input as an empty paragraph', () => {
      expect(client.toADF('').content).toEqual([{ type: 'paragraph' }]);
    });
  });

  describe('extractErrorDetail', () => {
    test('joins errorMessages when present', () => {
      expect(client.extractErrorDetail({ errorMessages: ['boom', 'bang'], errors: {} })).toBe('boom, bang');
    });

    test('falls back to the errors object when errorMessages is empty', () => {
      expect(client.extractErrorDetail({ errorMessages: [], errors: { comment: 'Comment body is not valid!' } }))
        .toBe('comment: Comment body is not valid!');
    });

    test('returns empty string when no detail is available', () => {
      expect(client.extractErrorDetail({ errorMessages: [], errors: {} })).toBe('');
    });
  });
});
