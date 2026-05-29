const fs = require("fs");
const path = require("path");

function ensureDirectoryExists(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function isWithinDirectory(filePath, directoryPath) {
  const relativePath = path.relative(path.resolve(directoryPath), path.resolve(filePath));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function stagePendingInput(inputPath, pendingLogsDir) {
  ensureDirectoryExists(pendingLogsDir);

  if (isWithinDirectory(inputPath, pendingLogsDir)) {
    return path.resolve(inputPath);
  }

  const destinationPath = path.join(pendingLogsDir, path.basename(inputPath));
  fs.copyFileSync(inputPath, destinationPath);
  return destinationPath;
}

module.exports = {
  ensureDirectoryExists,
  isWithinDirectory,
  stagePendingInput,
};
