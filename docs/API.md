# JIRA CLI API Documentation

This document describes the internal API structure of the JIRA CLI tool.

## Core Classes

### JiraClient

The main client for interacting with JIRA REST API.

#### Constructor

```javascript
const client = new JiraClient(config)
```

**Parameters:**
- `config` (Object): Configuration object containing server, username, token, and optional apiVersion (`auto`, `2`, `3`)

#### Methods

##### Issue Operations

- `getIssue(issueKey)` - Get issue by key
- `searchIssues(jql, options)` - Search issues using JQL
- `createIssue(issueData)` - Create new issue  
- `updateIssue(issueKey, updateData)` - Update existing issue
- `deleteIssue(issueKey)` - Delete issue

##### Project Operations

- `getProjects()` - Get all projects
- `getProject(projectKey)` - Get specific project

##### Sprint Operations

- `getSprints(boardId)` - Get sprints for board
- `getBoards()` - Get all boards

##### Utility Operations

- `testConnection()` - Test API connection
- `getIssueTypes()` - Get available issue types
- `getStatuses()` - Get available statuses
- `searchUsers(query)` - Search for users

### Config

Configuration management singleton.

#### Methods

- `get(key)` - Get configuration value
- `set(key, value)` - Set configuration value
- `isConfigured()` - Check if all required config is present
- `getRequiredConfig()` - Get config or throw error
- `createClient()` - Create JiraClient with current config
- `testConfig()` - Test current configuration
- `displayConfig()` - Display current config (safe)
- `interactiveSetup()` - Interactive configuration setup

### Analytics

Analytics and reporting functionality.

#### Methods

- `getProjectStats(projectKey, options)` - Get project statistics
- `getUserWorkload(username)` - Get user workload statistics
- `displayProjectStats(projectKey, stats)` - Display project stats
- `displayUserWorkload(username, stats)` - Display user workload

## Utility Functions

### utils.js

- `formatDate(dateString)` - Format date for display
- `formatIssueForTable(issue)` - Format issue for table
- `createIssuesTable(issues)` - Create formatted issue table
- `createProjectsTable(projects)` - Create formatted project table
- `createSprintsTable(sprints)` - Create formatted sprint table
- `displayIssueDetails(issue)` - Display detailed issue info
- `buildJQL(options)` - Build JQL query from options
- `success(message)` - Display success message
- `error(message)` - Display error message
- `warning(message)` - Display warning message
- `info(message)` - Display info message

## Command Structure

Commands are organized in the `bin/commands/` directory:

- `config.js` - Configuration management
- `issue.js` - Issue operations
- `project.js` - Project operations  
- `sprint.js` - Sprint operations

Each command module exports a function that handles the command logic.

## Error Handling

The CLI uses consistent error handling patterns:

1. **Authentication Errors (401)**: Clear message about credentials
2. **Permission Errors (403)**: Message about access rights  
3. **Not Found Errors (404)**: Resource not found message
4. **Network Errors**: Connection and server URL guidance
5. **General API Errors**: Formatted error messages from JIRA

## Configuration Storage

Configuration is stored using the `conf` package:

- **Location**: Platform-specific config directory
- **Format**: JSON
- **Schema**: Validated structure for server, username, token

## Dependencies

### Production Dependencies

- `axios` - HTTP client for API requests
- `commander` - Command line argument parsing
- `chalk` - Terminal string styling
- `ora` - Loading spinners
- `inquirer` - Interactive prompts
- `conf` - Configuration management
- `cli-table3` - Table formatting

### Development Dependencies

- `jest` - Testing framework
- `eslint` - Code linting

## Testing

Tests are located in the `tests/` directory and use Jest.

### Test Categories

1. **Unit Tests**: Core functionality testing
2. **Integration Tests**: Command integration testing
3. **Mock Tests**: API interaction testing

### Running Tests

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
```

## Project Structure

```
jira-cli/
├── bin/
│   ├── index.js              # CLI entry point
│   └── commands/             # Command implementations
│       ├── config.js
│       ├── issue.js
│       ├── project.js
│       └── sprint.js
├── lib/
│   ├── jira-client.js        # JIRA API client
│   ├── config.js             # Configuration management
│   ├── utils.js              # Utility functions
│   └── analytics.js          # Analytics functionality
├── tests/
│   ├── setup.js              # Test setup
│   └── jira-client.test.js   # Main test suite
├── examples/
│   └── README.md             # Usage examples
├── docs/
│   └── API.md                # This file
├── package.json
├── README.md
├── jest.config.js
├── .eslintrc.json
└── .gitignore
```

## Extension Points

The CLI is designed to be extensible:

1. **New Commands**: Add new command files in `bin/commands/`
2. **New Analytics**: Extend the Analytics class
3. **Custom Formatters**: Add utility functions for new output formats
4. **Additional APIs**: Extend JiraClient with new JIRA API endpoints

## Performance Considerations

1. **API Rate Limits**: Built-in delay handling
2. **Pagination**: Configurable result limits
3. **Caching**: Configuration caching via `conf`
4. **Error Recovery**: Graceful error handling and recovery
