const Analytics = require('../lib/analytics');

describe('Analytics', () => {
  let analytics;
  let searchIssuesMock;

  beforeEach(() => {
    analytics = new Analytics();
    searchIssuesMock = jest.fn().mockResolvedValue({ total: 0, issues: [] });
    analytics.client = { searchIssues: searchIssuesMock };
  });

  describe('getProjectStats JQL injection', () => {
    it('should escape double quotes in projectKey', async () => {
      await analytics.getProjectStats('TEST" OR project = "X');

      expect(searchIssuesMock).toHaveBeenCalledWith(
        'project = "TEST\\" OR project = \\"X"',
        expect.any(Object)
      );
    });

    it('should escape backslashes in projectKey', async () => {
      await analytics.getProjectStats('A\\B');

      expect(searchIssuesMock).toHaveBeenCalledWith(
        'project = "A\\\\B"',
        expect.any(Object)
      );
    });

    it('should pass through legitimate project keys unchanged', async () => {
      await analytics.getProjectStats('TEST');

      expect(searchIssuesMock).toHaveBeenCalledWith(
        'project = "TEST"',
        expect.any(Object)
      );
    });
  });

  describe('getUserWorkload JQL injection', () => {
    it('should escape double quotes in username', async () => {
      await analytics.getUserWorkload('bob" OR assignee = "alice');

      expect(searchIssuesMock).toHaveBeenCalledWith(
        'assignee = "bob\\" OR assignee = \\"alice" AND resolution = Unresolved',
        expect.any(Object)
      );
    });

    it('should escape control characters in username', async () => {
      await analytics.getUserWorkload('a\nb');

      expect(searchIssuesMock).toHaveBeenCalledWith(
        'assignee = "a\\nb" AND resolution = Unresolved',
        expect.any(Object)
      );
    });

    it('should pass through legitimate usernames unchanged', async () => {
      await analytics.getUserWorkload('john.doe');

      expect(searchIssuesMock).toHaveBeenCalledWith(
        'assignee = "john.doe" AND resolution = Unresolved',
        expect.any(Object)
      );
    });
  });
});
