const Utils = require('../lib/utils');

describe('Utils', () => {
  describe('formatDate', () => {
    it('should format ISO date strings', () => {
      const isoDate = '2023-12-25T10:30:00.000Z';
      const formatted = Utils.formatDate(isoDate);
      
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted).not.toBe('N/A');
    });

    it('should handle null/undefined dates', () => {
      expect(Utils.formatDate(null)).toBe('N/A');
      expect(Utils.formatDate(undefined)).toBe('N/A');
      expect(Utils.formatDate('')).toBe('N/A');
    });

    it('should handle invalid dates gracefully', () => {
      const result = Utils.formatDate('invalid-date');
      expect(typeof result).toBe('string');
    });
  });

  describe('formatIssueForTable', () => {
    it('should format issue for table display', () => {
      const mockIssue = {
        key: 'TEST-123',
        fields: {
          summary: 'Test issue summary',
          status: { name: 'In Progress' },
          assignee: { displayName: 'John Doe' },
          created: '2023-12-25T10:30:00.000Z',
          updated: '2023-12-25T11:00:00.000Z'
        }
      };

      const formatted = Utils.formatIssueForTable(mockIssue);
      
      expect(formatted).toHaveProperty('key');
      expect(formatted).toHaveProperty('summary');
      expect(formatted).toHaveProperty('status');
      expect(formatted).toHaveProperty('assignee');
      expect(formatted).toHaveProperty('created');
      expect(formatted).toHaveProperty('updated');
    });

    it('should handle missing fields gracefully', () => {
      const mockIssue = {
        key: 'TEST-123',
        fields: {}
      };

      const formatted = Utils.formatIssueForTable(mockIssue);
      
      expect(formatted.summary).toBe('N/A');
      expect(formatted.status).toBe('N/A');
      expect(formatted.assignee).toBe('Unassigned');
    });

    it('should truncate long summaries', () => {
      const longSummary = 'This is a very long summary that should be truncated because it exceeds the maximum length';
      const mockIssue = {
        key: 'TEST-123',
        fields: {
          summary: longSummary
        }
      };

      const formatted = Utils.formatIssueForTable(mockIssue);
      
      expect(formatted.summary.length).toBeLessThanOrEqual(53); // 50 + '...'
      expect(formatted.summary).toContain('...');
    });
  });

  describe('createIssuesTable', () => {
    it('should create table with issues', () => {
      const mockIssues = [
        {
          key: 'TEST-123',
          fields: {
            summary: 'Test issue',
            status: { name: 'In Progress' },
            assignee: { displayName: 'John Doe' },
            created: '2023-12-25T10:30:00.000Z',
            updated: '2023-12-25T11:00:00.000Z'
          }
        }
      ];

      const table = Utils.createIssuesTable(mockIssues);

      expect(table).toBeDefined();
      expect(typeof table.toString).toBe('function');
    });

    it('should handle empty issues array', () => {
      const table = Utils.createIssuesTable([]);

      expect(table).toBeDefined();
      expect(typeof table.toString).toBe('function');
    });
  });

  describe('convertAdfToText', () => {
    it('should convert simple ADF paragraph to text', () => {
      const adf = {
        version: 1,
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }]
          }
        ]
      };
      expect(Utils.convertAdfToText(adf)).toBe('Hello world\n');
    });

    it('should convert ADF with headings', () => {
      const adf = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] }
        ]
      };
      const result = Utils.convertAdfToText(adf);
      expect(result).toContain('## Title');
      expect(result).toContain('Body text');
    });

    it('should convert ADF bullet list', () => {
      const adf = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }] }
            ]
          }
        ]
      };
      const result = Utils.convertAdfToText(adf);
      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
    });

    it('should convert ADF ordered list', () => {
      const adf = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] }
            ]
          }
        ]
      };
      const result = Utils.convertAdfToText(adf);
      expect(result).toContain('1. First');
      expect(result).toContain('2. Second');
    });

    it('should convert ADF code block', () => {
      const adf = {
        type: 'doc',
        content: [
          { type: 'codeBlock', content: [{ type: 'text', text: 'const x = 1;' }] }
        ]
      };
      const result = Utils.convertAdfToText(adf);
      expect(result).toContain('```\nconst x = 1;```');
    });

    it('should convert ADF blockquote', () => {
      const adf = {
        type: 'doc',
        content: [
          { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted text' }] }] }
        ]
      };
      const result = Utils.convertAdfToText(adf);
      expect(result).toContain('> Quoted text');
    });

    it('should handle hardBreak', () => {
      const adf = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [
            { type: 'text', text: 'Line 1' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Line 2' }
          ]}
        ]
      };
      const result = Utils.convertAdfToText(adf);
      expect(result).toContain('Line 1\nLine 2');
    });

    it('should handle mentions', () => {
      const adf = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [
            { type: 'mention', attrs: { text: '@john' } }
          ]}
        ]
      };
      expect(Utils.convertAdfToText(adf)).toContain('@john');
    });

    it('should handle null/undefined input', () => {
      expect(Utils.convertAdfToText(null)).toBe('');
      expect(Utils.convertAdfToText(undefined)).toBe('');
    });

    it('should handle string input', () => {
      expect(Utils.convertAdfToText('plain text')).toBe('plain text');
    });

    it('should handle rule (horizontal line)', () => {
      const adf = {
        type: 'doc',
        content: [{ type: 'rule' }]
      };
      expect(Utils.convertAdfToText(adf)).toContain('---');
    });
  });

  describe('resolveDescription', () => {
    it('should return string descriptions as-is', () => {
      expect(Utils.resolveDescription('plain text')).toBe('plain text');
    });

    it('should convert ADF object to text', () => {
      const adf = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'ADF content' }] }
        ]
      };
      expect(Utils.resolveDescription(adf)).toBe('ADF content');
    });

    it('should return empty string for falsy input', () => {
      expect(Utils.resolveDescription(null)).toBe('');
      expect(Utils.resolveDescription(undefined)).toBe('');
      expect(Utils.resolveDescription('')).toBe('');
    });
  });

  describe('formatIssueAsMarkdown with ADF description', () => {
    it('should render ADF description as text instead of [object Object]', () => {
      const issue = {
        key: 'TEST-1',
        id: '10001',
        self: 'https://jira.example.com/rest/api/3/issue/10001',
        fields: {
          summary: 'Test issue',
          status: { name: 'Open' },
          issuetype: { name: 'Bug' },
          priority: { name: 'High' },
          assignee: { displayName: 'John' },
          reporter: { displayName: 'Jane' },
          created: '2024-01-01T00:00:00.000Z',
          updated: '2024-01-02T00:00:00.000Z',
          labels: [],
          description: {
            version: 1,
            type: 'doc',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Bug description here' }] }
            ]
          }
        }
      };
      const result = Utils.formatIssueAsMarkdown(issue);
      expect(result).toContain('Bug description here');
      expect(result).not.toContain('[object Object]');
    });
  });

  describe('buildJQL', () => {
    it('should build JQL with project filter', () => {
      const options = { project: 'TEST' };
      const jql = Utils.buildJQL(options);

      expect(jql).toBe('project = "TEST"');
    });

    it('should build JQL with currentUser assignee', () => {
      const options = { assignee: 'currentUser' };
      const jql = Utils.buildJQL(options);

      expect(jql).toBe('assignee = currentUser()');
    });

    it('should build JQL with specific user assignee', () => {
      const options = { assignee: 'john.doe' };
      const jql = Utils.buildJQL(options);

      expect(jql).toBe('assignee = "john.doe"');
    });

    it('should build JQL with status filter', () => {
      const options = { status: 'In Progress' };
      const jql = Utils.buildJQL(options);

      expect(jql).toBe('status = "In Progress"');
    });

    it('should build JQL with multiple filters', () => {
      const options = {
        project: 'TEST',
        assignee: 'currentUser',
        status: 'Open'
      };
      const jql = Utils.buildJQL(options);

      expect(jql).toBe('project = "TEST" AND assignee = currentUser() AND status = "Open"');
    });

    it('should return default ORDER BY when no filters', () => {
      const options = {};
      const jql = Utils.buildJQL(options);

      expect(jql).toBe('ORDER BY updated DESC');
    });
  });
});
