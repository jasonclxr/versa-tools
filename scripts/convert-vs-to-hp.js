#!/usr/bin/env node

const childProcess = require("child_process");
const { parse, stringify } = require("csv/sync");
const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const { stdin, stdout } = require("process");

const STOICH_AFR_GAS = 14.7;
const KPA_TO_PSI = 0.1450377377;
const GRAMS_PER_SECOND_TO_LB_PER_MIN = 0.13227735731;
const PROJECT_ROOT = path.join(__dirname, "..");
const LOGS_DIR = path.join(PROJECT_ROOT, "logs");
const PENDING_LOGS_DIR = path.join(LOGS_DIR, "pending");
const CONVERTED_LOGS_DIR = path.join(LOGS_DIR, "converted");
const DEFAULT_REFERENCE_CANDIDATES = [
  path.join(PROJECT_ROOT, "HP Log format - All Channels.csv"),
  path.join(PROJECT_ROOT, "HPFormat.csv"),
];

const DEFAULT_REFERENCE_PATH = DEFAULT_REFERENCE_CANDIDATES.find((candidate) =>
  fs.existsSync(candidate),
);

const SOURCE_COLUMN_OPTIONS = {
  time: ["Time (s)"],
  absoluteLoad: ["Absolute load"],
  throttle: ["Absolute throttle position 1 (%)"],
  acceleratorPedal: ["Accelerator pedal position (%)"],
  afrGas: ["Actual equivalence/air to fuel ratio (AFR gas)"],
  actualLambda: ["Actual equivalence/air to fuel ratio (λ)"],
  commandedLambda: ["Desired equivalence/air to fuel ratio (λ)"],
  coolantTemp: ["Engine coolant temperature (°F)"],
  rpm: ["Engine RPM"],
  timingAdvance: ["Ignition timing advance (°)"],
  intakeAirTemp: ["Intake air temperature (°F)"],
  mapKpa: ["Intake manifold absolute pressure (kPa)"],
  knockRetard: ["Knock retard (°)"],
  longTermFuelTrim: ["Long term fuel trim (%)"],
  manifoldAirTemp: ["Manifold air temperature (°F)", "Intake air temperature (°F)"],
  mafGps: ["Mass airflow (g/s)"],
  shortTermFuelTrim: ["Short term fuel trim (primary sensor) (%)"],
  vehicleSpeed: ["Vehicle speed (mph)"],
  catalystTemp: ["Catalyst Temperature (%)"],
  intakeCamDesired: ["Desired intake camshaft advance from max retard position (°)"],
  intakeCamActual: ["Actual intake camshaft advance from max retard position (°)"],
  exhaustCamDesired: ["Desired exhaust camshaft retard from max advance position (°)"],
  exhaustCamActual: ["Actual exhaust camshaft retard from max advance position (°)"],
  injectorPulseWidth: ["Fuel injection pulse width (ms)"],
};

const STATIC_VALUES = new Map([
  ["Fuel System #1 Status (SAE)", "---"],
  ["Intake Cam Des Angle", 0],
  ["Intake Cam Angle", 0],
  ["Exhaust Cam Des Angle", 0],
  ["Exhaust Cam Angle", 0],
  ["Fuel Pressure", 0],
  ["Fuel Rail Pressure (SAE)", 0],
  ["Actual Engine Torque (SAE)", 0],
  ["Mass Airflow Sensor", 0],
  ["Engine Fuel Rate (SAE)", 0],
  ["Injector Pulse Width", 0],
  ["Catalyst Temp B1S1 (SAE)", 0],
  ["Control Module Voltage", 0],
  ["Fuel Level Input (SAE)", 0],
]);

