#!/usr/bin/env node

const childProcess = require("child_process");
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

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/convert-avo-to-hp.js [input.csv] [output.csv] [reference.csv]",
      "",
      "Examples:",
      "  node scripts/convert-avo-to-hp.js",
      '  node scripts/convert-avo-to-hp.js "/Users/Jason/Downloads/AVO ND2 - v2.05 MF - Gas Station Run.csv"',
      '  node scripts/convert-avo-to-hp.js "input.csv" "converted.csv" "HP Log format - All Channels.csv"',
    ].join("\n"),
  );
}

function buildDefaultOutputPath(inputPath) {
  const parsed = path.parse(path.resolve(inputPath));
  return path.join(parsed.dir, `${parsed.name} - HP format${parsed.ext || ".csv"}`);
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
    labels: parseCsvLine(labelsLine),
  };
}

function readSourceRows(inputPath) {
  const content = fs.readFileSync(inputPath, "utf8").replace(/\r\n/g, "\n").trim();
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error(`Source CSV does not contain any data rows: ${inputPath}`);
  }

  const headers = parseCsvLine(lines[0]);
  validateSourceHeaders(headers);

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });

    return row;
  });
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
  const time = row[SOURCE_COLUMNS.time];
  const throttle = row[SOURCE_COLUMNS.throttle];
  const rpm = row[SOURCE_COLUMNS.rpm];
  const timingAdvance = row[SOURCE_COLUMNS.timingAdvance];
  const vehicleSpeed = row[SOURCE_COLUMNS.vehicleSpeed];
  const shortTermFuelTrim = row[SOURCE_COLUMNS.shortTermFuelTrim];
  const longTermFuelTrim = row[SOURCE_COLUMNS.longTermFuelTrim];
  const intakeAirTemp = row[SOURCE_COLUMNS.intakeAirTemp];
  const manifoldAirTemp = row[SOURCE_COLUMNS.manifoldAirTemp];
  const coolantTemp = row[SOURCE_COLUMNS.coolantTemp];
  const knockRetard = row[SOURCE_COLUMNS.knockRetard];

  const lambda = divideIfFinite(readNumber(row, SOURCE_COLUMNS.afrGas), STOICH_AFR_GAS);
  const mapPsi = multiplyIfFinite(readNumber(row, SOURCE_COLUMNS.mapKpa), KPA_TO_PSI);
  const mafLbMin = multiplyIfFinite(
    readNumber(row, SOURCE_COLUMNS.mafGps),
    GRAMS_PER_SECOND_TO_LB_PER_MIN,
  );
  const loadPercent = multiplyIfFinite(readNumber(row, SOURCE_COLUMNS.absoluteLoad), 100);

  switch (label) {
    case "Offset":
      return time;
    case "WB EQ Ratio Bank 1":
      return lambda;
    case "Knock Retard":
      return knockRetard;
    case "Short Term Fuel Trim Bank 1":
      return shortTermFuelTrim;
    case "Long Term Fuel Trim Bank 1":
      return longTermFuelTrim;
    case "Equivalence Ratio Commanded (SAE)":
      return lambda;
    case "Timing Advance":
    case "Timing Advance (SAE)":
      return timingAdvance;
    case "Manifold Absolute Pressure":
    case "Intake Manifold Absolute Pressure (SAE)":
      return mapPsi;
    case "Mass Airflow":
    case "Mass Airflow (SAE)":
      return mafLbMin;
    case "Fuel System #1 Status (SAE)":
      return "---";
    case "Engine RPM":
    case "Engine RPM (SAE)":
      return rpm;
    case "Intake Cam Des Angle":
    case "Intake Cam Angle":
    case "Exhaust Cam Des Angle":
    case "Exhaust Cam Angle":
      return 0;
    case "WB EQ Ratio 1 (SAE) (2)":
      return lambda;
    case "Fuel Pressure":
    case "Fuel Rail Pressure (SAE)":
    case "Actual Engine Torque (SAE)":
    case "Mass Airflow Sensor":
    case "Engine Fuel Rate (SAE)":
    case "Injector Pulse Width":
    case "Catalyst Temp B1S1 (SAE)":
    case "Control Module Voltage":
    case "Fuel Level Input (SAE)":
      return 0;
    case "Accelerator Position D (SAE)":
    case "Commanded Throttle Actuator (SAE)":
    case "Relative Throttle Position (SAE)":
    case "Accelerator Pedal Position":
    case "Throttle Position (SAE)":
      return throttle;
    case "Calculated Engine Load (SAE)":
    case "Absolute Load (SAE)":
      return loadPercent;
    case "Long Term Fuel Trim Bank 1 (SAE)":
      return longTermFuelTrim;
    case "Short Term Fuel Trim Bank 1 (SAE)":
      return shortTermFuelTrim;
    case "Vehicle Speed":
      return vehicleSpeed;
    case "Intake Air Temp (SAE)":
      return intakeAirTemp;
    case "Intake Air Temp":
      return manifoldAirTemp;
    case "Engine Coolant Temp":
      return coolantTemp;
    case "Barometric Pressure":
      return barometricPressureKpa;
    case "Ambient Air Temp":
      return intakeAirTemp;
    default:
      return 0;
  }
}

function readNumber(row, columnName) {
  const value = Number.parseFloat(row[columnName]);
  return Number.isFinite(value) ? value : NaN;
}

function divideIfFinite(value, divisor) {
  return Number.isFinite(value) ? value / divisor : NaN;
}

function multiplyIfFinite(value, multiplier) {
  return Number.isFinite(value) ? value * multiplier : NaN;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
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
