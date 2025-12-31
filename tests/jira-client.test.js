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
});
