const config = require('./config');
const chalk = require('chalk');
const Table = require('cli-table3');

class Analytics {
  constructor() {
    this.client = null;
  }

  async init() {
    this.client = config.createClient();
  }

  // Get issue statistics for a project
  async getProjectStats(projectKey) {
    if (!this.client) await this.init();

    const jql = `project = "${projectKey}"`;
    const issues = await this.client.searchIssues(jql, {
      maxResults: 1000,
      fields: ['status', 'issuetype', 'assignee', 'created', 'resolved', 'priority']
    });

    const stats = {
      total: issues.total,
      byStatus: {},
      byType: {},
      byAssignee: {},
      byPriority: {},
      resolved: 0,
      unresolved: 0,
      avgResolutionTime: 0
    };

    let resolutionTimes = [];

    issues.issues.forEach(issue => {
      const fields = issue.fields;
      
      // Status
      const status = fields.status.name;
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      
      // Type
      const type = fields.issuetype.name;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      // Assignee
      const assignee = fields.assignee ? fields.assignee.displayName : 'Unassigned';
      stats.byAssignee[assignee] = (stats.byAssignee[assignee] || 0) + 1;
      
      // Priority
      const priority = fields.priority ? fields.priority.name : 'None';
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
      
      // Resolution
      if (fields.resolved) {
        stats.resolved++;
        const created = new Date(fields.created);
        const resolved = new Date(fields.resolved);
        resolutionTimes.push(resolved - created);
      } else {
        stats.unresolved++;
      }
    });

    // Calculate average resolution time
    if (resolutionTimes.length > 0) {
      const avgMs = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;
      stats.avgResolutionTime = Math.round(avgMs / (1000 * 60 * 60 * 24)); // Convert to days
    }

    return stats;
  }

  // Get user workload statistics
  async getUserWorkload(username) {
    if (!this.client) await this.init();

    const jql = `assignee = "${username}" AND resolution = Unresolved`;
    const issues = await this.client.searchIssues(jql, {
      maxResults: 1000,
      fields: ['status', 'issuetype', 'priority', 'project', 'created']
    });

    const stats = {
      total: issues.total,
      byProject: {},
      byStatus: {},
      byType: {},
      byPriority: {},
      oldestIssue: null
    };

    let oldestDate = null;

    issues.issues.forEach(issue => {
      const fields = issue.fields;
      
      // Project
      const project = fields.project.key;
      stats.byProject[project] = (stats.byProject[project] || 0) + 1;
      
      // Status
      const status = fields.status.name;
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      
      // Type
      const type = fields.issuetype.name;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      // Priority
      const priority = fields.priority ? fields.priority.name : 'None';
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
      
      // Oldest issue
      const created = new Date(fields.created);
      if (!oldestDate || created < oldestDate) {
        oldestDate = created;
        stats.oldestIssue = {
          key: issue.key,
          summary: fields.summary,
          created: fields.created
        };
      }
    });

    return stats;
  }

  /**
   * Track analytics event (placeholder implementation)
   * @param {string} event - Event name
   * @param {Object} properties - Event properties
   */
  async track(event, properties = {}) {
    // For now, this is a no-op placeholder
    // In a real implementation, this would send data to analytics service
    console.debug(`Analytics: ${event}`, properties);
  }

  // Display project statistics
  displayProjectStats(projectKey, stats) {
    console.log(chalk.bold(`\nProject Analytics: ${projectKey}`));
    console.log(chalk.gray('═'.repeat(60)));
    
    console.log(chalk.bold('\nOverview:'));
    console.log(`Total Issues: ${chalk.blue(stats.total)}`);
    console.log(`Resolved: ${chalk.green(stats.resolved)}`);
    console.log(`Unresolved: ${chalk.red(stats.unresolved)}`);
    
    if (stats.avgResolutionTime > 0) {
      console.log(`Average Resolution Time: ${chalk.yellow(stats.avgResolutionTime)} days`);
    }

    // Status breakdown
    if (Object.keys(stats.byStatus).length > 0) {
      console.log(chalk.bold('\nBy Status:'));
      const statusTable = new Table({
        head: ['Status', 'Count', 'Percentage'],
        colWidths: [20, 10, 12]
      });
      
      Object.entries(stats.byStatus)
        .sort(([,a], [,b]) => b - a)
        .forEach(([status, count]) => {
          const percentage = Math.round((count / stats.total) * 100);
          statusTable.push([status, count, `${percentage}%`]);
        });
      
      console.log(statusTable.toString());
    }

    // Type breakdown
    if (Object.keys(stats.byType).length > 0) {
      console.log(chalk.bold('\nBy Type:'));
      const typeTable = new Table({
        head: ['Type', 'Count', 'Percentage'],
        colWidths: [20, 10, 12]
      });
      
      Object.entries(stats.byType)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          const percentage = Math.round((count / stats.total) * 100);
          typeTable.push([type, count, `${percentage}%`]);
        });
      
      console.log(typeTable.toString());
    }

    // Top assignees
    if (Object.keys(stats.byAssignee).length > 0) {
      console.log(chalk.bold('\nTop Assignees:'));
      const assigneeTable = new Table({
        head: ['Assignee', 'Count', 'Percentage'],
        colWidths: [25, 10, 12]
      });
      
      Object.entries(stats.byAssignee)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([assignee, count]) => {
          const percentage = Math.round((count / stats.total) * 100);
          assigneeTable.push([assignee, count, `${percentage}%`]);
        });
      
      console.log(assigneeTable.toString());
    }
  }

  // Display user workload
  displayUserWorkload(username, stats) {
    console.log(chalk.bold(`\nWorkload Analytics: ${username}`));
    console.log(chalk.gray('═'.repeat(60)));
    
    console.log(chalk.bold('\nOverview:'));
    console.log(`Open Issues: ${chalk.blue(stats.total)}`);
    
    if (stats.oldestIssue) {
      const daysSince = Math.floor((new Date() - new Date(stats.oldestIssue.created)) / (1000 * 60 * 60 * 24));
      console.log(`Oldest Issue: ${chalk.yellow(stats.oldestIssue.key)} (${daysSince} days old)`);
    }

    // Project breakdown
    if (Object.keys(stats.byProject).length > 0) {
      console.log(chalk.bold('\nBy Project:'));
      const projectTable = new Table({
        head: ['Project', 'Count', 'Percentage'],
        colWidths: [15, 10, 12]
      });
      
      Object.entries(stats.byProject)
        .sort(([,a], [,b]) => b - a)
        .forEach(([project, count]) => {
          const percentage = Math.round((count / stats.total) * 100);
          projectTable.push([project, count, `${percentage}%`]);
        });
      
      console.log(projectTable.toString());
    }

    // Priority breakdown
    if (Object.keys(stats.byPriority).length > 0) {
      console.log(chalk.bold('\nBy Priority:'));
      const priorityTable = new Table({
        head: ['Priority', 'Count', 'Percentage'],
        colWidths: [15, 10, 12]
      });
      
      Object.entries(stats.byPriority)
        .sort(([,a], [,b]) => b - a)
        .forEach(([priority, count]) => {
          const percentage = Math.round((count / stats.total) * 100);
          priorityTable.push([priority, count, `${percentage}%`]);
        });
      
      console.log(priorityTable.toString());
    }
  }
}

module.exports = Analytics;