# [2.3.0](https://github.com/pchuri/jira-cli/compare/v2.2.0...v2.3.0) (2025-12-29)


### Features

* add comment management commands ([#17](https://github.com/pchuri/jira-cli/issues/17)) ([822c733](https://github.com/pchuri/jira-cli/commit/822c73349f4b349a12d256b10d0217e95e9ce51d))

# [2.2.0](https://github.com/pchuri/jira-cli/compare/v2.1.2...v2.2.0) (2025-12-11)


### Features

* add markdown export support for issues ([#15](https://github.com/pchuri/jira-cli/issues/15)) ([9691ea5](https://github.com/pchuri/jira-cli/commit/9691ea5df66d7cb21ad2fe99e78fa9ee81916769))

## [2.1.2](https://github.com/pchuri/jira-cli/compare/v2.1.1...v2.1.2) (2025-12-10)


### Bug Fixes

* resolve option parsing conflict in issue subcommands ([#14](https://github.com/pchuri/jira-cli/issues/14)) ([efe6be8](https://github.com/pchuri/jira-cli/commit/efe6be867f4fcda181a156b7385c40bc1df7a136))

## [2.1.1](https://github.com/pchuri/jira-cli/compare/v2.1.0...v2.1.1) (2025-12-10)


### Bug Fixes

* handle currentUser assignee filter correctly in JQL ([#13](https://github.com/pchuri/jira-cli/issues/13)) ([91b1306](https://github.com/pchuri/jira-cli/commit/91b13061209fc4644f62c1fd43a3c3a78812a84c))

# [2.1.0](https://github.com/pchuri/jira-cli/compare/v2.0.0...v2.1.0) (2025-12-10)


### Features

* make username optional for Bearer token authentication ([#12](https://github.com/pchuri/jira-cli/issues/12)) ([d9762ad](https://github.com/pchuri/jira-cli/commit/d9762ad19804d50039a2d7f6a8a63d47f609bd81))

# [2.0.0](https://github.com/pchuri/jira-cli/compare/v1.1.1...v2.0.0) (2025-12-10)


* feat!: remove interactive mode for full automation support (#11) ([872a39c](https://github.com/pchuri/jira-cli/commit/872a39ccb49415c62d9c970eef0597c534a2a9e6)), closes [#11](https://github.com/pchuri/jira-cli/issues/11)


### BREAKING CHANGES

* Removed all interactive prompts and inquirer dependency.

- Remove 'jira init' command - use 'jira config' with explicit flags
- Issue create/edit now require all options via CLI flags
- Add --description-file option for multi-line descriptions
- Issue delete requires --force flag
- Sprint list requires --board when multiple boards exist
- Remove inquirer dependency

Migration guide added in MIGRATION.md.

This change makes the CLI fully scriptable for CI/CD pipelines.

## [1.1.1](https://github.com/pchuri/jira-cli/compare/v1.1.0...v1.1.1) (2025-11-18)


### Bug Fixes

* honor issue flags in non-interactive mode ([#8](https://github.com/pchuri/jira-cli/issues/8)) ([95aaf54](https://github.com/pchuri/jira-cli/commit/95aaf5407fcbc0b172a58424d1b2e434afcca51e))

# [1.1.0](https://github.com/pchuri/jira-cli/compare/v1.0.1...v1.1.0) (2025-10-21)


### Features

* support token-only authentication without username ([#7](https://github.com/pchuri/jira-cli/issues/7)) ([8e2589f](https://github.com/pchuri/jira-cli/commit/8e2589fe1cfe39dd89ab55446c926ff76142ab3d))

## [1.0.1](https://github.com/pchuri/jira-cli/compare/v1.0.0...v1.0.1) (2025-10-12)


### Bug Fixes

* trigger release after hotfix ([1bf5509](https://github.com/pchuri/jira-cli/commit/1bf5509304c06241d2be9ab2b3a55b19f7aa44f8))

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
