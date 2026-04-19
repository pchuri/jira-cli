const createIssueCommand = require('../../bin/commands/issue');

describe('IssueCommand', () => {
  let mockFactory;
  let mockIOStreams;
  let mockJiraClient;
  let mockAnalytics;
  let issueCommand;

  beforeEach(() => {
    const outFn = jest.fn();
    outFn.write = jest.fn();
    mockIOStreams = {
      out: outFn,
      println: jest.fn(),
      printError: jest.fn(),
      printSuccess: jest.fn(),
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      colorize: jest.fn(),
      spinner: jest.fn(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        succeed: jest.fn(),
        fail: jest.fn()
      }))
    };

    mockJiraClient = {
      getIssue: jest.fn(),
      searchIssues: jest.fn(),
      createIssue: jest.fn(),
      updateIssue: jest.fn(),
      assignIssue: jest.fn(),
      addComment: jest.fn(),
      getComments: jest.fn(),
      updateComment: jest.fn(),
      deleteComment: jest.fn(),
      getTransitions: jest.fn(),
      transitionIssue: jest.fn(),
      getRemoteLinks: jest.fn(),
      getRemoteLink: jest.fn(),
      addRemoteLink: jest.fn(),
      updateRemoteLink: jest.fn(),
      deleteRemoteLink: jest.fn()
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

      const commentCommand = commands.find(cmd => cmd.name() === 'comment');
      expect(commentCommand).toBeDefined();
    });
  });

  describe('comment subcommand', () => {
    let commentCommand;

    beforeEach(() => {
      commentCommand = issueCommand.commands.find(cmd => cmd.name() === 'comment');
    });

    it('should exist with correct alias', () => {
      expect(commentCommand).toBeDefined();
      expect(commentCommand.aliases()).toContain('c');
    });

    it('should have add subcommand', () => {
      const addCommand = commentCommand.commands.find(cmd => cmd.name() === 'add');
      expect(addCommand).toBeDefined();
      expect(addCommand.description()).toContain('add a comment');
    });

    it('should have list subcommand', () => {
      const listCommand = commentCommand.commands.find(cmd => cmd.name() === 'list');
      expect(listCommand).toBeDefined();
      expect(listCommand.description()).toContain('list comments');
    });

    it('should have edit subcommand', () => {
      const editCommand = commentCommand.commands.find(cmd => cmd.name() === 'edit');
      expect(editCommand).toBeDefined();
      expect(editCommand.description()).toContain('edit an existing comment');
    });

    it('should have delete subcommand', () => {
      const deleteCommand = commentCommand.commands.find(cmd => cmd.name() === 'delete');
      expect(deleteCommand).toBeDefined();
      expect(deleteCommand.description()).toContain('delete a comment');
    });
  });

  describe('remote-link subcommand', () => {
    let remoteLinkCommand;

    beforeEach(() => {
      remoteLinkCommand = issueCommand.commands.find(cmd => cmd.name() === 'remote-link');
    });

    it('should exist with correct alias', () => {
      expect(remoteLinkCommand).toBeDefined();
      expect(remoteLinkCommand.aliases()).toContain('rl');
    });

    it('should have list subcommand', () => {
      const listCommand = remoteLinkCommand.commands.find(cmd => cmd.name() === 'list');
      expect(listCommand).toBeDefined();
      expect(listCommand.description()).toContain('list remote links');

      const formatOption = listCommand.options.find(opt => opt.long === '--format');
      expect(formatOption).toBeDefined();
      expect(formatOption.defaultValue).toBe('table');

      const globalIdOption = listCommand.options.find(opt => opt.long === '--global-id');
      expect(globalIdOption).toBeDefined();
    });

    it('should have add subcommand with url and title options', () => {
      const addCommand = remoteLinkCommand.commands.find(cmd => cmd.name() === 'add');
      expect(addCommand).toBeDefined();
      expect(addCommand.description()).toContain('add a remote link');

      const urlOption = addCommand.options.find(opt => opt.long === '--url');
      expect(urlOption).toBeDefined();

      const titleOption = addCommand.options.find(opt => opt.long === '--title');
      expect(titleOption).toBeDefined();

      const globalIdOption = addCommand.options.find(opt => opt.long === '--global-id');
      expect(globalIdOption).toBeDefined();

      const relationshipOption = addCommand.options.find(opt => opt.long === '--relationship');
      expect(relationshipOption).toBeDefined();
    });

    it('should have update subcommand', () => {
      const updateCommand = remoteLinkCommand.commands.find(cmd => cmd.name() === 'update');
      expect(updateCommand).toBeDefined();
      expect(updateCommand.description()).toContain('update an existing remote link');
    });

    it('should have delete subcommand with force option', () => {
      const deleteCommand = remoteLinkCommand.commands.find(cmd => cmd.name() === 'delete');
      expect(deleteCommand).toBeDefined();
      expect(deleteCommand.description()).toContain('delete a remote link');

      const forceOption = deleteCommand.options.find(opt => opt.long === '--force');
      expect(forceOption).toBeDefined();
    });
  });

  describe('remote-link command execution', () => {
    let exitSpy;

    beforeEach(() => {
      exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
      exitSpy.mockRestore();
    });

    it('should call getRemoteLinks on list', async () => {
      mockJiraClient.getRemoteLinks.mockResolvedValue([]);

      await issueCommand.parseAsync(['node', 'jira', 'remote-link', 'list', 'PROJ-123']);

      expect(mockJiraClient.getRemoteLinks).toHaveBeenCalledWith('PROJ-123', { globalId: undefined });
    });

    it('should pass globalId filter to getRemoteLinks', async () => {
      mockJiraClient.getRemoteLinks.mockResolvedValue([]);

      await issueCommand.parseAsync([
        'node', 'jira', 'remote-link', 'list', 'PROJ-123',
        '--global-id', 'https://example.com/resource'
      ]);

      expect(mockJiraClient.getRemoteLinks).toHaveBeenCalledWith('PROJ-123', {
        globalId: 'https://example.com/resource'
      });
    });

    it('should require --url and --title for add', async () => {
      await issueCommand.parseAsync(['node', 'jira', 'remote-link', 'add', 'PROJ-123']);

      expect(mockJiraClient.addRemoteLink).not.toHaveBeenCalled();
      expect(mockIOStreams.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing required options')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should build correct payload for add with required options', async () => {
      mockJiraClient.addRemoteLink.mockResolvedValue({ id: 10001 });

      await issueCommand.parseAsync([
        'node', 'jira', 'remote-link', 'add', 'PROJ-123',
        '--url', 'https://github.com/org/repo/pull/42',
        '--title', 'org/repo#42'
      ]);

      expect(mockJiraClient.addRemoteLink).toHaveBeenCalledWith('PROJ-123', {
        object: {
          url: 'https://github.com/org/repo/pull/42',
          title: 'org/repo#42'
        }
      });
    });

    it('should include globalId, relationship, summary, and icon in add payload', async () => {
      mockJiraClient.addRemoteLink.mockResolvedValue({ id: 10001 });

      await issueCommand.parseAsync([
        'node', 'jira', 'remote-link', 'add', 'PROJ-123',
        '--url', 'https://example.com/resource',
        '--title', 'Example resource',
        '--global-id', 'https://example.com/resource',
        '--relationship', 'relates to',
        '--summary', 'A resource summary',
        '--icon-url', 'https://example.com/icon.png',
        '--icon-title', 'Example icon'
      ]);

      expect(mockJiraClient.addRemoteLink).toHaveBeenCalledWith('PROJ-123', {
        globalId: 'https://example.com/resource',
        relationship: 'relates to',
        object: {
          url: 'https://example.com/resource',
          title: 'Example resource',
          summary: 'A resource summary',
          icon: {
            url16x16: 'https://example.com/icon.png',
            title: 'Example icon'
          }
        }
      });
    });

    it('should require at least one field on update', async () => {
      await issueCommand.parseAsync(['node', 'jira', 'remote-link', 'update', 'PROJ-123', '10001']);

      expect(mockJiraClient.getRemoteLink).not.toHaveBeenCalled();
      expect(mockJiraClient.updateRemoteLink).not.toHaveBeenCalled();
      expect(mockIOStreams.error).toHaveBeenCalledWith(
        expect.stringContaining('At least one field must be specified')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should fetch existing link and merge before PUT (preserves unchanged fields)', async () => {
      mockJiraClient.getRemoteLink.mockResolvedValue({
        id: 10001,
        self: 'https://test.atlassian.net/rest/api/3/issue/PROJ-123/remotelink/10001',
        globalId: 'https://example.com/resource',
        application: { type: 'com.acme.tracker', name: 'Acme' },
        relationship: 'relates to',
        object: {
          url: 'https://example.com/resource',
          title: 'Old title',
          summary: 'Unchanged summary',
          icon: { url16x16: 'https://example.com/icon.png', title: 'icon' }
        }
      });
      mockJiraClient.updateRemoteLink.mockResolvedValue({});

      await issueCommand.parseAsync([
        'node', 'jira', 'remote-link', 'update', 'PROJ-123', '10001',
        '--title', 'Updated title'
      ]);

      expect(mockJiraClient.getRemoteLink).toHaveBeenCalledWith('PROJ-123', '10001');
      expect(mockJiraClient.updateRemoteLink).toHaveBeenCalledWith('PROJ-123', '10001', {
        globalId: 'https://example.com/resource',
        application: { type: 'com.acme.tracker', name: 'Acme' },
        relationship: 'relates to',
        object: {
          url: 'https://example.com/resource',
          title: 'Updated title',
          summary: 'Unchanged summary',
          icon: { url16x16: 'https://example.com/icon.png', title: 'icon' }
        }
      });
    });

    it('should overlay multiple fields without dropping existing ones', async () => {
      mockJiraClient.getRemoteLink.mockResolvedValue({
        id: 10001,
        self: 'https://...',
        object: {
          url: 'https://old.example.com',
          title: 'Old title'
        }
      });
      mockJiraClient.updateRemoteLink.mockResolvedValue({});

      await issueCommand.parseAsync([
        'node', 'jira', 'remote-link', 'update', 'PROJ-123', '10001',
        '--url', 'https://new.example.com',
        '--summary', 'New summary',
        '--icon-url', 'https://example.com/new-icon.png'
      ]);

      expect(mockJiraClient.updateRemoteLink).toHaveBeenCalledWith('PROJ-123', '10001', {
        object: {
          url: 'https://new.example.com',
          title: 'Old title',
          summary: 'New summary',
          icon: { url16x16: 'https://example.com/new-icon.png' }
        }
      });
    });

    it('should require --force on delete', async () => {
      await issueCommand.parseAsync(['node', 'jira', 'remote-link', 'delete', 'PROJ-123', '10001']);

      expect(mockJiraClient.deleteRemoteLink).not.toHaveBeenCalled();
      expect(mockIOStreams.error).toHaveBeenCalledWith(
        expect.stringContaining('--force flag to confirm')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should call deleteRemoteLink when --force is provided', async () => {
      mockJiraClient.deleteRemoteLink.mockResolvedValue(true);

      await issueCommand.parseAsync([
        'node', 'jira', 'remote-link', 'delete', 'PROJ-123', '10001', '--force'
      ]);

      expect(mockJiraClient.deleteRemoteLink).toHaveBeenCalledWith('PROJ-123', '10001');
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
