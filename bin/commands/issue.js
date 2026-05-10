const { Command } = require('commander');
const crud = require('./issue/crud');
const comment = require('./issue/comment');
const link = require('./issue/link');

function createIssueCommand(factory) {
  const command = new Command('issue')
    .description('Manage JIRA issues')
    .alias('i');

  crud.register(command, factory);
  comment.register(command, factory);
  link.register(command, factory);

  return command;
}

module.exports = createIssueCommand;
