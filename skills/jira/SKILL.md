---
name: jira
description: Use jira-cli to configure Jira access and manage issues, comments, remote links, projects, and sprints from the terminal.
argument-hint: <issue key, project key, sprint id, board id, or task description>
allowed-tools: [Bash, Read, Write, Glob, Grep]
---

# jira-cli Skill

A CLI tool for Atlassian Jira. Lets you configure authentication, inspect issues and projects, create and update issues, manage comments and remote links, inspect sprint state, and install this skill into a project.

## Installation

```sh
npm install -g @pchuri/jira-cli
jira --version
```

## Configuration

`jira-cli` is intentionally non-interactive. Prefer explicit flags or environment variables.

### Environment variables

| Variable | Description | Example |
|---|---|---|
| `JIRA_HOST` | Jira hostname or full URL | `your-site.atlassian.net` |
| `JIRA_DOMAIN` | Legacy hostname variable | `your-site.atlassian.net` |
| `JIRA_API_TOKEN` | API token or PAT | `ATATT3x...` |
| `JIRA_USERNAME` | Email/username for Basic auth or scoped cloud tokens | `user@example.com` |
| `JIRA_CLOUD_ID` | Atlassian Cloud ID for scoped tokens | `abcd-1234-...` |
| `JIRA_AUTH_TYPE` | `basic`, `bearer`, or `mtls` | `bearer` |
| `JIRA_TLS_CLIENT_CERT` | mTLS client certificate path | `~/.certs/client.pem` |
| `JIRA_TLS_CLIENT_KEY` | mTLS client key path | `~/.certs/client.key` |
| `JIRA_TLS_CA_CERT` | Optional CA certificate path | `~/.certs/ca.pem` |
| `JIRA_API_VERSION` | API version behavior: `auto`, `2`, or `3` | `auto` |

### CLI configuration

Bearer auth:

```sh
jira config --server https://your-site.atlassian.net --token <token>
```

Basic auth:

```sh
jira config --server https://your-site.atlassian.net --username user@example.com --token <token>
```

Scoped cloud token:

```sh
jira config --server https://your-site.atlassian.net --username user@example.com --token <token> --cloud-id <cloudId>
```

mTLS:

```sh
jira config --server https://jira.example.com --auth-type mtls --tls-client-cert ~/.certs/client.pem --tls-client-key ~/.certs/client.key --tls-ca-cert ~/.certs/ca.pem
```

Show current configuration:

```sh
jira config --show
```

### Global options

These apply at the root level:

```sh
jira [--config <path>] [--verbose] [--no-color] <command>
```

| Option | Description |
|---|---|
| `--config <path>` | Use a specific config file path |
| `--verbose` | Enable verbose output |
| `--no-color` | Disable ANSI color output |

## CLI conventions

- The CLI is non-interactive.
- Provide explicit flags instead of expecting prompts.
- Use `--force` for destructive or overwrite-style operations.
- Use `--description-file` for multiline issue content.
- Use `--file` where supported for multiline comment or payload input.
- If a command errors, prefer surfacing the exact follow-up command the user should run.

## Commands Reference

### `config`

Show or set configuration values.

```sh
jira config [--show] [--server <url>] [--username <username>] [--token <token>] [--cloud-id <cloudId>] [--auth-type <type>] [--tls-client-cert <path>] [--tls-client-key <path>] [--tls-ca-cert <path>]
```

Important options:

| Option | Description |
|---|---|
| `--show` | Display current configuration |
| `--server <url>` | Jira base URL |
| `--username <username>` | Username/email for Basic auth |
| `--token <token>` | API token |
| `--cloud-id <cloudId>` | Enables Atlassian scoped token routing |
| `--auth-type <type>` | `basic`, `bearer`, or `mtls` |
| `--tls-client-cert <path>` | mTLS client certificate |
| `--tls-client-key <path>` | mTLS client key |
| `--tls-ca-cert <path>` | Optional mTLS CA certificate |

