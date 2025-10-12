/**
 * IOStreams - handles input/output streams and formatting
 * Inspired by gh CLI's iostreams package
 */

const chalk = require('chalk');

class IOStreams {
  constructor(stdin = process.stdin, stdout = process.stdout, stderr = process.stderr) {
    this.stdin = stdin;
    this.stdout = stdout;
    this.stderr = stderr;

    this.out = {
      println: (message = '') => this.println(message),
      write: (message) => this.print(message)
    };

    this.err = {
      println: (message = '') => this.printErr(message),
      write: (message) => this.printErr(message)
    };
  }

  /**
   * Check if we can prompt the user (TTY available)
   * @returns {boolean}
   */
  canPrompt() {
    return this.stdin.isTTY && this.stdout.isTTY;
  }

  /**
   * Check if stdout is a TTY
   * @returns {boolean}
   */
  isStdoutTTY() {
    return this.stdout.isTTY;
  }

  /**
   * Check if stderr is a TTY
   * @returns {boolean}
   */
  isStderrTTY() {
    return this.stderr.isTTY;
  }

  /**
   * Print to stdout
   * @param {string} message 
   */
  print(message) {
    this.stdout.write(message);
  }

  /**
   * Print line to stdout
   * @param {string} message 
   */
  println(message = '') {
    this.stdout.write(message + '\n');
  }

  /**
   * Print to stderr
   * @param {string} message 
   */
  printErr(message) {
    this.stderr.write(message);
  }

  /**
   * Print line to stderr
   * @param {string} message 
   */
  printErrln(message = '') {
    this.stderr.write(message + '\n');
  }

  /**
   * Print success message
   * @param {string} message 
   */
  printSuccess(message) {
    if (this.isStdoutTTY()) {
      this.println(chalk.green('✓ ' + message));
    } else {
      this.println(message);
    }
  }

  /**
   * Print error message
   * @param {string} message 
   */
  printError(message) {
    if (this.isStderrTTY()) {
      this.printErrln(chalk.red('✗ ' + message));
    } else {
      this.printErrln(message);
    }
  }

  /**
   * Print warning message
   * @param {string} message 
   */
  printWarning(message) {
    if (this.isStderrTTY()) {
      this.printErrln(chalk.yellow('⚠ ' + message));
    } else {
      this.printErrln(message);
    }
  }

  /**
   * Print info message
   * @param {string} message 
   */
  printInfo(message) {
    if (this.isStdoutTTY()) {
      this.println(chalk.blue('ℹ ' + message));
    } else {
      this.println(message);
    }
  }

  /**
   * Get color scheme for styling
   * @returns {Object}
   */
  getColorScheme() {
    return {
      primary: chalk.blue,
      secondary: chalk.gray,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.blue,
      bold: chalk.bold,
      dim: chalk.dim
    };
  }

  /**
   * Create a table formatter
   * @param {Array} headers 
   * @param {Array} rows 
   * @returns {string}
   */
  formatTable(headers, rows) {
    if (!headers || !rows || rows.length === 0) {
      return '';
    }

    const colors = this.getColorScheme();
    
    // Calculate column widths
    const widths = headers.map((header, i) => {
      const maxRowWidth = Math.max(...rows.map(row => String(row[i] || '').length));
      return Math.max(header.length, maxRowWidth);
    });

    // Format header
    const headerRow = headers.map((header, i) => 
      colors.bold(header.padEnd(widths[i]))
    ).join('  ');

    // Format separator
    const separator = widths.map(w => '-'.repeat(w)).join('  ');

    // Format rows
    const dataRows = rows.map(row => 
      row.map((cell, i) => String(cell || '').padEnd(widths[i])).join('  ')
    );

    return [headerRow, separator, ...dataRows].join('\n');
  }

  /**
   * Print a table
   * @param {Array} headers 
   * @param {Array} rows 
   */
  printTable(headers, rows) {
    const table = this.formatTable(headers, rows);
    if (table) {
      this.println(table);
    }
  }

  /**
   * Print error message (alias for printError)
   * @param {string} message 
   */
  error(message) {
    this.printError(message);
  }

  /**
   * Print success message (alias for printSuccess)
   * @param {string} message 
   */
  success(message) {
    this.printSuccess(message);
  }

  /**
   * Print warning message (alias for printWarning)
   * @param {string} message
   */
  warn(message) {
    this.printWarning(message);
  }

  /**
   * Print info message (alias for printInfo)
   * @param {string} message
   */
  info(message) {
    this.printInfo(message);
  }

  /**
   * Colorize text
   * @param {string} color - Color name
   * @param {string} text - Text to colorize
   */
  colorize(color, text) {
    if (this.isStdoutTTY()) {
      const colors = this.getColorScheme();
      if (colors[color]) {
        this.print(colors[color](text));
      } else if (chalk[color]) {
        this.print(chalk[color](text));
      } else {
        this.print(text);
      }
    } else {
      this.print(text);
    }
  }

  /**
   * Create a simple spinner (placeholder implementation)
   * @param {string} message - Spinner message
   * @returns {Object} Spinner object
   */
  spinner(message = 'Loading...') {
    let interval;
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    const spinner = {
      start: () => {
        if (this.isStderrTTY()) {
          process.stderr.write('\x1B[?25l'); // Hide cursor
          interval = setInterval(() => {
            process.stderr.write(`\r${spinnerChars[i]} ${message}`);
            i = (i + 1) % spinnerChars.length;
          }, 100);
        }
      },
      stop: () => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
        if (this.isStderrTTY()) {
          process.stderr.write('\r\x1B[K'); // Clear line
          process.stderr.write('\x1B[?25h'); // Show cursor
        }
      },
      succeed: (text) => {
        spinner.stop();
        if (text) {
          this.printSuccess(text);
        }
      },
      fail: (text) => {
        spinner.stop();
        if (text) {
          this.printError(text);
        }
      }
    };
    
    return spinner;
  }
}

module.exports = IOStreams;
