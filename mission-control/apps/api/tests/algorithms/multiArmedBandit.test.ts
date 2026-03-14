/**
 * Multi-Armed Bandit Algorithm Unit Tests
 * Story test-1 - Comprehensive tests for UCB1 and Thompson Sampling
 *
 * Tests cover:
 * - UCB1 exploration and exploitation
 * - Thompson Sampling with Beta distributions
 * - Convergence behavior
 * - Regret calculation
 * - Edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MultiArmedBanditService,
  createBandit,
  BanditArm,
  ArmSelection,
  RegretMetrics,
} from '../../src/services/oracle/algorithms/multiArmedBandit';

// ============================================================================
// UCB1 BANDIT TESTS
// ============================================================================

describe('UCB1 Bandit', () => {
  let bandit: MultiArmedBanditService;

  beforeEach(() => {
    // Use fixed seed for reproducibility
    bandit = createBandit({}, 12345);
  });

  describe('Exploration Behavior', () => {
    it('should explore all arms initially', () => {
      // Add 3 arms
      bandit.addArms([
        { id: 'arm-a', name: 'Option A' },
        { id: 'arm-b', name: 'Option B' },
        { id: 'arm-c', name: 'Option C' },
      ]);

      const selectedArms = new Set<string>();

      // UCB1 should select each arm at least once before any exploitation
      // because unpulled arms have Infinity score
      for (let i = 0; i < 3; i++) {
        const selection = bandit.selectArmUCB1();
        selectedArms.add(selection.arm.id);
        // Record a reward to allow next selection
        bandit.recordReward(selection.arm.id, Math.random());
      }

      // All 3 arms should have been selected
      expect(selectedArms.size).toBe(3);
    });

    it('should return Infinity score for unpulled arms', () => {
      bandit.addArm('unpulled', 'Unpulled Arm');
      bandit.addArm('pulled', 'Pulled Arm');

      // Pull the second arm once
      bandit.recordReward('pulled', 0.5);

      const selection = bandit.selectArmUCB1();

      // Unpulled arm should be selected first (Infinity score)
      expect(selection.arm.id).toBe('unpulled');
      expect(selection.score).toBe(Infinity);
    });

    it('should have exploration bonus in score calculation', () => {
      bandit.addArms([
        { id: 'arm-1', name: 'Arm 1' },
        { id: 'arm-2', name: 'Arm 2' },
      ]);

      // Pull both arms once
      bandit.recordReward('arm-1', 0.5);
      bandit.recordReward('arm-2', 0.5);

      const selection = bandit.selectArmUCB1();

      // Both exploitation and exploration components should exist
      expect(selection.exploitationScore).toBeDefined();
      expect(selection.explorationBonus).toBeDefined();
      expect(selection.explorationBonus).toBeGreaterThan(0);
    });
  });

  describe('Convergence Behavior', () => {
    it('should converge to best arm over time', () => {
      bandit.addArms([
        { id: 'bad', name: 'Bad Arm' },
        { id: 'medium', name: 'Medium Arm' },
        { id: 'good', name: 'Good Arm' },
      ]);

      // Simulate 100 pulls with different reward probabilities
      const rewardProbabilities: Record<string, number> = {
        bad: 0.2,
        medium: 0.5,
        good: 0.8,
      };

      const selectionCounts: Record<string, number> = {
        bad: 0,
        medium: 0,
        good: 0,
      };

      // Use a seeded random for reward generation
      let seed = 42;
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };

      for (let i = 0; i < 100; i++) {
        const selection = bandit.selectArmUCB1();
        selectionCounts[selection.arm.id]++;

        // Generate reward based on arm's true probability
        const reward = random() < rewardProbabilities[selection.arm.id] ? 1 : 0;
        bandit.recordReward(selection.arm.id, reward);
      }

      // Best arm should be selected most often
      expect(selectionCounts.good).toBeGreaterThan(selectionCounts.bad);
      expect(selectionCounts.good).toBeGreaterThan(selectionCounts.medium);

      // Best arm estimation should be correct
      const bestArm = bandit.getBestArm();
      expect(bestArm).not.toBeNull();
      expect(bestArm!.id).toBe('good');
    });

    it('should reduce exploration bonus over time', () => {
      bandit.addArms([
        { id: 'arm-1', name: 'Arm 1' },
        { id: 'arm-2', name: 'Arm 2' },
      ]);

      // Pull both arms multiple times
      for (let i = 0; i < 10; i++) {
        bandit.recordReward('arm-1', 0.5);
        bandit.recordReward('arm-2', 0.5);
      }

      const selection1 = bandit.selectArmUCB1();
      const exploration1 = selection1.explorationBonus!;

      // Pull more times
      for (let i = 0; i < 20; i++) {
        bandit.recordReward('arm-1', 0.5);
        bandit.recordReward('arm-2', 0.5);
      }

      const selection2 = bandit.selectArmUCB1();
      const exploration2 = selection2.explorationBonus!;

      // Exploration bonus should decrease with more pulls
      expect(exploration2).toBeLessThan(exploration1);
    });
  });

  describe('Regret Calculation', () => {
    it('should calculate regret correctly', () => {
      bandit.addArms([
        { id: 'optimal', name: 'Optimal Arm' },
        { id: 'suboptimal', name: 'Suboptimal Arm' },
      ]);

      // Optimal arm: 10 pulls with reward 0.9 each
      for (let i = 0; i < 10; i++) {
        bandit.recordReward('optimal', 0.9);
      }

      // Suboptimal arm: 5 pulls with reward 0.4 each
      for (let i = 0; i < 5; i++) {
        bandit.recordReward('suboptimal', 0.4);
      }

      const regret = bandit.calculateRegret();

      expect(regret.estimatedOptimalArm).toBe('optimal');
      expect(regret.totalPulls).toBe(15);
      expect(regret.optimalArmPulls).toBe(10);

      // Cumulative regret = suboptimal_pulls * (optimal_mean - suboptimal_mean)
      // = 5 * (0.9 - 0.4) = 2.5
      expect(regret.cumulativeRegret).toBeCloseTo(2.5, 1);
      expect(regret.averageRegret).toBeCloseTo(2.5 / 15, 2);
    });

    it('should return zero regret when only optimal arm is pulled', () => {
      bandit.addArms([
        { id: 'arm-1', name: 'Arm 1' },
        { id: 'arm-2', name: 'Arm 2' },
      ]);

      // Only pull arm-1
      for (let i = 0; i < 10; i++) {
        bandit.recordReward('arm-1', 1.0);
      }

      const regret = bandit.calculateRegret();

      // No regret because we only pulled one arm (the "optimal" one by default)
      expect(regret.cumulativeRegret).toBe(0);
      expect(regret.averageRegret).toBe(0);
    });

    it('should handle equal arm performance', () => {
      bandit.addArms([
        { id: 'arm-1', name: 'Arm 1' },
        { id: 'arm-2', name: 'Arm 2' },
      ]);

      // Both arms get same rewards
      bandit.recordReward('arm-1', 0.5);
      bandit.recordReward('arm-2', 0.5);

      const regret = bandit.calculateRegret();

      // No regret when arms are equal
      expect(regret.cumulativeRegret).toBe(0);
    });
  });

  describe('Zero Pulls Handling', () => {
    it('should handle zero pulls on all arms', () => {
      bandit.addArms([
        { id: 'arm-1', name: 'Arm 1' },
        { id: 'arm-2', name: 'Arm 2' },
      ]);

      // No pulls yet - should still select an arm
      const selection = bandit.selectArmUCB1();

      expect(selection.arm).toBeDefined();
      expect(selection.score).toBe(Infinity);
    });

    it('should return empty regret metrics with no pulls', () => {
      bandit.addArms([
        { id: 'arm-1', name: 'Arm 1' },
      ]);

      const regret = bandit.calculateRegret();

      expect(regret.cumulativeRegret).toBe(0);
      expect(regret.averageRegret).toBe(0);
      expect(regret.totalPulls).toBe(0);
      expect(regret.estimatedOptimalArm).toBe('');
    });

    it('should return null for best arm when no pulls', () => {
      bandit.addArm('arm-1', 'Arm 1');

      const bestArm = bandit.getBestArm();

      expect(bestArm).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should throw error when selecting from empty bandit', () => {
      expect(() => bandit.selectArmUCB1()).toThrow('No arms available');
    });

    it('should throw error when adding duplicate arm', () => {
      bandit.addArm('arm-1', 'Arm 1');

      expect(() => bandit.addArm('arm-1', 'Duplicate')).toThrow('already exists');
    });

    it('should throw error when recording reward for unknown arm', () => {
      bandit.addArm('arm-1', 'Arm 1');

      expect(() => bandit.recordReward('unknown', 0.5)).toThrow('not found');
    });

    it('should handle very large number of arms', () => {
      // Add 100 arms
      for (let i = 0; i < 100; i++) {
        bandit.addArm(`arm-${i}`, `Arm ${i}`);
      }

      // Should still work efficiently
      const selection = bandit.selectArmUCB1();
      expect(selection.arm).toBeDefined();
      expect(bandit.getArms().length).toBe(100);
    });

    it('should handle reward values outside [0,1]', () => {
      bandit.addArm('arm-1', 'Arm 1');

      // Negative reward
      bandit.recordReward('arm-1', -0.5);

      // Large reward
      bandit.recordReward('arm-1', 2.0);

      const arm = bandit.getArm('arm-1');
      expect(arm).toBeDefined();
      expect(arm!.pulls).toBe(2);
    });
  });

  describe('Exploration Constant', () => {
    it('should increase exploration with higher constant', () => {
      const lowExploration = createBandit({ explorationConstant: 0.5 }, 12345);
      const highExploration = createBandit({ explorationConstant: 2.0 }, 12345);

      // Add same arms to both
      lowExploration.addArm('arm-1', 'Arm 1');
      highExploration.addArm('arm-1', 'Arm 1');

      // Pull arm once
      lowExploration.recordReward('arm-1', 0.5);
      highExploration.recordReward('arm-1', 0.5);

      // Add second arm
      lowExploration.addArm('arm-2', 'Arm 2');
      highExploration.addArm('arm-2', 'Arm 2');

      // Pull second arm
      lowExploration.recordReward('arm-2', 0.4);
      highExploration.recordReward('arm-2', 0.4);

      const lowSelection = lowExploration.selectArmUCB1();
      const highSelection = highExploration.selectArmUCB1();

      // Higher exploration constant leads to higher exploration bonus
      expect(highSelection.explorationBonus).toBeGreaterThan(lowSelection.explorationBonus!);
    });
  });
});

// ============================================================================
// THOMPSON SAMPLING TESTS
// ============================================================================

describe('Thompson Sampling', () => {
  let bandit: MultiArmedBanditService;

  beforeEach(() => {
    bandit = createBandit({}, 12345);
  });

  describe('Beta Distribution Sampling', () => {
    it('should sample from Beta distributions', () => {
      bandit.addArms([
        { id: 'arm-1', name: 'Arm 1' },
        { id: 'arm-2', name: 'Arm 2' },
      ]);

      // Make several selections
      const samples: number[] = [];
      for (let i = 0; i < 10; i++) {
        const selection = bandit.selectArmThompson();
        samples.push(selection.score);
        bandit.recordReward(selection.arm.id, Math.random());
      }

      // Samples should be in valid range [0, 1] for Beta distribution
      for (const sample of samples) {
        expect(sample).toBeGreaterThanOrEqual(0);
        expect(sample).toBeLessThanOrEqual(1);
      }
    });

    it('should vary samples across calls', () => {
      bandit.addArm('arm-1', 'Arm 1');

      // Pull the arm several times
      for (let i = 0; i < 10; i++) {
        bandit.recordReward('arm-1', 0.5);
      }

      // Create new bandit with different seed for comparison
      const bandit2 = createBandit({}, 54321);
      bandit2.addArm('arm-1', 'Arm 1');
      for (let i = 0; i < 10; i++) {
        bandit2.recordReward('arm-1', 0.5);
      }

      const sample1 = bandit.selectArmThompson().score;
      const sample2 = bandit2.selectArmThompson().score;

      // Different seeds should produce different samples
      expect(sample1).not.toBe(sample2);
    });
  });

  describe('Posterior Updates', () => {
    it('should update posteriors on reward', () => {
      bandit.addArm('arm-1', 'Arm 1');

      const armBefore = bandit.getArm('arm-1')!;
      const alphaBefore = armBefore.alpha;
      const betaBefore = armBefore.beta;

      // Record a success (reward = 1)
      bandit.recordReward('arm-1', 1);

      const armAfter = bandit.getArm('arm-1')!;

      // Alpha should increase for success
      expect(armAfter.alpha).toBeGreaterThan(alphaBefore);
      // Beta should stay roughly the same (reward = 1 adds 0 to beta)
      expect(armAfter.beta).toBeCloseTo(betaBefore, 5);
    });

    it('should update beta on failure', () => {
      bandit.addArm('arm-1', 'Arm 1');

      const armBefore = bandit.getArm('arm-1')!;
      const alphaBefore = armBefore.alpha;
      const betaBefore = armBefore.beta;

      // Record a failure (reward = 0)
      bandit.recordReward('arm-1', 0);

      const armAfter = bandit.getArm('arm-1')!;

      // Alpha should stay roughly the same (reward = 0 adds 0 to alpha)
      expect(armAfter.alpha).toBeCloseTo(alphaBefore, 5);
      // Beta should increase for failure
      expect(armAfter.beta).toBeGreaterThan(betaBefore);
    });

    it('should handle continuous rewards correctly', () => {
      bandit.addArm('arm-1', 'Arm 1');

      // Record a partial reward
      bandit.recordReward('arm-1', 0.7);

      const arm = bandit.getArm('arm-1')!;

      // Both alpha and beta should be updated proportionally
      // alpha += 0.7, beta += 0.3
      expect(arm.alpha).toBeCloseTo(1 + 0.7, 5);
      expect(arm.beta).toBeCloseTo(1 + 0.3, 5);
    });
  });

  describe('Convergence with Thompson Sampling', () => {
    it('should converge to best arm', () => {
      bandit.addArms([
        { id: 'bad', name: 'Bad Arm' },
        { id: 'good', name: 'Good Arm' },
      ]);

      const rewardProbabilities: Record<string, number> = {
        bad: 0.3,
        good: 0.7,
      };

      const selectionCounts: Record<string, number> = {
        bad: 0,
        good: 0,
      };

      // Use fixed seed for reward generation
      let seed = 42;
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };

      for (let i = 0; i < 100; i++) {
        const selection = bandit.selectArmThompson();
        selectionCounts[selection.arm.id]++;

        const reward = random() < rewardProbabilities[selection.arm.id] ? 1 : 0;
        bandit.recordReward(selection.arm.id, reward);
      }

      // Good arm should be selected more often
      expect(selectionCounts.good).toBeGreaterThan(selectionCounts.bad);
    });

    it('should naturally balance exploration and exploitation', () => {
      bandit.addArms([
        { id: 'arm-1', name: 'Arm 1' },
        { id: 'arm-2', name: 'Arm 2' },
        { id: 'arm-3', name: 'Arm 3' },
      ]);

      const selections = new Set<string>();

      // Early selections should explore
      for (let i = 0; i < 20; i++) {
        const selection = bandit.selectArmThompson();
        selections.add(selection.arm.id);
        bandit.recordReward(selection.arm.id, Math.random());
      }

      // All arms should be explored
      expect(selections.size).toBe(3);
    });
  });

  describe('Initial Prior Configuration', () => {
    it('should use custom initial priors', () => {
      const customBandit = createBandit({
        initialAlpha: 2,
        initialBeta: 5,
      }, 12345);

      customBandit.addArm('arm-1', 'Arm 1');

      const arm = customBandit.getArm('arm-1')!;

      expect(arm.alpha).toBe(2);
      expect(arm.beta).toBe(5);
    });

    it('should start with skeptical prior (more beta)', () => {
      const skepticalBandit = createBandit({
        initialAlpha: 1,
        initialBeta: 10,
      }, 12345);

      skepticalBandit.addArm('arm-1', 'Arm 1');

      // Get a sample - should be biased low due to skeptical prior
      const samples: number[] = [];
      for (let i = 0; i < 100; i++) {
        const selection = skepticalBandit.selectArmThompson();
        samples.push(selection.score);
      }

      const avgSample = samples.reduce((a, b) => a + b, 0) / samples.length;

      // Average sample should be biased toward lower values
      // Expected mean of Beta(1, 10) = 1/(1+10) = 0.0909
      expect(avgSample).toBeLessThan(0.2);
    });
  });
});

// ============================================================================
// EPSILON-GREEDY TESTS
// ============================================================================

describe('Epsilon-Greedy Strategy', () => {
  let bandit: MultiArmedBanditService;

  beforeEach(() => {
    bandit = createBandit({}, 12345);
  });

  it('should explore with probability epsilon', () => {
    bandit.addArms([
      { id: 'best', name: 'Best Arm' },
      { id: 'worst', name: 'Worst Arm' },
    ]);

    // Give best arm higher reward
    for (let i = 0; i < 10; i++) {
      bandit.recordReward('best', 1.0);
      bandit.recordReward('worst', 0.0);
    }

    const explorations = { best: 0, worst: 0 };

    // With epsilon = 0.3, roughly 30% should be random
    for (let i = 0; i < 1000; i++) {
      const selection = bandit.selectArmEpsilonGreedy(0.3);
      explorations[selection.arm.id as keyof typeof explorations]++;
    }

    // Worst arm should be selected sometimes due to exploration
    expect(explorations.worst).toBeGreaterThan(100); // At least 10%
    // Best arm should be selected most of the time
    expect(explorations.best).toBeGreaterThan(explorations.worst);
  });

  it('should always exploit with epsilon = 0', () => {
    bandit.addArms([
      { id: 'best', name: 'Best Arm' },
      { id: 'worst', name: 'Worst Arm' },
    ]);

    // Give best arm higher reward
    bandit.recordReward('best', 1.0);
    bandit.recordReward('worst', 0.0);

    // With epsilon = 0, should always pick best arm
    for (let i = 0; i < 100; i++) {
      const selection = bandit.selectArmEpsilonGreedy(0);
      expect(selection.arm.id).toBe('best');
    }
  });

  it('should always explore with epsilon = 1', () => {
    bandit.addArms([
      { id: 'arm-1', name: 'Arm 1' },
      { id: 'arm-2', name: 'Arm 2' },
      { id: 'arm-3', name: 'Arm 3' },
    ]);

    // Give arm-1 best reward
    bandit.recordReward('arm-1', 1.0);
    bandit.recordReward('arm-2', 0.5);
    bandit.recordReward('arm-3', 0.0);

    const selections = new Set<string>();

    // With epsilon = 1, should randomly explore all arms
    for (let i = 0; i < 100; i++) {
      const selection = bandit.selectArmEpsilonGreedy(1);
      selections.add(selection.arm.id);
    }

    // All arms should be selected at some point
    expect(selections.size).toBe(3);
  });
});

// ============================================================================
// STATE PERSISTENCE TESTS
// ============================================================================

describe('State Persistence', () => {
  it('should export and import state correctly', () => {
    const bandit1 = createBandit({}, 12345);

    bandit1.addArms([
      { id: 'arm-1', name: 'Arm 1', metadata: { category: 'test' } },
      { id: 'arm-2', name: 'Arm 2' },
    ]);

    // Record some rewards
    bandit1.recordReward('arm-1', 0.8);
    bandit1.recordReward('arm-1', 0.9);
    bandit1.recordReward('arm-2', 0.3);

    // Export state
    const state = bandit1.exportState();

    // Create new bandit and import state
    const bandit2 = createBandit({}, 54321);
    bandit2.importState(state);

    // Verify imported state
    expect(bandit2.getArms().length).toBe(2);
    expect(bandit2.getArm('arm-1')!.pulls).toBe(2);
    expect(bandit2.getArm('arm-2')!.pulls).toBe(1);
    expect(bandit2.getArm('arm-1')!.metadata).toEqual({ category: 'test' });
  });

  it('should preserve reward history in export', () => {
    const bandit = createBandit({}, 12345);
    bandit.addArm('arm-1', 'Arm 1');

    bandit.recordReward('arm-1', 0.5, { source: 'test' });
    bandit.recordReward('arm-1', 0.7);

    const state = bandit.exportState();

    expect(state.rewardHistory.length).toBe(2);
    expect(state.rewardHistory[0].context).toEqual({ source: 'test' });
  });

  it('should reset state correctly', () => {
    const bandit = createBandit({}, 12345);
    bandit.addArms([
      { id: 'arm-1', name: 'Arm 1' },
      { id: 'arm-2', name: 'Arm 2' },
    ]);

    // Record rewards
    bandit.recordReward('arm-1', 0.5);
    bandit.recordReward('arm-2', 0.7);

    // Reset
    bandit.reset();

    // Verify reset
    const arm1 = bandit.getArm('arm-1')!;
    expect(arm1.pulls).toBe(0);
    expect(arm1.totalReward).toBe(0);
    expect(bandit.getRewardHistory().length).toBe(0);
  });
});

// ============================================================================
// ALGORITHM RECOMMENDATION TESTS
// ============================================================================

describe('Algorithm Recommendation', () => {
  it('should recommend Thompson Sampling for small problems', () => {
    const recommendation = MultiArmedBanditService.recommendAlgorithm(5, 100);
    expect(recommendation).toBe('thompson');
  });

  it('should recommend UCB1 for large problems', () => {
    const recommendation = MultiArmedBanditService.recommendAlgorithm(50, 1000);
    expect(recommendation).toBe('ucb1');
  });

  it('should recommend epsilon-greedy for very small budgets', () => {
    const recommendation = MultiArmedBanditService.recommendAlgorithm(3, 10);
    expect(recommendation).toBe('epsilon-greedy');
  });
});

// ============================================================================
// REWARD DECAY TESTS
// ============================================================================

describe('Reward Decay', () => {
  it('should apply decay to accumulated rewards', () => {
    const bandit = createBandit({ rewardDecay: 0.9 }, 12345);
    bandit.addArm('arm-1', 'Arm 1');

    // First reward
    bandit.recordReward('arm-1', 1.0);
    const arm1 = bandit.getArm('arm-1')!;
    expect(arm1.totalReward).toBeCloseTo(1.0, 5);

    // Second reward - first should be decayed
    bandit.recordReward('arm-1', 1.0);
    const arm2 = bandit.getArm('arm-1')!;
    // totalReward = (1.0 * 0.9) + 1.0 = 1.9
    expect(arm2.totalReward).toBeCloseTo(1.9, 5);
  });

  it('should not decay with rewardDecay = 1', () => {
    const bandit = createBandit({ rewardDecay: 1.0 }, 12345);
    bandit.addArm('arm-1', 'Arm 1');

    bandit.recordReward('arm-1', 1.0);
    bandit.recordReward('arm-1', 1.0);

    const arm = bandit.getArm('arm-1')!;
    expect(arm.totalReward).toBe(2.0);
  });
});