```sh
jira config --show
jira config --server https://your-site.atlassian.net --token <token>
```

### `config get [key]`

Read a configuration value.

```sh
jira config get [key]
```

```sh
jira config get
jira config get server
```

### `config set <key> <value>`

Set a single configuration value.

```sh
jira config set <key> <value>
```

```sh
jira config set server https://your-site.atlassian.net
jira config set cloudId <cloudId>
jira config set apiVersion auto
```

### `config unset <key>`

Remove a single configuration value.

```sh
jira config unset <key>
```

```sh
jira config unset cloudId
```

### `issue list`

List issues with filtering.

```sh
jira issue list [--project <project>] [--assignee <assignee>] [--status <status>] [--type <type>] [--reporter <reporter>] [--priority <priority>] [--created <date>] [--updated <date>] [--limit <limit>] [--jql <query>]
```

Important options:

| Option | Description |
|---|---|
| `--project <project>` | Filter by project key |
| `--assignee <assignee>` | Filter by assignee, including `currentUser` |
| `--status <status>` | Filter by status |
| `--type <type>` | Filter by issue type |
| `--reporter <reporter>` | Filter by reporter |
| `--priority <priority>` | Filter by priority |
| `--created <date>` | Created since date like `-7d` or `2023-01-01` |
| `--updated <date>` | Updated since date |
| `--limit <limit>` | Result limit |
| `--jql <query>` | Extra JQL expression |

```sh
jira issue list
jira issue list --assignee=currentUser --status=Open
jira issue list --project=TEST --type=Bug --limit=50
```

### `issue view <key>`

View issue details.

```sh
jira issue view <key> [--format terminal|markdown] [--output <path>]
```

| Option | Default | Description |
|---|---|---|
| `--format` | `terminal` | Output format |
| `--output <path>` | none | Save the rendered output to a file |

```sh
jira issue view PROJ-123
jira issue view PROJ-123 --format markdown --output ./issue.md
```

### `issue create`

Create a new issue.

```sh
jira issue create --project <project> --type <type> --summary <summary> [--description <text>] [--description-file <path>] [--assignee <assignee>] [--priority <priority>]
```

Important options:

| Option | Description |
|---|---|
| `--project <project>` | Required project key |
| `--type <type>` | Required issue type |
| `--summary <summary>` | Required summary |
| `--description <text>` | Inline description |
| `--description-file <path>` | File-backed multiline description |
| `--assignee <assignee>` | Initial assignee |
| `--priority <priority>` | Initial priority |

```sh
jira issue create --project PROJ --type Bug --summary "Login fails"
jira issue create --project PROJ --type Story --summary "Add dashboard" --description-file ./dashboard.md
```

### `issue edit <key>`

Update an existing issue.

```sh
jira issue edit <key> [--summary <summary>] [--description <text>] [--description-file <path>] [--assignee <assignee>] [--priority <priority>]
```

```sh
jira issue edit PROJ-123 --summary "Updated summary"
jira issue edit PROJ-123 --description-file ./new-description.md
```

### `issue delete <key>`

Delete an issue.

```sh
jira issue delete <key> --force
```

`--force` is required; otherwise the command should fail without deleting anything.

### `issue comment add <key> [text]`

Add a comment to an issue.

```sh
jira issue comment add <key> [text] [--file <path>] [--internal]
```

| Option | Description |
|---|---|
| `--file <path>` | Read the comment body from a file |
| `--internal` | Mark the comment as internal/private |

```sh
jira issue comment add PROJ-123 "Investigation complete"
jira issue comment add PROJ-123 --file ./notes.md --internal
```

### `issue comment list <key>`

List comments on an issue.

```sh
jira issue comment list <key> [--format table|json]
```

```sh
jira issue comment list PROJ-123
jira issue comment list PROJ-123 --format json
```

### `issue comment edit <commentId> [text]`

Edit an existing comment.

```sh
jira issue comment edit <commentId> [text] [--file <path>]
```

