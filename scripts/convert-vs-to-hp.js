#!/usr/bin/env node

const childProcess = require("child_process");
const { parse } = require("csv-parse/sync");
const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const { stdin, stdout } = require("process");

const STOICH_AFR_GAS = 14.7;
const KPA_TO_PSI = 0.1450377377;
const GRAMS_PER_SECOND_TO_LB_PER_MIN = 0.13227735731;

const DEFAULT_REFERENCE_PATH = path.join(
  __dirname,
  "..",
  "HP Log format - All Channels.csv",
);

const SOURCE_COLUMNS = {
  time: "Time (s)",
  absoluteLoad: "Absolute load",
  throttle: "Absolute throttle position 1 (%)",
  afrGas: "Actual equivalence/air to fuel ratio (AFR gas)",
  coolantTemp: "Engine coolant temperature (°F)",
  rpm: "Engine RPM",
  timingAdvance: "Ignition timing advance (°)",
  intakeAirTemp: "Intake air temperature (°F)",
  mapKpa: "Intake manifold absolute pressure (kPa)",
  knockRetard: "Knock retard (°)",
  longTermFuelTrim: "Long term fuel trim (%)",
  manifoldAirTemp: "Manifold air temperature (°F)",
  mafGps: "Mass airflow (g/s)",
  shortTermFuelTrim: "Short term fuel trim (primary sensor) (%)",
  vehicleSpeed: "Vehicle speed (mph)",
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
  ["Offset", ({ row }) => row[SOURCE_COLUMNS.time]],
  ["Knock Retard", ({ row }) => row[SOURCE_COLUMNS.knockRetard]],
  ["Short Term Fuel Trim Bank 1", ({ row }) => row[SOURCE_COLUMNS.shortTermFuelTrim]],
  ["Long Term Fuel Trim Bank 1", ({ row }) => row[SOURCE_COLUMNS.longTermFuelTrim]],
  ["Timing Advance", ({ row }) => row[SOURCE_COLUMNS.timingAdvance]],
  ["Timing Advance (SAE)", ({ row }) => row[SOURCE_COLUMNS.timingAdvance]],
  ["Engine RPM", ({ row }) => row[SOURCE_COLUMNS.rpm]],
  ["Engine RPM (SAE)", ({ row }) => row[SOURCE_COLUMNS.rpm]],
  ["Accelerator Position D (SAE)", ({ row }) => row[SOURCE_COLUMNS.throttle]],
  ["Commanded Throttle Actuator (SAE)", ({ row }) => row[SOURCE_COLUMNS.throttle]],
  ["Relative Throttle Position (SAE)", ({ row }) => row[SOURCE_COLUMNS.throttle]],
  ["Accelerator Pedal Position", ({ row }) => row[SOURCE_COLUMNS.throttle]],
  ["Throttle Position (SAE)", ({ row }) => row[SOURCE_COLUMNS.throttle]],
  ["Long Term Fuel Trim Bank 1 (SAE)", ({ row }) => row[SOURCE_COLUMNS.longTermFuelTrim]],
  ["Short Term Fuel Trim Bank 1 (SAE)", ({ row }) => row[SOURCE_COLUMNS.shortTermFuelTrim]],
  ["Vehicle Speed", ({ row }) => row[SOURCE_COLUMNS.vehicleSpeed]],
  ["Intake Air Temp (SAE)", ({ row }) => row[SOURCE_COLUMNS.intakeAirTemp]],
  ["Intake Air Temp", ({ row }) => row[SOURCE_COLUMNS.manifoldAirTemp]],
  ["Engine Coolant Temp", ({ row }) => row[SOURCE_COLUMNS.coolantTemp]],
  ["Ambient Air Temp", ({ row }) => row[SOURCE_COLUMNS.intakeAirTemp]],
]);

async function main() {
  const { inputPath, outputPath, referencePath } = await parseArgs(process.argv.slice(2));
  const reference = readReferenceTemplate(referencePath);
  const sourceRows = readSourceRows(inputPath);
  const barometricPressureKpa = inferBarometricPressure(sourceRows);

  const outputLines = [...reference.headerLines];

  for (const row of sourceRows) {
    const values = reference.labels.map((label) =>
      mapTargetValue(label, row, barometricPressureKpa),
    );
    outputLines.push(values.map(toCsvCell).join(","));
  }

  fs.writeFileSync(outputPath, `${outputLines.join("\n")}\n`, "utf8");

  console.log(`Converted ${sourceRows.length} rows.`);
  console.log(`Source: ${inputPath}`);
  console.log(`Reference: ${referencePath}`);
  console.log(`Output: ${outputPath}`);
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

  const inputPath = await resolveInputPath(positional[0]);
  const outputPath = path.resolve(
    positional[1] || buildDefaultOutputPath(inputPath),
  );
  const referencePath = path.resolve(positional[2] || DEFAULT_REFERENCE_PATH);

  return { inputPath, outputPath, referencePath };
}

function buildDefaultOutputPath(inputPath) {
  const parsed = path.parse(path.resolve(inputPath));
  return path.join(parsed.dir, `HP Format - ${parsed.name} ${parsed.ext || ".csv"}`);
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
  const script = [
    'set selectedFile to choose file with prompt "Select the source CSV log"',
    "return POSIX path of selectedFile",
  ].join("\n");

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
    const answer = await rl.question("Path to source CSV: ");
    const trimmed = answer.trim();

    if (!trimmed) {
      throw new Error("No input CSV path provided.");
    }

    return path.resolve(trimmed);
  } finally {
    rl.close();
  }
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

  const headers = Object.keys(sourceRows[0]);
  validateSourceHeaders(headers);

  return sourceRows;
}

function validateSourceHeaders(headers) {
  const missing = Object.values(SOURCE_COLUMNS).filter((header) => !headers.includes(header));

  if (missing.length > 0) {
    throw new Error(
      `Source CSV is missing required columns:\n- ${missing.join("\n- ")}`,
    );
  }
}

function inferBarometricPressure(sourceRows) {
  const firstMap = readNumber(sourceRows[0], SOURCE_COLUMNS.mapKpa);
  return Number.isFinite(firstMap) ? firstMap : 101.325;
}

function mapTargetValue(label, row, barometricPressureKpa) {
  const computedValues = {
    lambda: convert(readNumber(row, SOURCE_COLUMNS.afrGas), STOICH_AFR_GAS, "/"),
    mapPsi: convert(readNumber(row, SOURCE_COLUMNS.mapKpa), KPA_TO_PSI),
    mafLbMin: convert(readNumber(row, SOURCE_COLUMNS.mafGps), GRAMS_PER_SECOND_TO_LB_PER_MIN),
    loadPercent: convert(readNumber(row, SOURCE_COLUMNS.absoluteLoad), 100),
    barometricPressureKpa,
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
    case "Equivalence Ratio Commanded (SAE)":
    case "WB EQ Ratio 1 (SAE) (2)":
      return computedValues.lambda;
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

function toCsvCell(value) {
  const normalized = normalizeValue(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
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
