import { useCallback, useEffect, useRef, useState } from "react";
import type { SimulationConfig, WorldState } from "../simulation/types";
import type { Camera } from "../rendering/camera";
import { injectFoodBurst } from "../simulation/food";
import { killPortion, computeCentroid } from "../simulation/world";
import { createSimulation } from "../simulation/world";
import { StatsDisplay } from "./StatsDisplay";

type TabId = "ctrl" | "stats" | "org";

interface ControlPanelProps {
  worldRef: React.MutableRefObject<WorldState>;
  configRef: React.MutableRefObject<SimulationConfig>;
  pausedRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
  cameraRef: React.MutableRefObject<Camera>;
  selectedIdRef: React.MutableRefObject<number | null>;
  openPanels: Set<string>;
  onTogglePanel: (id: string) => void;
}

const PANEL_BUTTONS = [
  { id: "graphs", label: "⇟", title: "Graphs" },
  { id: "events", label: "≡", title: "Event Log" },
  { id: "analysis", label: "☉", title: "Analysis" },
  { id: "debug", label: "⚙", title: "Debug" },
] as const;

export function ControlPanel({
  worldRef,
  configRef,
  pausedRef,
  speedRef,
  cameraRef,
  selectedIdRef,
  openPanels,
  onTogglePanel,
}: ControlPanelProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("ctrl");
  const [paused, setPaused] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);
  const [foodRate, setFoodRate] = useState(configRef.current.foodSpawnRate);
  const [energyCost, setEnergyCost] = useState(configRef.current.energyCostMultiplier);
  const [simSpeed, setSimSpeed] = useState(1);
  const [mutationRate, setMutationRate] = useState(configRef.current.mutationRate);

  const tabRef = useRef(tab);
  tabRef.current = tab;

  // Track organism selection state
  useEffect(() => {
    const id = setInterval(() => {
      setHasSelected(selectedIdRef.current !== null);
    }, 300);
    return () => clearInterval(id);
  }, [selectedIdRef]);

  // Leave Org tab when selection clears
  useEffect(() => {
    if (!hasSelected) {
      setTab((prev) => (prev === "org" ? "ctrl" : prev));
    }
  }, [hasSelected]);

  // Jump to Org tab when panel opens with an active selection
  useEffect(() => {
    if (open && hasSelected) setTab("org");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFoodRate = useCallback(
    (v: number) => {
      setFoodRate(v);
      configRef.current.foodSpawnRate = v;
    },
    [configRef],
  );

  const handleEnergyCost = useCallback(
    (v: number) => {
      setEnergyCost(v);
      configRef.current.energyCostMultiplier = v;
    },
    [configRef],
  );

  const handleSimSpeed = useCallback(
    (v: number) => {
      setSimSpeed(v);
      speedRef.current = v;
    },
    [speedRef],
  );

  const handleMutationRate = useCallback(
    (v: number) => {
      setMutationRate(v);
      configRef.current.mutationRate = v;
    },
    [configRef],
  );

  const togglePause = useCallback(() => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
  }, [paused, pausedRef]);

  const handleReset = useCallback(() => {
    worldRef.current = createSimulation(configRef.current);
    setPaused(false);
    pausedRef.current = false;
    const c = computeCentroid(worldRef.current.organisms);
    cameraRef.current.x = c.x;
    cameraRef.current.y = c.y;
  }, [worldRef, configRef, pausedRef, cameraRef]);

  const handleCenterView = useCallback(() => {
    const c = computeCentroid(worldRef.current.organisms);
    cameraRef.current.x = c.x;
    cameraRef.current.y = c.y;
  }, [worldRef, cameraRef]);

  const handleInjectFood = useCallback(() => {
    injectFoodBurst(worldRef.current, configRef.current, 50);
  }, [worldRef, configRef]);

  const handleKill = useCallback(() => {
    killPortion(worldRef.current, 0.5);
  }, [worldRef]);

  return (
    <>
      {/* Floating action button */}
      <button
        className={`fab${open ? " fab-hidden" : ""}${paused ? " fab-paused" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Open controls"
      >
        ⚙
      </button>

      {/* Bottom sheet / side panel */}
      <div className={`sheet${open ? " sheet-open" : ""}`} role="dialog" aria-modal="true">
        <div className="sheet-handle" />

        <div className="sheet-header">
          <span className="sheet-title">EvoSphere</span>
          <nav className="tab-bar">
            {(["ctrl", "stats"] as TabId[]).map((t) => (
              <button
                key={t}
                className={`tab-btn${tab === t ? " active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "ctrl" ? "Controls" : "Stats"}
              </button>
            ))}
            {hasSelected && (
              <button
                className={`tab-btn${tab === "org" ? " active" : ""}`}
                onClick={() => setTab("org")}
              >
                Org
              </button>
            )}
          </nav>
          <button className="sheet-close" onClick={() => setOpen(false)} aria-label="Close panel">
            ✕
          </button>
        </div>

        <div className="sheet-content">
          {tab === "ctrl" && (
            <div className="tab-pane">
              <div className="action-row">
                <button className={`action-btn${paused ? " active" : ""}`} onClick={togglePause}>
                  {paused ? "▶ Resume" : "⏸ Pause"}
                </button>
                <button className="action-btn" onClick={handleCenterView}>
                  ⊙ Center
                </button>
                <button className="action-btn danger" onClick={handleReset}>
                  ↺ Reset
                </button>
              </div>
              <label className="slider-wrap">
                <span className="slider-label">
                  Speed <span className="slider-value">{simSpeed}×</span>
                </span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={simSpeed}
                  onChange={(e) => handleSimSpeed(Number(e.target.value))}
                />
              </label>
              <label className="slider-wrap">
                <span className="slider-label">
                  Food Rate <span className="slider-value">{foodRate.toFixed(1)}</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={foodRate}
                  onChange={(e) => handleFoodRate(Number(e.target.value))}
                />
              </label>
              <label className="slider-wrap">
                <span className="slider-label">
                  Energy Cost <span className="slider-value">{energyCost.toFixed(1)}</span>
                </span>
                <input
                  type="range"
                  min="0.2"
                  max="3"
                  step="0.1"
                  value={energyCost}
                  onChange={(e) => handleEnergyCost(Number(e.target.value))}
                />
              </label>
              <label className="slider-wrap">
                <span className="slider-label">
                  Mutation Rate <span className="slider-value">{mutationRate.toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min="0.01"
                  max="0.5"
                  step="0.01"
                  value={mutationRate}
                  onChange={(e) => handleMutationRate(Number(e.target.value))}
                />
              </label>
              <div className="action-row">
                <button className="action-btn" onClick={handleInjectFood}>
                  + Food
                </button>
                <button className="action-btn danger" onClick={handleKill}>
                  Kill 50%
                </button>
              </div>
              <div className="stat-divider" />
              <div className="stat-label">Views</div>
              <div className="action-row">
                {PANEL_BUTTONS.map((p) => (
                  <button
                    key={p.id}
                    className={`action-btn${openPanels.has(p.id) ? " active" : ""}`}
                    title={p.title}
                    onClick={() => onTogglePanel(p.id)}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "stats" && (
            <div className="tab-pane">
              <StatsDisplay worldRef={worldRef} />
            </div>
          )}

          {tab === "org" && (
            <div className="tab-pane">
              <SelectedOrganism worldRef={worldRef} selectedIdRef={selectedIdRef} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SelectedOrganism({
  worldRef,
  selectedIdRef,
}: {
  worldRef: React.RefObject<WorldState>;
  selectedIdRef: React.RefObject<number | null>;
}) {
  const [info, setInfo] = useState<{
    id: number;
    energy: number;
    speed: number;
    vision: number;
    metabolism: number;
    aggression: number;
    awareness: number;
    efficiency: number;
    riskTolerance: number;
    socialAffinity: number;
    state: string;
    generation: number;
    age: number;
    abilities: string[];
    role: string;
    societyId: number | null;
    societySize: number;
    sharedPool: number;
    strategy: string | null;
    stability: number | null;
    personality: {
      aggression: number;
      defensiveness: number;
      expansiveness: number;
      economicFocus: number;
    } | null;
    topRival: { id: number; hostility: number } | null;
  } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const id = selectedIdRef.current;
      if (id == null) {
        setInfo(null);
        return;
      }
      const org = worldRef.current.organisms.find((o) => o.id === id);
      if (!org) {
        setInfo(null);
        selectedIdRef.current = null;
        return;
      }
      const society =
        org.societyId !== null
          ? worldRef.current.societies.find((s) => s.id === org.societyId)
          : null;
      setInfo({
        id: org.id,
        energy: org.energy,
        speed: org.speed,
        vision: org.vision,
        metabolism: org.metabolism,
        aggression: org.aggression,
        awareness: org.awareness,
        efficiency: org.efficiency,
        riskTolerance: org.riskTolerance,
        socialAffinity: org.socialAffinity,
        state: org.state,
        generation: org.generation,
        age: org.age,
        abilities: org.abilities.map((a) => `${a.type}${a.active ? "*" : ""}`),
        role: org.role,
        societyId: org.societyId,
        societySize: society?.memberIds.size ?? 0,
        sharedPool: society?.sharedPool ?? 0,
        strategy: society?.strategy ?? null,
        stability: society?.stabilityScore ?? null,
        personality: society?.personality ?? null,
        topRival: (() => {
          if (!society) return null;
          let best: { id: number; hostility: number } | null = null;
          for (const [sid, h] of society.rivalries) {
            if (!best || h > best.hostility) best = { id: sid, hostility: h };
          }
          return best && best.hostility > 0.1 ? best : null;
        })(),
      });
    }, 250);
    return () => clearInterval(interval);
  }, [worldRef, selectedIdRef]);

  if (!info) return <p className="empty-msg">Click an organism to inspect it.</p>;

  return (
    <div className="stats">
      <div className="stat-label">Selected #{info.id}</div>
      <div className="stat-row">
        <span>State</span>
        <span>{info.state}</span>
      </div>
      <div className="stat-row">
        <span>Energy</span>
        <span>{info.energy.toFixed(1)}</span>
      </div>
      <div className="stat-row">
        <span>Gen / Age</span>
        <span>
          {info.generation} / {info.age}
        </span>
      </div>
      <div className="stat-row">
        <span>Speed</span>
        <span>{info.speed.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Vision</span>
        <span>{info.vision.toFixed(1)}</span>
      </div>
      <div className="stat-row">
        <span>Aggression</span>
        <span>{info.aggression.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Awareness</span>
        <span>{info.awareness.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Efficiency</span>
        <span>{info.efficiency.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Risk</span>
        <span>{info.riskTolerance.toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span>Social</span>
        <span>{info.socialAffinity.toFixed(2)}</span>
      </div>
      {info.abilities.length > 0 && (
        <div className="stat-row">
          <span>Abilities</span>
          <span>{info.abilities.join(", ")}</span>
        </div>
      )}
      {info.societyId !== null && (
        <>
          <div className="stat-divider" />
          <div className="stat-label">Society #{info.societyId}</div>
          <div className="stat-row">
            <span>Role</span>
            <span>{info.role}</span>
          </div>
          <div className="stat-row">
            <span>Members</span>
            <span>{info.societySize}</span>
          </div>
          <div className="stat-row">
            <span>Shared Pool</span>
            <span>{info.sharedPool.toFixed(1)}</span>
          </div>
          {info.strategy && (
            <div className="stat-row">
              <span>Strategy</span>
              <span>{info.strategy}</span>
            </div>
          )}
          {info.stability !== null && (
            <div className="stat-row">
              <span>Stability</span>
              <span>{info.stability.toFixed(2)}</span>
            </div>
          )}
          {info.personality && (
            <>
              <div className="stat-label" style={{ marginTop: 4 }}>
                Personality
              </div>
              <div className="stat-row">
                <span>Aggression</span>
                <span>{info.personality.aggression.toFixed(2)}</span>
              </div>
              <div className="stat-row">
                <span>Defense</span>
                <span>{info.personality.defensiveness.toFixed(2)}</span>
              </div>
              <div className="stat-row">
                <span>Expansion</span>
                <span>{info.personality.expansiveness.toFixed(2)}</span>
              </div>
              <div className="stat-row">
                <span>Economy</span>
                <span>{info.personality.economicFocus.toFixed(2)}</span>
              </div>
            </>
          )}
          {info.topRival && (
            <div className="stat-row">
              <span>Top Rival</span>
              <span>
                #{info.topRival.id} ({info.topRival.hostility.toFixed(2)})
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
