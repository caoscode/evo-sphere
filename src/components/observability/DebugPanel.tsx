import { useCallback, useState, type MutableRefObject } from "react";
import type { WorldState, BehaviorState } from "../../simulation/types";
import type { DebugOverlayConfig } from "../../observability/debug-overlay";
import { FloatingPanel } from "./FloatingPanel";

interface DebugPanelProps {
  debugOverlayRef: MutableRefObject<DebugOverlayConfig>;
  worldRef: MutableRefObject<WorldState>;
  stepOnceRef: MutableRefObject<boolean>;
  pausedRef: MutableRefObject<boolean>;
  onClose: () => void;
}

const BEHAVIOR_STATES: BehaviorState[] = [
  "FORAGING",
  "HUNTING",
  "FLEEING",
  "FEEDING",
  "GATHERING",
  "BUILDING",
  "DEFENDING",
  "COOPERATING",
  "PATROLLING",
  "INVADING",
];

export function DebugPanel({
  debugOverlayRef,
  worldRef,
  stepOnceRef,
  pausedRef,
  onClose,
}: DebugPanelProps) {
  const [, forceUpdate] = useState(0);
  const config = debugOverlayRef.current;

  const update = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  const toggleBool = useCallback(
    (key: "showMovementVectors" | "showVisionRings" | "showFoodDensity") => {
      debugOverlayRef.current[key] = !debugOverlayRef.current[key];
      update();
    },
    [debugOverlayRef, update],
  );

  const toggleState = useCallback(
    (state: BehaviorState) => {
      const set = debugOverlayRef.current.entityFilter.hiddenStates;
      if (set.has(state)) set.delete(state);
      else set.add(state);
      update();
    },
    [debugOverlayRef, update],
  );

  const societies = worldRef.current.societies;

  return (
    <FloatingPanel
      title="Debug"
      defaultX={Math.max(80, window.innerWidth / 2 - 140)}
      defaultY={16}
      onClose={onClose}
      width={280}
    >
      <div className="debug-section">
        <div className="debug-section-title">Overlays</div>
        <label className="debug-toggle">
          <input
            type="checkbox"
            checked={config.showMovementVectors}
            onChange={() => toggleBool("showMovementVectors")}
          />
          Movement vectors
        </label>
        <label className="debug-toggle">
          <input
            type="checkbox"
            checked={config.showVisionRings}
            onChange={() => toggleBool("showVisionRings")}
          />
          Vision rings (always)
        </label>
        <label className="debug-toggle">
          <input
            type="checkbox"
            checked={config.showFoodDensity}
            onChange={() => toggleBool("showFoodDensity")}
          />
          Enhanced food density
        </label>
      </div>

      <div className="debug-section">
        <div className="debug-section-title">Highlight Society</div>
        <select
          className="debug-select"
          value={config.highlightSocietyId ?? ""}
          onChange={(e) => {
            debugOverlayRef.current.highlightSocietyId = e.target.value
              ? Number(e.target.value)
              : null;
            update();
          }}
        >
          <option value="">None</option>
          {societies.map((s) => (
            <option key={s.id} value={s.id}>
              Society #{s.id} ({s.memberIds.size} members)
            </option>
          ))}
        </select>
      </div>

      <div className="debug-section">
        <div className="debug-section-title">Filter by State</div>
        <div className="debug-state-grid">
          {BEHAVIOR_STATES.map((state) => (
            <label key={state} className="debug-toggle-sm">
              <input
                type="checkbox"
                checked={!config.entityFilter.hiddenStates.has(state)}
                onChange={() => toggleState(state)}
              />
              {state.slice(0, 4).toLowerCase()}
            </label>
          ))}
        </div>
      </div>

      <div className="debug-section">
        <div className="debug-section-title">Min Generation</div>
        <input
          type="range"
          className="debug-range"
          min={0}
          max={50}
          value={config.entityFilter.minGeneration}
          onChange={(e) => {
            debugOverlayRef.current.entityFilter.minGeneration = Number(e.target.value);
            update();
          }}
        />
        <span className="debug-range-value">{config.entityFilter.minGeneration}</span>
      </div>

      <div className="debug-section">
        <button
          className="action-btn"
          onClick={() => {
            if (pausedRef.current) {
              stepOnceRef.current = true;
            }
          }}
        >
          Step Frame (.)
        </button>
      </div>
    </FloatingPanel>
  );
}
