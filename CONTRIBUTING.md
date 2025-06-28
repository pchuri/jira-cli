# Contributing to JIRA CLI

We love your input! We want to make contributing to JIRA CLI as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## Pull Requests

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any Contributions You Make Will Be Under the ISC Software License

In short, when you submit code changes, your submissions are understood to be under the same [ISC License](https://choosealicense.com/licenses/isc/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report Bugs Using GitHub Issues

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/pchuri/jira-cli/issues).

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Feature Requests

We use GitHub issues to track feature requests as well. You can [create a feature request](https://github.com/pchuri/jira-cli/issues/new) by opening a new issue and using the feature request template.

## Coding Style

* We use ESLint for JavaScript style consistency
* 2 spaces for indentation
* Single quotes for strings
* Follow the existing code style in the project

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) specification for our commit messages. This leads to **automatic versioning and changelog generation**.

### Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature (bumps minor version)
- **fix**: A bug fix (bumps patch version)
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools
- **ci**: Changes to CI configuration files and scripts

### Breaking Changes

For breaking changes, add `BREAKING CHANGE:` in the footer or add `!` after the type:

```
feat!: remove deprecated command options

BREAKING CHANGE: The --legacy flag has been removed
```

### Examples

```
feat(auth): add OAuth2 authentication support
fix(cli): resolve issue parsing empty project names
docs: update installation instructions
test(client): add tests for error handling
chore(deps): update axios to v1.6.0
```

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Run linting: `npm run lint`

## Testing

* Write tests for new features
* Ensure all tests pass before submitting a PR
* We use Jest for testing

## Documentation

* Update README.md if you change functionality
* Add JSDoc comments for new functions
* Update API documentation in docs/ if needed

## Code Review Process

The core team looks at Pull Requests on a regular basis. We may suggest changes, improvements or alternatives.

## Community

* Be respectful and considerate
* Follow our [Code of Conduct](CODE_OF_CONDUCT.md)
* Help others in discussions and issues

## Getting Help

* Check existing issues and documentation first
* Open a [discussion](https://github.com/pchuri/jira-cli/discussions) for questions
* Reach out to maintainers if needed

Thank you for contributing! 🎉
