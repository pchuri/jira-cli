# JIRA CLI

A modern, extensible command-line interface for Atlassian JIRA built with Factory pattern and Commander.js. Manage your issues, projects, and sprints directly from the terminal with a beautiful, user-friendly interface.

## ✨ Features

- 📋 **Issue Management**: Create, read, update, and delete JIRA issues with full CRUD operations
- 📊 **Project Information**: View project details, statistics, and team insights
- 🏃 **Sprint Management**: Monitor sprint progress, burndown charts, and team velocity
- ⚙️ **Smart Configuration**: Environment variables and CLI options for flexible setup
- 📈 **Advanced Analytics**: Get insights into project health, user workload, and performance metrics
- 🤖 **Automation-Friendly**: Fully scriptable, non-interactive mode for CI/CD pipelines
- 🎨 **Beautiful Output**: Formatted tables, colored output, and progress indicators
- 🔍 **Powerful Search**: Filter issues with JQL-like queries and advanced search options
- 🏗️ **Modern Architecture**: Factory pattern, dependency injection, and extensible command structure
- 🛡️ **Secure**: Support for API tokens, environment variables, and secure credential storage

## 🚀 Quick Start

### Installation

```bash
# Install globally via npm
npm install -g @pchuri/jira-cli

# Or use npx (no installation required)
npx @pchuri/jira-cli

# Or install locally for development
git clone https://github.com/pchuri/jira-cli.git
cd jira-cli
npm install
npm link
```

### Setup

1. **Configure using CLI options:**
   ```bash
   jira config --server https://your-jira-instance.atlassian.net \
               --username your-email@company.com \
               --token your-api-token
   ```

2. **Or use environment variables:**
   ```bash
   export JIRA_HOST=your-jira-instance.atlassian.net
   export JIRA_API_TOKEN=your-api-token
   export JIRA_USERNAME=your-email@company.com    # optional, for user-specific actions
   ```

3. **Verify connection:**
   ```bash
   jira config --show
   jira issue view PROJ-123
   ```

4. **Create a new issue:**
   ```bash
   jira issue create --project PROJ --type Bug --summary "Login fails"
   ```

5. **View project information:**
   ```bash
   jira project list
   ```

## Configuration

### Option 1: Command Line Configuration

```bash
# Set all values at once
jira config --server https://yourcompany.atlassian.net \
            --username your-email@company.com \
            --token your-api-token

# Or set individual values
jira config set server https://yourcompany.atlassian.net
jira config set username your-email@company.com
jira config set token your-api-token

# Show current configuration
jira config --show
```

### Option 2: Environment Variables

You can configure the CLI using environment variables in either a new or legacy format:

#### New format (JIRA_HOST)
```bash
export JIRA_HOST="your-jira-instance.atlassian.net"
export JIRA_API_TOKEN="your-api-token"
export JIRA_USERNAME="your-email@company.com"    # optional when using JIRA_HOST
```

#### Legacy format (JIRA_DOMAIN)
```bash
export JIRA_DOMAIN="your-domain.atlassian.net"
export JIRA_USERNAME="your-email@company.com"
export JIRA_API_TOKEN="your-api-token"
```

### Getting Your API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label (e.g., "jira-cli")
4. Copy the generated token

## Usage

### Read an Issue

```bash
# Read by issue key
jira issue --get PROJ-123

# Get issue with full details
jira issue --get PROJ-123 --verbose

# Get issue in JSON format
jira issue --get PROJ-123 --format json
```

### List Issues

```bash
# List all recent issues
jira issue --list

# Filter by project
jira issue --list --project PROJ

# Filter by assignee
jira issue --list --assignee john.doe

# Filter by status
jira issue --list --status "In Progress"

# Combine filters
jira issue --list --project PROJ --assignee john.doe --status "To Do"
```

### Create a New Issue

```bash
# Create with required flags
jira issue create --project PROJ --type Bug --summary "Bug in login"

# With description
jira issue create --project PROJ --type Bug --summary "Bug in login" --description "User cannot login"

# With description from file
jira issue create --project PROJ --type Story --summary "Add feature" --description-file ./feature-spec.md

# With all options
jira issue create --project PROJ --type Bug --summary "Critical bug" \
                  --description "Details here" \
                  --assignee john.doe --priority High
```

### Update an Existing Issue

