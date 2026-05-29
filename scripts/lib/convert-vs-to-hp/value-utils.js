function getSourceValue(row, sourceColumns, logicalName) {
  const header = sourceColumns[logicalName];
  return header ? row[header] : undefined;
}

function readNumber(row, columnName) {
  const value = Number.parseFloat(row[columnName]);
  return Number.isFinite(value) ? value : NaN;
}

function convert(value, factor, operator = "*") {
  if (!Number.isFinite(value)) {
    return NaN;
  }

  return operator === "/" ? value / factor : value * factor;
}

function normalizeValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }

    return value.toFixed(10).replace(/(?:\.0+|(\.\d+?)0+)$/, "$1");
  }

  return String(value);
}

module.exports = {
  getSourceValue,
  readNumber,
  convert,
  normalizeValue,
};
