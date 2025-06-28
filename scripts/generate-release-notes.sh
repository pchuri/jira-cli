#!/bin/bash

# Generate release notes from conventional commits
# Usage: ./scripts/generate-release-notes.sh [previous-tag] [current-tag]

set -e

PREV_TAG=${1:-$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")}
CURRENT_TAG=${2:-$(git describe --tags --exact-match HEAD 2>/dev/null || echo "HEAD")}

echo "## 🎉 Release Notes for ${CURRENT_TAG}"
echo ""

# Get commits between tags
if [ -n "$PREV_TAG" ]; then
    COMMIT_RANGE="${PREV_TAG}..${CURRENT_TAG}"
    echo "### 📅 Changes since ${PREV_TAG}"
else
    COMMIT_RANGE="HEAD"
    echo "### 📅 Initial Release"
fi

echo ""

# Parse conventional commits
FEATURES=$(git log --pretty=format:"%s" $COMMIT_RANGE | grep "^feat" | sed 's/^feat[:(][^)]*[):] /- ✨ /' | sed 's/^feat: /- ✨ /' || true)
FIXES=$(git log --pretty=format:"%s" $COMMIT_RANGE | grep "^fix" | sed 's/^fix[:(][^)]*[):] /- 🐛 /' | sed 's/^fix: /- 🐛 /' || true)
DOCS=$(git log --pretty=format:"%s" $COMMIT_RANGE | grep "^docs" | sed 's/^docs[:(][^)]*[):] /- 📚 /' | sed 's/^docs: /- 📚 /' || true)
REFACTOR=$(git log --pretty=format:"%s" $COMMIT_RANGE | grep "^refactor" | sed 's/^refactor[:(][^)]*[):] /- ♻️ /' | sed 's/^refactor: /- ♻️ /' || true)
CHORE=$(git log --pretty=format:"%s" $COMMIT_RANGE | grep "^chore" | sed 's/^chore[:(][^)]*[):] /- 🔧 /' | sed 's/^chore: /- 🔧 /' || true)

# Print sections
if [ -n "$FEATURES" ]; then
    echo "### ✨ New Features"
    echo "$FEATURES"
    echo ""
fi

if [ -n "$FIXES" ]; then
    echo "### 🐛 Bug Fixes"
    echo "$FIXES"
    echo ""
fi

if [ -n "$DOCS" ]; then
    echo "### 📚 Documentation"
    echo "$DOCS"
    echo ""
fi

if [ -n "$REFACTOR" ]; then
    echo "### ♻️ Refactoring"
    echo "$REFACTOR"
    echo ""
fi

if [ -n "$CHORE" ]; then
    echo "### 🔧 Maintenance"
    echo "$CHORE"
    echo ""
fi

# Installation instructions
echo "### 🚀 Installation"
echo ""
echo '```bash'
echo "npm install -g @pchuri/jira-cli"
echo '```'
echo ""

# Quick start
echo "### 🎯 Quick Start"
echo ""
echo '```bash'
echo "# Setup your JIRA connection"
echo "jira init"
echo ""
echo "# View an issue"
echo "jira issue view PROJ-123"
echo ""
echo "# List issues"
echo "jira issue list --project PROJ"
echo '```'
echo ""

# Links
echo "### 🔗 Links"
echo ""
echo "- 📖 [Full Documentation](https://github.com/pchuri/jira-cli#readme)"
echo "- 🤝 [Contributing Guide](https://github.com/pchuri/jira-cli/blob/main/CONTRIBUTING.md)"
echo "- 🐛 [Report Issues](https://github.com/pchuri/jira-cli/issues/new/choose)"
echo "- 📦 [NPM Package](https://www.npmjs.com/package/@pchuri/jira-cli)"

if [ -n "$PREV_TAG" ]; then
    echo "- 📋 [Full Changelog](https://github.com/pchuri/jira-cli/compare/${PREV_TAG}...${CURRENT_TAG})"
fi

echo ""
echo "---"
echo "*Made with ❤️ for the JIRA community*"
