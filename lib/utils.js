const chalk = require('chalk');
const Table = require('cli-table3');

function convertAdfToText(node) {
  if (!node || typeof node === 'string') return node || '';
  if (typeof node !== 'object') return String(node);

  const content = node.content || [];
  const type = node.type;

  if (type === 'text') {
    return node.text || '';
  }

  if (type === 'hardBreak') {
    return '\n';
  }

  if (type === 'mention') {
    return node.attrs?.text || '@unknown';
  }

  if (type === 'emoji') {
    return node.attrs?.shortName || '';
  }

  if (type === 'inlineCard' || type === 'blockCard') {
    return node.attrs?.url || '';
  }

  const childText = content.map(convertAdfToText).join('');

  switch (type) {
  case 'doc':
    return childText;
  case 'paragraph':
    return childText + '\n';
  case 'heading': {
    const level = node.attrs?.level || 1;
    return '#'.repeat(level) + ' ' + childText + '\n';
  }
  case 'bulletList':
    return content.map(item => '- ' + convertAdfToText(item).replace(/^\s+|\s+$/g, '')).join('\n') + '\n';
  case 'orderedList':
    return content.map((item, i) => `${i + 1}. ` + convertAdfToText(item).replace(/^\s+|\s+$/g, '')).join('\n') + '\n';
  case 'listItem':
    return childText;
  case 'blockquote':
    return childText.split('\n').filter(Boolean).map(line => '> ' + line).join('\n') + '\n';
  case 'codeBlock':
    return '```\n' + childText + '```\n';
  case 'rule':
    return '---\n';
  case 'table':
  case 'tableRow':
  case 'tableHeader':
  case 'tableCell':
    return childText;
  case 'mediaGroup':
  case 'mediaSingle':
  case 'media':
    return '[media]\n';
  default:
    return childText;
  }
}

