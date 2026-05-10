const fs = require('fs');
const path = require('path');

function readDescriptionFile(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Description file not found: ${absolutePath}`);
  }

  const stats = fs.statSync(absolutePath);
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  if (!content.trim()) {
    throw new Error(`Description file is empty: ${absolutePath}`);
  }

  return content;
}

module.exports = {
  readDescriptionFile
};
