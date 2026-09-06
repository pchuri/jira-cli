const { Command } = require('commander');
const { applyConfigOptions, hasAnyConfigOption } = require('../../lib/config-options');

function createProfileCommand(factory) {
  const command = new Command('profile')
    .description('Manage JIRA CLI configuration profiles');

  command
    .command('list')
    .description('list all configuration profiles')
    .action(async () => {
      const io = factory.getIOStreams();
      const config = factory.getConfig();
      const analytics = factory.getAnalytics();
      await analytics.track('profile', { action: 'list' });

      const { profiles } = config.listProfiles();
      if (profiles.length === 0) {
        io.warn('No profiles configured. Run "jira config --server <url> --token <token>" or "jira profile add <name> ..." to create one.');
        return;
      }

      io.out('Configuration profiles:\n');
      profiles.forEach(p => {
        const marker = p.active ? '*' : ' ';
        const activeLabel = p.active ? ' (active)' : '';
        io.out(`  ${marker} ${p.name}${activeLabel} - ${p.server || 'not configured'} [${p.authType}]`);
      });
    });

  command
    .command('use <name>')
    .description('set the active configuration profile')
    .action(async (name) => {
      const io = factory.getIOStreams();
      const config = factory.getConfig();
      const analytics = factory.getAnalytics();
      await analytics.track('profile', { action: 'use' });

      try {
        config.setActiveProfile(name);
        io.success(`Switched to profile "${name}"`);
      } catch (err) {
        io.error(err.message);
        process.exit(1);
      }
    });

  command
    .command('add <name>')
    .description('create or update a configuration profile (non-interactive)')
    .option('--server <url>', 'set JIRA server URL')
    .option('--username <username>', 'set username')
    .option('--token <token>', 'set API token')
    .option('--cloud-id <cloudId>', 'set Atlassian Cloud ID for scoped API tokens')
    .option('--auth-type <type>', 'authentication type (basic, bearer, or mtls)')
    .option('--tls-client-cert <path>', 'client certificate for mTLS authentication')
    .option('--tls-client-key <path>', 'client private key for mTLS authentication')
    .option('--tls-ca-cert <path>', 'CA certificate for mTLS authentication (optional)')
    .option('--api-version <version>', 'JIRA REST API version to use (auto, 2, or 3)')
    .option('--cookie <cookie>', 'raw session cookie sent alongside auth (for SSO-gated on-prem instances)')
    .action(async (name, options) => {
      const io = factory.getIOStreams();
      const config = factory.getConfig();
      const analytics = factory.getAnalytics();
      await analytics.track('profile', { action: 'add' });

      try {
        if (!config.isValidProfileName(name)) {
          throw new Error('Invalid profile name. Use only letters, numbers, hyphens, and underscores.');
        }
        if (!hasAnyConfigOption(options)) {
          throw new Error('At least one configuration option is required, e.g. --server <url> --token <token>.');
        }
        await applyConfigOptions(config, io, options, name);
      } catch (err) {
        io.error(`Failed to add profile: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('remove <name>')
    .description('remove a configuration profile')
    .action(async (name) => {
      const io = factory.getIOStreams();
      const config = factory.getConfig();
      const analytics = factory.getAnalytics();
      await analytics.track('profile', { action: 'remove' });

      try {
        config.deleteProfile(name);
        io.success(`Profile "${name}" removed.`);
      } catch (err) {
        io.error(err.message);
        process.exit(1);
      }
    });

  return command;
}

module.exports = createProfileCommand;
