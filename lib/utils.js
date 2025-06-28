const chalk = require('chalk');
const Table = require('cli-table3');

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

// Display issue details
function displayIssueDetails(issue) {
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
    console.log(issue.fields.description);
  }
  
  if (issue.fields.labels && issue.fields.labels.length > 0) {
    console.log(`\n${chalk.bold('Labels:')} ${issue.fields.labels.join(', ')}`);
  }
  
  console.log(`\n${chalk.bold('URL:')} ${issue.self.replace('/rest/api/2/issue/' + issue.id, '/browse/' + issue.key)}`);
}

// Build JQL query from options
function buildJQL(options) {
  const conditions = [];
  
  if (options.project) {
    conditions.push(`project = "${options.project}"`);
  }
  
  if (options.assignee) {
    conditions.push(`assignee = "${options.assignee}"`);
  }
  
  if (options.status) {
    conditions.push(`status = "${options.status}"`);
  }
  
  return conditions.length > 0 ? conditions.join(' AND ') : 'ORDER BY updated DESC';
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

module.exports = {
  formatDate,
  formatIssueForTable,
  createIssuesTable,
  createProjectsTable,
  createSprintsTable,
  displayIssueDetails,
  buildJQL,
  success,
  error,
  warning,
  info
};
