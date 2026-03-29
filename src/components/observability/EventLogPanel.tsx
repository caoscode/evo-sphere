import { useState, type MutableRefObject } from "react";
import type { SimEvent, SimEventType } from "../../observability/events";
import { FloatingPanel } from "./FloatingPanel";

interface EventLogPanelProps {
  eventLogRef: MutableRefObject<SimEvent[]>;
  onClose: () => void;
}

type EventFilter = "all" | "societies" | "population" | "resources";

const EVENT_COLORS: Record<SimEventType, string> = {
  society_formed: "#7c6cff",
  society_dissolved: "#b06cff",
  society_fragmented: "#9c6cff",
  population_crash: "#ff6b6b",
  food_surge: "#44cc55",
  rescue_spawn: "#ffcc44",
  trait_shift: "#55ccee",
};

const EVENT_ICONS: Record<SimEventType, string> = {
  society_formed: "\u2726",
  society_dissolved: "\u2717",
  society_fragmented: "\u2704",
  population_crash: "\u2620",
  food_surge: "\u2618",
  rescue_spawn: "\u271A",
  trait_shift: "\u2191",
};

const FILTER_MAP: Record<EventFilter, SimEventType[]> = {
  all: [],
  societies: ["society_formed", "society_dissolved", "society_fragmented"],
  population: ["population_crash", "rescue_spawn", "trait_shift"],
  resources: ["food_surge"],
};

export function EventLogPanel({ eventLogRef, onClose }: EventLogPanelProps) {
  const [filter, setFilter] = useState<EventFilter>("all");
  const events = eventLogRef.current;

  const filtered =
    filter === "all" ? events : events.filter((e) => FILTER_MAP[filter].includes(e.type));

  return (
    <FloatingPanel
      title="Event Log"
      defaultX={window.innerWidth - 310}
      defaultY={340}
      onClose={onClose}
      width={300}
    >
      <div className="event-log-filters">
        {(["all", "societies", "population", "resources"] as const).map((f) => (
          <button
            key={f}
            className={`event-filter-btn${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div className="event-log">
        {filtered.length === 0 && <div className="empty-msg">No events yet</div>}
        {filtered.map((event, i) => (
          <div key={`${event.tick}-${event.type}-${i}`} className="event-entry">
            <span className="event-tick">{event.tick}</span>
            <span className="event-icon" style={{ color: EVENT_COLORS[event.type] }}>
              {EVENT_ICONS[event.type]}
            </span>
            <span className="event-detail">{event.detail}</span>
          </div>
        ))}
      </div>
    </FloatingPanel>
  );
}
