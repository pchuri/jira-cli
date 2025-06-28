# 1.0.0 (2025-06-28)


### Bug Fixes

* **ci:** add workflow permissions and make codecov optional ([056eeab](https://github.com/pchuri/jira-cli/commit/056eeab325c7c1c5e3be6acea5639abec0cf8e55))
* **release:** disable husky hooks for semantic-release ([8232ddc](https://github.com/pchuri/jira-cli/commit/8232ddc9ebf1431f7985ecaec018d74ea24d39e1))


### Features

* initial release of modern JIRA CLI ([90012a1](https://github.com/pchuri/jira-cli/commit/90012a133d67f25a0592109bcfafe78f4c0a1544))


### BREAKING CHANGES

* Initial release with new CLI architecture

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-06-29

### 🎉 Initial Release

#### ✨ Added
- **Modern CLI Architecture**: Built with Factory pattern and Commander.js for extensibility
- **Complete Issue Management**: Full CRUD operations for JIRA issues
- **Project & Sprint Management**: Comprehensive project information and sprint monitoring
- **Smart Configuration**: Interactive setup with `jira init` command
- **Multiple Auth Methods**: Support for API tokens and environment variables
- **Beautiful Interface**: Formatted tables, colored output, and progress indicators
- **Advanced Search**: Powerful filtering with JQL-like queries
- **Analytics & Reporting**: Project insights and team performance metrics
- **Robust Error Handling**: User-friendly error messages and guidance
- **Comprehensive Testing**: Full test suite with Jest
- **Developer Experience**: ESLint configuration, GitHub Actions CI/CD
- **Security First**: Secure credential handling and security audit integration

#### 🏗️ Architecture
- Factory pattern for dependency injection
- IOStreams utility for consistent input/output
- Commander.js subcommands for scalable CLI structure
- Modular command organization for easy maintenance

#### 📚 Documentation
- Complete README with examples and API documentation
- Contributing guidelines for open source collaboration
- Code of Conduct for community standards
- Security policy for responsible disclosure

#### 🔧 Developer Tools
- GitHub Issue templates for bug reports and feature requests
- Automated CI/CD pipeline with GitHub Actions
- Test coverage reporting and code quality checks
- NPM package ready for distribution
- CLI help system and documentation
- Unit tests with Jest
- ESLint code quality checks
- Support for multiple output formats (table, JSON)
- Filtering options for issues (project, assignee, status)
- Debug mode for troubleshooting

### Features
- 📋 Complete issue lifecycle management
- 📊 Project analytics and insights  
- 🏃 Sprint tracking and status monitoring
- ⚙️ Easy configuration with multiple setup options
- 🎨 Rich, colorful terminal output
- 🔍 Powerful search capabilities
- 📈 Usage analytics (with opt-out option)
- 🔧 Interactive prompts for complex operations

### Configuration
- Interactive setup: `jira init`
- Environment variables: `JIRA_DOMAIN`, `JIRA_USERNAME`, `JIRA_API_TOKEN`
- Command-line configuration: `jira config`
- Secure credential storage

### Commands Available
- `init` - Initialize CLI configuration
- `issue` - Manage JIRA issues (list, get, create, update, delete)
- `project` - View project information and statistics
- `sprint` - Monitor sprints and boards
- `config` - Manage configuration settings
- `search` - Search for issues with queries

### Technical Details
- Built with Node.js and modern JavaScript
- Uses Axios for HTTP requests to JIRA REST API
- Commander.js for CLI argument parsing
- Inquirer.js for interactive prompts
- Chalk for colored terminal output
- CLI-table3 for formatted tables
- Ora for loading spinners
- Conf for configuration management

### Documentation
- Comprehensive README with usage examples
- API documentation for developers
- Contributing guidelines
- Troubleshooting guide
- Example workflows and scripts
