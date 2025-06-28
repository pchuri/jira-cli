# JIRA CLI Examples

This document provides practical examples of how to use the JIRA CLI tool.

## Basic Usage Examples

### Setup and Configuration

```bash
# Initial setup - interactive configuration
jira config

# Manual configuration
jira config --server https://mycompany.atlassian.net
jira config --username john.doe@company.com
jira config --token abcd1234efgh5678

# Check current configuration
jira config --show
```

### Issue Management Examples

#### Listing Issues

```bash
# List all recent issues
jira issue

# List issues for specific project
jira issue --list --project MYPROJ

# List issues assigned to you
jira issue --list --assignee john.doe

# List issues by status
jira issue --list --status "In Progress"

# Combine filters
jira issue --list --project MYPROJ --assignee john.doe --status "To Do"
```

#### Working with Specific Issues

```bash
# Get detailed information about an issue
jira issue --get MYPROJ-123

# Create a new issue (interactive)
jira issue --create

# Update an existing issue (interactive)
jira issue --update MYPROJ-123

# Delete an issue (with confirmation)
jira issue --delete MYPROJ-123
```

### Project Management Examples

```bash
# List all projects you have access to
jira project

# Get detailed information about a specific project
jira project --get MYPROJ

# List projects and then get details
jira project --list
jira project --get $(jira project --list | grep "MYPROJ" | awk '{print $1}')
```

### Sprint Management Examples

```bash
# List all sprints (will prompt for board selection)
jira sprint

# List sprints for a specific board
jira sprint --list --board 42

# Show only active sprints
jira sprint --active

# Show active sprints for specific board
jira sprint --active --board 42
```

## Advanced Workflow Examples

### Daily Standup Preparation

```bash
#!/bin/bash
# daily-standup.sh - Prepare for daily standup

echo "=== Your Issues for Today ==="
jira issue --list --assignee $(whoami) --status "In Progress"

echo ""
echo "=== Recent Updates ==="
jira issue --list --assignee $(whoami) | head -5

echo ""
echo "=== Active Sprints ==="
jira sprint --active
```

### Bug Triage Workflow

```bash
#!/bin/bash
# bug-triage.sh - Review new bugs

echo "=== New Bugs to Triage ==="
jira issue --list --project MYPROJ --status "Open" | grep -i bug

echo ""
echo "=== High Priority Issues ==="
jira issue --list --project MYPROJ --status "Open"
```

### Release Planning

```bash
#!/bin/bash
# release-planning.sh - Review issues for upcoming release

echo "=== Issues Ready for Release ==="
jira issue --list --project MYPROJ --status "Done"

echo ""
echo "=== Issues in Progress ==="
jira issue --list --project MYPROJ --status "In Progress"

echo ""
echo "=== Current Sprint Status ==="
jira sprint --active --board 42
```

## Integration Examples

### Git Hooks Integration

Create a commit-msg hook to validate issue references:

```bash
#!/bin/bash
# .git/hooks/commit-msg

commit_regex='^(MYPROJ-[0-9]+):.*'

if ! grep -qE "$commit_regex" "$1"; then
    echo "Invalid commit message format!"
    echo "Format: MYPROJ-123: Your commit message"
    echo ""
    echo "Recent issues you might be working on:"
    jira issue --list --assignee $(whoami) --status "In Progress" | head -3
    exit 1
fi

# Validate that the issue exists
issue_key=$(grep -oE 'MYPROJ-[0-9]+' "$1" | head -1)
if ! jira issue --get "$issue_key" > /dev/null 2>&1; then
    echo "Warning: Issue $issue_key not found in JIRA"
    echo "Continue anyway? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
```

### Slack Integration

```bash
#!/bin/bash
# slack-daily-report.sh - Send daily report to Slack

SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

# Get today's completed issues
completed_issues=$(jira issue --list --assignee $(whoami) --status "Done" | wc -l)

# Get issues in progress
in_progress=$(jira issue --list --assignee $(whoami) --status "In Progress" | wc -l)

# Send to Slack
curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"Daily Report: $completed_issues issues completed, $in_progress in progress\"}" \
    $SLACK_WEBHOOK
```

### Shell Aliases

Add these to your `.bashrc` or `.zshrc`:

```bash
# JIRA CLI aliases
alias ji='jira issue'
alias jil='jira issue --list'
alias jig='jira issue --get'
alias jic='jira issue --create'
alias jp='jira project'
alias js='jira sprint'
alias jsa='jira sprint --active'

# Personal workflow aliases
alias my-issues='jira issue --list --assignee $(whoami)'
alias my-active='jira issue --list --assignee $(whoami) --status "In Progress"'
alias team-sprint='jira sprint --active --board 42'
```

### Issue Templates

Create issue templates for common issue types:

```bash
#!/bin/bash
# create-bug.sh - Create a bug report with template

jira issue --create << EOF
Bug Report Template:

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**


**Actual Result:**


**Environment:**
- Browser: 
- OS: 
- Version: 

**Additional Information:**

EOF
```

## Automation Examples

### Automated Issue Updates

```bash
#!/bin/bash
# auto-transition.sh - Automatically transition issues based on git commits

# Get current branch
branch=$(git branch --show-current)

# Extract issue key from branch name (e.g., feature/MYPROJ-123-new-feature)
issue_key=$(echo "$branch" | grep -oE 'MYPROJ-[0-9]+')

if [[ -n "$issue_key" ]]; then
    echo "Found issue: $issue_key"
    
    # Check if issue exists and get current status
    if jira issue --get "$issue_key" > /dev/null 2>&1; then
        echo "Issue exists in JIRA"
        
        # You can add logic here to transition issues based on git actions
        # Note: Issue transitions require additional API calls not implemented in basic CLI
        echo "Consider updating issue status in JIRA web interface"
    else
        echo "Warning: Issue $issue_key not found"
    fi
fi
```

### Batch Operations

```bash
#!/bin/bash
# batch-update.sh - Update multiple issues

# Read issue keys from file
while IFS= read -r issue_key; do
    echo "Processing $issue_key..."
    
    # Get issue details
    jira issue --get "$issue_key"
    
    # You can add batch update logic here
    # For now, just display the issue
    
done < issue-list.txt
```

## Tips and Best Practices

### Performance Tips

1. **Use specific filters** to reduce API calls:
   ```bash
   # Good - specific filter
   jira issue --list --project MYPROJ --status "In Progress"
   
   # Less efficient - broad search
   jira issue --list | grep MYPROJ
   ```

2. **Combine operations** when possible:
   ```bash
   # Get issue details and save to file for reference
   jira issue --get MYPROJ-123 > issue-details.txt
   ```

### Workflow Integration

1. **Use in shell scripts** for automation
2. **Combine with other CLI tools** (grep, awk, jq)
3. **Set up aliases** for frequently used commands
4. **Create project-specific scripts** for common workflows

### Security Best Practices

1. **Never hardcode credentials** in scripts
2. **Use environment variables** for sensitive data
3. **Rotate API tokens** regularly
4. **Limit token permissions** when possible

## Troubleshooting Examples

### Debug Connection Issues

```bash
# Test configuration
jira config --show

# Test with minimal request
jira project --list

# Check network connectivity
curl -u "username:token" "https://yoursite.atlassian.net/rest/api/2/myself"
```

### Handle Rate Limits

```bash
#!/bin/bash
# rate-limit-safe.sh - Handle API rate limits

for issue in PROJ-1 PROJ-2 PROJ-3; do
    echo "Processing $issue..."
    jira issue --get "$issue"
    
    # Add delay to avoid rate limits
    sleep 1
done
```
