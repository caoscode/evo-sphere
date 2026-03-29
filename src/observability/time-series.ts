export interface TimeSeriesSample {
  tick: number;
  population: number;
  food: number;
  societies: number;
  avgSpeed: number;
  avgVision: number;
  avgMetabolism: number;
  avgAggression: number;
  avgEfficiency: number;
  hunters: number;
  largestSociety: number;
  totalEnergy: number;
}

export class TimeSeriesStore {
  readonly capacity: number;
  private buffer: TimeSeriesSample[];
  private writeIndex = 0;
  private count = 0;

  constructor(capacity = 600) {
    this.capacity = capacity;
    this.buffer = Array.from<TimeSeriesSample>({ length: capacity });
  }

  push(sample: TimeSeriesSample): void {
    this.buffer[this.writeIndex] = sample;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  getRecent(n: number): TimeSeriesSample[] {
    const count = Math.min(n, this.count);
    const result: TimeSeriesSample[] = [];
    let idx = (this.writeIndex - count + this.capacity) % this.capacity;
    for (let i = 0; i < count; i++) {
      result.push(this.buffer[idx]);
      idx = (idx + 1) % this.capacity;
    }
    return result;
  }

  get length(): number {
    return this.count;
  }

  clear(): void {
    this.writeIndex = 0;
    this.count = 0;
  }
}