const DIRECT_VALUE_SOURCES = new Map([
  ["Offset", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "time")],
  ["Knock Retard", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "knockRetard")],
  ["Short Term Fuel Trim Bank 1", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "shortTermFuelTrim")],
  ["Long Term Fuel Trim Bank 1", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "longTermFuelTrim")],
  ["Timing Advance", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "timingAdvance")],
  ["Timing Advance (SAE)", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "timingAdvance")],
  ["Engine RPM", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "rpm")],
  ["Engine RPM (SAE)", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "rpm")],
  ["Accelerator Position D (SAE)", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "acceleratorPedal")],
  ["Commanded Throttle Actuator (SAE)", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "throttle")],
  ["Relative Throttle Position (SAE)", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "throttle")],
  ["Accelerator Pedal Position", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "acceleratorPedal")],
  ["Throttle Position (SAE)", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "throttle")],
  ["Long Term Fuel Trim Bank 1 (SAE)", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "longTermFuelTrim")],
  ["Short Term Fuel Trim Bank 1 (SAE)", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "shortTermFuelTrim")],
  ["Vehicle Speed", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "vehicleSpeed")],
  ["Catalyst Temp B1S1 (SAE)", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "catalystTemp")],
  ["Intake Air Temp (SAE)", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "intakeAirTemp")],
  ["Intake Air Temp", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "manifoldAirTemp")],
  ["Engine Coolant Temp", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "coolantTemp")],
  ["Ambient Air Temp", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "intakeAirTemp")],
  ["Intake Cam Des Angle", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "intakeCamDesired")],
  ["Intake Cam Angle", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "intakeCamActual")],
  ["Exhaust Cam Des Angle", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "exhaustCamDesired")],
  ["Exhaust Cam Angle", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "exhaustCamActual")],
  ["Injector Pulse Width", ({ row, sourceColumns }) => getSourceValue(row, sourceColumns, "injectorPulseWidth")],
]);

async function main() {
  const { selectedInputPath, inputPath, outputPath, referencePath } = await parseArgs(
    process.argv.slice(2),
  );
  const reference = readReferenceTemplate(referencePath);
  const { sourceRows, headers } = readSourceRows(inputPath);
  const sourceColumns = resolveSourceColumns(headers);
  const barometricPressureKpa = inferBarometricPressure(sourceRows, sourceColumns);
  const unmappedSourceHeaders = findUnmappedSourceHeaders(headers, sourceColumns);
  const outputRows = [];

  for (const row of sourceRows) {
    const values = reference.labels.map((label) =>
      mapTargetValue(label, row, sourceColumns, barometricPressureKpa),
    );
    outputRows.push(values.map(normalizeValue));
  }

  ensureDirectoryExists(path.dirname(outputPath));
  const outputContent = [
    reference.headerLines.join("\n"),
    stringify(outputRows, { record_delimiter: "\n" }).trimEnd(),
  ]
    .filter(Boolean)
    .join("\n")
    .concat("\n");
  fs.writeFileSync(outputPath, outputContent, "utf8");
  reportUnmappedSourceHeaders(unmappedSourceHeaders);
}

async function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const positional = argv.filter((arg) => !arg.startsWith("--"));

  if (positional.length > 3) {
    printUsage();
    process.exit(1);
  }

  const selectedInputPath = await resolveInputPath(positional[0]);
  const inputPath = stagePendingInput(selectedInputPath);
  const outputPath = path.resolve(positional[1] || buildDefaultOutputPath(inputPath));
  const referencePath = path.resolve(positional[2] || resolveDefaultReferencePath());

  return { selectedInputPath, inputPath, outputPath, referencePath };
}

function buildDefaultOutputPath(inputPath) {
  const parsed = path.parse(path.resolve(inputPath));
  return path.join(CONVERTED_LOGS_DIR, `HP Format - ${parsed.name}${parsed.ext || ".csv"}`);
}

function resolveDefaultReferencePath() {
  if (DEFAULT_REFERENCE_PATH) {
    return DEFAULT_REFERENCE_PATH;
  }

  throw new Error(
    `No default HP reference file found. Checked:\n- ${DEFAULT_REFERENCE_CANDIDATES.join("\n- ")}`,
  );
}

async function resolveInputPath(explicitInputPath) {
  if (explicitInputPath) {
    return path.resolve(explicitInputPath);
  }

  if (process.platform === "darwin") {
    const selectedPath = chooseCsvFileWithMacDialog();
    if (selectedPath) {
      return path.resolve(selectedPath);
    }
  }

  return promptForInputPathInTerminal();
}

