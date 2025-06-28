const IOStreams = require('../lib/iostreams');

describe('IOStreams', () => {
  let iostreams;
  let mockStdout;
  let mockStderr;
  let mockStdin;

  beforeEach(() => {
    mockStdout = {
      write: jest.fn(),
      isTTY: true
    };
    mockStderr = {
      write: jest.fn(),
      isTTY: true
    };
    mockStdin = {
      isTTY: true
    };
  });

  describe('constructor', () => {
    it('should create IOStreams with default streams', () => {
      iostreams = new IOStreams();
      
      expect(iostreams.stdin).toBeDefined();
      expect(iostreams.stdout).toBeDefined();
      expect(iostreams.stderr).toBeDefined();
    });

    it('should use custom streams when provided', () => {
      iostreams = new IOStreams(mockStdin, mockStdout, mockStderr);
      
      expect(iostreams.stdout).toBe(mockStdout);
      expect(iostreams.stderr).toBe(mockStderr);
      expect(iostreams.stdin).toBe(mockStdin);
    });
  });

  describe('TTY detection methods', () => {
    beforeEach(() => {
      iostreams = new IOStreams(mockStdin, mockStdout, mockStderr);
    });

    it('should detect if can prompt', () => {
      const result = iostreams.canPrompt();
      expect(result).toBe(true);
    });

    it('should detect if stdout is TTY', () => {
      const result = iostreams.isStdoutTTY();
      expect(result).toBe(true);
    });

    it('should detect if stderr is TTY', () => {
      const result = iostreams.isStderrTTY();
      expect(result).toBe(true);
    });

    it('should return false for canPrompt when no TTY', () => {
      mockStdin.isTTY = false;
      const result = iostreams.canPrompt();
      expect(result).toBe(false);
    });
  });

  describe('basic output methods', () => {
    beforeEach(() => {
      iostreams = new IOStreams(mockStdin, mockStdout, mockStderr);
    });

    it('should print to stdout', () => {
      iostreams.print('test message');
      
      expect(mockStdout.write).toHaveBeenCalledWith('test message');
    });

    it('should print line to stdout with newline', () => {
      iostreams.println('test message');
      
      expect(mockStdout.write).toHaveBeenCalledWith('test message\n');
    });

    it('should print to stderr', () => {
      iostreams.printErr('error message');
      
      expect(mockStderr.write).toHaveBeenCalledWith('error message');
    });

    it('should print line to stderr with newline', () => {
      iostreams.printErrln('error message');
      
      expect(mockStderr.write).toHaveBeenCalledWith('error message\n');
    });
  });

  describe('styled output methods', () => {
    beforeEach(() => {
      iostreams = new IOStreams(mockStdin, mockStdout, mockStderr);
    });

    it('should print success message with styling when TTY', () => {
      iostreams.printSuccess('Success!');
      
      expect(mockStdout.write).toHaveBeenCalled();
      const call = mockStdout.write.mock.calls[0][0];
      expect(call).toContain('Success!');
      expect(call).toContain('✓');
    });

    it('should print error message with styling when TTY', () => {
      iostreams.printError('Error!');
      
      expect(mockStderr.write).toHaveBeenCalled();
      const call = mockStderr.write.mock.calls[0][0];
      expect(call).toContain('Error!');
      expect(call).toContain('✗');
    });

    it('should print warning message with styling when TTY', () => {
      iostreams.printWarning('Warning!');
      
      expect(mockStderr.write).toHaveBeenCalled();
      const call = mockStderr.write.mock.calls[0][0];
      expect(call).toContain('Warning!');
      expect(call).toContain('⚠');
    });

    it('should print info message with styling when TTY', () => {
      iostreams.printInfo('Info!');
      
      expect(mockStdout.write).toHaveBeenCalled();
      const call = mockStdout.write.mock.calls[0][0];
      expect(call).toContain('Info!');
      expect(call).toContain('ℹ');
    });

    it('should print plain messages when not TTY', () => {
      mockStdout.isTTY = false;
      iostreams.printSuccess('Success!');
      
      expect(mockStdout.write).toHaveBeenCalledWith('Success!\n');
    });
  });

  describe('color scheme', () => {
    beforeEach(() => {
      iostreams = new IOStreams(mockStdin, mockStdout, mockStderr);
    });

    it('should provide color scheme object', () => {
      const colors = iostreams.getColorScheme();
      
      expect(colors).toBeDefined();
      expect(typeof colors.primary).toBe('function');
      expect(typeof colors.secondary).toBe('function');
      expect(typeof colors.success).toBe('function');
      expect(typeof colors.error).toBe('function');
      expect(typeof colors.warning).toBe('function');
      expect(typeof colors.info).toBe('function');
      expect(typeof colors.bold).toBe('function');
      expect(typeof colors.dim).toBe('function');
    });
  });

  describe('table formatting', () => {
    beforeEach(() => {
      iostreams = new IOStreams(mockStdin, mockStdout, mockStderr);
    });

    it('should format table with headers and rows', () => {
      const headers = ['Name', 'Age'];
      const rows = [['John', '30'], ['Jane', '25']];
      
      const result = iostreams.formatTable(headers, rows);
      
      expect(result).toContain('Name');
      expect(result).toContain('Age');
      expect(result).toContain('John');
      expect(result).toContain('Jane');
    });

    it('should return empty string for empty data', () => {
      const result = iostreams.formatTable([], []);
      
      expect(result).toBe('');
    });

    it('should handle null or undefined input', () => {
      const result = iostreams.formatTable(null, null);
      
      expect(result).toBe('');
    });
  });
});
