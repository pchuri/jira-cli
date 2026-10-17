// Pagination for v3 enhanced search (nextPageToken/isLast), v2 offset search
// (startAt/total), and complete comment traversal. All HTTP is served by
// synthetic axios adapter fixtures; nothing touches a real Jira.

jest.mock('../lib/utils', () => ({
  ...jest.requireActual('../lib/utils'),
  createIssuesTable: jest.fn(() => ({ toString: () => 'ISSUES-TABLE' })),
  createCommentsTable: jest.fn(() => ({ toString: () => 'COMMENTS-TABLE' }))
}));

const { Command } = require('commander');
const JiraClient = require('../lib/jira-client');
const crud = require('../bin/commands/issue/crud');
const commentCmd = require('../bin/commands/issue/comment');

const baseConfig = {
  server: 'https://synthetic.example.invalid',
  username: 'synthetic@example.invalid',
  token: 'synthetic-token'
};
const DEFAULT_FIELDS = ['summary', 'status', 'assignee', 'created', 'updated'];

function ok(config, data) {
  return Promise.resolve({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    config,
    request: {},
    data
  });
}

function httpError(config, status, data = {}) {
  const err = new Error('Request failed with status code ' + status);
  err.config = config;
  err.response = { status, headers: {}, data, statusText: 'err', config };
  err.isAxiosError = true;
  return Promise.reject(err);
}

function makeClient(apiVersion) {
  const c = new JiraClient({ ...baseConfig, ...(apiVersion ? { apiVersion } : {}) });
  // Non-retryable status so an unexpected call fails fast without retry sleeps.
  c.clientV2.defaults.adapter = jest.fn(config => httpError(config, 400, { errorMessages: ['unexpected v2 call'] }));
  c.clientV3.defaults.adapter = jest.fn(config => httpError(config, 400, { errorMessages: ['unexpected v3 call'] }));
  return c;
}

function paramsOf(adapter, index) {
  return adapter.mock.calls[index][0].params;
}

function makeIo() {
  return {
    spinner: () => ({ stop: () => {} }),
    info: jest.fn(),
    out: jest.fn(),
    success: jest.fn(),
    error: jest.fn()
  };
}

function issue(key) {
  return { key, fields: { summary: key, status: { name: 'Open' } } };
}

describe('v3 enhanced search pagination (nextPageToken/isLast)', () => {
  test('a Cloud page without total exposes isLast=false and the next request sends the cursor', async () => {
    const c = makeClient(3);
    c.clientV3.defaults.adapter = jest.fn(config => {
      if (!config.params.nextPageToken) {
        return ok(config, { issues: [issue('SYN-1'), issue('SYN-2')], nextPageToken: 'cursor-2', isLast: false });
      }
      return ok(config, { issues: [issue('SYN-3')], isLast: true });
    });

    const first = await c.searchIssues('project = SYN', { maxResults: 2 });
    expect(first.total).toBeUndefined();
    expect(first.isLast).toBe(false);
    expect(first.nextPageToken).toBe('cursor-2');
    expect(c.clientV3.defaults.adapter.mock.calls[0][0].url).toBe('/search/jql');
    expect(paramsOf(c.clientV3.defaults.adapter, 0)).toEqual({
      jql: 'project = SYN', maxResults: 2, fields: DEFAULT_FIELDS
    });

    const second = await c.searchIssues('project = SYN', { maxResults: 2, nextPageToken: first.nextPageToken });
    expect(paramsOf(c.clientV3.defaults.adapter, 1)).toEqual({
      jql: 'project = SYN', maxResults: 2, fields: DEFAULT_FIELDS, nextPageToken: 'cursor-2'
    });
    expect(second.issues.map(i => i.key)).toEqual(['SYN-3']);
    expect(second.total).toBeUndefined();
    expect(c.clientV2.defaults.adapter).not.toHaveBeenCalled();
  });

  test('requested maxResults stays bounded: one page per call, never an implicit fetch-all', async () => {
    const c = makeClient(3);
    c.clientV3.defaults.adapter = jest.fn(config =>
      ok(config, { issues: [issue('SYN-1')], nextPageToken: 'more', isLast: false }));
    await c.searchIssues('project = SYN', { maxResults: 20 });
    expect(c.clientV3.defaults.adapter).toHaveBeenCalledTimes(1);
    expect(paramsOf(c.clientV3.defaults.adapter, 0).maxResults).toBe(20);
  });

  test('isLast=false without a usable nextPageToken is an incomplete-result error', async () => {
    const c = makeClient(3);
    c.clientV3.defaults.adapter = jest.fn(config => ok(config, { issues: [issue('SYN-1')], isLast: false }));
    await expect(c.searchIssues('project = SYN')).rejects.toThrow(/isLast=false.*nextPageToken/);
  });

  test('a server echoing the requested cursor is refused instead of repeating the page', async () => {
    const c = makeClient(3);
    c.clientV3.defaults.adapter = jest.fn(config =>
      ok(config, { issues: [issue('SYN-1')], nextPageToken: config.params.nextPageToken, isLast: false }));
    await expect(c.searchIssues('project = SYN', { nextPageToken: 'same' })).rejects.toThrow(/same nextPageToken/);
  });

  test('a malformed caller token is rejected before any request', async () => {
    const c = makeClient(3);
    await expect(c.searchIssues('project = SYN', { nextPageToken: 'has space' })).rejects.toThrow(/Invalid nextPageToken/);
    await expect(c.searchIssues('project = SYN', { nextPageToken: '' })).rejects.toThrow(/Invalid nextPageToken/);
    expect(c.clientV3.defaults.adapter).not.toHaveBeenCalled();
  });

  test('a positive startAt is never silently ignored on v3', async () => {
    const c = makeClient(3);
    await expect(c.searchIssues('project = SYN', { startAt: 50 }))
      .rejects.toMatchObject({ code: 'JIRA_SEARCH_PAGINATION_UNSUPPORTED' });
    expect(c.clientV3.defaults.adapter).not.toHaveBeenCalled();
  });
});

