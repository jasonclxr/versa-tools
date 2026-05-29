const fs = require("fs");
const { parse } = require("csv/sync");

function readSourceRows(inputPath) {
  const content = fs.readFileSync(inputPath, "utf8");
  const sourceRows = parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (sourceRows.length < 1) {
    throw new Error(`Source CSV does not contain any data rows: ${inputPath}`);
  }

  return {
    sourceRows,
    headers: Object.keys(sourceRows[0]),
  };
}

module.exports = {
  readSourceRows,
};
