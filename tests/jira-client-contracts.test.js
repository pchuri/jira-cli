const http = require('http');
const JiraClient = require('../lib/jira-client');

describe('Jira REST write contracts', () => {
  let server;
  let config;
  let requests;
  let reply;

  beforeEach(async () => {
    requests = [];
    reply = jest.fn(() => ({ status: 200, body: {} }));
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const request = { method: req.method, url: req.url, data: body ? JSON.parse(body) : undefined };
        requests.push(request);
        const response = reply(request);
        res.writeHead(response.status, response.headers || { 'Content-Type': 'application/json' });
        res.end(typeof response.body === 'string' ? response.body : JSON.stringify(response.body));
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    config = { server: `http://127.0.0.1:${server.address().port}` };
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  function createClient(apiVersion = 'auto') {
    const client = new JiraClient({ ...config, apiVersion });
    // These fixtures must use the local server even if the host has a proxy.
    client.clientV2.defaults.proxy = false;
    client.clientV3.defaults.proxy = false;
    return client;
  }

  const writes = [
    ['issue edit', 'PUT', '/issue/TEST-1', client => client.updateIssue('TEST-1', { fields: { summary: 'Updated' } })],
    ['issue delete', 'DELETE', '/issue/TEST-1', client => client.deleteIssue('TEST-1')],
    ['comment edit', 'PUT', '/issue/TEST-1/comment/10000', client => client.updateComment('TEST-1', '10000', 'Updated')],
    ['comment delete', 'DELETE', '/issue/TEST-1/comment/10000', client => client.deleteComment('TEST-1', '10000')],
    ['remote link edit', 'PUT', '/issue/TEST-1/remotelink/10000', client => client.updateRemoteLink('TEST-1', '10000', { object: { title: 'Updated' } })],
    ['remote link delete', 'DELETE', '/issue/TEST-1/remotelink/10000', client => client.deleteRemoteLink('TEST-1', '10000')]
  ];

  describe.each([2, 3])('auto mode currently using v%i', version => {
    test.each(writes)('%s sends exactly one request after a real HTTP 204', async (_name, method, path, write) => {
      const client = createClient();
      client.apiVersion = version;
      // Axios decodes HTTP 204 as data: ''. A misleading Content-Type must
      // not turn this completed mutation into a second request to another API.
      reply.mockReturnValue({ status: 204, headers: { 'Content-Type': 'text/html' }, body: '' });

      await write(client);

      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ method, url: `/rest/api/${version}${path}` });
      expect(client.apiVersion).toBe(version);
    });
  });

  test.each([200, 201, 202, 205])('empty HTTP %i success does not replay a write', async status => {
    const client = createClient();
    reply.mockReturnValue({ status, body: '' });

    const response = await client.requestApi('post', '/issue', { fields: { summary: 'New' } });

    expect(response.status).toBe(status);
    expect(response.data).toBe('');
    expect(requests).toHaveLength(1);
    expect(client.apiVersion).toBe(3);
  });

  const issueWrites = [
    ['create', 'POST', '/issue', (client, data) => client.createIssue(data)],
    ['update', 'PUT', '/issue/TEST-1', (client, data) => client.updateIssue('TEST-1', data)]
  ];

  const description = 'First line\nSecond line\n\nNext paragraph';
  const adf = {
    type: 'doc', version: 1, content: [
      { type: 'paragraph', content: [
        { type: 'text', text: 'First line' },
        { type: 'hardBreak' },
        { type: 'text', text: 'Second line' }
      ] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Next paragraph' }] }
    ]
  };

  describe.each(issueWrites)('issue %s description', (_name, method, path, write) => {
    test.each([2, 3])('uses the pinned v%i representation without mutating input', async version => {
      const client = createClient(version);
      const fields = Object.freeze({ summary: 'Example', description });
      const data = Object.freeze({ fields });

      await write(client, data);

      expect(requests).toEqual([{
        method, url: `/rest/api/${version}${path}`,
        data: { fields: { summary: 'Example', description: version === 3 ? adf : description } }
      }]);
      expect(data.fields).toBe(fields);
      expect(data.fields.description).toBe(description);
    });

    test.each([2, 3])('rebuilds the payload when auto falls back from v%i', async version => {
      const client = createClient();
      client.apiVersion = version;
      const data = { fields: { description } };
      const fallback = version === 3 ? 2 : 3;
      reply.mockReturnValueOnce({ status: 404, body: { errorMessages: ['Endpoint not found'] } })
        .mockReturnValueOnce({ status: method === 'PUT' ? 204 : 201, body: method === 'PUT' ? '' : { key: 'TEST-1' } });

      await write(client, data);

      expect(requests).toEqual([version, fallback].map(apiVersion => ({
        method, url: `/rest/api/${apiVersion}${path}`,
        data: { fields: { description: apiVersion === 3 ? adf : description } }
      })));
      expect(client.apiVersion).toBe(fallback);
      expect(data.fields.description).toBe(description);
    });

    test('retains HTML fallback and rebuilds the v2 description', async () => {
      const client = createClient();
      reply.mockReturnValueOnce({ status: 200, headers: { 'Content-Type': 'text/html' }, body: '<html>Unsupported API</html>' });

      await write(client, { fields: { description } });

      expect(requests).toHaveLength(2);
      expect(requests[0].data.fields.description).toEqual(adf);
      expect(requests[1]).toEqual({ method, url: `/rest/api/2${path}`, data: { fields: { description } } });
      expect(client.apiVersion).toBe(2);
    });

    test.each([null, adf])('passes through null or pre-built ADF', async value => {
      const client = createClient(3);
      await write(client, { fields: { description: value } });
      expect(requests[0].data.fields.description).toEqual(value);
    });

    test('does not add an omitted description', async () => {
      await write(createClient(), { fields: { summary: 'Example' } });
      expect(requests[0].data).toEqual({ fields: { summary: 'Example' } });
    });

    test('encodes an empty description without an invalid empty text node', async () => {
      await write(createClient(), { fields: { description: '' } });
      expect(requests[0].data.fields.description).toEqual({
        type: 'doc', version: 1, content: [{ type: 'paragraph' }]
      });
    });

    test('does not fall back on unrelated validation errors', async () => {
      reply.mockReturnValue({ status: 400, body: { errors: { summary: 'Summary is required' } } });
      await expect(write(createClient(), { fields: { description } })).rejects.toMatchObject({ status: 400 });
      expect(requests).toHaveLength(1);
    });

    test('does not fall back when pinned to v3', async () => {
      reply.mockReturnValue({ status: 404, body: { errorMessages: ['Not found'] } });
      await expect(write(createClient(3), { fields: { description } })).rejects.toMatchObject({ status: 404 });
      expect(requests).toHaveLength(1);
    });
  });

  test.each([2, 3])('comment edit uses an issue-scoped route and the v%i body', async version => {
    const client = createClient(version);
    await client.updateComment('TEST-1', '10000', description);
    expect(requests).toEqual([{
      method: 'PUT', url: `/rest/api/${version}/issue/TEST-1/comment/10000`,
      data: { body: version === 3 ? adf : description }
    }]);
  });

  test('comment edit preserves the scoped route while rebuilding its fallback body', async () => {
    const client = createClient();
    reply.mockReturnValueOnce({ status: 404, body: { errorMessages: ['Not found'] } });
    await client.updateComment('TEST-1', '10000', description);
    expect(requests.map(request => request.url)).toEqual([
      '/rest/api/3/issue/TEST-1/comment/10000', '/rest/api/2/issue/TEST-1/comment/10000'
    ]);
    expect(requests[0].data.body).toEqual(adf);
    expect(requests[1].data.body).toBe(description);
  });

  test('rejects old comment-ID-only calls before making a request', async () => {
    const client = createClient();
    await expect(client.updateComment('10000', 'Updated text')).rejects.toThrow('Issue key');
    await expect(client.deleteComment('10000')).rejects.toThrow('Issue key');
    expect(requests).toHaveLength(0);
  });
});
