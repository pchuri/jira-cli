#!/usr/bin/env node

/**
 * Main entry point for JIRA CLI
 * Inspired by gh CLI's structure and patterns
 */

const pkg = require('../package.json');
const Factory = require('../lib/factory');
const { createRootCommand } = require('./root');

async function main() {
  try {
    // Create factory for dependency injection
    const factory = new Factory();
    
    // Create root command with all subcommands
    const rootCmd = await createRootCommand(factory, pkg.version);
    
    // Parse command line arguments
    await rootCmd.parseAsync(process.argv);
    
    // Show help if no command provided
    if (!process.argv.slice(2).length) {
      rootCmd.outputHelp();
    }
  } catch (error) {
    const io = new (require('../lib/iostreams'))();
    io.printError(error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, _promise) => {
  const io = new (require('../lib/iostreams'))();
  io.printError(`Unhandled promise rejection: ${reason}`);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  const io = new (require('../lib/iostreams'))();
  io.printError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

// Run main function
main();