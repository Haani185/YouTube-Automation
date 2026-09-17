export type HealthLevel = "HEALTHY" | "WARNING" | "BLOCKED";

export function budgetHealth(actualUsd:number, limitUsd:number):HealthLevel {
  if (limitUsd <= 0) return "WARNING";
  const ratio=actualUsd/limitUsd;
  if (ratio>=1) return "BLOCKED";
  if (ratio>=.8) return "WARNING";
  return "HEALTHY";
}

export function aggregateHealth(levels:HealthLevel[]):HealthLevel {
  if(levels.includes("BLOCKED"))return "BLOCKED";
  if(levels.includes("WARNING"))return "WARNING";
  return "HEALTHY";
}