describe('v2 offset search compatibility and version fallback', () => {
  test('v2 keeps startAt/total offset paging (regression)', async () => {
    const c = makeClient(2);
    c.clientV2.defaults.adapter = jest.fn(config =>
      ok(config, { startAt: 40, maxResults: 20, total: 75, issues: [issue('DC-41')] }));

    const page = await c.searchIssues('project = DC', { maxResults: 20, startAt: 40 });
    expect(c.clientV2.defaults.adapter.mock.calls[0][0].url).toBe('/search');
    expect(paramsOf(c.clientV2.defaults.adapter, 0)).toEqual({
      jql: 'project = DC', startAt: 40, maxResults: 20, fields: DEFAULT_FIELDS
    });
    expect(page.total).toBe(75);
  });

  test('a v3 cursor is never sent to the v2 API', async () => {
    const c = makeClient(2);
    await expect(c.searchIssues('project = DC', { nextPageToken: 'cursor' }))
      .rejects.toMatchObject({ code: 'JIRA_SEARCH_PAGINATION_UNSUPPORTED' });
    expect(c.clientV2.defaults.adapter).not.toHaveBeenCalled();
  });

  test('auto fallback from v3 to v2 rebuilds params for each version', async () => {
    const c = makeClient();
    c.clientV3.defaults.adapter = jest.fn(config => httpError(config, 404, { errorMessages: ['not found'] }));
    c.clientV2.defaults.adapter = jest.fn(config => ok(config, { startAt: 0, maxResults: 20, total: 3, issues: [] }));

    const page = await c.searchIssues('project = DC', { maxResults: 20 });
    expect(paramsOf(c.clientV3.defaults.adapter, 0)).toEqual({ jql: 'project = DC', maxResults: 20, fields: DEFAULT_FIELDS });
    expect(paramsOf(c.clientV2.defaults.adapter, 0)).toEqual({ jql: 'project = DC', startAt: 0, maxResults: 20, fields: DEFAULT_FIELDS });
    expect(page.total).toBe(3);
    expect(c.apiVersion).toBe(2);
  });

  test('auto mode with a cursor uses v3 only and never falls back to v2', async () => {
    const c = makeClient();
    c.clientV3.defaults.adapter = jest.fn(config => httpError(config, 404, { errorMessages: ['not found'] }));
    await expect(c.searchIssues('project = SYN', { nextPageToken: 'cursor' }))
      .rejects.toMatchObject({ code: 'JIRA_SEARCH_PAGINATION_UNSUPPORTED' });
    expect(paramsOf(c.clientV3.defaults.adapter, 0).nextPageToken).toBe('cursor');
    expect(c.clientV2.defaults.adapter).not.toHaveBeenCalled();
  });

  test('auto mode with a positive offset goes straight to v2 and never to v3', async () => {
    const c = makeClient();
    c.clientV2.defaults.adapter = jest.fn(config => ok(config, { startAt: 20, maxResults: 20, total: 30, issues: [issue('DC-21')] }));
    const page = await c.searchIssues('project = DC', { maxResults: 20, startAt: 20 });
    expect(paramsOf(c.clientV2.defaults.adapter, 0).startAt).toBe(20);
    expect(c.clientV3.defaults.adapter).not.toHaveBeenCalled();
    expect(page.startAt).toBe(20);
  });

  test('auto mode with an offset on a server without v2 search fails clearly', async () => {
    const c = makeClient();
    c.clientV2.defaults.adapter = jest.fn(config => httpError(config, 410, { errorMessages: ['The requested API has been removed'] }));
    await expect(c.searchIssues('project = SYN', { startAt: 20 }))
      .rejects.toThrow(/startAt offset paging requires the v2 search API/);
    expect(c.clientV3.defaults.adapter).not.toHaveBeenCalled();
  });
});

