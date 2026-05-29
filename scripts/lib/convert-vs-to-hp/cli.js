const path = require("path");

async function parseArgs(argv, options) {
  const {
    buildDefaultOutputPath,
    pendingLogsDir,
    resolveDefaultReferencePath,
    resolveInputPath,
    stagePendingInput,
  } = options;

  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage(pendingLogsDir);
    process.exit(0);
  }

  const positional = argv.filter((arg) => !arg.startsWith("--"));

  if (positional.length > 3) {
    printUsage(pendingLogsDir);
    process.exit(1);
  }

  const selectedInputPath = await resolveInputPath(positional[0], pendingLogsDir);
  const inputPath = stagePendingInput(selectedInputPath, pendingLogsDir);
  const outputPath = path.resolve(positional[1] || buildDefaultOutputPath(inputPath));
  const referencePath = path.resolve(positional[2] || resolveDefaultReferencePath());

  return { selectedInputPath, inputPath, outputPath, referencePath };
}

function printUsage(pendingLogsDir) {
  console.log(`Usage: node scripts/convert-vs-to-hp.js [input.csv] [output.csv] [reference.csv]

Arguments:
  input.csv      Optional VersaTuner CSV log to convert.
  output.csv     Optional output path. Defaults to logs/converted/HP Format - <name>.csv
  reference.csv  Optional HP Tuners reference CSV. Defaults to HPFormat.csv when available.

Behavior:
  - If no input path is provided, the script prompts for one.
  - Selected inputs are copied into ${pendingLogsDir} before conversion.
  - Converted logs are written to logs/converted by default.`);
}

module.exports = {
  parseArgs,
  printUsage,
};
