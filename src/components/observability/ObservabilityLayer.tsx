import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { WorldState } from "../../simulation/types";
import type { SimEvent } from "../../observability/events";
import { TimeSeriesStore, type TimeSeriesSample } from "../../observability/time-series";
import type { DebugOverlayConfig } from "../../observability/debug-overlay";
import { GraphsPanel } from "./GraphsPanel";
import { EventLogPanel } from "./EventLogPanel";
import { AnalysisPanel } from "./AnalysisPanel";
import { DebugPanel } from "./DebugPanel";

interface ObservabilityLayerProps {
  worldRef: MutableRefObject<WorldState>;
  debugOverlayRef: MutableRefObject<DebugOverlayConfig>;
  stepOnceRef: MutableRefObject<boolean>;
  pausedRef: MutableRefObject<boolean>;
  openPanels: Set<string>;
  onTogglePanel: (id: string) => void;
}

function sampleWorld(world: WorldState): TimeSeriesSample {
  const orgs = world.organisms;
  const n = orgs.length || 1;
  let sumSpeed = 0,
    sumVision = 0,
    sumMeta = 0,
    sumAgg = 0,
    sumEff = 0,
    hunters = 0,
    totalEnergy = 0;
  for (const o of orgs) {
    sumSpeed += o.speed;
    sumVision += o.vision;
    sumMeta += o.metabolism;
    sumAgg += o.aggression;
    sumEff += o.efficiency;
    totalEnergy += o.energy;
    if (o.state === "HUNTING") hunters++;
  }
  let largest = 0;
  for (const s of world.societies) {
    if (s.memberIds.size > largest) largest = s.memberIds.size;
  }
  return {
    tick: world.tick,
    population: orgs.length,
    food: world.food.length,
    societies: world.societies.length,
    avgSpeed: sumSpeed / n,
    avgVision: sumVision / n,
    avgMetabolism: sumMeta / n,
    avgAggression: sumAgg / n,
    avgEfficiency: sumEff / n,
    hunters,
    largestSociety: largest,
    totalEnergy,
  };
}

export function ObservabilityLayer({
  worldRef,
  debugOverlayRef,
  stepOnceRef,
  pausedRef,
  openPanels,
  onTogglePanel,
}: ObservabilityLayerProps) {
  const [, setRenderTick] = useState(0);

  const timeSeriesRef = useRef(new TimeSeriesStore(600));
  const eventLogRef = useRef<SimEvent[]>([]);

  // 500ms sampling interval
  useEffect(() => {
    const id = setInterval(() => {
      const world = worldRef.current;

      // Sample time series
      timeSeriesRef.current.push(sampleWorld(world));

      // Drain events from world
      if (world.events.length > 0) {
        eventLogRef.current = [...world.events, ...eventLogRef.current].slice(0, 200);
        world.events = [];
      }

      // Trigger re-render for open panels
      setRenderTick((t) => t + 1);
    }, 500);
    return () => clearInterval(id);
  }, [worldRef]);

  return (
    <>
      {openPanels.has("graphs") && (
        <GraphsPanel timeSeriesRef={timeSeriesRef} onClose={() => onTogglePanel("graphs")} />
      )}
      {openPanels.has("events") && (
        <EventLogPanel eventLogRef={eventLogRef} onClose={() => onTogglePanel("events")} />
      )}
      {openPanels.has("analysis") && (
        <AnalysisPanel
          timeSeriesRef={timeSeriesRef}
          worldRef={worldRef}
          onClose={() => onTogglePanel("analysis")}
        />
      )}
      {openPanels.has("debug") && (
        <DebugPanel
          debugOverlayRef={debugOverlayRef}
          worldRef={worldRef}
          stepOnceRef={stepOnceRef}
          pausedRef={pausedRef}
          onClose={() => onTogglePanel("debug")}
        />
      )}
    </>
  );
}
