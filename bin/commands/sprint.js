const { Command } = require('commander');
const { createSprintsTable } = require('../../lib/utils');
const chalk = require('chalk');

function createSprintCommand(factory) {
  const command = new Command('sprint')
    .description('Manage JIRA sprints')
    .alias('s')
    .option('-b, --board <id>', 'board ID to list sprints for')
    .option('-a, --active', 'show only active sprints')
    .action(async (options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();
      const analytics = factory.getAnalytics();

      try {
        await analytics.track('sprint', { action: 'list', activeOnly: options.active });

        if (options.board) {
          await listSprintsByBoard(client, io, options.board, options.active);
        } else {
          await listSprints(client, io, options.active);
        }

      } catch (err) {
        io.error(`Sprint command failed: ${err.message}`);
        process.exit(1);
      }
    });

  // Add subcommands
  command
    .command('list')
    .description('list sprints')
    .alias('ls')
    .option('-b, --board <id>', 'board ID to list sprints for')
    .option('-a, --active', 'show only active sprints')
    .option('--state <state>', 'filter by state (active, future, closed)')
    .action(async (options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();
      
      try {
        if (options.board) {
          await listSprintsByBoard(client, io, options.board, options.active, null, options.state);
        } else {
          await listSprints(client, io, options.active, options.state);
        }
      } catch (err) {
        io.error(`Failed to list sprints: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('active')
    .description('list active sprints')
    .option('-b, --board <id>', 'board ID to list sprints for')
    .action(async (options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();
      
      try {
        if (options.board) {
          await listSprintsByBoard(client, io, options.board, true);
        } else {
          await listSprints(client, io, true);
        }
      } catch (err) {
        io.error(`Failed to list active sprints: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('boards')
    .description('list available boards')
    .action(async () => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();
      
      try {
        await listBoards(client, io);
      } catch (err) {
        io.error(`Failed to list boards: ${err.message}`);
        process.exit(1);
      }
    });

  return command;
}

async function listSprints(client, io, activeOnly = false, stateFilter = null) {
  const spinner = io.spinner('Fetching boards and sprints...');
  
  try {
    // First get boards
    const boardsResult = await client.getBoards();
    
    if (boardsResult.values.length === 0) {
      spinner.stop();
      io.info('No boards found');
      return;
    }

    // If only one board, use it automatically
    let selectedBoard;
    if (boardsResult.values.length === 1) {
      selectedBoard = boardsResult.values[0];
      await listSprintsByBoard(client, io, selectedBoard.id, activeOnly, selectedBoard.name, stateFilter);
      spinner.stop();
    } else {
      // Multiple boards found - require explicit board selection
      spinner.stop();

      io.out(chalk.bold('\nMultiple boards found:\n'));
      boardsResult.values.forEach(board => {
        io.out(`  ${chalk.cyan(board.id.toString().padEnd(6))} ${board.name} (${board.type})`);
      });
      io.out('\n' + chalk.yellow('Please specify a board using --board <ID>'));
      io.out('Example: jira sprint list --board ' + boardsResult.values[0].id + '\n');

      throw new Error('Board ID required when multiple boards exist');
    }

  } catch (err) {
    spinner.stop();
    throw err;
  }
}

async function listSprintsByBoard(client, io, boardId, activeOnly = false, boardName = null, stateFilter = null) {
  const spinner = io.spinner(`Fetching sprints${boardName ? ` for ${boardName}` : ''}...`);
  
  try {
    const result = await client.getSprints(boardId);
    spinner.stop();

    let sprints = result.values;
    
    if (activeOnly) {
      sprints = sprints.filter(sprint => sprint.state === 'ACTIVE');
    }

    if (stateFilter) {
      sprints = sprints.filter(sprint => 
        sprint.state.toLowerCase() === stateFilter.toLowerCase()
      );
    }

    if (sprints.length === 0) {
      const filterText = activeOnly ? 'active sprints' : 
        stateFilter ? `${stateFilter} sprints` : 'sprints';
      io.info(`No ${filterText} found`);
      return;
    }

    const statusText = activeOnly ? 'active sprints' : 
      stateFilter ? `${stateFilter} sprints` : 'sprints';
    io.out(chalk.bold(`\nFound ${sprints.length} ${statusText}${boardName ? ` for ${boardName}` : ''}:\n`));
    
    const table = createSprintsTable(sprints);
    io.out(table.toString());

    // Show summary by state
    if (!activeOnly && !stateFilter) {
      const summary = sprints.reduce((acc, sprint) => {
        acc[sprint.state] = (acc[sprint.state] || 0) + 1;
        return acc;
      }, {});

      io.out(chalk.bold('\nSprint Summary:'));
      Object.entries(summary).forEach(([state, count]) => {
        const color = state === 'ACTIVE' ? 'green' : 
          state === 'FUTURE' ? 'yellow' : 'gray';
        io.out(`  ${chalk[color](state)}: ${count}`);
      });
    }

  } catch (err) {
    spinner.stop();
    throw err;
  }
}

async function listBoards(client, io) {
  const spinner = io.spinner('Fetching boards...');
  
  try {
    const result = await client.getBoards();
    spinner.stop();

    if (result.values.length === 0) {
      io.info('No boards found');
      return;
    }

    io.out(chalk.bold(`\nFound ${result.values.length} boards:\n`));
    
    result.values.forEach(board => {
      io.out(`${chalk.cyan('•')} ${chalk.bold(board.name)} (${board.type})`);
      io.out(`  ${chalk.gray('ID:')} ${board.id}`);
      if (board.location && board.location.displayName) {
        io.out(`  ${chalk.gray('Project:')} ${board.location.displayName}`);
      }
      io.out('');
    });

  } catch (err) {
    spinner.stop();
    throw err;
  }
}

module.exports = createSprintCommand;
