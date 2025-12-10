# Migration Guide: Interactive to Non-Interactive CLI

## What Changed in v2.0.0

Version 2.0.0 removes all interactive prompts to make the CLI fully scriptable and automation-friendly for CI/CD pipelines.

## Impact Summary

### Commands Removed
- `jira init` - Use `jira config` with explicit flags instead

### Commands Modified
- `jira config` - No longer falls back to interactive mode
- `jira issue create` - All options now required via CLI flags
- `jira issue edit` - Requires explicit field flags
- `jira issue delete` - Requires `--force` flag
- `jira sprint list` - Requires `--board` when multiple boards exist

### New Features
- `--description-file` option for reading multi-line descriptions from files

## Migration Steps

### 1. Configuration Setup

**Before (v1.x - Interactive):**
```bash
jira init
# Interactive prompts for server, username, token
```

**After (v2.0 - Explicit):**
```bash
# One-time setup with all options
jira config --server https://jira.company.com \
            --username user@company.com \
            --token your-api-token

# Or use environment variables (recommended for CI/CD)
export JIRA_HOST=jira.company.com
export JIRA_API_TOKEN=your-api-token
export JIRA_USERNAME=user@company.com
```

### 2. Creating Issues

**Before (v1.x - Interactive):**
```bash
jira issue create
# Interactive prompts for project, type, summary, description
```

**After (v2.0 - Explicit):**
```bash
# With required flags
jira issue create --project PROJ \
                  --type Bug \
                  --summary "Issue summary" \
                  --description "Issue description"

# For long descriptions, use files
jira issue create --project PROJ \
                  --type Story \
                  --summary "New feature" \
                  --description-file ./spec.md
```

### 3. Updating Issues

**Before (v1.x - Interactive):**
```bash
jira issue edit PROJ-123
# Interactive prompts with editor
```

**After (v2.0 - Explicit):**
```bash
# Update specific fields
jira issue edit PROJ-123 --summary "New summary"
jira issue edit PROJ-123 --description-file ./updated-spec.md
jira issue edit PROJ-123 --assignee john.doe --priority High
```

### 4. Deleting Issues

**Before (v1.x - Interactive):**
```bash
jira issue delete PROJ-123
# Confirmation prompt
```

**After (v2.0 - Explicit):**
```bash
# Requires --force flag
jira issue delete PROJ-123 --force
```

### 5. Sprint Management

**Before (v1.x - Interactive):**
```bash
jira sprint list
# Board selection prompt if multiple boards
```

**After (v2.0 - Explicit):**
```bash
# List boards first
jira sprint boards

# Then specify board
jira sprint list --board 123
```

## Benefits of Non-Interactive Mode

### For Automation
- **Scriptable**: Use in CI/CD pipelines without timeouts
- **Reliable**: No hanging on prompts in automated environments
- **Fast**: No interactive delays

### For Users
- **Clear**: Explicit requirements shown upfront
- **Flexible**: Choose between CLI flags or environment variables
- **Powerful**: File-based input for complex descriptions

## Backward Compatibility

### Still Works
- **Config file**: Existing configuration files continue to work
- **Environment variables**: No changes to env var support
- **API**: JIRA API integration unchanged
- **All commands**: Same functionality, just explicit parameters

### No Longer Works
- `jira init` command
- Interactive prompts when options missing
- Editor-based description input (use `--description-file` instead)

## Common Migration Scenarios

### Scenario 1: CI/CD Pipeline

**Old approach:**
```yaml
# This would hang in CI/CD
- run: jira issue create
```

**New approach:**
```yaml
- run: |
    jira issue create \
      --project $PROJECT_KEY \
      --type Bug \
      --summary "Build failed: $CI_JOB_NAME" \
      --description "Build log: $CI_JOB_URL"
```

### Scenario 2: Shell Script

**Old approach:**
```bash
#!/bin/bash
# Would require user interaction
jira init
jira issue create
```

**New approach:**
```bash
#!/bin/bash
# Fully automated
export JIRA_HOST=jira.company.com
export JIRA_API_TOKEN=$TOKEN
export JIRA_USERNAME=bot@company.com

# Create description file
cat > /tmp/desc.txt <<EOF
Issue details:
- Component: $COMPONENT
- Environment: $ENV
EOF

jira issue create \
  --project INFRA \
  --type Task \
  --summary "Deploy $COMPONENT to $ENV" \
  --description-file /tmp/desc.txt
```

### Scenario 3: Multi-line Descriptions

**Old approach:**
```bash
# Opens editor
jira issue create  # Then write in $EDITOR
```

**New approach:**
```bash
# Create description in your preferred editor
vim feature-spec.md

# Then use file
jira issue create \
  --project PROJ \
  --type Story \
  --summary "Add feature" \
  --description-file ./feature-spec.md
```

## Troubleshooting

### Error: "Missing required options"

**Problem:**
```bash
$ jira issue create
Error: Missing required options for creating an issue.
```

**Solution:**
Add all required flags:
```bash
jira issue create --project PROJ --type Bug --summary "Summary text"
```

### Error: "Configuration requires explicit options"

**Problem:**
```bash
$ jira config
Error: Configuration requires explicit options.
```

**Solution:**
Use explicit configuration:
```bash
jira config --server https://jira.company.com \
            --username user@company.com \
            --token your-token
```

### Error: "Board ID required when multiple boards exist"

**Problem:**
```bash
$ jira sprint list
Multiple boards found:
  1      Board 1 (scrum)
  2      Board 2 (kanban)
Error: Board ID required when multiple boards exist
```

**Solution:**
Specify board ID:
```bash
jira sprint list --board 1
```

## Getting Help

### Command Help
All commands now show clearer help with examples:
```bash
jira issue create --help
jira issue edit --help
jira config --help
```

### Error Messages
Error messages now include usage examples:
```bash
$ jira issue create
Error: Missing required options for creating an issue.

Usage: jira issue create --project <KEY> --type <TYPE> --summary <TEXT>

Example:
  jira issue create --project TEST --type Bug --summary "Login fails"
```

## Need More Help?

- Check updated [README.md](README.md) for detailed examples
- Review [CLAUDE.md](CLAUDE.md) for development patterns
- Open an issue on GitHub for questions

## Feedback

We value your feedback on this migration! Please let us know:
- What worked well in your migration
- What was challenging
- What documentation could be improved

Open an issue at: https://github.com/pchuri/jira-cli/issues
