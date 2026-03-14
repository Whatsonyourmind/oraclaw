/**
 * Monte Carlo Simulation Service
 * Story 5.1 - ORACLE Probability Engine
 */

export interface SimulationConfig {
  iterations: number;
  timeoutMs: number;
  seed?: number;
}

export interface DistributionParams {
  type: 'normal' | 'lognormal' | 'uniform' | 'triangular' | 'beta' | 'exponential';
  params: number[];
}

export interface SimulationFactor {
  name: string;
  distribution: DistributionParams;
}

export interface SimulationOutput {
  mean: number;
  stdDev: number;
  percentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  distribution: Array<{ bucket: number; count: number; percentage: number }>;
  iterations: number;
  executionTimeMs: number;
  timedOut: boolean;
}

// Simple seeded random number generator (Mulberry32)
function createRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform for normal distribution
function normalSample(mean: number, stdDev: number, random: () => number): number {
  const u1 = random();
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

// Sample from various distributions
function sampleDistribution(dist: DistributionParams, random: () => number): number {
  const { type, params } = dist;

  switch (type) {
    case 'normal': {
      // params: [mean, stdDev]
      const [mean, stdDev] = params;
      return normalSample(mean, stdDev, random);
    }

    case 'lognormal': {
      // params: [mu, sigma] (parameters of underlying normal)
      const [mu, sigma] = params;
      return Math.exp(normalSample(mu, sigma, random));
    }

    case 'uniform': {
      // params: [min, max]
      const [min, max] = params;
      return min + random() * (max - min);
    }

    case 'triangular': {
      // params: [min, mode, max]
      const [min, mode, max] = params;
      const u = random();
      const fc = (mode - min) / (max - min);
      if (u < fc) {
        return min + Math.sqrt(u * (max - min) * (mode - min));
      } else {
        return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
      }
    }

    case 'beta': {
      // params: [alpha, beta]
      // Using Gamma distribution method
      const [alpha, beta] = params;
      const gamma1 = gammaSample(alpha, random);
      const gamma2 = gammaSample(beta, random);
      return gamma1 / (gamma1 + gamma2);
    }

    case 'exponential': {
      // params: [lambda (rate)]
      const [lambda] = params;
      return -Math.log(1 - random()) / lambda;
    }

    default:
      return random();
  }
}

// Gamma sampling using Marsaglia and Tsang's method
function gammaSample(shape: number, random: () => number): number {
  if (shape < 1) {
    // Use transformation for shape < 1
    return gammaSample(shape + 1, random) * Math.pow(random(), 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number, v: number;
    do {
      x = normalSample(0, 1, random);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = random();

    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

// Calculate percentile from sorted array
function percentile(sortedValues: number[], p: number): number {
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

// Create histogram buckets
function createHistogram(values: number[], bucketCount: number = 20): Array<{ bucket: number; count: number; percentage: number }> {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const bucketSize = range / bucketCount;

  const buckets = new Array(bucketCount).fill(0);

  for (const value of values) {
    const bucketIndex = Math.min(Math.floor((value - min) / bucketSize), bucketCount - 1);
    buckets[bucketIndex]++;
  }

  return buckets.map((count, i) => ({
    bucket: min + (i + 0.5) * bucketSize,
    count,
    percentage: (count / values.length) * 100,
  }));
}

export class MonteCarloService {
  private defaultConfig: SimulationConfig = {
    iterations: 1000,
    timeoutMs: 10000, // 10 second timeout
  };

  /**
   * Run Monte Carlo simulation with multiple factors
   */
  async runSimulation(
    factors: SimulationFactor[],
    aggregator: (samples: Record<string, number>) => number = (s) => Object.values(s).reduce((a, b) => a + b, 0),
    config: Partial<SimulationConfig> = {}
  ): Promise<SimulationOutput> {
    const startTime = Date.now();
    const iterations = Math.min(config.iterations || this.defaultConfig.iterations, 2000); // Cap at 2000
    const timeoutMs = config.timeoutMs || this.defaultConfig.timeoutMs;
    const seed = config.seed || Date.now();

    const random = createRandom(seed);
    const results: number[] = [];
    let timedOut = false;

    for (let i = 0; i < iterations; i++) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        timedOut = true;
        break;
      }

      // Sample each factor
      const samples: Record<string, number> = {};
      for (const factor of factors) {
        samples[factor.name] = sampleDistribution(factor.distribution, random);
      }

      // Aggregate samples into single outcome
      results.push(aggregator(samples));
    }

    // Calculate statistics
    const sortedResults = [...results].sort((a, b) => a - b);
    const n = results.length;

    const mean = results.reduce((a, b) => a + b, 0) / n;
    const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      percentiles: {
        p5: percentile(sortedResults, 5),
        p10: percentile(sortedResults, 10),
        p25: percentile(sortedResults, 25),
        p50: percentile(sortedResults, 50),
        p75: percentile(sortedResults, 75),
        p90: percentile(sortedResults, 90),
        p95: percentile(sortedResults, 95),
      },
      distribution: createHistogram(sortedResults),
      iterations: n,
      executionTimeMs: Date.now() - startTime,
      timedOut,
    };
  }

  /**
   * Simple single-factor simulation
   */
  async runSingleFactorSimulation(
    distribution: DistributionParams,
    iterations: number = 1000
  ): Promise<SimulationOutput> {
    return this.runSimulation(
      [{ name: 'value', distribution }],
      (s) => s.value,
      { iterations }
    );
  }

  /**
   * Run scenario analysis with multiple named scenarios
   */
  async runScenarioAnalysis(
    scenarios: Record<string, SimulationFactor[]>,
    aggregator: (samples: Record<string, number>) => number,
    iterations: number = 500
  ): Promise<Record<string, SimulationOutput>> {
    const results: Record<string, SimulationOutput> = {};

    for (const [scenarioName, factors] of Object.entries(scenarios)) {
      results[scenarioName] = await this.runSimulation(factors, aggregator, { iterations });
    }

    return results;
  }
}

// Singleton instance
export const monteCarloService = new MonteCarloService();
