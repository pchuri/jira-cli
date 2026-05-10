const chalk = require('chalk');
const { createCommentsTable } = require('../../../lib/utils');
const { readDescriptionFile } = require('./shared');

async function addComment(client, io, issueKey, text, options = {}) {
  if (!text && !options.file) {
    throw new Error(
      'Comment text is required.\n\n' +
      'Usage: jira issue comment add <KEY> [text] [options]\n\n' +
      'Provide comment text either as:\n' +
      '  - Direct argument: jira issue comment add PROJ-123 "Comment text"\n' +
      '  - From file: jira issue comment add PROJ-123 --file ./comment.md\n\n' +
      'Options:\n' +
      '  --file <path>  Read comment body from file\n' +
      '  --internal     Mark comment as internal/private'
    );
  }

  if (text && options.file) {
    throw new Error('Cannot use both text argument and --file option. Please use only one.');
  }

  let commentBody = text;
  if (options.file) {
    commentBody = readDescriptionFile(options.file);
  }

  const spinner = io.spinner(`Adding comment to ${issueKey}...`);
  const comment = await client.addComment(issueKey, commentBody, {
    internal: options.internal
  });
  spinner.stop();

  io.success(`Comment added to ${issueKey}`);
  io.out(`Comment ID: ${comment.id}`);

  if (options.internal) {
    io.info('Comment marked as internal');
  }
}

async function listComments(client, io, issueKey, options = {}) {
  const spinner = io.spinner(`Fetching comments for ${issueKey}...`);

  try {
    const result = await client.getComments(issueKey);
    spinner.stop();

    if (!result.comments || result.comments.length === 0) {
      io.info(`No comments found for ${issueKey}`);
      return;
    }

    io.out(chalk.bold(`\nComments for ${issueKey} (${result.comments.length} total):\n`));

    if (options.format === 'json') {
      io.out(JSON.stringify(result.comments, null, 2));
    } else {
      const table = createCommentsTable(result.comments);
      io.out(table.toString());
    }

  } catch (err) {
    spinner.stop();
    throw err;
  }
}

async function editComment(client, io, commentId, text, options = {}) {
  if (!text && !options.file) {
    throw new Error(
      'Comment text is required.\n\n' +
      'Usage: jira issue comment edit <COMMENT-ID> [text] [options]\n\n' +
      'Provide comment text either as:\n' +
      '  - Direct argument: jira issue comment edit 12345 "Updated text"\n' +
      '  - From file: jira issue comment edit 12345 --file ./updated.md\n\n' +
      'Options:\n' +
      '  --file <path>  Read comment body from file'
    );
  }

  if (text && options.file) {
    throw new Error('Cannot use both text argument and --file option. Please use only one.');
  }

  let commentBody = text;
  if (options.file) {
    commentBody = readDescriptionFile(options.file);
  }

  const spinner = io.spinner(`Updating comment ${commentId}...`);
  await client.updateComment(commentId, commentBody);
  spinner.stop();

  io.success(`Comment ${commentId} updated successfully`);
}

async function deleteComment(client, io, commentId, options = {}) {
  io.out(chalk.bold.red('\nWARNING: You are about to delete this comment:'));
  io.out(`  Comment ID: ${chalk.cyan(commentId)}\n`);

  if (!options.force) {
    throw new Error(
      'Deletion requires --force flag to confirm.\n' +
      `Use: jira issue comment delete ${commentId} --force`
    );
  }

  const spinner = io.spinner('Deleting comment...');
  await client.deleteComment(commentId);
  spinner.stop();

  io.success(`Comment ${commentId} deleted successfully`);
}

function register(parent, factory) {
  const commentCommand = parent
    .command('comment')
    .description('Manage issue comments')
    .alias('c');

  commentCommand
    .command('add <key> [text]')
    .description('add a comment to an issue\n\n' +
      'Examples:\n' +
      '  $ jira issue comment add PROJ-123 "Review completed"\n' +
      '  $ jira issue comment add PROJ-123 --file ./notes.md\n' +
      '  $ jira issue comment add PROJ-123 "Internal note" --internal')
    .option('--file <path>', 'read comment body from file')
    .option('--internal', 'mark comment as internal/private')
    .action(async (key, text, options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();

      try {
        await addComment(client, io, key, text, options);
      } catch (err) {
        io.error(`Failed to add comment: ${err.message}`);
        process.exit(1);
      }
    });

  commentCommand
    .command('list <key>')
    .description('list comments on an issue\n\n' +
      'Examples:\n' +
      '  $ jira issue comment list PROJ-123\n' +
      '  $ jira issue comment list PROJ-123 --format json')
    .option('--format <format>', 'output format (table, json)', 'table')
    .action(async (key, options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();

      try {
        await listComments(client, io, key, options);
      } catch (err) {
        io.error(`Failed to list comments: ${err.message}`);
        process.exit(1);
      }
    });

  commentCommand
    .command('edit <commentId> [text]')
    .description('edit an existing comment\n\n' +
      'Examples:\n' +
      '  $ jira issue comment edit 12345 "Updated comment"\n' +
      '  $ jira issue comment edit 12345 --file ./updated-notes.md')
    .option('--file <path>', 'read comment body from file')
    .action(async (commentId, text, options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();

      try {
        await editComment(client, io, commentId, text, options);
      } catch (err) {
        io.error(`Failed to edit comment: ${err.message}`);
        process.exit(1);
      }
    });

  commentCommand
    .command('delete <commentId>')
    .description('delete a comment\n\n' +
      'Examples:\n' +
      '  $ jira issue comment delete 12345 --force')
    .option('-f, --force', 'force delete without confirmation')
    .action(async (commentId, options) => {
      const io = factory.getIOStreams();
      const client = await factory.getJiraClient();

      try {
        await deleteComment(client, io, commentId, options);
      } catch (err) {
        io.error(`Failed to delete comment: ${err.message}`);
        process.exit(1);
      }
    });
}

module.exports = {
  register,
  addComment,
  listComments,
  editComment,
  deleteComment
};