function resolveDescription(description) {
  if (!description) return '';
  if (typeof description === 'string') return description;
  if (typeof description === 'object' && description.type === 'doc') {
    return convertAdfToText(description).replace(/\n{3,}/g, '\n\n').trim();
  }
  return String(description);
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Format issue for table display
function formatIssueForTable(issue) {
  return {
    key: chalk.blue(issue.key),
    summary: issue.fields.summary ? 
      (issue.fields.summary.length > 50 ? 
        issue.fields.summary.substring(0, 50) + '...' : 
        issue.fields.summary) : 'N/A',
    status: issue.fields.status ? 
      chalk.yellow(issue.fields.status.name) : 'N/A',
    assignee: issue.fields.assignee ? 
      issue.fields.assignee.displayName : 'Unassigned',
    created: formatDate(issue.fields.created),
    updated: formatDate(issue.fields.updated)
  };
}

// Create table for issues
function createIssuesTable(issues) {
  const table = new Table({
    head: [
      chalk.bold('Key'),
      chalk.bold('Summary'),
      chalk.bold('Status'),
      chalk.bold('Assignee'),
      chalk.bold('Created'),
      chalk.bold('Updated')
    ],
    colWidths: [12, 52, 15, 20, 12, 12]
  });

  issues.forEach(issue => {
    const formatted = formatIssueForTable(issue);
    table.push([
      formatted.key,
      formatted.summary,
      formatted.status,
      formatted.assignee,
      formatted.created,
      formatted.updated
    ]);
  });

  return table;
}

// Create table for projects
function createProjectsTable(projects) {
  const table = new Table({
    head: [
      chalk.bold('Key'),
      chalk.bold('Name'),
      chalk.bold('Type'),
      chalk.bold('Lead')
    ],
    colWidths: [12, 40, 15, 25]
  });

  projects.forEach(project => {
    table.push([
      chalk.blue(project.key),
      project.name,
      project.projectTypeKey,
      project.lead ? project.lead.displayName : 'N/A'
    ]);
  });

  return table;
}

// Create table for sprints
function createSprintsTable(sprints) {
  const table = new Table({
    head: [
      chalk.bold('ID'),
      chalk.bold('Name'),
      chalk.bold('State'),
      chalk.bold('Start Date'),
      chalk.bold('End Date')
    ],
    colWidths: [8, 30, 12, 12, 12]
  });

  sprints.forEach(sprint => {
    const stateColor = sprint.state === 'ACTIVE' ? 'green' : 
      sprint.state === 'FUTURE' ? 'yellow' : 'gray';
    
    table.push([
      sprint.id,
      sprint.name,
      chalk[stateColor](sprint.state),
      sprint.startDate ? new Date(sprint.startDate).toLocaleDateString() : 'N/A',
      sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : 'N/A'
    ]);
  });

  return table;
}

// Format issue as markdown
function formatIssueAsMarkdown(issue) {
  if (!issue || !issue.fields) {
    throw new Error('Unexpected API response: issue fields missing. Try setting API version with: jira config --api-version 2');
  }
  const lines = [];

  lines.push(`# ${issue.key}: ${issue.fields.summary}`);
  lines.push('');

  lines.push('## Metadata');
  lines.push('');
  lines.push(`- **Status**: ${issue.fields.status.name}`);
  lines.push(`- **Type**: ${issue.fields.issuetype.name}`);
  lines.push(`- **Priority**: ${issue.fields.priority ? issue.fields.priority.name : 'N/A'}`);
  lines.push(`- **Assignee**: ${issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned'}`);
  lines.push(`- **Reporter**: ${issue.fields.reporter ? issue.fields.reporter.displayName : 'N/A'}`);
  lines.push(`- **Created**: ${formatDate(issue.fields.created)}`);
  lines.push(`- **Updated**: ${formatDate(issue.fields.updated)}`);

  if (issue.fields.labels && issue.fields.labels.length > 0) {
    lines.push(`- **Labels**: ${issue.fields.labels.join(', ')}`);
  }

  const url = issue.self.replace(new RegExp(`/rest/api/(2|3)/issue/${issue.id}`), `/browse/${issue.key}`);
  lines.push(`- **URL**: ${url}`);
  lines.push('');

  if (issue.fields.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(resolveDescription(issue.fields.description));
    lines.push('');
  }

  return lines.join('\n');
}

// Display issue details
function displayIssueDetails(issue) {
  if (!issue || !issue.fields) {
    throw new Error('Unexpected API response: issue fields missing. Try setting API version with: jira config --api-version 2');
  }
  console.log(chalk.bold(`\n${issue.key}: ${issue.fields.summary}`));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(`${chalk.bold('Status:')} ${chalk.yellow(issue.fields.status.name)}`);
  console.log(`${chalk.bold('Type:')} ${issue.fields.issuetype.name}`);
  console.log(`${chalk.bold('Priority:')} ${issue.fields.priority ? issue.fields.priority.name : 'N/A'}`);
  console.log(`${chalk.bold('Assignee:')} ${issue.fields.assignee ? issue.fields.assignee.displayName : 'Unassigned'}`);
  console.log(`${chalk.bold('Reporter:')} ${issue.fields.reporter ? issue.fields.reporter.displayName : 'N/A'}`);
  console.log(`${chalk.bold('Created:')} ${formatDate(issue.fields.created)}`);
  console.log(`${chalk.bold('Updated:')} ${formatDate(issue.fields.updated)}`);

  if (issue.fields.description) {
    console.log(`\n${chalk.bold('Description:')}`);
    console.log(resolveDescription(issue.fields.description));
  }

  if (issue.fields.labels && issue.fields.labels.length > 0) {
    console.log(`\n${chalk.bold('Labels:')} ${issue.fields.labels.join(', ')}`);
  }

  console.log(`\n${chalk.bold('URL:')} ${issue.self.replace(new RegExp(`/rest/api/(2|3)/issue/${issue.id}`), '/browse/' + issue.key)}`);
}

// Escape a value for safe use inside a JQL double-quoted string literal.
// JQL treats backslash as the escape char; double quotes terminate the literal.
// Newline/carriage return/tab can also terminate or corrupt parsing, so we
// normalize them to their escaped forms.
function escapeJqlString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function buildUserClause(field, value) {
  const resolved = value === 'currentUser'
    ? 'currentUser()'
    : `"${escapeJqlString(value)}"`;
  return `${field} = ${resolved}`;
}

// Split a trailing `ORDER BY ...` clause from a JQL expression. The sort
// clause in JQL must remain at the end of the final query, so it cannot be
// captured inside the parens we wrap around --jql. Uses the last `ORDER BY`
// occurrence to tolerate the rare case of `ORDER BY` appearing inside an
// earlier quoted string.
function splitOrderBy(jql) {
  const trimmed = jql.trim();
  const re = /\bORDER\s+BY\b/gi;
  let lastMatch = null;
  let m;
  while ((m = re.exec(trimmed)) !== null) {
    lastMatch = m;
  }
  if (!lastMatch) return { filter: trimmed, orderBy: null };
  return {
    filter: trimmed.slice(0, lastMatch.index).trim(),
    orderBy: trimmed.slice(lastMatch.index).trim()
  };
}

// Build JQL query from options.
// Structured filters are AND-composed. options.jql is AND-composed after
// splitting off any trailing `ORDER BY`, which is re-appended to the end of
// the final query so JQL parsing stays valid.
function buildJQL(options) {
  const conditions = [];
  let orderBy = null;

  if (options.project) {
    conditions.push(`project = "${escapeJqlString(options.project)}"`);
  }

  if (options.assignee) {
    conditions.push(buildUserClause('assignee', options.assignee));
  }

  if (options.reporter) {
    conditions.push(buildUserClause('reporter', options.reporter));
  }

  if (options.status) {
    conditions.push(`status = "${escapeJqlString(options.status)}"`);
  }

  if (options.type) {
    conditions.push(`issuetype = "${escapeJqlString(options.type)}"`);
  }

  if (options.priority) {
    conditions.push(`priority = "${escapeJqlString(options.priority)}"`);
  }

  if (options.created) {
    conditions.push(`created >= "${escapeJqlString(options.created)}"`);
  }

  if (options.updated) {
    conditions.push(`updated >= "${escapeJqlString(options.updated)}"`);
  }

  if (options.jql) {
    const split = splitOrderBy(options.jql);
    if (split.filter) {
      conditions.push(`(${split.filter})`);
    }
    if (split.orderBy) {
      orderBy = split.orderBy;
    }
  }

  const base = conditions.length > 0 ? conditions.join(' AND ') : '';

  if (orderBy) {
    return base ? `${base} ${orderBy}` : orderBy;
  }
  return base || 'ORDER BY updated DESC';
}

// Success message
function success(message) {
  console.log(chalk.green('✓'), message);
}

// Error message
function error(message) {
  console.error(chalk.red('✗'), message);
}

// Warning message
function warning(message) {
  console.log(chalk.yellow('⚠'), message);
}

// Info message
function info(message) {
  console.log(chalk.blue('ℹ'), message);
}

// Create table for comments
function createCommentsTable(comments) {
  const table = new Table({
    head: [
      chalk.bold('ID'),
      chalk.bold('Author'),
      chalk.bold('Body'),
      chalk.bold('Created'),
      chalk.bold('Updated')
    ],
    colWidths: [15, 20, 50, 12, 12],
    wordWrap: true
  });

  comments.forEach(comment => {
    const body = comment.body || '';
    const truncatedBody = body.length > 150 ? 
      body.substring(0, 147) + '...' : body;
    
    table.push([
      chalk.cyan(comment.id),
      comment.author ? comment.author.displayName : 'Unknown',
      truncatedBody,
      formatDate(comment.created),
      formatDate(comment.updated)
    ]);
  });

  return table;
}

function createRemoteLinksTable(remoteLinks) {
  const table = new Table({
    head: [
      chalk.bold('ID'),
      chalk.bold('Title'),
      chalk.bold('URL'),
      chalk.bold('Relationship'),
      chalk.bold('Global ID')
    ],
    colWidths: [10, 30, 45, 18, 30],
    wordWrap: true
  });

  remoteLinks.forEach(link => {
    const object = link.object || {};
    table.push([
      chalk.cyan(link.id),
      object.title || '',
      object.url || '',
      link.relationship || '',
      link.globalId || ''
    ]);
  });

  return table;
}

// Display single comment details
function displayCommentDetails(comment) {
  console.log(chalk.bold(`\nComment ID: ${comment.id}`));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`${chalk.bold('Author:')} ${comment.author ? comment.author.displayName : 'Unknown'}`);
  console.log(`${chalk.bold('Created:')} ${formatDate(comment.created)}`);
  console.log(`${chalk.bold('Updated:')} ${formatDate(comment.updated)}`);
  
  if (comment.visibility) {
    console.log(`${chalk.bold('Visibility:')} ${comment.visibility.type} - ${comment.visibility.value}`);
  }
  
  console.log(`\n${chalk.bold('Body:')}`);
  console.log(comment.body || 'No content');
  console.log('');
}

module.exports = {
  formatDate,
  formatIssueForTable,
  createIssuesTable,
  createProjectsTable,
  createSprintsTable,
  displayIssueDetails,
  formatIssueAsMarkdown,
  buildJQL,
  escapeJqlString,
  success,
  error,
  warning,
  info,
  createCommentsTable,
  createRemoteLinksTable,
  displayCommentDetails,
  convertAdfToText,
  resolveDescription
};
