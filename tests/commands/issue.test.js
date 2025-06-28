const createIssueCommand = require('../../bin/commands/issue');

describe('IssueCommand', () => {
  let mockFactory;
  let mockIOStreams;
  let mockJiraClient;
  let mockAnalytics;
  let issueCommand;

  beforeEach(() => {
    mockIOStreams = {
      out: {
        write: jest.fn()
      },
      println: jest.fn(),
      printError: jest.fn(),
      printSuccess: jest.fn(),
      success: jest.fn(),
      error: jest.fn(),
      colorize: jest.fn()
    };

    mockJiraClient = {
      getIssue: jest.fn(),
      searchIssues: jest.fn(),
      createIssue: jest.fn(),
      updateIssue: jest.fn(),
      assignIssue: jest.fn(),
      addComment: jest.fn(),
      getTransitions: jest.fn(),
      transitionIssue: jest.fn()
    };

    mockAnalytics = {
      track: jest.fn().mockResolvedValue()
    };

    mockFactory = {
      getIOStreams: jest.fn(() => mockIOStreams),
      getJiraClient: jest.fn().mockResolvedValue(mockJiraClient),
      getAnalytics: jest.fn(() => mockAnalytics)
    };

    issueCommand = createIssueCommand(mockFactory);
  });

  describe('command structure', () => {
    it('should create issue command', () => {
      expect(issueCommand.name()).toBe('issue');
      expect(issueCommand.description()).toContain('Manage JIRA issues');
    });

    it('should have correct alias', () => {
      expect(issueCommand.aliases()).toContain('i');
    });

    it('should have options', () => {
      const options = issueCommand.options;
      expect(options.length).toBeGreaterThan(0);
    });
  });

  describe('command options', () => {
    it('should have list option', () => {
      const listOption = issueCommand.options.find(opt => opt.long === '--list');
      expect(listOption).toBeDefined();
      expect(listOption.short).toBe('-l');
    });

    it('should have create option', () => {
      const createOption = issueCommand.options.find(opt => opt.long === '--create');
      expect(createOption).toBeDefined();
      expect(createOption.short).toBe('-c');
    });

    it('should have get option', () => {
      const getOption = issueCommand.options.find(opt => opt.long === '--get');
      expect(getOption).toBeDefined();
      expect(getOption.short).toBe('-g');
    });

    it('should have filter options', () => {
      const projectOption = issueCommand.options.find(opt => opt.long === '--project');
      expect(projectOption).toBeDefined();
      
      const assigneeOption = issueCommand.options.find(opt => opt.long === '--assignee');
      expect(assigneeOption).toBeDefined();
      
      const statusOption = issueCommand.options.find(opt => opt.long === '--status');
      expect(statusOption).toBeDefined();
    });
  });
});
