const axios = require('axios');

class JiraClient {
  constructor(config) {
    this.config = config;
    this.baseURL = config.server;
    
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
    
    this.client = axios.create({
      baseURL: `${this.baseURL}/rest/api/2`,
      auth: auth,
      headers: headers
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          const { status, data } = error.response;
          switch (status) {
          case 401:
            throw new Error('Authentication failed. Please check your credentials.');
          case 403:
            throw new Error('Access denied. You don\'t have permission to perform this action.');
          case 404:
            throw new Error('Resource not found.');
          default:
            throw new Error(data.errorMessages ? data.errorMessages.join(', ') : 'API request failed');
          }
        } else if (error.request) {
          throw new Error('Network error. Please check your connection and server URL.');
        } else {
          throw new Error(error.message);
        }
      }
    );
  }

  // Test connection
  async testConnection() {
    try {
      const response = await this.client.get('/myself');
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
    const response = await this.client.get(`/issue/${issueKey}`);
    return response.data;
  }

  async searchIssues(jql, options = {}) {
    const params = {
      jql,
      startAt: options.startAt || 0,
      maxResults: options.maxResults || 50,
      fields: options.fields || ['summary', 'status', 'assignee', 'created', 'updated']
    };
    
    const response = await this.client.get('/search', { params });
    return response.data;
  }

  async createIssue(issueData) {
    const response = await this.client.post('/issue', issueData);
    return response.data;
  }

  async updateIssue(issueKey, updateData) {
    const response = await this.client.put(`/issue/${issueKey}`, updateData);
    return response.data;
  }

  async deleteIssue(issueKey) {
    await this.client.delete(`/issue/${issueKey}`);
    return true;
  }

  // Projects
  async getProjects() {
    const response = await this.client.get('/project');
    return response.data;
  }

  async getProject(projectKey) {
    const response = await this.client.get(`/project/${projectKey}`);
    return response.data;
  }

  // Sprints (requires Agile API)
  async getSprints(boardId) {
    const response = await this.client.get(`/board/${boardId}/sprint`, {
      baseURL: `${this.baseURL}/rest/agile/1.0`
    });
    return response.data;
  }

  async getBoards() {
    const response = await this.client.get('/board', {
      baseURL: `${this.baseURL}/rest/agile/1.0`
    });
    return response.data;
  }

  // Issue types
  async getIssueTypes() {
    const response = await this.client.get('/issuetype');
    return response.data;
  }

  // Statuses
  async getStatuses() {
    const response = await this.client.get('/status');
    return response.data;
  }

  // Users
  async searchUsers(query) {
    const response = await this.client.get('/user/search', {
      params: { username: query }
    });
    return response.data;
  }
}

module.exports = JiraClient;