```bash
# Update summary
jira issue edit PROJ-123 --summary "Updated summary"

# Update specific fields
jira issue edit PROJ-123 --assignee john.doe --priority High

# Update description
jira issue edit PROJ-123 --description "Updated description"

# Update description from file
jira issue edit PROJ-123 --description-file ./updated-spec.md
```

### Search Issues

```bash
# Search issues with JQL filtering
jira issue list --jql "login bug"

jira issue list --jql "project = PROJ AND status = 'In Progress'"

# Limit results
jira issue list --jql "bug" --limit 5
```

### Project Management

```bash
# List all projects
jira project list

# View project details
jira project view PROJ
```

### Sprint Management

```bash
# List available boards first
jira sprint boards

# List sprints for specific board (required when multiple boards exist)
jira sprint list --board 123

# Show only active sprints
jira sprint active --board 123

# Filter by state
jira sprint list --board 123 --state active
```

## Commands

| Command | Description | Options |
|---------|-------------|---------|
| `config --server <url> --username <email> --token <token>` | Configure CLI | All three options required, or use `config set` |
| `config --show` | Show current configuration | - |
| `config set <key> <value>` | Set individual config value | - |
| `issue get <key>` | Get issue details | `--format <json\|table>`, `--verbose` |
| `issue list` | List issues | `--project <key>`, `--assignee <user>`, `--status <status>`, `--jql <query>`, `--limit <number>` |
| `issue create` | Create new issue | **Required:** `--project <key>`, `--type <type>`, `--summary <text>`<br>**Optional:** `--description <text>`, `--description-file <path>`, `--assignee <user>`, `--priority <level>` |
| `issue edit <key>` | Edit an existing issue (alias: update) | **At least one required:**<br>`--summary <text>`, `--description <text>`, `--description-file <path>`, `--assignee <user>`, `--priority <level>` |
| `issue delete <key>` | Delete issue | **Required:** `--force` |
| `project list` | List all projects | `--type <type>`, `--category <category>` |
| `project view <key>` | View project details | - |
| `project components <key>` | List project components | - |
| `project versions <key>` | List project versions | - |
| `sprint list` | List sprints | `--board <id>` (required when multiple boards), `--state <state>`, `--active` |
| `sprint active` | List active sprints | `--board <id>` (required when multiple boards) |
| `sprint boards` | List available boards | - |

## Configuration File

Configuration is stored using the `conf` package in your system's config directory:

- **macOS**: `~/Library/Preferences/jira-cli/config.json`
- **Linux**: `~/.config/jira-cli/config.json`
- **Windows**: `%APPDATA%\jira-cli\config.json`

## Examples

```bash
# Setup
jira config --server https://jira.company.com \
            --username user@company.com \
            --token your-api-token

# Read an issue
jira issue view PROJ-123

# Read an issue with full details
jira issue view PROJ-123 --verbose

# Get issue in JSON format
jira issue view PROJ-123 --format json

# List issues with filters
jira issue list --project PROJ --status "In Progress" --limit 10

# Create new issue
jira issue create --project PROJ --type Bug --summary "Login fails"

# Create issue with description file
jira issue create --project PROJ --type Story \
                  --summary "Add feature" \
                  --description-file ./feature-spec.md

# Update issue
jira issue edit PROJ-123 --summary "Updated summary"

# Delete issue (requires --force)
jira issue delete PROJ-123 --force

# List all projects
jira project list

# Show available boards
jira sprint boards

# Show active sprints
jira sprint active --board 123
```

## Development

```bash
# Clone the repository
git clone https://github.com/pchuri/jira-cli.git
cd jira-cli

# Install dependencies
npm install

# Run locally
npm start -- --help

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure

```
jira-cli/
├── bin/
│   ├── index.js              # Main CLI entry point
│   └── commands/             # Command implementations
│       ├── config.js         # Configuration management
│       ├── issue.js          # Issue operations
│       ├── project.js        # Project operations
│       └── sprint.js         # Sprint operations
├── lib/
│   ├── jira-client.js        # JIRA API client
│   ├── config.js             # Configuration management
│   ├── utils.js              # Utility functions
│   └── analytics.js          # Analytics and reporting
├── tests/
│   └── jira-client.test.js   # Unit tests
├── docs/                     # Documentation
├── examples/                 # Usage examples
└── package.json
```

## Error Handling

The CLI provides clear error messages for common issues:

- **Authentication failures**: Check your credentials with `jira config --show`
- **Network errors**: Verify your server URL and connection
- **Permission errors**: Ensure your account has the necessary permissions
- **Invalid issue keys**: Double-check the issue key format (PROJ-123)

## Troubleshooting

### Common Issues

1. **"JIRA CLI is not configured"**
   - Run `jira config --server <url> --username <email> --token <token>` to set up your connection
   - Or set environment variables (JIRA_HOST, JIRA_API_TOKEN, JIRA_USERNAME)

2. **"Authentication failed"**
   - Verify your username and API token with `jira config --show`
   - Make sure you're using an API token, not your password
   - Check if your token has expired

3. **"Network error"**
   - Check your server URL format: `https://yourcompany.atlassian.net`
   - Ensure you can access JIRA from your network
   - Try with `curl` to test connectivity