function chooseCsvFileWithMacDialog() {
  const scriptLines = [];

  if (fs.existsSync(PENDING_LOGS_DIR)) {
    scriptLines.push(
      `set defaultFolder to POSIX file "${escapeAppleScriptString(PENDING_LOGS_DIR)}"`,
    );
    scriptLines.push(
      'set selectedFile to choose file with prompt "Select the source CSV log" default location defaultFolder',
    );
  } else {
    scriptLines.push('set selectedFile to choose file with prompt "Select the source CSV log"');
  }

  scriptLines.push("return POSIX path of selectedFile");
  const script = scriptLines.join("\n");

  try {
    return childProcess
      .execFileSync("osascript", ["-e", script], { encoding: "utf8" })
      .trim();
  } catch (error) {
    const stderr = error.stderr?.toString() || "";
    const stdoutText = error.stdout?.toString() || "";
    const combined = `${stderr}\n${stdoutText}`;

    if (combined.includes("User canceled")) {
      console.error("File selection canceled.");
      process.exit(1);
    }

    return "";
  }
}

async function promptForInputPathInTerminal() {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("No input CSV path provided and no interactive prompt is available.");
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const answer = await rl.question(
      `Path to source CSV${fs.existsSync(PENDING_LOGS_DIR) ? ` (pending folder: ${PENDING_LOGS_DIR})` : ""}: `,
    );
    const trimmed = answer.trim();

    if (!trimmed) {
      throw new Error("No input CSV path provided.");
    }

    return path.resolve(trimmed);
  } finally {
    rl.close();
  }
}

function stagePendingInput(inputPath) {
  ensureDirectoryExists(PENDING_LOGS_DIR);

  if (isWithinDirectory(inputPath, PENDING_LOGS_DIR)) {
    return path.resolve(inputPath);
  }

  const destinationPath = path.join(PENDING_LOGS_DIR, path.basename(inputPath));
  fs.copyFileSync(inputPath, destinationPath);
  return destinationPath;
}

function ensureDirectoryExists(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function isWithinDirectory(filePath, directoryPath) {
  const relativePath = path.relative(path.resolve(directoryPath), path.resolve(filePath));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function escapeAppleScriptString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

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

function resolveSourceColumns(headers) {
  return Object.fromEntries(
    Object.entries(SOURCE_COLUMN_OPTIONS).map(([key, candidates]) => [
      key,
      candidates.find((candidate) => headers.includes(candidate)),
    ]),
  );
}

function findUnmappedSourceHeaders(headers, sourceColumns) {
  const mappedHeaders = new Set(Object.values(sourceColumns).filter(Boolean));
  return headers.filter((header) => !mappedHeaders.has(header));
}

function reportUnmappedSourceHeaders(headers) {
  if (headers.length === 0) {
    console.log("Unmapped source columns: none");
    return;
  }

  console.log(`Unmapped source columns (${headers.length}):`);
  for (const header of headers) {
    console.log(`- ${header}`);
  }
}

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
    sourceColumns,
    row,
  };

  if (STATIC_VALUES.has(label)) {
    return STATIC_VALUES.get(label);
  }

  if (DIRECT_VALUE_SOURCES.has(label)) {
    return DIRECT_VALUE_SOURCES.get(label)(computedValues);
  }

  switch (label) {
    case "WB EQ Ratio Bank 1":
    case "WB EQ Ratio 1 (SAE) (2)":
      return computedValues.lambda;
    case "Equivalence Ratio Commanded (SAE)":
      return computedValues.commandedLambda;
    case "Manifold Absolute Pressure":
    case "Intake Manifold Absolute Pressure (SAE)":
      return computedValues.mapPsi;
    case "Mass Airflow":
    case "Mass Airflow (SAE)":
      return computedValues.mafLbMin;
    case "Calculated Engine Load (SAE)":
    case "Absolute Load (SAE)":
      return computedValues.loadPercent;
    case "Barometric Pressure":
      return computedValues.barometricPressureKpa;
    default:
      return 0;
  }
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

function parseCsvRow(line) {
  return parse(line, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  })[0] || [];
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

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
