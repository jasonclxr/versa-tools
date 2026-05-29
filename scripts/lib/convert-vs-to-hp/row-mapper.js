const {
  STOICH_AFR_GAS,
  KPA_TO_PSI,
  GRAMS_PER_SECOND_TO_LB_PER_MIN,
} = require("./constants");
const { STATIC_VALUES, DIRECT_VALUE_SOURCES, getComputedLabelValue } = require("./hp-mappings");
const { getSourceValue, readNumber, convert } = require("./value-utils");

function inferBarometricPressure(sourceRows, sourceColumns) {
  const firstMap = readNumber(sourceRows[0], sourceColumns.mapKpa);
  return Number.isFinite(firstMap) ? firstMap : 101.325;
}

function mapTargetValue(label, row, sourceColumns, barometricPressureKpa) {
  const actualLambda = readActualLambda(row, sourceColumns);
  const computedValues = {
    lambda: actualLambda,
    commandedLambda: readCommandedLambda(row, sourceColumns),
    mapPsi: convert(readNumber(row, sourceColumns.mapKpa), KPA_TO_PSI),
    mafLbMin: convert(readNumber(row, sourceColumns.mafGps), GRAMS_PER_SECOND_TO_LB_PER_MIN),
    loadPercent: convert(readNumber(row, sourceColumns.absoluteLoad), 100),
    barometricPressureKpa,
    getSourceValue,
    sourceColumns,
    row,
  };

  if (STATIC_VALUES.has(label)) {
    return STATIC_VALUES.get(label);
  }

  if (DIRECT_VALUE_SOURCES.has(label)) {
    return DIRECT_VALUE_SOURCES.get(label)(computedValues);
  }

  return getComputedLabelValue(label, computedValues);
}

function readActualLambda(row, sourceColumns) {
  const actualLambda = readNumber(row, sourceColumns.actualLambda);
  if (Number.isFinite(actualLambda)) {
    return actualLambda;
  }

  return convert(readNumber(row, sourceColumns.afrGas), STOICH_AFR_GAS, "/");
}

function readCommandedLambda(row, sourceColumns) {
  const commandedLambda = readNumber(row, sourceColumns.commandedLambda);
  if (Number.isFinite(commandedLambda)) {
    return commandedLambda;
  }

  return readActualLambda(row, sourceColumns);
}

module.exports = {
  inferBarometricPressure,
  mapTargetValue,
};