4. **"Resource not found"**
   - Verify the issue key or project key exists
   - Check if you have permission to access the resource
   - Use `jira search` to find the correct issue key

### Debug Mode

Set the `DEBUG` environment variable to get more detailed output:

```bash
DEBUG=jira-cli* jira issue --list
```

Or disable analytics:

```bash
export JIRA_CLI_ANALYTICS=false
```

## Contributing

We use [Conventional Commits](https://www.conventionalcommits.org/) and [Semantic Release](https://semantic-release.gitbook.io/) for automated versioning and changelog generation.

### Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following our coding standards
4. Write tests for new functionality
5. Commit your changes using conventional commit format:
   ```bash
   # Examples:
   git commit -m "feat: add issue filtering by labels"
   git commit -m "fix: resolve authentication timeout issue"  
   git commit -m "docs: update installation instructions"
   ```
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

**Examples**:
- `feat(auth): add OAuth2 support`
- `fix(cli): handle empty project names correctly`
- `docs: update README with new examples`
- `test: add unit tests for issue creation`

### Automated Releases

- **Push to `main`**: Triggers automated release based on commit types
- **Breaking changes**: Use `feat!:` or `BREAKING CHANGE:` in footer
- **Versioning**: Automatically determined by semantic-release
- **Changelog**: Generated from conventional commits
- **NPM publish**: Automated via GitHub Actions

Read our full [Contributing Guide](CONTRIBUTING.md) for detailed guidelines.

## License

This project is licensed under the ISC License - see the [LICENSE](https://github.com/pchuri/jira-cli/blob/main/LICENSE) file for details.

## Roadmap

- [x] Basic issue management (create, read, update, delete)
- [x] Project and sprint management
- [x] Configuration management
- [x] Non-interactive, automation-friendly CLI
- [x] Analytics and reporting
- [ ] Issue templates
- [ ] Bulk operations
- [ ] Export issues to different formats
- [ ] Integration with other Atlassian tools
- [ ] Issue attachments management
- [ ] Comments and workflows
- [ ] Custom fields support
- [ ] Time tracking

## Support & Feedback

### 💬 We'd love to hear from you!

Your feedback helps make jira-cli better for everyone. Here's how you can share your thoughts:

#### 🐛 Found a bug?

1. Check the [Issues](https://github.com/pchuri/jira-cli/issues) page
2. Create a new [bug report](https://github.com/pchuri/jira-cli/issues/new?template=bug_report.md)

#### 💡 Have a feature idea?

1. Create a [feature request](https://github.com/pchuri/jira-cli/issues/new?template=feature_request.md)
2. Join our [Discussions](https://github.com/pchuri/jira-cli/discussions) to chat with the community

#### 📝 General feedback?

- Share your experience with a [feedback issue](https://github.com/pchuri/jira-cli/issues/new?template=feedback.md)
- Rate us on [NPM](https://www.npmjs.com/package/@pchuri/jira-cli)
- Star the repo if you find it useful! ⭐

#### 🤝 Want to contribute?

Check out our [Contributing Guide](https://github.com/pchuri/jira-cli/blob/main/CONTRIBUTING.md) - all contributions are welcome!

### 📈 Usage Analytics

To help us understand how jira-cli is being used and improve it, we collect anonymous usage statistics. This includes:

- Command usage frequency (no personal data)
- Error patterns (to fix bugs faster)  
- Feature adoption metrics

You can opt-out anytime by setting: `export JIRA_CLI_ANALYTICS=false`

---

Made with ❤️ for the JIRA community
