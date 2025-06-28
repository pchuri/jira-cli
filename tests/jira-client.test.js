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