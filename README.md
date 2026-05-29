# tuning-tools

Small Node.js utilities for tuning workflows.

At the moment, this repo is mainly for converting a VersaTuner CSV log into an HP Tuners-style CSV using a reference template.

## Setup

Install dependencies:

```bash
npm install
```

Make sure you also have an HP Tuners reference CSV available. By default, the script looks for one of these files in the repo root:

- `HP Log format - All Channels.csv`
- `HPFormat.csv`

## Usage

Run the converter with npm:

```bash
npm run convert -- [input.csv] [output.csv] [reference.csv]
```

Or run it directly:

```bash
node scripts/convert-vs-to-hp.js [input.csv] [output.csv] [reference.csv]
```

## Arguments

- `input.csv` is the VersaTuner log you want to convert
- `output.csv` is where the converted file should be written
- `reference.csv` is the HP Tuners reference template to use

All three arguments are optional.

## Default Behavior

If you do not pass an input file:

- on macOS, the script opens a file picker
- otherwise, it prompts for a path in the terminal

If you do not pass an output path, the converted file is written to:

```text
logs/converted/HP Format - <input name>.csv
```

If you do not pass a reference file, the script uses the first matching default file it finds in the repo root.

The selected source file is also copied into `logs/pending/` before conversion unless it is already there.

## Examples

Convert a file using the default output path and default reference file:

```bash
npm run convert -- "logs/raw/my-log.csv"
```

Convert a file and choose your own output path:

```bash
npm run convert -- "logs/raw/my-log.csv" "logs/converted/custom-output.csv"
```

Convert a file with a custom reference template:

```bash
npm run convert -- "logs/raw/my-log.csv" "logs/converted/custom-output.csv" "HPFormat.csv"
```

Show the built-in help:

```bash
npm run convert -- --help
```
