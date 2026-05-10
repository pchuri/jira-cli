const chalk = require('chalk');
const { createRemoteLinksTable } = require('../../../lib/utils');

function buildRemoteLinkPayload(options) {
  const payload = { object: {} };

  if (options.url) payload.object.url = options.url;
  if (options.title) payload.object.title = options.title;
  if (options.summary) payload.object.summary = options.summary;

  if (options.iconUrl || options.iconTitle) {
    payload.object.icon = {};
    if (options.iconUrl) payload.object.icon.url16x16 = options.iconUrl;
    if (options.iconTitle) payload.object.icon.title = options.iconTitle;
  }

  if (options.globalId) payload.globalId = options.globalId;
  if (options.relationship) payload.relationship = options.relationship;

  return payload;
}

function mergeRemoteLinkPayload(existing, options) {
  const base = { ...(existing || {}) };
  delete base.id;
  delete base.self;

  const payload = {
    ...base,
    object: { ...(base.object || {}) }
  };

  if (options.url) payload.object.url = options.url;
  if (options.title) payload.object.title = options.title;
  if (options.summary) payload.object.summary = options.summary;
  if (options.relationship) payload.relationship = options.relationship;

  if (options.iconUrl || options.iconTitle) {
    payload.object.icon = { ...(payload.object.icon || {}) };
    if (options.iconUrl) payload.object.icon.url16x16 = options.iconUrl;
    if (options.iconTitle) payload.object.icon.title = options.iconTitle;
  }

  return payload;
}

async function listRemoteLinks(client, io, issueKey, options = {}) {
  const spinner = io.spinner(`Fetching remote links for ${issueKey}...`);

  try {
    const links = await client.getRemoteLinks(issueKey, {
      globalId: options.globalId
    });
    spinner.stop();

    if (links.length === 0) {
      io.info(`No remote links found for ${issueKey}`);
      return;
    }

    io.out(chalk.bold(`\nRemote links for ${issueKey} (${links.length} total):\n`));

    if (options.format === 'json') {
      io.out(JSON.stringify(links, null, 2));
    } else {
      const table = createRemoteLinksTable(links);
      io.out(table.toString());
    }

  } catch (err) {
    spinner.stop();
    throw err;
  }
}

async function addRemoteLink(client, io, issueKey, options = {}) {
  if (!options.url || !options.title) {
    throw new Error(
      'Missing required options for adding a remote link.\n\n' +
      'Usage: jira issue remote-link add <KEY> --url <URL> --title <TITLE> [options]\n\n' +
      'Required options:\n' +
      '  --url <URL>              External resource URL\n' +
      '  --title <TITLE>          Link title\n\n' +
      'Optional:\n' +
      '  --global-id <ID>         Stable identifier for upsert behavior\n' +
      '  --relationship <REL>     Link relationship (e.g., "relates to")\n' +
      '  --summary <TEXT>         Summary shown under the title\n' +
      '  --icon-url <URL>         16x16 icon URL\n' +
      '  --icon-title <TITLE>     Icon alt text\n\n' +
      'Example:\n' +
      '  jira issue remote-link add PROJ-123 \\\n' +
      '      --url https://github.com/org/repo/pull/42 \\\n' +
      '      --title "org/repo#42" \\\n' +
      '      --global-id https://github.com/org/repo/pull/42'
    );
  }

  const payload = buildRemoteLinkPayload(options);

  const spinner = io.spinner(`Adding remote link to ${issueKey}...`);
  const result = await client.addRemoteLink(issueKey, payload);
  spinner.stop();

  io.success(`Remote link added to ${issueKey}`);
  if (result && result.id) {
    io.out(`Link ID: ${result.id}`);
  }
  if (result && result.self) {
    io.out(`URL: ${result.self}`);
  }
}

async function updateRemoteLink(client, io, issueKey, linkId, options = {}) {
  if (!options.url && !options.title && !options.summary &&
      !options.relationship && !options.iconUrl && !options.iconTitle) {
    throw new Error(
      'At least one field must be specified for update.\n\n' +
      'Usage: jira issue remote-link update <KEY> <LINK-ID> [options]\n\n' +
      'Available options:\n' +
      '  --url <URL>              New resource URL\n' +
      '  --title <TITLE>          New link title\n' +
      '  --relationship <REL>     New relationship\n' +
      '  --summary <TEXT>         New summary\n' +
      '  --icon-url <URL>         New icon URL\n' +
      '  --icon-title <TITLE>     New icon alt text\n\n' +
      'Example:\n' +
      '  jira issue remote-link update PROJ-123 12345 --title "Updated title"'
    );
  }

  const fetchSpinner = io.spinner(`Loading remote link ${linkId}...`);
  const existing = await client.getRemoteLink(issueKey, linkId);
  fetchSpinner.stop();

  const payload = mergeRemoteLinkPayload(existing, options);

  const spinner = io.spinner(`Updating remote link ${linkId}...`);
  await client.updateRemoteLink(issueKey, linkId, payload);
  spinner.stop();

  io.success(`Remote link ${linkId} updated successfully`);
}

