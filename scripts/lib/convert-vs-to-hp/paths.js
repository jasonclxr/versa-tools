const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");
const LOGS_DIR = path.join(PROJECT_ROOT, "logs");
const PENDING_LOGS_DIR = path.join(LOGS_DIR, "pending");
const CONVERTED_LOGS_DIR = path.join(LOGS_DIR, "converted");
const DEFAULT_REFERENCE_CANDIDATES = [
  path.join(PROJECT_ROOT, "HP Log format - All Channels.csv"),
  path.join(PROJECT_ROOT, "HPFormat.csv"),
];

function buildDefaultOutputPath(inputPath) {
  const parsed = path.parse(path.resolve(inputPath));
  return path.join(CONVERTED_LOGS_DIR, `HP Format - ${parsed.name}${parsed.ext || ".csv"}`);
}

function resolveDefaultReferencePath() {
  const defaultReferencePath = DEFAULT_REFERENCE_CANDIDATES.find((candidate) =>
    fs.existsSync(candidate),
  );

  if (defaultReferencePath) {
    return defaultReferencePath;
  }

  throw new Error(
    `No default HP reference file found. Checked:\n- ${DEFAULT_REFERENCE_CANDIDATES.join("\n- ")}`,
  );
}

module.exports = {
  PROJECT_ROOT,
  LOGS_DIR,
  PENDING_LOGS_DIR,
  CONVERTED_LOGS_DIR,
  DEFAULT_REFERENCE_CANDIDATES,
  buildDefaultOutputPath,
  resolveDefaultReferencePath,
};