describe('jira issue list continuation', () => {
  test('registers --next-page-token and --start-at options', () => {
    const parent = new Command('issue');
    crud.register(parent, {});
    const list = parent.commands.find(cmd => cmd.name() === 'list');
    const longs = list.options.map(o => o.long);
    expect(longs).toEqual(expect.arrayContaining(['--next-page-token', '--start-at', '--limit']));
  });

  test('passes the cursor as data and prints a shell-quoted continuation hint without inventing a total', async () => {
    const token = 'tok\'en$(x)';
    const client = {
      searchIssues: jest.fn().mockResolvedValue({ issues: [issue('SYN-1')], nextPageToken: token, isLast: false })
    };
    const io = makeIo();

    await crud.listIssues(client, io, { limit: '20', nextPageToken: 'previous-cursor' });

    expect(client.searchIssues).toHaveBeenCalledWith(expect.any(String), { maxResults: 20, nextPageToken: 'previous-cursor' });
    const info = io.info.mock.calls.map(args => args[0]);
    expect(info).toContain('More issues are available.');
    expect(info).toContain(`Next page token: ${token}`);
    expect(info).toContain('Re-run the same command with --next-page-token \'tok\'\\\'\'en$(x)\' to see the next page.');
    expect(info.some(line => /total issues/.test(line))).toBe(false);
  });

  test('a last Cloud page prints no continuation hint', async () => {
    const client = { searchIssues: jest.fn().mockResolvedValue({ issues: [issue('SYN-1')], isLast: true }) };
    const io = makeIo();
    await crud.listIssues(client, io, { limit: '20' });
    expect(client.searchIssues).toHaveBeenCalledWith(expect.any(String), { maxResults: 20 });
    expect(io.info).not.toHaveBeenCalled();
  });

  test('an empty Cloud page that is not last still shows the continuation', async () => {
    const client = { searchIssues: jest.fn().mockResolvedValue({ issues: [], nextPageToken: 'next', isLast: false }) };
    const io = makeIo();
    await crud.listIssues(client, io, { limit: '20' });
    const info = io.info.mock.calls.map(args => args[0]);
    expect(info).toContain('No issues found');
    expect(info).toContain('Next page token: next');
  });

  test('v2 results keep the total message and add an offset hint', async () => {
    const client = {
      searchIssues: jest.fn().mockResolvedValue({ startAt: 20, maxResults: 2, total: 25, issues: [issue('DC-21'), issue('DC-22')] })
    };
    const io = makeIo();
    await crud.listIssues(client, io, { limit: '2', startAt: '20' });
    expect(client.searchIssues).toHaveBeenCalledWith(expect.any(String), { maxResults: 2, startAt: 20 });
    const info = io.info.mock.calls.map(args => args[0]);
    expect(info).toContain('Showing 2 of 25 total issues');
    expect(info).toContain('Re-run the same command with --start-at 22 to see the next page.');
  });

  test('rejects combining --next-page-token with --start-at, and invalid offsets', async () => {
    const client = { searchIssues: jest.fn() };
    await expect(crud.listIssues(client, makeIo(), { limit: '20', nextPageToken: 't', startAt: '5' }))
      .rejects.toThrow(/not both/);
    await expect(crud.listIssues(client, makeIo(), { limit: '20', startAt: '-1' }))
      .rejects.toThrow(/Invalid --start-at/);
    expect(client.searchIssues).not.toHaveBeenCalled();
  });
});

