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

    it('should have subcommands', () => {
      const commands = issueCommand.commands;
      expect(commands.length).toBeGreaterThan(0);

      const listCommand = commands.find(cmd => cmd.name() === 'list');
      expect(listCommand).toBeDefined();

      const createCommand = commands.find(cmd => cmd.name() === 'create');
      expect(createCommand).toBeDefined();

      const viewCommand = commands.find(cmd => cmd.name() === 'view');
      expect(viewCommand).toBeDefined();
    });
  });

  describe('list subcommand options', () => {
    let listCommand;

    beforeEach(() => {
      listCommand = issueCommand.commands.find(cmd => cmd.name() === 'list');
    });

    it('should have filter options', () => {
      const projectOption = listCommand.options.find(opt => opt.long === '--project');
      expect(projectOption).toBeDefined();

      const assigneeOption = listCommand.options.find(opt => opt.long === '--assignee');
      expect(assigneeOption).toBeDefined();

      const statusOption = listCommand.options.find(opt => opt.long === '--status');
      expect(statusOption).toBeDefined();
    });

    it('should have limit option with default value', () => {
      const limitOption = listCommand.options.find(opt => opt.long === '--limit');
      expect(limitOption).toBeDefined();
      expect(limitOption.defaultValue).toBe('20');
    });
  });
});
