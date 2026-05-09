export const recommendations: Record<string, string> = {
  low_oxygen: "Check aeration, water circulation, stocking density, and biofilter flow.",
  ph_drift: "Retest pH, inspect dosing history, and adjust gradually.",
  temperature_spike: "Check heater, shade, pump flow, and recent weather exposure.",
  water_level_issue: "Inspect for leaks, stuck valves, clogged drains, or failed top-off supply.",
  device_offline: "Check power, network connectivity, controller health, and sensor wiring."
};

export function recommendedAction(type: string) {
  return recommendations[type] ?? "Inspect the site and verify the latest sensor readings.";
}
