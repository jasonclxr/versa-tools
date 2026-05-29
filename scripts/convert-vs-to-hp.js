const fs = require("fs");
const path = require("path");
const { parseArgs } = require("./lib/convert-vs-to-hp/cli");
const { stagePendingInput, ensureDirectoryExists } = require("./lib/convert-vs-to-hp/fs-workflow");
const { readReferenceTemplate } = require("./lib/convert-vs-to-hp/hp-reference");
const { resolveInputPath } = require("./lib/convert-vs-to-hp/input-resolution");
const { buildHpCsvContent } = require("./lib/convert-vs-to-hp/output-builder");
const {
  PENDING_LOGS_DIR,
  buildDefaultOutputPath,
  resolveDefaultReferencePath,
} = require("./lib/convert-vs-to-hp/paths");
const { inferBarometricPressure, mapTargetValue } = require("./lib/convert-vs-to-hp/row-mapper");
const { readSourceRows } = require("./lib/convert-vs-to-hp/source-csv");
const {
  resolveSourceColumns,
  findUnmappedSourceHeaders,
  reportUnmappedSourceHeaders,
} = require("./lib/convert-vs-to-hp/source-columns");

async function main() {
  const { selectedInputPath, inputPath, outputPath, referencePath } = await parseArgs(
    process.argv.slice(2),
    {
      buildDefaultOutputPath,
      pendingLogsDir: PENDING_LOGS_DIR,
      resolveDefaultReferencePath,
      resolveInputPath,
      stagePendingInput,
    },
  );
  const reference = readReferenceTemplate(referencePath);
  const { sourceRows, headers } = readSourceRows(inputPath);
  const sourceColumns = resolveSourceColumns(headers);
  const barometricPressureKpa = inferBarometricPressure(sourceRows, sourceColumns);
  const unmappedSourceHeaders = findUnmappedSourceHeaders(headers, sourceColumns);
  const outputRows = sourceRows.map((row) =>
    reference.labels.map((label) => mapTargetValue(label, row, sourceColumns, barometricPressureKpa)),
  );

  ensureDirectoryExists(path.dirname(outputPath));
  fs.writeFileSync(outputPath, buildHpCsvContent(reference, outputRows), "utf8");

  reportUnmappedSourceHeaders(unmappedSourceHeaders);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