```sh
jira issue comment edit 12345 "Updated comment"
jira issue comment edit 12345 --file ./updated-notes.md
```

### `issue comment delete <commentId>`

Delete a comment.

```sh
jira issue comment delete <commentId> --force
```

### `issue remote-link list <key>`

List remote links for an issue.

```sh
jira issue remote-link list <key> [--format table|json] [--global-id <id>]
```

```sh
jira issue remote-link list PROJ-123
jira issue remote-link list PROJ-123 --global-id https://example.com/resource --format json
```

### `issue remote-link add <key>`

Add a remote link.

```sh
jira issue remote-link add <key> --url <url> --title <title> [--global-id <id>] [--relationship <relationship>] [--summary <summary>] [--icon-url <url>] [--icon-title <title>]
```

Important options:

| Option | Description |
|---|---|
| `--url <url>` | Required external resource URL |
| `--title <title>` | Required link title |
| `--global-id <id>` | Stable identifier for idempotent upserts |
| `--relationship <relationship>` | Relationship text |
| `--summary <summary>` | Optional summary |
| `--icon-url <url>` | Optional icon URL |
| `--icon-title <title>` | Optional icon alt text |

```sh
jira issue remote-link add PROJ-123 --url https://example.com/spec --title "Spec"
```

### `issue remote-link update <key> <linkId>`

Update an existing remote link.

```sh
jira issue remote-link update <key> <linkId> [--url <url>] [--title <title>] [--relationship <relationship>] [--summary <summary>] [--icon-url <url>] [--icon-title <title>]
```

```sh
jira issue remote-link update PROJ-123 10001 --title "Updated spec"
```

### `issue remote-link delete <key> <linkId>`

Delete a remote link.

```sh
jira issue remote-link delete <key> <linkId> --force
```

### `project`

List projects by default, or fetch a project directly with `--get`.

```sh
jira project [--get <key>]
```

```sh
jira project
jira project --get PROJ
```

### `project list`

List projects with optional filtering.

```sh
jira project list [--type <type>] [--category <category>]
```

```sh
jira project list
jira project list --type software --category Platform
```

### `project view <key>`

View project details.

```sh
jira project view <key>
```

### `project components <key>`

List project components.

```sh
jira project components <key>
```

### `project versions <key>`

List project versions.

```sh
jira project versions <key>
```

### `sprint`

List sprints by default, optionally constrained to a board or active-only view.

If multiple boards exist, the CLI may require `--board <id>` instead of guessing.

```sh
jira sprint [--board <id>] [--active]
```

```sh
jira sprint --board 12
jira sprint --board 12 --active
```

### `sprint list`

List sprints.

```sh
jira sprint list [--board <id>] [--active] [--state <state>]
```

| Option | Description |
|---|---|
| `--board <id>` | Restrict to a board |
| `--active` | Show only active sprints |
| `--state <state>` | Filter by `active`, `future`, or `closed` |

```sh
jira sprint list --board 12
jira sprint list --board 12 --state active
```

### `sprint active`

List active sprints.

```sh
jira sprint active [--board <id>]
```

### `sprint boards`

List available boards.

```sh
jira sprint boards
```

### `install-skill`

Copy this skill into the current project.

```sh
jira install-skill [--dest <directory>] [--force]
```

| Option | Default | Description |
|---|---|---|
| `--dest <directory>` | `./.claude/skills/jira` | Target directory |
| `--force` | false | Overwrite an existing installed skill |

```sh
jira install-skill
jira install-skill --force
jira install-skill --dest ./custom/skills/jira
```

## Workflow examples

### Investigate open issues for the current user

```sh
jira issue list --assignee=currentUser --status=Open
```

### Export an issue as markdown for offline review

```sh
jira issue view PROJ-123 --format markdown --output ./issue.md
```

### Create an issue from a detailed spec file

```sh
jira issue create --project PROJ --type Story --summary "Add dashboard" --description-file ./dashboard.md
```

### Inspect boards before querying sprint state

```sh
jira sprint boards
jira sprint list --board 12
```
