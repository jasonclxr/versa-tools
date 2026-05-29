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

module.exports = {
  SOURCE_COLUMN_OPTIONS,
  resolveSourceColumns,
  findUnmappedSourceHeaders,
  reportUnmappedSourceHeaders,
};
