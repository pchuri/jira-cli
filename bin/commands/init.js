const { Command } = require('commander');

function createInitCommand(factory) {
  const command = new Command('init')
    .description('🚀 Initialize JIRA CLI configuration (run this first!)')
    .alias('setup')
    .addHelpText('after', `
Examples:
  $ jira init
  $ jira setup
    `)
    .action(async () => {
      const io = factory.getIOStreams();
      const config = factory.getConfig();
      const analytics = factory.getAnalytics();
      
      try {
        await analytics.track('init', { action: 'interactive_setup' });
        
        io.out.write('\n🚀 Welcome to JIRA CLI!\n\n');
        io.colorize('cyan', 'Let\'s get you set up with your JIRA connection...\n\n');
        
        await config.interactiveSetup();
        
        io.out.write('\n🎉 Setup complete!\n');
        io.out.write('\nYou can now start using JIRA CLI:\n');
        io.out.write('  • List issues: jira issue list\n');
        io.out.write('  • Get issue: jira issue view PROJ-123\n');
        io.out.write('  • Create issue: jira issue create\n');
        io.out.write('  • List projects: jira project list\n');
        io.out.write('  • Show help: jira --help\n\n');
        
      } catch (error) {
        io.colorize('red', `\n❌ Setup failed: ${error.message}\n`);
        io.out.write('\nYou can try again by running: jira init\n');
        io.out.write('Or configure manually: jira config\n');
        process.exit(1);
      }
    });

  return command;
}

module.exports = createInitCommand;
