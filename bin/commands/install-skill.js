const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { expandHomePath } = require('../../lib/utils');

function createInstallSkillCommand(factory) {
  return new Command('install-skill')
    .description('install the packaged Jira skill into the current project')
    .option('--dest <directory>', 'target directory', './.claude/skills/jira')
    .option('-f, --force', 'overwrite existing skill file without prompting')
    .action((options) => {
      const io = factory.getIOStreams();
      const analytics = factory.getAnalytics();
      const sourceFile = path.join(__dirname, '..', '..', 'skills', 'jira', 'SKILL.md');
      const destinationDir = path.resolve(expandHomePath(options.dest));
      const destinationFile = path.join(destinationDir, 'SKILL.md');

      try {
        if (!fs.existsSync(sourceFile)) {
          throw new Error('packaged skill file not found in this installation');
        }

        if (fs.existsSync(destinationFile) && !options.force) {
          throw new Error(`skill file already exists at ${destinationFile}. Re-run with --force to overwrite.`);
        }

        fs.mkdirSync(destinationDir, { recursive: true });
        fs.copyFileSync(sourceFile, destinationFile);

        io.success('Skill installed successfully');
        io.info(`Location: ${destinationFile}`);
        analytics.track('install-skill', { overwritten: Boolean(options.force) });
      } catch (err) {
        analytics.track('install-skill', { overwritten: Boolean(options.force), success: false });
        io.error(`Failed to install skill: ${err.message}`);
        process.exit(1);
      }
    });
}

module.exports = createInstallSkillCommand;
