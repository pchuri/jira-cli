const { Command } = require('commander');
const { 
  createIssuesTable, 
  displayIssueDetails, 
  buildJQL 
} = require('../../lib/utils');
const chalk = require('chalk');
const inquirer = require('inquirer');

function createIssueCommand(factory) {
  const command = new Command('issue')
    .description('Manage JIRA issues')
    .alias('i')
    .option('-l, --list', 'list issues')
    .option('-c, --create', 'create a new issue')
    .option('-g, --get <key>', 'get issue by key')
    .option('-u, --update <key>', 'update issue by key')
    .option('-d, --delete <key>', 'delete issue by key')
    .option('--project <project>', 'filter by project')
    .option('--assignee <assignee>', 'filter by assignee')
    .option('--status <status>', 'filter by status')
    .option('--type <type>', 'filter by issue type')
    .option('--limit <limit>', 'limit number of results', '20')
    .action(async (options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();
      const analytics = factory.getAnalytics();

      try {
        await analytics.track('issue', { action: getIssueAction(options) });

        if (options.create) {
          await createIssue(client, io, factory);
        } else if (options.get) {
          await getIssue(client, io, options.get);
        } else if (options.update) {
          await updateIssue(client, io, options.update);
        } else if (options.delete) {
          await deleteIssue(client, io, options.delete);
        } else {
          // Default to list issues
          await listIssues(client, io, options);
        }

      } catch (err) {
        io.error(`Issue command failed: ${err.message}`);
        process.exit(1);
      }
    });

  // Add subcommands
  command
    .command('list')
    .description('list issues with advanced filtering\n\n' +
      'Examples:\n' +
      '  $ jira issue list                              # List recent issues\n' +
      '  $ jira issue list --assignee=currentUser      # Your assigned issues\n' +
      '  $ jira issue list --status=Open --limit=50    # Open issues (max 50)\n' +
      '  $ jira issue list --project=TEST --type=Bug   # Bugs in TEST project')
    .alias('ls')
    .option('--project <project>', 'filter by project key')
    .option('--assignee <assignee>', 'filter by assignee (use "currentUser" for yourself)')
    .option('--status <status>', 'filter by status (e.g., Open, In Progress)')
    .option('--type <type>', 'filter by issue type (e.g., Bug, Story)')
    .option('--reporter <reporter>', 'filter by reporter')
    .option('--priority <priority>', 'filter by priority (e.g., High, Medium)')
    .option('--created <date>', 'created date filter (e.g., -7d, 2023-01-01)')
    .option('--updated <date>', 'updated date filter')
    .option('--limit <limit>', 'limit number of results (default: 20)', '20')
    .option('--jql <query>', 'custom JQL query for advanced filtering')
    .action(async (options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();
      
      try {
        await listIssues(client, io, options);
      } catch (err) {
        io.error(`Failed to list issues: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('view <key>')
    .description('view issue details')
    .alias('show')
    .action(async (key) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();
      
      try {
        await getIssue(client, io, key);
      } catch (err) {
        io.error(`Failed to get issue: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('create')
    .description('create a new issue\n\n' +
      'Examples:\n' +
      '  $ jira issue create                                    # Interactive mode\n' +
      '  $ jira issue create --project=TEST --type=Bug \\\n' +
      '                      --summary="Login fails on Safari"\n' +
      '  $ jira issue create --project=PROJ --type=Story \\\n' +
      '                      --summary="Add user profile page" \\\n' +
      '                      --description="Users need a profile page to manage settings" \\\n' +
      '                      --assignee=john.doe --priority=High')
    .alias('new')
    .option('--project <project>', 'project key (e.g., TEST, PROJ)')
    .option('--type <type>', 'issue type (e.g., Bug, Story, Task)')
    .option('--summary <summary>', 'issue summary (required)')
    .option('--description <description>', 'issue description (optional)')
    .option('--assignee <assignee>', 'assignee username')
    .option('--priority <priority>', 'priority (e.g., High, Medium, Low)')
    .action(async (options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();
      
      try {
        await createIssue(client, io, factory, options);
      } catch (err) {
        io.error(`Failed to create issue: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('edit <key>')
    .description('edit issue')
    .alias('update')
    .option('--summary <summary>', 'new summary')
    .option('--description <description>', 'new description')
    .option('--assignee <assignee>', 'new assignee')
    .option('--priority <priority>', 'new priority')
    .action(async (key, options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();
      
      try {
        await updateIssue(client, io, key, options);
      } catch (err) {
        io.error(`Failed to update issue: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('delete <key>')
    .description('delete issue')
    .alias('rm')
    .option('-f, --force', 'force delete without confirmation')
    .action(async (key, options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();
      
      try {
        await deleteIssue(client, io, key, options);
      } catch (err) {
        io.error(`Failed to delete issue: ${err.message}`);
        process.exit(1);
      }
    });

  return command;
}

async function listIssues(client, io, options) {
  const spinner = io.spinner('Fetching issues...');
  
  try {
    const jql = buildJQL(options);
    const limit = parseInt(options.limit) || 20;
    const result = await client.searchIssues(jql, {
      maxResults: limit
    });

    spinner.stop();

    if (result.issues.length === 0) {
      io.info('No issues found');
      return;
    }

    io.out(chalk.bold(`\nFound ${result.issues.length} issues (showing ${Math.min(result.issues.length, limit)}):\n`));
    
    const table = createIssuesTable(result.issues);
    io.out(table.toString());

    if (result.total > result.issues.length) {
      io.info(`Showing ${result.issues.length} of ${result.total} total issues`);
    }

  } catch (err) {
    spinner.stop();
    throw err;
  }
}

async function getIssue(client, io, issueKey) {
  const spinner = io.spinner(`Fetching issue ${issueKey}...`);
  
  try {
    const issue = await client.getIssue(issueKey);
    spinner.stop();
    
    displayIssueDetails(issue);

  } catch (err) {
    spinner.stop();
    throw err;
  }
}

async function createIssue(client, io, factory, options = {}) {
  const config = factory.getConfig();
  
  // If options provided, use them directly
  if (options.project && options.type && options.summary) {
    const issueData = {
      fields: {
        project: { key: options.project },
        issuetype: { name: options.type },
        summary: options.summary,
        description: options.description || ''
      }
    };

    if (options.assignee) {
      issueData.fields.assignee = { name: options.assignee };
    }

    if (options.priority) {
      issueData.fields.priority = { name: options.priority };
    }

    const spinner = io.spinner('Creating issue...');
    const result = await client.createIssue(issueData);
    spinner.stop();

    io.success(`Issue created: ${result.key}`);
    io.out(`URL: ${config.get('server')}/browse/${result.key}`);
    return;
  }

  // Interactive form
  const spinner = io.spinner('Loading form data...');
  
  const [projects, issueTypes] = await Promise.all([
    client.getProjects(),
    client.getIssueTypes()
  ]);
  
  spinner.stop();

  const questions = [
    {
      type: 'list',
      name: 'project',
      message: 'Select project:',
      choices: projects.map(p => ({ name: `${p.key} - ${p.name}`, value: p.key }))
    },
    {
      type: 'list',
      name: 'issueType',
      message: 'Select issue type:',
      choices: issueTypes.map(t => ({ name: t.name, value: t.id }))
    },
    {
      type: 'input',
      name: 'summary',
      message: 'Issue summary:',
      validate: input => input ? true : 'Summary is required'
    },
    {
      type: 'editor',
      name: 'description',
      message: 'Issue description (optional):'
    }
  ];

  const answers = await inquirer.prompt(questions);

  const issueData = {
    fields: {
      project: { key: answers.project },
      issuetype: { id: answers.issueType },
      summary: answers.summary,
      description: answers.description || ''
    }
  };

  const createSpinner = io.spinner('Creating issue...');
  const result = await client.createIssue(issueData);
  createSpinner.stop();

  io.success(`Issue created: ${result.key}`);
  io.out(`URL: ${config.get('server')}/browse/${result.key}`);
}

async function updateIssue(client, io, issueKey, options = {}) {
  // Get current issue
  const spinner = io.spinner(`Loading issue ${issueKey}...`);
  const issue = await client.getIssue(issueKey);
  spinner.stop();

  io.out(chalk.bold(`\nUpdating issue: ${issue.key}`));
  io.out(`Current summary: ${issue.fields.summary}\n`);

  const updateData = { fields: {} };
  let hasChanges = false;

  // If options provided, use them directly
  if (options.summary || options.description || options.assignee || options.priority) {
    if (options.summary && options.summary !== issue.fields.summary) {
      updateData.fields.summary = options.summary;
      hasChanges = true;
    }

    if (options.description && options.description !== (issue.fields.description || '')) {
      updateData.fields.description = options.description;
      hasChanges = true;
    }

    if (options.assignee) {
      updateData.fields.assignee = { name: options.assignee };
      hasChanges = true;
    }

    if (options.priority) {
      updateData.fields.priority = { name: options.priority };
      hasChanges = true;
    }
  } else {
    // Interactive update
    const questions = [
      {
        type: 'input',
        name: 'summary',
        message: 'New summary (leave empty to keep current):',
        default: issue.fields.summary
      },
      {
        type: 'editor',
        name: 'description',
        message: 'New description (leave empty to keep current):',
        default: issue.fields.description || ''
      }
    ];

    const answers = await inquirer.prompt(questions);

    if (answers.summary && answers.summary !== issue.fields.summary) {
      updateData.fields.summary = answers.summary;
      hasChanges = true;
    }

    if (answers.description && answers.description !== (issue.fields.description || '')) {
      updateData.fields.description = answers.description;
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    io.info('No changes made');
    return;
  }

  const updateSpinner = io.spinner('Updating issue...');
  await client.updateIssue(issueKey, updateData);
  updateSpinner.stop();

  io.success(`Issue ${issueKey} updated successfully`);
}

async function deleteIssue(client, io, issueKey, options = {}) {
  // Get issue details first
  const spinner = io.spinner(`Loading issue ${issueKey}...`);
  const issue = await client.getIssue(issueKey);
  spinner.stop();

  io.out(chalk.bold(`\nIssue to delete: ${issue.key}`));
  io.out(`Summary: ${issue.fields.summary}\n`);

  let confirmed = options.force;

  if (!confirmed) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('Are you sure you want to delete this issue? This action cannot be undone.'),
        default: false
      }
    ]);
    confirmed = confirm;
  }

  if (!confirmed) {
    io.info('Delete cancelled');
    return;
  }

  const deleteSpinner = io.spinner('Deleting issue...');
  await client.deleteIssue(issueKey);
  deleteSpinner.stop();

  io.success(`Issue ${issueKey} deleted successfully`);
}

function getIssueAction(options) {
  if (options.create) return 'create';
  if (options.get) return 'get';
  if (options.update) return 'update';
  if (options.delete) return 'delete';
  return 'list';
}

module.exports = createIssueCommand;
