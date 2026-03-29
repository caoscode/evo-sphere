import type { MutableRefObject } from "react";
import type { WorldState } from "../../simulation/types";
import type { TimeSeriesStore } from "../../observability/time-series";
import { analyzeState, type InsightSeverity } from "../../observability/analysis";
import { FloatingPanel } from "./FloatingPanel";

interface AnalysisPanelProps {
  timeSeriesRef: MutableRefObject<TimeSeriesStore>;
  worldRef: MutableRefObject<WorldState>;
  onClose: () => void;
}

const SEVERITY_COLORS: Record<InsightSeverity, string> = {
  info: "#55aaff",
  warning: "#ffaa44",
  critical: "#ff5555",
};

const SEVERITY_ICONS: Record<InsightSeverity, string> = {
  info: "\u2139",
  warning: "\u26A0",
  critical: "\u2622",
};

export function AnalysisPanel({ timeSeriesRef, worldRef, onClose }: AnalysisPanelProps) {
  const recent = timeSeriesRef.current.getRecent(30);
  const insights = analyzeState(recent, worldRef.current);

  return (
    <FloatingPanel
      title="Analysis"
      defaultX={16}
      defaultY={window.innerHeight - 280}
      onClose={onClose}
      width={300}
    >
      <div className="analysis-list">
        {insights.length === 0 && <div className="empty-msg">No notable patterns</div>}
        {insights.map((insight, i) => (
          <div
            key={i}
            className="insight-badge"
            style={{ borderLeftColor: SEVERITY_COLORS[insight.severity] }}
          >
            <span className="insight-icon" style={{ color: SEVERITY_COLORS[insight.severity] }}>
              {SEVERITY_ICONS[insight.severity]}
            </span>
            <span className="insight-message">{insight.message}</span>
          </div>
        ))}
      </div>
    </FloatingPanel>
  );
}
