const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");
const { stdin, stdout } = require("process");

async function resolveInputPath(explicitInputPath, pendingLogsDir) {
  if (explicitInputPath) {
    return path.resolve(explicitInputPath);
  }

  if (process.platform === "darwin") {
    const selectedPath = chooseCsvFileWithMacDialog(pendingLogsDir);
    if (selectedPath) {
      return path.resolve(selectedPath);
    }
  }

  if (process.platform === "win32") {
    const selectedPath = chooseCsvFileWithWindowsDialog(pendingLogsDir);
    if (selectedPath) {
      return path.resolve(selectedPath);
    }
  }

  return promptForInputPathInTerminal(pendingLogsDir);
}

function chooseCsvFileWithMacDialog(pendingLogsDir) {
  const scriptLines = [];

  if (fs.existsSync(pendingLogsDir)) {
    scriptLines.push(
      `set defaultFolder to POSIX file "${escapeAppleScriptString(pendingLogsDir)}"`,
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

function chooseCsvFileWithWindowsDialog(pendingLogsDir) {
  const scriptLines = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
    '$dialog.Title = "Select the source CSV log"',
    '$dialog.Filter = "CSV files (*.csv)|*.csv|All files (*.*)|*.*"',
  ];

  if (fs.existsSync(pendingLogsDir)) {
    scriptLines.push(
      `$dialog.InitialDirectory = '${escapePowerShellString(path.resolve(pendingLogsDir))}'`,
    );
  }

  scriptLines.push("$result = $dialog.ShowDialog()");
  scriptLines.push(
    "if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName) }",
  );
  scriptLines.push(
    "elseif ($result -eq [System.Windows.Forms.DialogResult]::Cancel) { [Console]::Error.Write('User canceled') ; exit 1 }",
  );

  try {
    return childProcess
      .execFileSync(
        "powershell.exe",
        ["-NoProfile", "-STA", "-Command", scriptLines.join("; ")],
        { encoding: "utf8" },
      )
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

async function promptForInputPathInTerminal(pendingLogsDir) {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("No input CSV path provided and no interactive prompt is available.");
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const answer = await rl.question(
      `Path to source CSV${fs.existsSync(pendingLogsDir) ? ` (pending folder: ${pendingLogsDir})` : ""}: `,
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

function escapeAppleScriptString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapePowerShellString(value) {
  return value.replace(/'/g, "''");
}

module.exports = {
  resolveInputPath,
};
