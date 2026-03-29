export type SimEventType =
  | "society_formed"
  | "society_dissolved"
  | "society_fragmented"
  | "population_crash"
  | "food_surge"
  | "rescue_spawn"
  | "trait_shift";

export interface SimEvent {
  type: SimEventType;
  tick: number;
  detail: string;
  data?: Record<string, number | string>;
}
