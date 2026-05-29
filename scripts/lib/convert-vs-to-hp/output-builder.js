const { stringify } = require("csv/sync");
const { normalizeValue } = require("./value-utils");

function buildHpCsvContent(reference, outputRows) {
  const normalizedRows = outputRows.map((row) => row.map(normalizeValue));

  return [
    reference.headerLines.join("\n"),
    stringify(normalizedRows, { record_delimiter: "\n" }).trimEnd(),
  ]
    .filter(Boolean)
    .join("\n")
    .concat("\n");
}

module.exports = {
  buildHpCsvContent,
};
