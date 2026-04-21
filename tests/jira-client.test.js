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

    test('addComment should make correct API call', async () => {
      const mockComment = { id: '10001', body: 'New comment' };
      client.clientV3.request.mockResolvedValue({ data: mockComment });

      const result = await client.addComment('TEST-1', 'New comment');

      expect(client.clientV3.request).toHaveBeenCalledWith({ method: 'post', url: '/issue/TEST-1/comment', data: { body: 'New comment' } });
      expect(result).toEqual(mockComment);
    });

    test('addComment with internal flag should include visibility', async () => {
      const mockComment = { id: '10001', body: 'Internal comment' };
      client.clientV3.request.mockResolvedValue({ data: mockComment });

      const result = await client.addComment('TEST-1', 'Internal comment', { internal: true });

      expect(client.clientV3.request).toHaveBeenCalledWith({ method: 'post', url: '/issue/TEST-1/comment', data: {
        body: 'Internal comment',
        visibility: {
          type: 'role',
          value: 'Administrators'
        }
      } });
      expect(result).toEqual(mockComment);
    });

    test('updateComment should make correct API call', async () => {
      const mockComment = { id: '10000', body: 'Updated comment' };
      client.clientV3.request.mockResolvedValue({ data: mockComment });

      const result = await client.updateComment('10000', 'Updated comment');

      expect(client.clientV3.request).toHaveBeenCalledWith({ method: 'put', url: '/comment/10000', data: { body: 'Updated comment' } });
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
});
