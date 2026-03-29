import type { WorldState } from "../simulation/types";
import type { TimeSeriesSample } from "./time-series";

export type InsightSeverity = "info" | "warning" | "critical";

export interface Insight {
  severity: InsightSeverity;
  message: string;
}

export function analyzeState(recent: TimeSeriesSample[], world: WorldState): Insight[] {
  const insights: Insight[] = [];
  if (recent.length < 5) return insights;

  const latest = recent[recent.length - 1];

  // Population critically low
  if (latest.population < 15) {
    insights.push({ severity: "critical", message: "Population critically low — extinction risk" });
  }

  // Population declining
  if (recent.length >= 10) {
    const older = recent.slice(-10, -5);
    const newer = recent.slice(-5);
    const avgOld = older.reduce((s, r) => s + r.population, 0) / older.length;
    const avgNew = newer.reduce((s, r) => s + r.population, 0) / newer.length;
    if (avgOld > 20 && avgNew < avgOld * 0.8) {
      insights.push({ severity: "warning", message: "Population declining rapidly" });
    }
    if (avgOld > 0 && avgNew > avgOld * 1.3) {
      insights.push({ severity: "info", message: "Population boom underway" });
    }
  }

  // Food shortage
  if (recent.length >= 5) {
    const recentSlice = recent.slice(-5);
    const allLow = recentSlice.every((s) => s.population > 0 && s.food / s.population < 1.5);
    if (allLow && latest.population > 10) {
      insights.push({ severity: "warning", message: "Food shortage — organisms starving" });
    }
  }

  // Resource surplus
  if (latest.population > 0 && latest.food > latest.population * 3) {
    insights.push({ severity: "info", message: "Resource surplus — expect population boom" });
  }

  // High predation
  if (latest.population > 0 && latest.hunters / latest.population > 0.3) {
    insights.push({ severity: "info", message: "High predation activity" });
  }

  // Trait trends
  if (recent.length >= 20) {
    const old20 = recent.slice(-20, -10);
    const new10 = recent.slice(-10);
    const traitKeys: Array<{ key: keyof TimeSeriesSample; name: string }> = [
      { key: "avgSpeed", name: "Speed" },
      { key: "avgAggression", name: "Aggression" },
      { key: "avgEfficiency", name: "Efficiency" },
      { key: "avgMetabolism", name: "Metabolism" },
    ];
    for (const { key, name } of traitKeys) {
      const avgOld = old20.reduce((s, r) => s + (r[key] as number), 0) / old20.length;
      const avgNew = new10.reduce((s, r) => s + (r[key] as number), 0) / new10.length;
      if (avgOld > 0 && avgNew > avgOld * 1.15) {
        insights.push({
          severity: "info",
          message: `${name} trending upward — evolutionary pressure`,
        });
      }
      if (avgOld > 0 && avgNew < avgOld * 0.85) {
        insights.push({ severity: "info", message: `${name} trending downward` });
      }
    }
  }

  // Society dominance
  for (const society of world.societies) {
    if (latest.population > 0 && society.memberIds.size / latest.population > 0.4) {
      insights.push({
        severity: "info",
        message: `Society #${society.id} is dominant (${society.memberIds.size} members, ${Math.round((society.memberIds.size / latest.population) * 100)}%)`,
      });
    }
    if (society.history.isFalling && society.stabilityScore < 0.3) {
      insights.push({
        severity: "warning",
        message: `Society #${society.id} is collapsing (stability: ${(society.stabilityScore * 100).toFixed(0)}%)`,
      });
    }
    if (society.history.isRising && society.stabilityScore > 0.7) {
      insights.push({
        severity: "info",
        message: `Society #${society.id} is thriving`,
      });
    }
  }

  return insights;
}