async function deleteRemoteLink(client, io, issueKey, linkId, options = {}) {
  io.out(chalk.bold.red('\nWARNING: You are about to delete this remote link:'));
  io.out(`  Issue: ${chalk.cyan(issueKey)}`);
  io.out(`  Link ID: ${chalk.cyan(linkId)}\n`);

  if (!options.force) {
    throw new Error(
      'Deletion requires --force flag to confirm.\n' +
      `Use: jira issue remote-link delete ${issueKey} ${linkId} --force`
    );
  }

  const spinner = io.spinner('Deleting remote link...');
  await client.deleteRemoteLink(issueKey, linkId);
  spinner.stop();

  io.success(`Remote link ${linkId} deleted successfully`);
}

function register(parent, factory) {
  const remoteLinkCommand = parent
    .command('remote-link')
    .description('Manage issue remote links')
    .alias('rl');

  remoteLinkCommand
    .command('list <key>')
    .description('list remote links on an issue\n\n' +
      'Examples:\n' +
      '  $ jira issue remote-link list PROJ-123\n' +
      '  $ jira issue remote-link list PROJ-123 --format json\n' +
      '  $ jira issue remote-link list PROJ-123 --global-id https://example.com/resource')
    .option('--format <format>', 'output format (table, json)', 'table')
    .option('--global-id <id>', 'filter by globalId')
    .action(async (key, options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();

      try {
        await listRemoteLinks(client, io, key, options);
      } catch (err) {
        io.error(`Failed to list remote links: ${err.message}`);
        process.exit(1);
      }
    });

  remoteLinkCommand
    .command('add <key>')
    .description('add a remote link to an issue\n\n' +
      'Examples:\n' +
      '  $ jira issue remote-link add PROJ-123 \\\n' +
      '      --url https://github.com/org/repo/pull/42 \\\n' +
      '      --title "org/repo#42"\n' +
      '  $ jira issue remote-link add PROJ-123 \\\n' +
      '      --url https://github.com/org/repo/pull/42 \\\n' +
      '      --title "org/repo#42" \\\n' +
      '      --global-id https://github.com/org/repo/pull/42 \\\n' +
      '      --relationship "relates to"')
    .option('--url <url>', 'external resource URL (required)')
    .option('--title <title>', 'link title (required)')
    .option('--global-id <id>', 'stable identifier for upsert (recommended)')
    .option('--relationship <relationship>', 'link relationship (e.g., "relates to")')
    .option('--summary <summary>', 'optional summary shown under the title')
    .option('--icon-url <url>', 'optional 16x16 icon URL')
    .option('--icon-title <title>', 'optional icon alt text')
    .action(async (key, options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();

      try {
        await addRemoteLink(client, io, key, options);
      } catch (err) {
        io.error(`Failed to add remote link: ${err.message}`);
        process.exit(1);
      }
    });

  remoteLinkCommand
    .command('update <key> <linkId>')
    .description('update an existing remote link\n\n' +
      'Examples:\n' +
      '  $ jira issue remote-link update PROJ-123 12345 --title "Updated title"\n' +
      '  $ jira issue remote-link update PROJ-123 12345 --url https://example.com/new')
    .option('--url <url>', 'new resource URL')
    .option('--title <title>', 'new link title')
    .option('--relationship <relationship>', 'new relationship')
    .option('--summary <summary>', 'new summary')
    .option('--icon-url <url>', 'new icon URL')
    .option('--icon-title <title>', 'new icon alt text')
    .action(async (key, linkId, options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();

      try {
        await updateRemoteLink(client, io, key, linkId, options);
      } catch (err) {
        io.error(`Failed to update remote link: ${err.message}`);
        process.exit(1);
      }
    });

  remoteLinkCommand
    .command('delete <key> <linkId>')
    .description('delete a remote link\n\n' +
      'Examples:\n' +
      '  $ jira issue remote-link delete PROJ-123 12345 --force')
    .option('-f, --force', 'force delete without confirmation')
    .action(async (key, linkId, options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();

      try {
        await deleteRemoteLink(client, io, key, linkId, options);
      } catch (err) {
        io.error(`Failed to delete remote link: ${err.message}`);
        process.exit(1);
      }
    });
}

module.exports = {
  register,
  listRemoteLinks,
  addRemoteLink,
  updateRemoteLink,
  deleteRemoteLink,
  buildRemoteLinkPayload,
  mergeRemoteLinkPayload
};
