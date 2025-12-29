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
      // Auth is now handled internally by axios client
      expect(client.client.defaults.auth).toEqual({
        username: mockConfig.username,
        password: mockConfig.token
      });
    });

    test('should set up axios client with correct base URL', () => {
      expect(client.client.defaults.baseURL).toBe(`${mockConfig.server}/rest/api/2`);
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
      expect(bearerClient.client.defaults.auth).toBeNull();
      expect(bearerClient.client.defaults.headers['Authorization']).toBe('Bearer test-token');
    });

    test('should create client with Bearer auth when username is missing', () => {
      const bearerConfig = {
        server: 'https://test.atlassian.net',
        token: 'test-token'
      };

      const bearerClient = new JiraClient(bearerConfig);

      expect(bearerClient.client.defaults.auth).toBeNull();
      expect(bearerClient.client.defaults.headers['Authorization']).toBe('Bearer test-token');
    });

    test('should create client with Basic auth when username is provided', () => {
      const basicConfig = {
        server: 'https://test.atlassian.net',
        username: 'test@example.com',
        token: 'test-token'
      };

      const basicClient = new JiraClient(basicConfig);

      expect(basicClient.client.defaults.auth).toEqual({
        username: basicConfig.username,
        password: basicConfig.token
      });
      expect(basicClient.client.defaults.headers['Authorization']).toBeUndefined();
    });
  });

  describe('API methods', () => {
    // Mock axios client
    beforeEach(() => {
      client.client.get = jest.fn();
      client.client.post = jest.fn();
      client.client.put = jest.fn();
      client.client.delete = jest.fn();
    });

    test('getIssue should make correct API call', async () => {
      const mockIssue = { key: 'TEST-1', fields: { summary: 'Test Issue' } };
      client.client.get.mockResolvedValue({ data: mockIssue });

      const result = await client.getIssue('TEST-1');

      expect(client.client.get).toHaveBeenCalledWith('/issue/TEST-1');
      expect(result).toEqual(mockIssue);
    });

    test('searchIssues should make correct API call with JQL', async () => {
      const mockSearch = { issues: [], total: 0 };
      client.client.get.mockResolvedValue({ data: mockSearch });

      const result = await client.searchIssues('project = TEST');

      expect(client.client.get).toHaveBeenCalledWith('/search', {
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
      
      client.client.post.mockResolvedValue({ data: mockResponse });

      const result = await client.createIssue(issueData);

      expect(client.client.post).toHaveBeenCalledWith('/issue', issueData);
      expect(result).toEqual(mockResponse);
    });

    test('getProjects should make correct API call', async () => {
      const mockProjects = [{ key: 'TEST', name: 'Test Project' }];
      client.client.get.mockResolvedValue({ data: mockProjects });

      const result = await client.getProjects();

      expect(client.client.get).toHaveBeenCalledWith('/project');
      expect(result).toEqual(mockProjects);
    });

    test('getComments should make correct API call', async () => {
      const mockComments = { 
        comments: [
          { id: '10000', body: 'Test comment', author: { displayName: 'Test User' } }
        ]
      };
      client.client.get.mockResolvedValue({ data: mockComments });

      const result = await client.getComments('TEST-1');

      expect(client.client.get).toHaveBeenCalledWith('/issue/TEST-1/comment');
      expect(result).toEqual(mockComments);
    });

    test('addComment should make correct API call', async () => {
      const mockComment = { id: '10001', body: 'New comment' };
      client.client.post.mockResolvedValue({ data: mockComment });

      const result = await client.addComment('TEST-1', 'New comment');

      expect(client.client.post).toHaveBeenCalledWith('/issue/TEST-1/comment', {
        body: 'New comment'
      });
      expect(result).toEqual(mockComment);
    });

    test('addComment with internal flag should include visibility', async () => {
      const mockComment = { id: '10001', body: 'Internal comment' };
      client.client.post.mockResolvedValue({ data: mockComment });

      const result = await client.addComment('TEST-1', 'Internal comment', { internal: true });

      expect(client.client.post).toHaveBeenCalledWith('/issue/TEST-1/comment', {
        body: 'Internal comment',
        visibility: {
          type: 'role',
          value: 'Administrators'
        }
      });
      expect(result).toEqual(mockComment);
    });

    test('updateComment should make correct API call', async () => {
      const mockComment = { id: '10000', body: 'Updated comment' };
      client.client.put.mockResolvedValue({ data: mockComment });

      const result = await client.updateComment('10000', 'Updated comment');

      expect(client.client.put).toHaveBeenCalledWith('/comment/10000', {
        body: 'Updated comment'
      });
      expect(result).toEqual(mockComment);
    });

    test('deleteComment should make correct API call', async () => {
      client.client.delete.mockResolvedValue({});

      const result = await client.deleteComment('10000');

      expect(client.client.delete).toHaveBeenCalledWith('/comment/10000');
      expect(result).toBe(true);
    });
  });

  // Error handling tests
  describe('error handling', () => {
    test('should handle axios errors', async () => {
      // Test that errors are properly propagated
      const error = new Error('Network error');
      client.client.get = jest.fn().mockRejectedValue(error);

      await expect(client.getIssue('TEST-1')).rejects.toThrow('Network error');
    });
  });
});