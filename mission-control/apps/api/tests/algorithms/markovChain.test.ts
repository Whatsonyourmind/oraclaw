/**
 * Markov Chain Predictor Tests
 * Tests for state transitions, predictions, Hidden Markov Models,
 * and OODA phase integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MarkovChainPredictor,
  createMarkovChainPredictor,
  type MarkovState,
  type Observation,
  type HMMParameters,
} from '../../src/services/oracle/algorithms/markovChain';

describe('MarkovChainPredictor', () => {
  let predictor: MarkovChainPredictor;

  beforeEach(() => {
    // Create predictor with seed for reproducibility
    predictor = createMarkovChainPredictor({}, 12345);
  });

  // ============================================================================
  // State Management Tests
  // ============================================================================

  describe('State Management', () => {
    it('should add a single state', () => {
      const state: MarkovState = { id: 'A', name: 'State A' };
      predictor.addState(state);

      const stats = predictor.getStats();
      expect(stats.uniqueStates).toBe(1);
    });

    it('should add multiple states at once', () => {
      const states: MarkovState[] = [
        { id: 'A', name: 'State A' },
        { id: 'B', name: 'State B' },
        { id: 'C', name: 'State C' },
      ];
      predictor.addStates(states);

      const stats = predictor.getStats();
      expect(stats.uniqueStates).toBe(3);
    });

    it('should auto-add states when observing unknown states', () => {
      predictor.observe('newState');
      const stats = predictor.getStats();
      expect(stats.uniqueStates).toBe(1);
    });

    it('should handle duplicate state additions gracefully', () => {
      predictor.addState({ id: 'A', name: 'State A' });
      predictor.addState({ id: 'A', name: 'State A Updated' });

      const stats = predictor.getStats();
      expect(stats.uniqueStates).toBe(1);
    });
  });

  // ============================================================================
  // Transition Tests
  // ============================================================================

  describe('State Transitions', () => {
    beforeEach(() => {
      predictor.addStates([
        { id: 'A', name: 'State A' },
        { id: 'B', name: 'State B' },
        { id: 'C', name: 'State C' },
      ]);
    });

    it('should record transitions when observing state sequences', () => {
      predictor.observe('A');
      predictor.observe('B');
      predictor.observe('C');

      const stats = predictor.getStats();
      expect(stats.totalObservations).toBe(3);
      expect(stats.uniqueTransitions).toBe(2); // A->B and B->C
    });

    it('should correctly calculate transition probabilities', () => {
      // Create a deterministic sequence
      for (let i = 0; i < 10; i++) {
        predictor.observe('A');
        predictor.observe('B');
      }

      const probAB = predictor.getTransitionProbability('A', 'B');
      const probBA = predictor.getTransitionProbability('B', 'A');

      // A should always transition to B
      expect(probAB).toBeGreaterThan(0.5);
      // B should always transition to A (due to loop)
      expect(probBA).toBeGreaterThan(0.5);
    });

    it('should apply Laplace smoothing to prevent zero probabilities', () => {
      predictor.observe('A');
      predictor.observe('B');

      // Even though we never observed A->C, probability should be > 0
      const probAC = predictor.getTransitionProbability('A', 'C');
      expect(probAC).toBeGreaterThan(0);
    });

    it('should return uniform probability for unknown states', () => {
      const prob = predictor.getTransitionProbability('unknown', 'A');
      // With 3 states, uniform probability is 1/3
      expect(prob).toBeCloseTo(1 / 3, 1);
    });
  });

  // ============================================================================
  // Prediction Tests
  // ============================================================================

  describe('State Predictions', () => {
    beforeEach(() => {
      predictor = createMarkovChainPredictor(
        { minObservations: 5 },
        12345
      );
      predictor.addStates([
        { id: 'observe', name: 'Observe' },
        { id: 'orient', name: 'Orient' },
        { id: 'decide', name: 'Decide' },
        { id: 'act', name: 'Act' },
      ]);
    });

    it('should predict next state with highest probability', () => {
      // Train with OODA loop pattern
      for (let i = 0; i < 10; i++) {
        predictor.observe('observe');
        predictor.observe('orient');
        predictor.observe('decide');
        predictor.observe('act');
      }

      const prediction = predictor.predictNextState('observe');
      expect(prediction.state).toBe('orient');
      expect(prediction.probability).toBeGreaterThan(0.5);
    });

    it('should return all state probabilities in prediction', () => {
      for (let i = 0; i < 10; i++) {
        predictor.observe('observe');
        predictor.observe('orient');
        predictor.observe('decide');
        predictor.observe('act');
      }

      const prediction = predictor.predictNextState('observe');
      expect(prediction.stateProbabilities.size).toBe(4);
    });

    it('should calculate confidence intervals', () => {
      for (let i = 0; i < 20; i++) {
        predictor.observe('observe');
        predictor.observe('orient');
      }

      const prediction = predictor.predictNextState('observe');
      expect(prediction.confidenceLower).toBeDefined();
      expect(prediction.confidenceUpper).toBeDefined();
      expect(prediction.confidenceLower).toBeLessThanOrEqual(prediction.probability);
      expect(prediction.confidenceUpper).toBeGreaterThanOrEqual(prediction.probability);
    });

    it('should calculate entropy (uncertainty measure)', () => {
      for (let i = 0; i < 10; i++) {
        predictor.observe('observe');
        predictor.observe('orient');
      }

      const prediction = predictor.predictNextState('observe');
      expect(prediction.entropy).toBeDefined();
      expect(prediction.entropy).toBeGreaterThanOrEqual(0);
    });

    it('should return uniform distribution when insufficient observations', () => {
      predictor.observe('observe');
      predictor.observe('orient');

      const prediction = predictor.predictNextState('observe');
      // With minObservations: 5, should return uniform
      expect(prediction.stateProbabilities.size).toBe(4);
    });
  });

  // ============================================================================
  // Sequence Prediction Tests
  // ============================================================================

  describe('Sequence Predictions', () => {
    beforeEach(() => {
      predictor = createMarkovChainPredictor({ minObservations: 3 }, 12345);
      predictor.addStates([
        { id: 'A', name: 'State A' },
        { id: 'B', name: 'State B' },
        { id: 'C', name: 'State C' },
      ]);

      // Train with A -> B -> C pattern
      for (let i = 0; i < 10; i++) {
        predictor.observe('A');
        predictor.observe('B');
        predictor.observe('C');
      }
    });

    it('should predict sequence of k states', () => {
      const sequence = predictor.predictSequence('A', 3);

      expect(sequence).toHaveLength(3);
      expect(sequence[0].state).toBe('B');
      expect(sequence[1].state).toBe('C');
    });

    it('should calculate cumulative probability for sequence', () => {
      const sequence = predictor.predictSequence('A', 3);

      // Each step should have lower or equal cumulative probability
      for (let i = 1; i < sequence.length; i++) {
        expect(sequence[i].probability).toBeLessThanOrEqual(sequence[i - 1].probability);
      }
    });

    it('should handle single-step sequence', () => {
      const sequence = predictor.predictSequence('A', 1);

      expect(sequence).toHaveLength(1);
      expect(sequence[0].state).toBeDefined();
    });

    it('should handle empty sequence request', () => {
      const sequence = predictor.predictSequence('A', 0);
      expect(sequence).toHaveLength(0);
    });
  });

  // ============================================================================
  // Stationary Distribution Tests
  // ============================================================================

  describe('Stationary Distribution', () => {
    beforeEach(() => {
      predictor.addStates([
        { id: 'A', name: 'State A' },
        { id: 'B', name: 'State B' },
      ]);
    });

    it('should calculate stationary distribution using power iteration', () => {
      // Create balanced transitions
      for (let i = 0; i < 20; i++) {
        predictor.observe('A');
        predictor.observe('B');
      }

      const distribution = predictor.getStationaryDistribution();

      expect(distribution.size).toBe(2);
      // Sum of probabilities should be 1
      const sum = Array.from(distribution.values()).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    it('should return empty map for empty predictor', () => {
      const emptyPredictor = createMarkovChainPredictor();
      const distribution = emptyPredictor.getStationaryDistribution();

      expect(distribution.size).toBe(0);
    });

    it('should converge to correct distribution for biased chain', () => {
      // A -> B with 80% probability, A -> A with 20%
      for (let i = 0; i < 80; i++) {
        predictor.observe('A');
        predictor.observe('B');
      }
      for (let i = 0; i < 20; i++) {
        predictor.observe('A');
        predictor.observe('A');
      }

      const distribution = predictor.getStationaryDistribution();

      // With this pattern, B should have higher long-term probability
      expect(distribution.get('B')).toBeGreaterThan(0.3);
    });
  });

  // ============================================================================
  // Hidden Markov Model Tests
  // ============================================================================

  describe('Hidden Markov Model', () => {
    describe('HMM Initialization', () => {
      it('should initialize HMM with correct dimensions', () => {
        const hmm = predictor.initializeHMM(3, 4);

        expect(hmm.numHiddenStates).toBe(3);
        expect(hmm.initialDistribution).toHaveLength(3);
        expect(hmm.transitionMatrix).toHaveLength(3);
        expect(hmm.emissionMatrix).toHaveLength(3);
        expect(hmm.emissionMatrix[0]).toHaveLength(4);
      });

      it('should initialize with row-stochastic transition matrix', () => {
        const hmm = predictor.initializeHMM(3, 4);

        for (const row of hmm.transitionMatrix) {
          const sum = row.reduce((a, b) => a + b, 0);
          expect(sum).toBeCloseTo(1, 5);
        }
      });

      it('should initialize with row-stochastic emission matrix', () => {
        const hmm = predictor.initializeHMM(3, 4);

        for (const row of hmm.emissionMatrix) {
          const sum = row.reduce((a, b) => a + b, 0);
          expect(sum).toBeCloseTo(1, 5);
        }
      });

      it('should initialize with valid initial distribution', () => {
        const hmm = predictor.initializeHMM(3, 4);

        const sum = hmm.initialDistribution.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 5);
      });
    });

    describe('Viterbi Algorithm', () => {
      let hmm: HMMParameters;

      beforeEach(() => {
        // Simple HMM for testing
        hmm = {
          numHiddenStates: 2,
          initialDistribution: [0.6, 0.4],
          transitionMatrix: [
            [0.7, 0.3],
            [0.4, 0.6],
          ],
          emissionMatrix: [
            [0.9, 0.1], // State 0 emits observation 0 with high probability
            [0.2, 0.8], // State 1 emits observation 1 with high probability
          ],
          hiddenStateNames: ['H0', 'H1'],
        };
      });

      it('should find most likely state sequence', () => {
        const observations = [0, 0, 1, 1, 0];
        const result = predictor.viterbi(observations, hmm);

        expect(result.stateSequence).toHaveLength(5);
        expect(result.probability).toBeGreaterThan(0);
      });

      it('should return path probabilities at each step', () => {
        const observations = [0, 1, 0];
        const result = predictor.viterbi(observations, hmm);

        expect(result.pathProbabilities).toHaveLength(3);
        expect(result.pathProbabilities[0]).toHaveLength(2);
      });

      it('should handle empty observation sequence', () => {
        const result = predictor.viterbi([], hmm);

        expect(result.stateSequence).toHaveLength(0);
        expect(result.probability).toBe(1);
      });

      it('should prefer state 0 for observation 0', () => {
        const observations = [0, 0, 0];
        const result = predictor.viterbi(observations, hmm);

        // Most states should be H0 since observation 0 is more likely from H0
        const h0Count = result.stateSequence.filter(s => s === 'H0').length;
        expect(h0Count).toBeGreaterThan(1);
      });

      it('should return log probability for numerical stability', () => {
        const observations = [0, 1, 0, 1];
        const result = predictor.viterbi(observations, hmm);

        expect(result.logProbability).toBeDefined();
        expect(result.logProbability).toBeLessThanOrEqual(0); // Log of probability <= 1
      });
    });

    describe('Forward Algorithm', () => {
      let hmm: HMMParameters;

      beforeEach(() => {
        hmm = {
          numHiddenStates: 2,
          initialDistribution: [0.5, 0.5],
          transitionMatrix: [
            [0.6, 0.4],
            [0.3, 0.7],
          ],
          emissionMatrix: [
            [0.8, 0.2],
            [0.3, 0.7],
          ],
        };
      });

      it('should calculate forward probabilities', () => {
        const observations = [0, 1, 0];
        const alpha = predictor.forward(observations, hmm);

        expect(alpha).toHaveLength(3);
        expect(alpha[0]).toHaveLength(2);
      });

      it('should have non-negative probabilities', () => {
        const observations = [0, 1];
        const alpha = predictor.forward(observations, hmm);

        for (const row of alpha) {
          for (const prob of row) {
            expect(prob).toBeGreaterThanOrEqual(0);
          }
        }
      });

      it('should return empty array for empty observations', () => {
        const alpha = predictor.forward([], hmm);
        expect(alpha).toHaveLength(0);
      });
    });

    describe('Backward Algorithm', () => {
      let hmm: HMMParameters;

      beforeEach(() => {
        hmm = {
          numHiddenStates: 2,
          initialDistribution: [0.5, 0.5],
          transitionMatrix: [
            [0.6, 0.4],
            [0.3, 0.7],
          ],
          emissionMatrix: [
            [0.8, 0.2],
            [0.3, 0.7],
          ],
        };
      });

      it('should calculate backward probabilities', () => {
        const observations = [0, 1, 0];
        const beta = predictor.backward(observations, hmm);

        expect(beta).toHaveLength(3);
        expect(beta[2]).toEqual([1, 1]); // Last step is all 1s
      });

      it('should return empty array for empty observations', () => {
        const beta = predictor.backward([], hmm);
        expect(beta).toHaveLength(0);
      });
    });

    describe('Forward-Backward Algorithm', () => {
      let hmm: HMMParameters;

      beforeEach(() => {
        hmm = {
          numHiddenStates: 2,
          initialDistribution: [0.5, 0.5],
          transitionMatrix: [
            [0.6, 0.4],
            [0.3, 0.7],
          ],
          emissionMatrix: [
            [0.8, 0.2],
            [0.3, 0.7],
          ],
        };
      });

      it('should calculate state probabilities at each time step', () => {
        const observations = [0, 1, 0];
        const result = predictor.forwardBackward(observations, hmm);

        expect(result.stateProbabilities).toHaveLength(3);
      });

      it('should have normalized state probabilities', () => {
        const observations = [0, 1];
        const result = predictor.forwardBackward(observations, hmm);

        for (const gamma of result.stateProbabilities) {
          const sum = gamma.reduce((a, b) => a + b, 0);
          expect(sum).toBeCloseTo(1, 3);
        }
      });

      it('should return sequence probability', () => {
        const observations = [0, 1, 0];
        const result = predictor.forwardBackward(observations, hmm);

        expect(result.sequenceProbability).toBeGreaterThan(0);
      });

      it('should handle empty observations', () => {
        const result = predictor.forwardBackward([], hmm);

        expect(result.stateProbabilities).toHaveLength(0);
        expect(result.sequenceProbability).toBe(1);
      });
    });

    describe('Baum-Welch Algorithm', () => {
      let hmm: HMMParameters;

      beforeEach(() => {
        hmm = {
          numHiddenStates: 2,
          initialDistribution: [0.5, 0.5],
          transitionMatrix: [
            [0.5, 0.5],
            [0.5, 0.5],
          ],
          emissionMatrix: [
            [0.5, 0.5],
            [0.5, 0.5],
          ],
        };
      });

      it('should train HMM parameters from observations', () => {
        // Create observations that should reveal structure
        const observations = [0, 0, 0, 1, 1, 1, 0, 0, 0];
        const trained = predictor.baumWelch(observations, hmm, 10);

        // Parameters should be different from uniform initialization
        expect(trained.emissionMatrix[0][0]).not.toBeCloseTo(0.5, 1);
      });

      it('should maintain row-stochastic matrices after training', () => {
        const observations = [0, 1, 0, 1, 0];
        const trained = predictor.baumWelch(observations, hmm, 10);

        // Check transition matrix
        for (const row of trained.transitionMatrix) {
          const sum = row.reduce((a, b) => a + b, 0);
          expect(sum).toBeCloseTo(1, 3);
        }

        // Check emission matrix
        for (const row of trained.emissionMatrix) {
          const sum = row.reduce((a, b) => a + b, 0);
          expect(sum).toBeCloseTo(1, 3);
        }
      });

      it('should return original HMM for short sequences', () => {
        const observations = [0];
        const trained = predictor.baumWelch(observations, hmm);

        expect(trained).toEqual(hmm);
      });
    });
  });

  // ============================================================================
  // History Learning Tests
  // ============================================================================

  describe('Learning from History', () => {
    it('should learn from historical observations', () => {
      const history: Observation[] = [
        { state: 'A', timestamp: 1000, context: {} },
        { state: 'B', timestamp: 2000, context: {} },
        { state: 'C', timestamp: 3000, context: {} },
        { state: 'A', timestamp: 4000, context: {} },
      ];

      predictor.learnFromHistory(history);

      const stats = predictor.getStats();
      expect(stats.totalObservations).toBe(4);
      expect(stats.uniqueStates).toBe(3);
    });

    it('should apply time decay to older observations', () => {
      const now = Date.now();
      const oldHistory: Observation[] = [
        { state: 'A', timestamp: now - 1000000, context: {} },
        { state: 'B', timestamp: now - 1000000, context: {} },
      ];
      const newHistory: Observation[] = [
        { state: 'A', timestamp: now - 100, context: {} },
        { state: 'C', timestamp: now, context: {} },
      ];

      predictor.learnFromHistory([...oldHistory, ...newHistory]);

      // Newer observation A->C should have more influence than old A->B
      const probAC = predictor.getTransitionProbability('A', 'C');
      const probAB = predictor.getTransitionProbability('A', 'B');

      expect(probAC).toBeGreaterThan(probAB);
    });

    it('should sort observations by timestamp', () => {
      const history: Observation[] = [
        { state: 'C', timestamp: 3000, context: {} },
        { state: 'A', timestamp: 1000, context: {} },
        { state: 'B', timestamp: 2000, context: {} },
      ];

      predictor.learnFromHistory(history);

      // Transitions should be A->B->C regardless of input order
      const probAB = predictor.getTransitionProbability('A', 'B');
      const probBC = predictor.getTransitionProbability('B', 'C');

      expect(probAB).toBeGreaterThan(0.3);
      expect(probBC).toBeGreaterThan(0.3);
    });
  });

  // ============================================================================
  // OODA Phase Integration Tests
  // ============================================================================

  describe('OODA Phase Integration', () => {
    beforeEach(() => {
      predictor.addStates([
        { id: 'observe', name: 'Observe Phase', metadata: { phase: 1 } },
        { id: 'orient', name: 'Orient Phase', metadata: { phase: 2 } },
        { id: 'decide', name: 'Decide Phase', metadata: { phase: 3 } },
        { id: 'act', name: 'Act Phase', metadata: { phase: 4 } },
      ]);

      // Train with realistic OODA loop patterns
      for (let i = 0; i < 20; i++) {
        predictor.observe('observe');
        predictor.observe('orient');
        predictor.observe('decide');
        predictor.observe('act');
      }
      // Add some variations (sometimes skip decide)
      for (let i = 0; i < 5; i++) {
        predictor.observe('observe');
        predictor.observe('orient');
        predictor.observe('act');
      }
    });

    it('should provide OBSERVE phase data', () => {
      const data = predictor.getObservePhaseData('observe');

      expect(data.prediction).toBeDefined();
      expect(data.stationaryDistribution).toBeDefined();
      expect(data.recentTransitions).toBeDefined();
    });

    it('should predict orient as most likely after observe', () => {
      const data = predictor.getObservePhaseData('observe');

      expect(data.prediction.state).toBe('orient');
    });

    it('should include recent transitions sorted by probability', () => {
      const data = predictor.getObservePhaseData('observe');

      expect(data.recentTransitions.length).toBeLessThanOrEqual(5);
      if (data.recentTransitions.length > 1) {
        expect(data.recentTransitions[0].probability)
          .toBeGreaterThanOrEqual(data.recentTransitions[1].probability);
      }
    });

    it('should provide stationary distribution for long-term predictions', () => {
      const data = predictor.getObservePhaseData('observe');

      const sum = Array.from(data.stationaryDistribution.values())
        .reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 3);
    });
  });

  // ============================================================================
  // State Persistence Tests
  // ============================================================================

  describe('State Export/Import', () => {
    it('should export current state', () => {
      predictor.addStates([
        { id: 'A', name: 'State A' },
        { id: 'B', name: 'State B' },
      ]);
      predictor.observe('A');
      predictor.observe('B');
      predictor.observe('A');

      const exported = predictor.exportState();

      expect(exported.states).toHaveLength(2);
      expect(exported.transitionCounts).toBeDefined();
      expect(exported.observations).toHaveLength(3);
      expect(exported.config).toBeDefined();
    });

    it('should import state correctly', () => {
      predictor.addStates([
        { id: 'A', name: 'State A' },
        { id: 'B', name: 'State B' },
      ]);
      predictor.observe('A');
      predictor.observe('B');

      const exported = predictor.exportState();

      // Create new predictor and import
      const newPredictor = createMarkovChainPredictor();
      newPredictor.importState(exported);

      const stats = newPredictor.getStats();
      expect(stats.uniqueStates).toBe(2);
      expect(stats.totalObservations).toBe(2);
    });

    it('should preserve transition probabilities after import', () => {
      predictor.addStates([
        { id: 'A', name: 'State A' },
        { id: 'B', name: 'State B' },
      ]);
      for (let i = 0; i < 10; i++) {
        predictor.observe('A');
        predictor.observe('B');
      }

      const probBefore = predictor.getTransitionProbability('A', 'B');
      const exported = predictor.exportState();

      const newPredictor = createMarkovChainPredictor();
      newPredictor.importState(exported);
      const probAfter = newPredictor.getTransitionProbability('A', 'B');

      expect(probAfter).toBeCloseTo(probBefore, 5);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle reset correctly', () => {
      predictor.addStates([{ id: 'A', name: 'State A' }]);
      predictor.observe('A');
      predictor.observe('A');

      predictor.reset();

      const stats = predictor.getStats();
      expect(stats.uniqueStates).toBe(0);
      expect(stats.totalObservations).toBe(0);
    });

    it('should handle single state predictor', () => {
      predictor.addState({ id: 'only', name: 'Only State' });
      for (let i = 0; i < 10; i++) {
        predictor.observe('only');
      }

      const prediction = predictor.predictNextState('only');
      expect(prediction.state).toBe('only');
    });

    it('should handle very long observation sequences', () => {
      predictor.addStates([
        { id: 'A', name: 'A' },
        { id: 'B', name: 'B' },
      ]);

      for (let i = 0; i < 1000; i++) {
        predictor.observe(i % 2 === 0 ? 'A' : 'B');
      }

      const stats = predictor.getStats();
      expect(stats.totalObservations).toBe(1000);
    });

    it('should provide valid stats even with no observations', () => {
      const stats = predictor.getStats();

      expect(stats.totalObservations).toBe(0);
      expect(stats.uniqueStates).toBe(0);
      expect(stats.uniqueTransitions).toBe(0);
      expect(stats.avgLogLikelihood).toBe(0);
    });
  });
});
