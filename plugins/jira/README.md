# jira Claude Code Plugin

Adds the `jira` skill to Claude Code so it understands `jira-cli` commands automatically.

## Install

```
/plugin marketplace add pchuri/jira-cli
/plugin install jira@pchuri-jira-cli
```

## Prerequisites

```sh
npm install -g @pchuri/jira-cli
jira config --server "https://your-site.atlassian.net" --username "user@example.com" --token "your-api-token"
```

See the [jira-cli README](https://github.com/pchuri/jira-cli#readme) for all authentication options (Bearer, Basic, scoped Cloud tokens, mTLS).
