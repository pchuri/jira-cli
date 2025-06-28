/**
 * Root command for JIRA CLI
 * Inspired by gh CLI's root command structure
 */

const { Command } = require('commander');

// Import command modules
const createConfigCommand = require('./commands/config');
const createInitCommand = require('./commands/init');
const createIssueCommand = require('./commands/issue');
const createProjectCommand = require('./commands/project');
const createSprintCommand = require('./commands/sprint');

/**
 * Create the root command with all subcommands
 * @param {Factory} factory - Dependency injection factory
 * @param {string} version - CLI version
 * @returns {Command} Root commander instance
 */
async function createRootCommand(factory, version) {
  const io = factory.getIOStreams();
  
  const program = new Command();
  
  program
    .name('jira')
    .description('Work seamlessly with JIRA from the command line')
    .version(version)
    .configureHelp({
      sortSubcommands: true,
      showGlobalOptions: true
    });

  // Add global options
  program
    .option('--config <path>', 'config file path')
    .option('--verbose', 'verbose output')
    .option('--no-color', 'disable color output');

  // Core commands group (alphabetically ordered for better UX)
  const coreCommands = [
    createConfigCommand(factory),
    createInitCommand(factory),  // Setup command - should be prominent
    createIssueCommand(factory),
    createProjectCommand(factory),
    createSprintCommand(factory)
  ];

  // Add all commands
  coreCommands.forEach(cmd => {
    program.addCommand(cmd);
  });

  // Custom help formatting
  program.configureOutput({
    writeOut: (str) => io.print(str),
    writeErr: (str) => io.printErr(str),
  });

  // Global error handler
  program.exitOverride((err) => {
    if (err.code === 'commander.helpDisplayed') {
      process.exit(0);
    }
    if (err.code === 'commander.version') {
      process.exit(0);
    }
    io.printError(err.message);
    process.exit(1);
  });

  // Add hook for global options
  program.hook('preAction', (_thisCommand, _actionCommand) => {
    // Handle global --verbose flag
    if (program.opts().verbose) {
      process.env.JIRA_CLI_VERBOSE = 'true';
    }
    
    // Handle global --no-color flag
    if (!program.opts().color) {
      process.env.NO_COLOR = 'true';
    }
    
    // Handle global --config flag
    if (program.opts().config) {
      process.env.JIRA_CLI_CONFIG_PATH = program.opts().config;
    }
  });

  return program;
}

module.exports = {
  createRootCommand
};
