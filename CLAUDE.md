# JIRA CLI Project Guide

## Project Overview
Modern, extensible JIRA command-line interface built with Factory pattern and Commander.js. Provides full CRUD operations for issues, projects, and sprints with beautiful terminal UX.

## Architecture

### Design Patterns
- **Factory Pattern**: Command creation via `lib/factory.js`
- **Dependency Injection**: Services injected into commands
- **Commander.js**: CLI framework for command routing and parsing

### Project Structure
```
jira-cli/
├── bin/
│   ├── index.js              # CLI entry point
│   ├── root.js               # Root command setup
│   └── commands/             # Command implementations
│       ├── config.js         # Configuration management
│       ├── init.js           # Interactive setup
│       ├── issue.js          # Issue CRUD operations
│       ├── project.js        # Project operations
│       └── sprint.js         # Sprint management
├── lib/
│   ├── jira-client.js        # JIRA API client (axios)
│   ├── config.js             # Config management (conf package)
│   ├── factory.js            # Command factory
│   ├── iostreams.js          # I/O abstractions for testing
│   ├── utils.js              # Utility functions
│   └── analytics.js          # Usage analytics
└── tests/                    # Jest unit tests
```

### Key Dependencies
- **commander**: CLI framework
- **axios**: HTTP client for JIRA API
- **inquirer**: Interactive prompts
- **chalk**: Terminal colors
- **ora**: Spinners and progress indicators
- **cli-table3**: Formatted table output
- **conf**: Cross-platform config storage

## Development Guidelines

### Code Style
- JavaScript (CommonJS), not TypeScript
- Self-documenting code preferred over comments (per global CLAUDE.md)
- Use descriptive variable/function names
- Follow existing patterns in the codebase

### Adding New Commands
1. Create command file in `bin/commands/`
2. Implement command logic following existing patterns
3. Register command in `bin/root.js`
4. Add tests in `tests/commands/`
5. Update README.md with command documentation

### API Client Usage
- Use `lib/jira-client.js` for all JIRA API calls
- Handle authentication via config (API token + username)
- Implement proper error handling with user-friendly messages
- Use iostreams for output (supports testing and mocking)

### Configuration
- Config stored via `conf` package (platform-specific locations)
- Support both environment variables and interactive setup
- Environment variables: `JIRA_HOST`, `JIRA_API_TOKEN`, `JIRA_USERNAME`
- Legacy support: `JIRA_DOMAIN`, `JIRA_USERNAME`, `JIRA_API_TOKEN`

## Testing

### Running Tests
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Test Strategy
- Unit tests for all commands and lib functions
- Mock JIRA API calls using Jest mocks
- Use iostreams abstraction for CLI I/O testing
- Maintain high test coverage

### Writing Tests
- Place tests in `tests/` directory mirroring source structure
- Use descriptive test names
- Mock external dependencies (axios, inquirer)
- Test both success and error cases

## Release Process

### Conventional Commits (Required)
All commits must follow [Conventional Commits](https://www.conventionalcommits.org/) format:
- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `docs:` - Documentation only
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Build/tooling changes

### Automated Release
- Merge to `main` triggers semantic-release
- Version bumped automatically based on commit types
- Changelog generated from commit messages
- NPM publish automated via GitHub Actions

### Manual Release Fallback
See AGENTS.md for emergency release procedures if automation fails.

## Common Tasks

### Adding JIRA API Integration
1. Add method to `lib/jira-client.js`
2. Use axios for HTTP requests
3. Handle authentication headers automatically
4. Return meaningful error messages
5. Add unit tests with mocked responses

### Improving UX
- Use `chalk` for colored output
- Use `ora` for loading indicators
- Use `cli-table3` for tabular data
- Use `inquirer` for interactive prompts
- Provide clear error messages with actionable guidance

### Debugging
```bash
DEBUG=jira-cli* jira issue --list
JIRA_CLI_ANALYTICS=false jira config --show
```

## Important Notes

- JIRA API uses Bearer token authentication (API tokens, not passwords)
- Support both JIRA Cloud and JIRA Data Center APIs
- Handle rate limiting and network errors gracefully
- Respect user privacy (analytics opt-out via `JIRA_CLI_ANALYTICS=false`)
- Always test with real JIRA instance before releasing
