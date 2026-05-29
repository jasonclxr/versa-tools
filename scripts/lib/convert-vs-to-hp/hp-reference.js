const fs = require("fs");
const { parse } = require("csv/sync");

function readReferenceTemplate(referencePath) {
  const content = fs.readFileSync(referencePath, "utf8").replace(/\r\n/g, "\n");
  const lines = content.split("\n");
  const channelDataIndex = lines.findIndex((line) => line.trim() === "[Channel Data]");

  if (channelDataIndex === -1) {
    throw new Error(`Reference file does not contain a [Channel Data] section: ${referencePath}`);
  }

  const labelsLine = lines.find((line, index) => index < channelDataIndex && line.startsWith("Offset,"));

  if (!labelsLine) {
    throw new Error(`Reference file does not contain the expected label row: ${referencePath}`);
  }

  const headerLines = lines.slice(0, channelDataIndex + 1);
  const creationTimeIndex = headerLines.findIndex((line) => line.startsWith("Creation Time:"));

  if (creationTimeIndex !== -1) {
    headerLines[creationTimeIndex] = `Creation Time: ${formatHpDate(new Date())}`;
  }

  return {
    headerLines,
    labels: parseCsvRow(labelsLine),
  };
}

function parseCsvRow(line) {
  return parse(line, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  })[0] || [];
}

function formatHpDate(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const amPm = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;

  return `${month}/${day}/${year} ${hours12}:${minutes}:${seconds} ${amPm}`;
}

module.exports = {
  readReferenceTemplate,
};
