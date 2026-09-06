const createProfileCommand = require('../../bin/commands/profile');
const createConfigCommand = require('../../bin/commands/config');

describe('ProfileCommand', () => {
  let mockFactory;
  let mockIOStreams;
  let mockConfig;
  let mockAnalytics;
  let profileCommand;
  let exitSpy;

  beforeEach(() => {
    mockIOStreams = {
      out: jest.fn(),
      success: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    };

    mockConfig = {
      listProfiles: jest.fn(),
      setActiveProfile: jest.fn(),
      deleteProfile: jest.fn(),
      isValidProfileName: jest.fn(name => /^[a-zA-Z0-9_-]+$/.test(name)),
      set: jest.fn(),
      isConfigured: jest.fn(),
      testConfig: jest.fn()
    };

    mockAnalytics = {
      track: jest.fn().mockResolvedValue()
    };

    mockFactory = {
      getIOStreams: jest.fn(() => mockIOStreams),
      getConfig: jest.fn(() => mockConfig),
      getAnalytics: jest.fn(() => mockAnalytics)
    };

    profileCommand = createProfileCommand(mockFactory);
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  describe('command structure', () => {
    it('should create a profile command with the four expected subcommands', () => {
      expect(profileCommand.name()).toBe('profile');
      const names = profileCommand.commands.map(c => c.name());
      expect(names).toEqual(expect.arrayContaining(['list', 'use', 'add', 'remove']));
    });

    it('should give profile add the same credential flags as jira config (excluding --show)', () => {
      const configCommand = createConfigCommand(mockFactory);
      const addCommand = profileCommand.commands.find(c => c.name() === 'add');

      const configFlags = configCommand.options.map(o => o.long).filter(f => f !== '--show').sort();
      const addFlags = addCommand.options.map(o => o.long).sort();
      expect(addFlags).toEqual(configFlags);
    });
  });

  describe('list', () => {
    it('should warn when no profiles are configured', async () => {
      mockConfig.listProfiles.mockReturnValue({ activeProfile: null, profiles: [] });

      await profileCommand.parseAsync(['node', 'test', 'list']);

      expect(mockIOStreams.warn).toHaveBeenCalledWith(expect.stringContaining('No profiles configured'));
    });

    it('should print each profile with an active marker', async () => {
      mockConfig.listProfiles.mockReturnValue({
        activeProfile: 'default',
        profiles: [
          { name: 'default', active: true, server: 'https://default.atlassian.net', authType: 'bearer' },
          { name: 'work', active: false, server: 'https://work.atlassian.net', authType: 'basic' }
        ]
      });

      await profileCommand.parseAsync(['node', 'test', 'list']);

      expect(mockIOStreams.out).toHaveBeenCalledWith(expect.stringContaining('default'));
      expect(mockIOStreams.out).toHaveBeenCalledWith(expect.stringContaining('(active)'));
      expect(mockIOStreams.out).toHaveBeenCalledWith(expect.stringContaining('work'));
    });
  });

  describe('use <name>', () => {
    it('should switch the active profile on success', async () => {
      await profileCommand.parseAsync(['node', 'test', 'use', 'work']);

      expect(mockConfig.setActiveProfile).toHaveBeenCalledWith('work');
      expect(mockIOStreams.success).toHaveBeenCalledWith(expect.stringContaining('work'));
    });

    it('should error and exit when the profile does not exist', async () => {
      mockConfig.setActiveProfile.mockImplementation(() => {
        throw new Error('Profile "doesnotexist" not found.');
      });

      await profileCommand.parseAsync(['node', 'test', 'use', 'doesnotexist']);

      expect(mockIOStreams.error).toHaveBeenCalledWith(expect.stringContaining('not found'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('add <name>', () => {
    it('should reject an invalid profile name without calling config.set', async () => {
      mockConfig.isValidProfileName.mockReturnValue(false);

      await profileCommand.parseAsync(['node', 'test', 'add', 'in valid', '--server', 'https://x.atlassian.net']);

      expect(mockIOStreams.error).toHaveBeenCalledWith(expect.stringContaining('Invalid profile name'));
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockConfig.set).not.toHaveBeenCalled();
    });

    it('should require at least one configuration option', async () => {
      await profileCommand.parseAsync(['node', 'test', 'add', 'work']);

      expect(mockIOStreams.error).toHaveBeenCalledWith(expect.stringContaining('At least one configuration option'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should forward provided flags to config.set scoped to the given profile name', async () => {
      mockConfig.isConfigured.mockReturnValue(false);

      await profileCommand.parseAsync(['node', 'test', 'add', 'work',
        '--server', 'https://work.atlassian.net',
        '--token', 'work-token'
      ]);

      expect(mockConfig.set).toHaveBeenCalledWith('server', 'https://work.atlassian.net', 'work');
      expect(mockConfig.set).toHaveBeenCalledWith('token', 'work-token', 'work');
    });

    it('should test the connection against the new profile when it is complete', async () => {
      mockConfig.isConfigured.mockReturnValue(true);
      mockConfig.testConfig.mockResolvedValue({ success: true, user: { displayName: 'Test User' } });

      await profileCommand.parseAsync(['node', 'test', 'add', 'work',
        '--server', 'https://work.atlassian.net',
        '--token', 'work-token'
      ]);

      expect(mockConfig.isConfigured).toHaveBeenCalledWith('work');
      expect(mockConfig.testConfig).toHaveBeenCalledWith('work');
      expect(mockIOStreams.success).toHaveBeenCalledWith('Connection successful!');
    });
  });

  describe('remove <name>', () => {
    it('should remove a profile on success', async () => {
      await profileCommand.parseAsync(['node', 'test', 'remove', 'work']);

      expect(mockConfig.deleteProfile).toHaveBeenCalledWith('work');
      expect(mockIOStreams.success).toHaveBeenCalledWith(expect.stringContaining('work'));
    });

    it('should error and exit when trying to remove the only remaining profile', async () => {
      mockConfig.deleteProfile.mockImplementation(() => {
        throw new Error('Cannot delete the only remaining profile.');
      });

      await profileCommand.parseAsync(['node', 'test', 'remove', 'default']);

      expect(mockIOStreams.error).toHaveBeenCalledWith('Cannot delete the only remaining profile.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
