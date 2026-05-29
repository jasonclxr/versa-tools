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
  ["Offset", ({ row, sourceColumns, getSourceValue }) => getSourceValue(row, sourceColumns, "time")],
  ["Knock Retard", ({ row, sourceColumns, getSourceValue }) => getSourceValue(row, sourceColumns, "knockRetard")],
  ["Short Term Fuel Trim Bank 1", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "shortTermFuelTrim")],
  ["Long Term Fuel Trim Bank 1", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "longTermFuelTrim")],
  ["Timing Advance", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "timingAdvance")],
  ["Timing Advance (SAE)", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "timingAdvance")],
  ["Engine RPM", ({ row, sourceColumns, getSourceValue }) => getSourceValue(row, sourceColumns, "rpm")],
  ["Engine RPM (SAE)", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "rpm")],
  ["Accelerator Position D (SAE)", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "acceleratorPedal")],
  ["Commanded Throttle Actuator (SAE)", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "throttle")],
  ["Relative Throttle Position (SAE)", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "throttle")],
  ["Accelerator Pedal Position", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "acceleratorPedal")],
  ["Throttle Position (SAE)", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "throttle")],
  ["Long Term Fuel Trim Bank 1 (SAE)", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "longTermFuelTrim")],
  ["Short Term Fuel Trim Bank 1 (SAE)", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "shortTermFuelTrim")],
  ["Vehicle Speed", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "vehicleSpeed")],
  ["Catalyst Temp B1S1 (SAE)", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "catalystTemp")],
  ["Intake Air Temp (SAE)", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "intakeAirTemp")],
  ["Intake Air Temp", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "manifoldAirTemp")],
  ["Engine Coolant Temp", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "coolantTemp")],
  ["Ambient Air Temp", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "intakeAirTemp")],
  ["Intake Cam Des Angle", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "intakeCamDesired")],
  ["Intake Cam Angle", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "intakeCamActual")],
  ["Exhaust Cam Des Angle", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "exhaustCamDesired")],
  ["Exhaust Cam Angle", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "exhaustCamActual")],
  ["Injector Pulse Width", ({ row, sourceColumns, getSourceValue }) =>
    getSourceValue(row, sourceColumns, "injectorPulseWidth")],
]);

function getComputedLabelValue(label, computedValues) {
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

module.exports = {
  STATIC_VALUES,
  DIRECT_VALUE_SOURCES,
  getComputedLabelValue,
};