describe('getComments complete traversal', () => {
  function comments(from, count) {
    return Array.from({ length: count }, (_, i) => ({ id: String(10000 + from + i), body: `c${from + i}` }));
  }

  function pagedAdapter(total, cap = 100) {
    return jest.fn(config => {
      const { startAt, maxResults } = config.params;
      const size = Math.min(maxResults, cap, Math.max(total - startAt, 0));
      return ok(config, { startAt, maxResults: Math.min(maxResults, cap), total, comments: comments(startAt, size) });
    });
  }

  test('120 comments are fetched as 100 + 20 and returned in one page shape', async () => {
    const c = makeClient(3);
    c.clientV3.defaults.adapter = pagedAdapter(120);

    const result = await c.getComments('SYN-1');

    expect(c.clientV3.defaults.adapter).toHaveBeenCalledTimes(2);
    expect(paramsOf(c.clientV3.defaults.adapter, 0)).toEqual({ startAt: 0, maxResults: 100 });
    expect(paramsOf(c.clientV3.defaults.adapter, 1)).toEqual({ startAt: 100, maxResults: 100 });
    expect(result.comments).toHaveLength(120);
    expect(new Set(result.comments.map(x => x.id)).size).toBe(120);
    expect(result.comments[119].id).toBe('10119');
    expect(result).toMatchObject({ startAt: 0, maxResults: 120, total: 120 });
  });

  test('a server that caps the page size is followed by actual page length', async () => {
    const c = makeClient(3);
    c.clientV3.defaults.adapter = pagedAdapter(120, 50);
    const result = await c.getComments('SYN-1');
    expect(c.clientV3.defaults.adapter.mock.calls.map(call => call[0].params.startAt)).toEqual([0, 50, 100]);
    expect(result.comments).toHaveLength(120);
  });

  test('a repeated page (duplicate comment ids) is an explicit error', async () => {
    const c = makeClient(3);
    c.clientV3.defaults.adapter = jest.fn(config =>
      ok(config, { startAt: config.params.startAt, maxResults: 100, total: 120, comments: comments(0, 100) }));
    await expect(c.getComments('SYN-1')).rejects.toMatchObject({ code: 'JIRA_INCOMPLETE_COMMENTS' });
    expect(c.clientV3.defaults.adapter).toHaveBeenCalledTimes(2);
  });

  test('a server that ignores startAt is detected instead of looping', async () => {
    const c = makeClient(3);
    c.clientV3.defaults.adapter = jest.fn(config =>
      ok(config, { startAt: 0, maxResults: 100, total: 120, comments: comments(0, 100) }));
    await expect(c.getComments('SYN-1')).rejects.toThrow(/requested startAt=100 but received startAt=0/);
  });

  test('an empty page while comments remain is an explicit incomplete error', async () => {
    const c = makeClient(3);
    c.clientV3.defaults.adapter = jest.fn(config => config.params.startAt === 0
      ? ok(config, { startAt: 0, maxResults: 100, total: 120, comments: comments(0, 100) })
      : ok(config, { startAt: config.params.startAt, maxResults: 100, total: 120, comments: [] }));
    await expect(c.getComments('SYN-1')).rejects.toThrow(/empty page at startAt=100 while 20 of 120 comments remain/);
  });

  test('traversal is bounded by a page limit', async () => {
    const c = makeClient(3);
    c.clientV3.defaults.adapter = jest.fn(config =>
      ok(config, { startAt: config.params.startAt, maxResults: 1, total: 1e9, comments: comments(config.params.startAt, 1) }));
    await expect(c.getComments('SYN-1')).rejects.toThrow(/stopped after \d+ pages/);
    expect(c.clientV3.defaults.adapter.mock.calls.length).toBeLessThanOrEqual(1000);
  });

  test('comment list --format json still prints the plain comment array', async () => {
    const c = makeClient(3);
    c.clientV3.defaults.adapter = pagedAdapter(120);
    const io = makeIo();
    await commentCmd.listComments(c, io, 'SYN-1', { format: 'json' });
    const printed = JSON.parse(io.out.mock.calls[io.out.mock.calls.length - 1][0]);
    expect(Array.isArray(printed)).toBe(true);
    expect(printed).toHaveLength(120);
    expect(io.out.mock.calls[0][0]).toMatch(/120 total/);
  });
});
