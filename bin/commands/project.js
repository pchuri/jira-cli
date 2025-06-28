const { Command } = require('commander');
const { createProjectsTable } = require('../../lib/utils');
const chalk = require('chalk');

function createProjectCommand(factory) {
  const command = new Command('project')
    .description('Manage JIRA projects')
    .alias('p')
    .option('-g, --get <key>', 'get project by key')
    .action(async (options) => {
      const io = factory.getIOStreams();
      const client = factory.getJiraClient();
      const analytics = factory.getAnalytics();

      try {
        await analytics.track('project', { action: options.get ? 'get' : 'list' });

        if (options.get) {
          await getProject(client, io, options.get, factory);
        } else {
          // Default to list projects
          await listProjects(client, io);
        }

      } catch (err) {
        io.error(`Project command failed: ${err.message}`);
        process.exit(1);
      }
    });

  // Add subcommands
  command
    .command('list')
    .description('list all projects')
    .alias('ls')
    .option('--type <type>', 'filter by project type')
    .option('--category <category>', 'filter by project category')
    .action(async (options) => {
      const io = factory.getIOStreams();
      const client = factory.getJiraClient();
      
      try {
        await listProjects(client, io, options);
      } catch (err) {
        io.error(`Failed to list projects: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('view <key>')
    .description('view project details')
    .alias('show')
    .action(async (key) => {
      const io = factory.getIOStreams();
      const client = factory.getJiraClient();
      
      try {
        await getProject(client, io, key, factory);
      } catch (err) {
        io.error(`Failed to get project: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('components <key>')
    .description('list project components')
    .action(async (key) => {
      const io = factory.getIOStreams();
      const client = factory.getJiraClient();
      
      try {
        await listComponents(client, io, key);
      } catch (err) {
        io.error(`Failed to list components: ${err.message}`);
        process.exit(1);
      }
    });

  command
    .command('versions <key>')
    .description('list project versions')
    .action(async (key) => {
      const io = factory.getIOStreams();
      const client = factory.getJiraClient();
      
      try {
        await listVersions(client, io, key);
      } catch (err) {
        io.error(`Failed to list versions: ${err.message}`);
        process.exit(1);
      }
    });

  return command;
}

async function listProjects(client, io, options = {}) {
  const spinner = io.spinner('Fetching projects...');
  
  try {
    const projects = await client.getProjects();
    spinner.stop();

    if (projects.length === 0) {
      io.info('No projects found');
      return;
    }

    // Apply filters if provided
    let filteredProjects = projects;
    if (options.type) {
      filteredProjects = projects.filter(p => 
        p.projectTypeKey.toLowerCase().includes(options.type.toLowerCase())
      );
    }
    if (options.category) {
      filteredProjects = filteredProjects.filter(p => 
        p.projectCategory && 
        p.projectCategory.name.toLowerCase().includes(options.category.toLowerCase())
      );
    }

    io.out(chalk.bold(`\nFound ${filteredProjects.length} projects:\n`));
    
    const table = createProjectsTable(filteredProjects);
    io.out(table.toString());

  } catch (err) {
    spinner.stop();
    throw err;
  }
}

async function getProject(client, io, projectKey, factory) {
  const spinner = io.spinner(`Fetching project ${projectKey}...`);
  
  try {
    const project = await client.getProject(projectKey);
    spinner.stop();
    
    displayProjectDetails(project, io, factory);

  } catch (err) {
    spinner.stop();
    throw err;
  }
}

async function listComponents(client, io, projectKey) {
  const spinner = io.spinner(`Fetching components for ${projectKey}...`);
  
  try {
    const components = await client.getProjectComponents(projectKey);
    spinner.stop();

    if (components.length === 0) {
      io.info(`No components found for project ${projectKey}`);
      return;
    }

    io.out(chalk.bold(`\nComponents for ${projectKey}:\n`));
    
    components.forEach(component => {
      io.out(`${chalk.cyan('•')} ${chalk.bold(component.name)}`);
      if (component.description) {
        io.out(`  ${chalk.gray(component.description)}`);
      }
      if (component.lead) {
        io.out(`  ${chalk.gray('Lead:')} ${component.lead.displayName}`);
      }
      io.out('');
    });

  } catch (err) {
    spinner.stop();
    throw err;
  }
}

async function listVersions(client, io, projectKey) {
  const spinner = io.spinner(`Fetching versions for ${projectKey}...`);
  
  try {
    const versions = await client.getProjectVersions(projectKey);
    spinner.stop();

    if (versions.length === 0) {
      io.info(`No versions found for project ${projectKey}`);
      return;
    }

    io.out(chalk.bold(`\nVersions for ${projectKey}:\n`));
    
    versions.forEach(version => {
      const status = version.released ? chalk.green('Released') : 
        version.archived ? chalk.gray('Archived') : 
          chalk.yellow('Unreleased');
      
      io.out(`${chalk.cyan('•')} ${chalk.bold(version.name)} ${status}`);
      if (version.description) {
        io.out(`  ${chalk.gray(version.description)}`);
      }
      if (version.releaseDate) {
        io.out(`  ${chalk.gray('Release Date:')} ${version.releaseDate}`);
      }
      io.out('');
    });

  } catch (err) {
    spinner.stop();
    throw err;
  }
}

function displayProjectDetails(project, io, factory) {
  io.out(chalk.bold(`\n${project.key}: ${project.name}`));
  io.out(chalk.gray('─'.repeat(60)));
  
  io.out(`${chalk.bold('Type:')} ${project.projectTypeKey}`);
  io.out(`${chalk.bold('Lead:')} ${project.lead ? project.lead.displayName : 'N/A'}`);
  io.out(`${chalk.bold('Description:')} ${project.description || 'No description'}`);
  
  if (project.projectCategory) {
    io.out(`${chalk.bold('Category:')} ${project.projectCategory.name}`);
  }
  
  if (project.components && project.components.length > 0) {
    io.out(`\n${chalk.bold('Components:')}`);
    project.components.forEach(component => {
      io.out(`  ${chalk.cyan('•')} ${component.name}${component.description ? ` - ${component.description}` : ''}`);
    });
  }
  
  if (project.versions && project.versions.length > 0) {
    io.out(`\n${chalk.bold('Versions:')}`);
    project.versions.forEach(version => {
      const status = version.released ? chalk.green('Released') : 
        version.archived ? chalk.gray('Archived') : 
          chalk.yellow('Unreleased');
      io.out(`  ${chalk.cyan('•')} ${version.name} (${status})`);
    });
  }
  
  const config = factory.getConfig();
  const serverUrl = config.get('server');
  io.out(`\n${chalk.bold('URL:')} ${serverUrl}/browse/${project.key}`);
}

module.exports = createProjectCommand;
