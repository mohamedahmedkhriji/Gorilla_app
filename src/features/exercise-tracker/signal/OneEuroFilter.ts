const DEFAULT_FREQUENCY_HZ = 30;
const MIN_DELTA_TIME_SECONDS = 1 / 240;

const clampPositive = (value: number, fallback: number) => (
  Number.isFinite(value) && value > 0 ? value : fallback
);

class LowPassFilter {
  private initialized = false;
  private previousValue = 0;

  reset() {
    this.initialized = false;
    this.previousValue = 0;
  }

  filter(value: number, alpha: number) {
    if (!this.initialized) {
      this.initialized = true;
      this.previousValue = value;
      return value;
    }

    this.previousValue = (alpha * value) + ((1 - alpha) * this.previousValue);
    return this.previousValue;
  }

  hasValue() {
    return this.initialized;
  }
}

export interface OneEuroFilterOptions {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

export class OneEuroFilter {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;

  private lastTimestampMs: number | null = null;
  private lastRawValue: number | null = null;
  private readonly valueFilter = new LowPassFilter();
  private readonly derivativeFilter = new LowPassFilter();

  constructor(options: OneEuroFilterOptions) {
    this.minCutoff = clampPositive(options.minCutoff, 1);
    this.beta = Number.isFinite(options.beta) ? options.beta : 0;
    this.dCutoff = clampPositive(options.dCutoff, 1);
  }

  reset() {
    this.lastTimestampMs = null;
    this.lastRawValue = null;
    this.valueFilter.reset();
    this.derivativeFilter.reset();
  }

  filter(value: number, timestampMs: number) {
    if (!Number.isFinite(value)) {
      return this.lastRawValue ?? 0;
    }

    const deltaSeconds = this.getDeltaSeconds(timestampMs);
    const alphaDerivative = this.computeAlpha(this.dCutoff, deltaSeconds);
    const rawDerivative = this.lastRawValue === null
      ? 0
      : (value - this.lastRawValue) / deltaSeconds;

    const filteredDerivative = this.derivativeFilter.filter(rawDerivative, alphaDerivative);
    const cutoff = this.minCutoff + (this.beta * Math.abs(filteredDerivative));
    const alphaValue = this.computeAlpha(cutoff, deltaSeconds);
    const filteredValue = this.valueFilter.filter(value, alphaValue);

    this.lastRawValue = value;
    this.lastTimestampMs = timestampMs;

    return filteredValue;
  }

  private getDeltaSeconds(timestampMs: number) {
    if (this.lastTimestampMs === null) {
      return 1 / DEFAULT_FREQUENCY_HZ;
    }

    const deltaMs = Math.max(0, timestampMs - this.lastTimestampMs);
    return Math.max(MIN_DELTA_TIME_SECONDS, deltaMs / 1000);
  }

  private computeAlpha(cutoff: number, deltaSeconds: number) {
    const safeCutoff = clampPositive(cutoff, this.minCutoff);
    const tau = 1 / (2 * Math.PI * safeCutoff);
    return 1 / (1 + (tau / deltaSeconds));
  }
}
