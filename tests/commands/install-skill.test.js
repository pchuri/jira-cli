const fs = require('fs');
const os = require('os');
const path = require('path');
const createInstallSkillCommand = require('../../bin/commands/install-skill');

describe('InstallSkillCommand', () => {
  let mockFactory;
  let mockIOStreams;
  let installSkillCommand;
  let tmpDir;
  let cwd;
  let exitSpy;
  let mockAnalytics;

  beforeEach(() => {
    mockIOStreams = {
      out: jest.fn(),
      println: jest.fn(),
      printError: jest.fn(),
      printSuccess: jest.fn(),
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      colorize: jest.fn(),
      print: jest.fn(),
      printErr: jest.fn()
    };

    mockAnalytics = {
      track: jest.fn().mockResolvedValue()
    };

    mockFactory = {
      getIOStreams: jest.fn(() => mockIOStreams),
      getAnalytics: jest.fn(() => mockAnalytics)
    };

    installSkillCommand = createInstallSkillCommand(mockFactory);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jira-install-skill-'));
    cwd = process.cwd();
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  describe('command structure', () => {
    it('should create install-skill command', () => {
      expect(installSkillCommand.name()).toBe('install-skill');
      expect(installSkillCommand.description()).toContain('install the packaged Jira skill');
    });

    it('should define dest and force options', () => {
      const destOption = installSkillCommand.options.find((opt) => opt.long === '--dest');
      const forceOption = installSkillCommand.options.find((opt) => opt.long === '--force');

      expect(destOption).toBeDefined();
      expect(destOption.defaultValue).toBe('./.claude/skills/jira');
      expect(forceOption).toBeDefined();
      expect(forceOption.short).toBe('-f');
    });
  });

  describe('command execution', () => {
    it('should install the packaged skill into the default destination', async () => {
      process.chdir(tmpDir);

      await installSkillCommand.parseAsync(['node', 'jira']);

      const installedSkill = path.join(tmpDir, '.claude', 'skills', 'jira', 'SKILL.md');
      const resolvedInstalledSkill = fs.realpathSync(installedSkill);

      expect(fs.existsSync(installedSkill)).toBe(true);
      expect(fs.readFileSync(installedSkill, 'utf8')).toContain('# jira');
      expect(mockIOStreams.success).toHaveBeenCalledWith('Skill installed successfully');
      expect(mockIOStreams.info).toHaveBeenCalledWith(`Location: ${resolvedInstalledSkill}`);
      expect(mockAnalytics.track).toHaveBeenCalledWith('install-skill', { overwritten: false });
    });

    it('should install the packaged skill into a custom destination', async () => {
      const destination = path.join(tmpDir, 'custom-skill-dir');

      await installSkillCommand.parseAsync(['node', 'jira', '--dest', destination]);

      expect(fs.existsSync(path.join(destination, 'SKILL.md'))).toBe(true);
    });

    it('should error when the packaged skill file is missing', async () => {
      const sourceFile = path.join(
        __dirname,
        '..',
        '..',
        'skills',
        'jira',
        'SKILL.md'
      );
      const originalExistsSync = fs.existsSync;
      jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === sourceFile) {
          return false;
        }

        return originalExistsSync(filePath);
      });

      await installSkillCommand.parseAsync(['node', 'jira']);

      expect(mockIOStreams.error).toHaveBeenCalledWith(
        expect.stringContaining('packaged skill file not found')
      );
      expect(mockAnalytics.track).toHaveBeenCalledWith('install-skill', {
        overwritten: false,
        success: false
      });
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should error when the destination already exists without --force', async () => {
      const destination = path.join(tmpDir, 'existing-skill');
      fs.mkdirSync(destination, { recursive: true });
      fs.writeFileSync(path.join(destination, 'SKILL.md'), 'existing');

      await installSkillCommand.parseAsync(['node', 'jira', '--dest', destination]);

      expect(mockIOStreams.error).toHaveBeenCalledWith(
        expect.stringContaining('Re-run with --force to overwrite')
      );
      expect(mockAnalytics.track).toHaveBeenCalledWith('install-skill', {
        overwritten: false,
        success: false
      });
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf8')).toBe('existing');
    });

    it('should overwrite the destination when --force is provided', async () => {
      const destination = path.join(tmpDir, 'existing-skill');
      const destinationFile = path.join(destination, 'SKILL.md');
      fs.mkdirSync(destination, { recursive: true });
      fs.writeFileSync(destinationFile, 'existing');

      await installSkillCommand.parseAsync(['node', 'jira', '--dest', destination, '--force']);

      expect(fs.readFileSync(destinationFile, 'utf8')).toContain('# jira');
      expect(mockIOStreams.success).toHaveBeenCalledWith('Skill installed successfully');
      expect(mockAnalytics.track).toHaveBeenCalledWith('install-skill', { overwritten: true });
    });

    it('should expand ~/ in the destination path', async () => {
      const homeDir = path.join(tmpDir, 'home');
      jest.spyOn(os, 'homedir').mockReturnValue(homeDir);

      await installSkillCommand.parseAsync(['node', 'jira', '--dest', '~/skills/jira']);

      expect(fs.existsSync(path.join(homeDir, 'skills', 'jira', 'SKILL.md'))).toBe(true);
    });
  });
});
