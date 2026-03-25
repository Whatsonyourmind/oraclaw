import { describe, it, expect, beforeEach } from "vitest";
import {
  ContextualBanditService,
  createContextualBandit,
} from "../../src/services/oracle/algorithms/contextualBandit";

describe("ContextualBandit (LinUCB)", () => {
  let bandit: ContextualBanditService;

  beforeEach(() => {
    bandit = createContextualBandit({ dimensions: 3, alpha: 1.0 });
    bandit.addArm("a", "Arm A");
    bandit.addArm("b", "Arm B");
    bandit.addArm("c", "Arm C");
  });

  describe("initialization", () => {
    it("should create bandit with correct dimensions", () => {
      const arms = bandit.getArms();
      expect(arms).toHaveLength(3);
      expect(arms[0]!.A).toHaveLength(3);
      expect(arms[0]!.A[0]).toHaveLength(3);
      expect(arms[0]!.b).toHaveLength(3);
    });

    it("should initialize A as identity matrix", () => {
      const arm = bandit.getArms()[0]!;
      expect(arm.A[0]![0]).toBe(1);
      expect(arm.A[1]![1]).toBe(1);
      expect(arm.A[2]![2]).toBe(1);
      expect(arm.A[0]![1]).toBe(0);
    });

    it("should initialize b as zero vector", () => {
      const arm = bandit.getArms()[0]!;
      expect(arm.b).toEqual([0, 0, 0]);
    });

    it("should reject duplicate arm IDs", () => {
      expect(() => bandit.addArm("a", "Duplicate")).toThrow("already exists");
    });
  });

  describe("selectArm", () => {
    it("should select an arm given context", () => {
      const result = bandit.selectArm([1, 0, 0]);
      expect(result.arm).toBeDefined();
      expect(result.score).toBeGreaterThan(-Infinity);
      expect(result.context).toEqual([1, 0, 0]);
    });

    it("should reject wrong-dimensional context", () => {
      expect(() => bandit.selectArm([1, 0])).toThrow("dimension mismatch");
    });

    it("should have exploration component initially", () => {
      const result = bandit.selectArm([1, 0, 0]);
      expect(result.confidenceWidth).toBeGreaterThan(0);
    });

    it("should return all required fields", () => {
      const result = bandit.selectArm([0.5, 0.3, 0.8]);
      expect(result).toHaveProperty("arm");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("expectedReward");
      expect(result).toHaveProperty("confidenceWidth");
      expect(result).toHaveProperty("context");
    });
  });

  describe("learning", () => {
    it("should update arm statistics after reward", () => {
      bandit.recordReward("a", 1.0, [1, 0, 0]);
      const arm = bandit.getArms().find((a) => a.id === "a")!;
      expect(arm.pulls).toBe(1);
      expect(arm.totalReward).toBe(1.0);
    });

    it("should learn to prefer high-reward arm in matching context", () => {
      // Train: arm A is best when context[0] is high
      for (let i = 0; i < 50; i++) {
        bandit.recordReward("a", 0.9, [1, 0, 0]);
        bandit.recordReward("b", 0.1, [1, 0, 0]);
        bandit.recordReward("c", 0.5, [1, 0, 0]);
      }

      const result = bandit.selectArm([1, 0, 0]);
      expect(result.arm.id).toBe("a");
    });

    it("should learn different preferences for different contexts", () => {
      // Arm A is best in context [1,0,0], Arm B best in [0,1,0]
      for (let i = 0; i < 50; i++) {
        bandit.recordReward("a", 0.9, [1, 0, 0]);
        bandit.recordReward("b", 0.1, [1, 0, 0]);
        bandit.recordReward("a", 0.1, [0, 1, 0]);
        bandit.recordReward("b", 0.9, [0, 1, 0]);
      }

      const result1 = bandit.selectArm([1, 0, 0]);
      const result2 = bandit.selectArm([0, 1, 0]);

      expect(result1.arm.id).toBe("a");
      expect(result2.arm.id).toBe("b");
    });

    it("should reject wrong-dimensional context in reward", () => {
      expect(() => bandit.recordReward("a", 1.0, [1])).toThrow("dimension mismatch");
    });

    it("should reject unknown arm ID", () => {
      expect(() => bandit.recordReward("x", 1.0, [1, 0, 0])).toThrow("not found");
    });
  });

  describe("getWeights", () => {
    it("should return weight vector of correct dimension", () => {
      bandit.recordReward("a", 1.0, [1, 0, 0]);
      const weights = bandit.getWeights("a");
      expect(weights).toHaveLength(3);
    });

    it("should learn positive weight for rewarded feature", () => {
      for (let i = 0; i < 20; i++) {
        bandit.recordReward("a", 1.0, [1, 0, 0]);
      }
      const weights = bandit.getWeights("a");
      expect(weights[0]).toBeGreaterThan(0.5);
    });
  });

  describe("predict", () => {
    it("should predict reward for arm + context", () => {
      bandit.recordReward("a", 0.8, [1, 0, 0]);
      const pred = bandit.predict("a", [1, 0, 0]);
      expect(pred.expected).toBeGreaterThan(0);
      expect(pred.confidence).toBeGreaterThan(0);
    });

    it("should have narrower confidence after more observations", () => {
      const pred1 = bandit.predict("a", [1, 0, 0]);
      for (let i = 0; i < 20; i++) {
        bandit.recordReward("a", 0.8, [1, 0, 0]);
      }
      const pred2 = bandit.predict("a", [1, 0, 0]);
      expect(pred2.confidence).toBeLessThan(pred1.confidence);
    });
  });

  describe("state persistence", () => {
    it("should export and import state", () => {
      bandit.recordReward("a", 0.9, [1, 0, 0]);
      bandit.recordReward("b", 0.3, [0, 1, 0]);

      const state = bandit.exportState();
      expect(state.arms).toHaveLength(3);
      expect(state.config.dimensions).toBe(3);

      const bandit2 = createContextualBandit({ dimensions: 3 });
      bandit2.importState(state);

      const arms2 = bandit2.getArms();
      expect(arms2).toHaveLength(3);
      expect(arms2.find((a) => a.id === "a")!.pulls).toBe(1);
    });

    it("should preserve learned behavior after import", () => {
      for (let i = 0; i < 30; i++) {
        bandit.recordReward("a", 0.9, [1, 0, 0]);
        bandit.recordReward("b", 0.1, [1, 0, 0]);
      }

      const state = bandit.exportState();
      const bandit2 = createContextualBandit({ dimensions: 3 });
      bandit2.importState(state);

      const result = bandit2.selectArm([1, 0, 0]);
      expect(result.arm.id).toBe("a");
    });
  });

  describe("exploration vs exploitation", () => {
    it("should explore more with higher alpha", () => {
      const exploratory = createContextualBandit({ dimensions: 3, alpha: 5.0 });
      exploratory.addArm("a", "A");
      exploratory.addArm("b", "B");
      exploratory.recordReward("a", 0.9, [1, 0, 0]);

      const conservative = createContextualBandit({ dimensions: 3, alpha: 0.1 });
      conservative.addArm("a", "A");
      conservative.addArm("b", "B");
      conservative.recordReward("a", 0.9, [1, 0, 0]);

      const exploratoryResult = exploratory.selectArm([1, 0, 0]);
      const conservativeResult = conservative.selectArm([1, 0, 0]);

      expect(exploratoryResult.confidenceWidth).toBeGreaterThan(
        conservativeResult.confidenceWidth,
      );
    });
  });
});
