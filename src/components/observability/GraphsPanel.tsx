import type { MutableRefObject } from "react";
import type { TimeSeriesStore } from "../../observability/time-series";
import { FloatingPanel } from "./FloatingPanel";
import { Sparkline } from "./Sparkline";

interface GraphsPanelProps {
  timeSeriesRef: MutableRefObject<TimeSeriesStore>;
  onClose: () => void;
}

const GRAPH_W = 126;
const GRAPH_H = 56;

export function GraphsPanel({ timeSeriesRef, onClose }: GraphsPanelProps) {
  const samples = timeSeriesRef.current.getRecent(120);
  if (samples.length < 2) {
    return (
      <FloatingPanel
        title="Graphs"
        defaultX={window.innerWidth - 310}
        defaultY={16}
        onClose={onClose}
      >
        <div className="empty-msg">Collecting data...</div>
      </FloatingPanel>
    );
  }

  const pop = samples.map((s) => s.population);
  const food = samples.map((s) => s.food);
  const soc = samples.map((s) => s.societies);
  const speed = samples.map((s) => s.avgSpeed);
  const agg = samples.map((s) => s.avgAggression);
  const eff = samples.map((s) => s.avgEfficiency);

  return (
    <FloatingPanel
      title="Graphs"
      defaultX={window.innerWidth - 310}
      defaultY={16}
      onClose={onClose}
    >
      <div className="sparkline-grid">
        <Sparkline
          data={pop}
          width={GRAPH_W}
          height={GRAPH_H}
          color="#e0e0e8"
          label="Population"
          minY={0}
        />
        <Sparkline
          data={food}
          width={GRAPH_W}
          height={GRAPH_H}
          color="#44cc55"
          label="Food"
          minY={0}
        />
        <Sparkline
          data={soc}
          width={GRAPH_W}
          height={GRAPH_H}
          color="#7c6cff"
          label="Societies"
          minY={0}
        />
        <Sparkline
          data={speed}
          width={GRAPH_W}
          height={GRAPH_H}
          color="#55ccee"
          label="Avg Speed"
        />
        <Sparkline
          data={agg}
          width={GRAPH_W}
          height={GRAPH_H}
          color="#ff6b6b"
          label="Aggression"
          minY={0}
          maxY={1}
        />
        <Sparkline data={eff} width={GRAPH_W} height={GRAPH_H} color="#ffcc44" label="Efficiency" />
      </div>
    </FloatingPanel>
  );
}
