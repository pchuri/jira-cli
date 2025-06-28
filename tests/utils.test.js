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
});
