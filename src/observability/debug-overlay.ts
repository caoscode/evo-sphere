import type { BehaviorState } from "../simulation/types";

export interface EntityFilter {
  hiddenStates: Set<BehaviorState>;
  showOnlySocietyMembers: boolean;
  showOnlyIndependents: boolean;
  minGeneration: number;
}

export interface DebugOverlayConfig {
  showMovementVectors: boolean;
  showVisionRings: boolean;
  showFoodDensity: boolean;
  highlightSocietyId: number | null;
  entityFilter: EntityFilter;
}

export function createDefaultDebugOverlay(): DebugOverlayConfig {
  return {
    showMovementVectors: false,
    showVisionRings: false,
    showFoodDensity: false,
    highlightSocietyId: null,
    entityFilter: {
      hiddenStates: new Set(),
      showOnlySocietyMembers: false,
      showOnlyIndependents: false,
      minGeneration: 0,
    },
  };
}
