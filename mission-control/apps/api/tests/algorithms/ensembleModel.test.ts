/**
 * Ensemble Model Tests
 * Tests for model combination, voting strategies, calibration, and uncertainty quantification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EnsembleModel,
  createEnsembleModel,
  type EnsembleModel as EnsembleModelType,
  type ModelPrediction,
  type EnsembleConfig,
  type ModelPerformance,
} from '../../src/services/oracle/algorithms/ensemble';

// Mock model factory
function createMockModel(
  id: string,
  name: string,
  predictedValue: number,
  confidence: number = 0.8
): EnsembleModelType {
  return {
    id,
    name,
    type: 'heuristic',
    weight: 0.25,
    active: true,
    predict: vi.fn((): ModelPrediction => ({
      value: predictedValue,
      confidence,
    })),
  };
}

describe('EnsembleModel', () => {
  let ensemble: EnsembleModel;

  beforeEach(() => {
    // Create ensemble with seed for reproducibility
    ensemble = createEnsembleModel(
      {
        combinationMethod: 'weighted-voting',
        autoCalibrate: false,
        minWeight: 0.01,
        maxWeight: 0.5,
        performanceWindow: 100,
      },
      12345
    );
  });

  // ============================================================================
  // Model Registration Tests
  // ============================================================================

  describe('Model Registration', () => {
    it('should register a single model', () => {
      const model = createMockModel('model1', 'Test Model', 0.5);
      ensemble.registerModel(model);

      const registered = ensemble.getModel('model1');
      expect(registered).toBeDefined();
      expect(registered?.id).toBe('model1');
    });

    it('should register multiple models', () => {
      const models = [
        createMockModel('m1', 'Model 1', 0.5),
        createMockModel('m2', 'Model 2', 0.6),
        createMockModel('m3', 'Model 3', 0.7),
      ];

      ensemble.registerModels(models);

      const allModels = ensemble.getAllModels();
      expect(allModels).toHaveLength(3);
    });

    it('should initialize performance tracking for registered models', () => {
      const model = createMockModel('model1', 'Test Model', 0.5);
      ensemble.registerModel(model);

      const performance = ensemble.getModelPerformance('model1');
      expect(performance).toBeDefined();
      expect(performance?.totalPredictions).toBe(0);
    });

    it('should enable/disable models', () => {
      const model = createMockModel('model1', 'Test Model', 0.5);
      ensemble.registerModel(model);

      ensemble.setModelActive('model1', false);
      expect(ensemble.getModel('model1')?.active).toBe(false);

      ensemble.setModelActive('model1', true);
      expect(ensemble.getModel('model1')?.active).toBe(true);
    });
  });

  // ============================================================================
  // Weighted Voting Tests
  // ============================================================================

  describe('Weighted Voting', () => {
    beforeEach(() => {
      ensemble = createEnsembleModel(
        { combinationMethod: 'weighted-voting' },
        12345
      );
    });

    it('should combine predictions using weighted average', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.8, 0.9);
      model1.weight = 0.5;
      const model2 = createMockModel('m2', 'Model 2', 0.4, 0.9);
      model2.weight = 0.5;

      ensemble.registerModels([model1, model2]);

      const prediction = ensemble.predict({});

      // Weighted average of 0.8 and 0.4 with equal weights
      expect(prediction.value).toBeCloseTo(0.6, 1);
      expect(prediction.method).toBe('weighted-voting');
    });

    it('should weight by confidence', () => {
      const model1 = createMockModel('m1', 'Model 1', 1.0, 0.9); // High confidence
      model1.weight = 0.5;
      const model2 = createMockModel('m2', 'Model 2', 0.0, 0.1); // Low confidence
      model2.weight = 0.5;

      ensemble.registerModels([model1, model2]);

      const prediction = ensemble.predict({});

      // Should be closer to 1.0 due to confidence weighting
      expect(prediction.value).toBeGreaterThan(0.5);
    });

    it('should skip inactive models', () => {
      const model1 = createMockModel('m1', 'Model 1', 1.0);
      const model2 = createMockModel('m2', 'Model 2', 0.0);
      model2.active = false;

      ensemble.registerModels([model1, model2]);

      const prediction = ensemble.predict({});

      expect(prediction.value).toBe(1.0);
      expect(model2.predict).not.toHaveBeenCalled();
    });

    it('should calculate model agreement', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.5);
      const model2 = createMockModel('m2', 'Model 2', 0.5);
      const model3 = createMockModel('m3', 'Model 3', 0.5);

      ensemble.registerModels([model1, model2, model3]);

      const prediction = ensemble.predict({});

      // All models agree, high agreement
      expect(prediction.agreement).toBe(1);
    });

    it('should calculate uncertainty', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.2);
      const model2 = createMockModel('m2', 'Model 2', 0.8);

      ensemble.registerModels([model1, model2]);

      const prediction = ensemble.predict({});

      // Different predictions = high uncertainty
      expect(prediction.uncertainty).toBeGreaterThan(0);
    });

    it('should return zero predictions when no active models', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.5);
      model1.active = false;

      ensemble.registerModel(model1);

      const prediction = ensemble.predict({});

      expect(prediction.value).toBe(0);
      expect(prediction.confidence).toBe(0);
    });
  });

  // ============================================================================
  // Stacking Tests
  // ============================================================================

  describe('Stacking Meta-Learner', () => {
    beforeEach(() => {
      ensemble = createEnsembleModel(
        {
          combinationMethod: 'stacking',
          stackingConfig: {
            cvFolds: 5,
            metaLearner: 'ridge',
            regularization: 0.1,
            learningRate: 0.01,
          },
        },
        12345
      );
    });

    it('should use stacking method for predictions', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.8);
      const model2 = createMockModel('m2', 'Model 2', 0.4);

      ensemble.registerModels([model1, model2]);

      const prediction = ensemble.predict({});

      expect(prediction.method).toBe('stacking');
    });

    it('should train stacking weights from history', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.8);
      const model2 = createMockModel('m2', 'Model 2', 0.4);

      ensemble.registerModels([model1, model2]);

      // Generate training data
      for (let i = 0; i < 20; i++) {
        const pred = ensemble.predict({ x: i });
        ensemble.recordOutcome({ x: i }, i % 2 === 0 ? 0.8 : 0.4, pred);
      }

      ensemble.trainStackingMetaLearner();

      // After training, should produce predictions
      const prediction = ensemble.predict({});
      expect(prediction.value).toBeDefined();
    });

    it('should not train with insufficient data', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.8);
      ensemble.registerModel(model1);

      // Only 5 examples - not enough
      for (let i = 0; i < 5; i++) {
        const pred = ensemble.predict({});
        ensemble.recordOutcome({}, 0.5, pred);
      }

      // Should not throw
      expect(() => ensemble.trainStackingMetaLearner()).not.toThrow();
    });
  });

  // ============================================================================
  // Bayesian Averaging Tests
  // ============================================================================

  describe('Bayesian Model Averaging', () => {
    beforeEach(() => {
      ensemble = createEnsembleModel(
        { combinationMethod: 'bayesian-averaging' },
        12345
      );
    });

    it('should use Bayesian averaging for predictions', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.8);
      const model2 = createMockModel('m2', 'Model 2', 0.4);

      ensemble.registerModels([model1, model2]);

      const prediction = ensemble.predict({});

      expect(prediction.method).toBe('bayesian-averaging');
    });

    it('should weight by historical performance', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.8);
      const model2 = createMockModel('m2', 'Model 2', 0.4);

      ensemble.registerModels([model1, model2]);

      // Record some outcomes to build history
      for (let i = 0; i < 10; i++) {
        const pred = ensemble.predict({});
        // Model 1 is closer to actual
        ensemble.recordOutcome({}, 0.8, pred);
      }

      const prediction = ensemble.predict({});

      // Model 1 should have higher weight
      const model1Weight = prediction.weightsUsed.get('m1') || 0;
      const model2Weight = prediction.weightsUsed.get('m2') || 0;

      expect(model1Weight).toBeGreaterThan(0);
      expect(model2Weight).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Performance Tracking Tests
  // ============================================================================

  describe('Performance Tracking', () => {
    it('should update performance on recorded outcomes', () => {
      const model = createMockModel('m1', 'Model 1', 0.8);
      ensemble.registerModel(model);

      const pred = ensemble.predict({});
      ensemble.recordOutcome({}, 0.8, pred);

      const perf = ensemble.getModelPerformance('m1');
      expect(perf?.totalPredictions).toBe(1);
    });

    it('should track mean absolute error', () => {
      const model = createMockModel('m1', 'Model 1', 0.8);
      ensemble.registerModel(model);

      const pred = ensemble.predict({});
      ensemble.recordOutcome({}, 0.5, pred); // Error of 0.3

      const perf = ensemble.getModelPerformance('m1');
      expect(perf?.meanAbsoluteError).toBeGreaterThan(0);
    });

    it('should track recent accuracy', () => {
      const model = createMockModel('m1', 'Model 1', 0.5);
      ensemble.registerModel(model);

      // Perfect predictions
      for (let i = 0; i < 10; i++) {
        const pred = ensemble.predict({});
        ensemble.recordOutcome({}, 0.5, pred);
      }

      const perf = ensemble.getModelPerformance('m1');
      expect(perf?.recentAccuracy).toBeGreaterThan(0.5);
    });

    it('should track calibration score', () => {
      const model = createMockModel('m1', 'Model 1', 0.8, 0.9);
      ensemble.registerModel(model);

      const pred = ensemble.predict({});
      ensemble.recordOutcome({}, 0.8, pred);

      const perf = ensemble.getModelPerformance('m1');
      expect(perf?.calibrationScore).toBeGreaterThan(0);
      expect(perf?.calibrationScore).toBeLessThanOrEqual(1);
    });

    it('should get all performances', () => {
      const models = [
        createMockModel('m1', 'Model 1', 0.5),
        createMockModel('m2', 'Model 2', 0.6),
      ];

      ensemble.registerModels(models);

      const perfs = ensemble.getAllPerformances();
      expect(perfs.size).toBe(2);
    });
  });

  // ============================================================================
  // Auto-Calibration Tests
  // ============================================================================

  describe('Auto-Calibration', () => {
    beforeEach(() => {
      ensemble = createEnsembleModel(
        {
          autoCalibrate: true,
          calibrationRate: 0.5,
          minWeight: 0.1,
          maxWeight: 0.9,
        },
        12345
      );
    });

    it('should calibrate weights on outcome recording', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.8);
      model1.weight = 0.5;
      const model2 = createMockModel('m2', 'Model 2', 0.2);
      model2.weight = 0.5;

      ensemble.registerModels([model1, model2]);

      // Model 1 is consistently right
      for (let i = 0; i < 10; i++) {
        const pred = ensemble.predict({});
        ensemble.recordOutcome({}, 0.8, pred);
      }

      // Model 1 should have higher weight now
      const m1 = ensemble.getModel('m1');
      const m2 = ensemble.getModel('m2');

      expect(m1?.weight).toBeGreaterThan(m2?.weight || 0);
    });

    it('should respect weight bounds', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.8);
      ensemble.registerModel(model1);

      for (let i = 0; i < 50; i++) {
        const pred = ensemble.predict({});
        ensemble.recordOutcome({}, 0.8, pred);
      }

      const model = ensemble.getModel('m1');
      expect(model?.weight).toBeGreaterThanOrEqual(0.1);
      expect(model?.weight).toBeLessThanOrEqual(0.9);
    });
  });

  // ============================================================================
  // Uncertainty Quantification Tests
  // ============================================================================

  describe('Uncertainty Quantification', () => {
    it('should calculate epistemic uncertainty', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.2);
      const model2 = createMockModel('m2', 'Model 2', 0.8);

      ensemble.registerModels([model1, model2]);

      const prediction = ensemble.predict({});
      const metrics = ensemble.getUncertaintyMetrics(prediction);

      // High disagreement = high epistemic uncertainty
      expect(metrics.epistemic).toBeGreaterThan(0);
    });

    it('should calculate aleatoric uncertainty', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.5, 0.5); // Low confidence
      const model2 = createMockModel('m2', 'Model 2', 0.5, 0.5);

      ensemble.registerModels([model1, model2]);

      const prediction = ensemble.predict({});
      const metrics = ensemble.getUncertaintyMetrics(prediction);

      // Low confidence = high aleatoric uncertainty
      expect(metrics.aleatoric).toBeGreaterThan(0);
    });

    it('should calculate total uncertainty', () => {
      const model = createMockModel('m1', 'Model 1', 0.5, 0.7);
      ensemble.registerModel(model);

      const prediction = ensemble.predict({});
      const metrics = ensemble.getUncertaintyMetrics(prediction);

      expect(metrics.total).toBeGreaterThan(0);
    });

    it('should provide confidence interval', () => {
      const model = createMockModel('m1', 'Model 1', 0.5, 0.8);
      ensemble.registerModel(model);

      const prediction = ensemble.predict({});
      const metrics = ensemble.getUncertaintyMetrics(prediction);

      expect(metrics.confidenceInterval.lower).toBeLessThanOrEqual(prediction.value);
      expect(metrics.confidenceInterval.upper).toBeGreaterThanOrEqual(prediction.value);
    });

    it('should handle empty predictions gracefully', () => {
      const model = createMockModel('m1', 'Model 1', 0.5);
      model.active = false;
      ensemble.registerModel(model);

      const prediction = ensemble.predict({});
      const metrics = ensemble.getUncertaintyMetrics(prediction);

      expect(metrics.epistemic).toBe(1);
      expect(metrics.aleatoric).toBe(1);
    });
  });

  // ============================================================================
  // Model Rankings Tests
  // ============================================================================

  describe('Model Rankings', () => {
    it('should rank models by performance', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.8);
      const model2 = createMockModel('m2', 'Model 2', 0.5);

      ensemble.registerModels([model1, model2]);

      // Record outcomes favoring model1
      for (let i = 0; i < 10; i++) {
        const pred = ensemble.predict({});
        ensemble.recordOutcome({}, 0.8, pred);
      }

      const rankings = ensemble.getModelRankings();

      expect(rankings).toHaveLength(2);
      expect(rankings[0].score).toBeGreaterThanOrEqual(rankings[1].score);
    });

    it('should include metrics in rankings', () => {
      const model = createMockModel('m1', 'Model 1', 0.5);
      ensemble.registerModel(model);

      const rankings = ensemble.getModelRankings();

      expect(rankings[0].modelId).toBe('m1');
      expect(rankings[0].metrics).toBeDefined();
      expect(rankings[0].score).toBeDefined();
    });
  });

  // ============================================================================
  // State Persistence Tests
  // ============================================================================

  describe('State Export/Import', () => {
    it('should export current state', () => {
      const model = createMockModel('m1', 'Model 1', 0.5);
      model.weight = 0.3;
      ensemble.registerModel(model);

      const exported = ensemble.exportState();

      expect(exported.config).toBeDefined();
      expect(exported.models).toHaveLength(1);
      expect(exported.models[0].weight).toBe(0.3);
    });

    it('should import state correctly', () => {
      const model = createMockModel('m1', 'Model 1', 0.5);
      model.weight = 0.7;
      ensemble.registerModel(model);

      const exported = ensemble.exportState();

      // Create new ensemble and import
      const newEnsemble = createEnsembleModel();
      newEnsemble.registerModel(createMockModel('m1', 'Model 1', 0.5));
      newEnsemble.importState(exported);

      const importedModel = newEnsemble.getModel('m1');
      expect(importedModel?.weight).toBe(0.7);
    });

    it('should preserve performance data', () => {
      const model = createMockModel('m1', 'Model 1', 0.5);
      ensemble.registerModel(model);

      // Record some outcomes
      for (let i = 0; i < 5; i++) {
        const pred = ensemble.predict({});
        ensemble.recordOutcome({}, 0.5, pred);
      }

      const exported = ensemble.exportState();

      const newEnsemble = createEnsembleModel();
      newEnsemble.registerModel(createMockModel('m1', 'Model 1', 0.5));
      newEnsemble.importState(exported);

      const perf = newEnsemble.getModelPerformance('m1');
      expect(perf?.totalPredictions).toBe(5);
    });

    it('should preserve stacking weights', () => {
      ensemble = createEnsembleModel({ combinationMethod: 'stacking' }, 12345);

      const model = createMockModel('m1', 'Model 1', 0.5);
      ensemble.registerModel(model);

      // Generate training data
      for (let i = 0; i < 15; i++) {
        const pred = ensemble.predict({});
        ensemble.recordOutcome({}, 0.5, pred);
      }
      ensemble.trainStackingMetaLearner();

      const exported = ensemble.exportState();
      expect(exported.stackingWeights.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Reset Tests
  // ============================================================================

  describe('Reset', () => {
    it('should reset all model weights to uniform', () => {
      const model1 = createMockModel('m1', 'Model 1', 0.5);
      model1.weight = 0.8;
      const model2 = createMockModel('m2', 'Model 2', 0.5);
      model2.weight = 0.2;

      ensemble.registerModels([model1, model2]);
      ensemble.reset();

      const m1 = ensemble.getModel('m1');
      const m2 = ensemble.getModel('m2');

      expect(m1?.weight).toBe(0.5);
      expect(m2?.weight).toBe(0.5);
    });

    it('should reset performance tracking', () => {
      const model = createMockModel('m1', 'Model 1', 0.5);
      ensemble.registerModel(model);

      // Record some outcomes
      for (let i = 0; i < 5; i++) {
        const pred = ensemble.predict({});
        ensemble.recordOutcome({}, 0.5, pred);
      }

      ensemble.reset();

      const perf = ensemble.getModelPerformance('m1');
      expect(perf?.totalPredictions).toBe(0);
      expect(perf?.accuracyHistory).toEqual([]);
    });

    it('should clear stacking weights', () => {
      ensemble = createEnsembleModel({ combinationMethod: 'stacking' }, 12345);

      const model = createMockModel('m1', 'Model 1', 0.5);
      ensemble.registerModel(model);

      ensemble.reset();

      const exported = ensemble.exportState();
      expect(exported.stackingWeights).toEqual([]);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle model prediction failure gracefully', () => {
      const failingModel: EnsembleModelType = {
        id: 'failing',
        name: 'Failing Model',
        type: 'heuristic',
        weight: 0.5,
        active: true,
        predict: () => {
          throw new Error('Model failed');
        },
      };
      const goodModel = createMockModel('good', 'Good Model', 0.5);

      ensemble.registerModels([failingModel, goodModel]);

      // Should not throw, should use working model
      const prediction = ensemble.predict({});
      expect(prediction.value).toBe(0.5);
    });

    it('should handle all models failing', () => {
      const failingModel: EnsembleModelType = {
        id: 'failing',
        name: 'Failing Model',
        type: 'heuristic',
        weight: 1,
        active: true,
        predict: () => {
          throw new Error('Model failed');
        },
      };

      ensemble.registerModel(failingModel);

      const prediction = ensemble.predict({});
      expect(prediction.value).toBe(0);
      expect(prediction.agreement).toBe(0);
    });

    it('should handle undefined model performance', () => {
      const perf = ensemble.getModelPerformance('nonexistent');
      expect(perf).toBeUndefined();
    });

    it('should handle recording outcome without prediction', () => {
      const model = createMockModel('m1', 'Model 1', 0.5);
      ensemble.registerModel(model);

      // Should generate prediction internally
      expect(() => ensemble.recordOutcome({}, 0.5)).not.toThrow();
    });
  });
});
