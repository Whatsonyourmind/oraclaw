/**
 * ORACLE Watch Complication Data Provider
 * Story watch-2 - Provides data for Apple Watch complications
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { watchBridge } from './WatchBridge';
import {
  OODAPhase,
  OODA_COLORS,
  OODA_ICONS,
  SignalUrgency,
  URGENCY_COLORS,
  ComplicationData,
  WatchSignal,
  WatchStep,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const COMPLICATION_REFRESH_KEY = 'oracle_complication_last_refresh';
const COMPLICATION_DATA_KEY = 'oracle_complication_data';
const MIN_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes minimum

// ============================================================================
// COMPLICATION FAMILIES
// ============================================================================

export type ComplicationFamily =
  | 'circularSmall'
  | 'modularSmall'
  | 'modularLarge'
  | 'utilitarianSmall'
  | 'utilitarianSmallFlat'
  | 'utilitarianLarge'
  | 'extraLarge'
  | 'graphicCorner'
  | 'graphicBezel'
  | 'graphicCircular'
  | 'graphicRectangular'
  | 'graphicExtraLarge';

export interface ComplicationTemplate {
  family: ComplicationFamily;
  type: string;
  data: any;
}

// ============================================================================
// COMPLICATION DATA PROVIDER CLASS
// ============================================================================

class OracleComplicationDataProvider {
  private currentData: ComplicationData | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private lastRefreshTime: number = 0;

  // ==========================================
  // INITIALIZATION
  // ==========================================

  async initialize(): Promise<void> {
    // Load persisted data
    await this.loadPersistedData();

    // Start refresh schedule
    this.startRefreshSchedule();
  }

  private async loadPersistedData(): Promise<void> {
    try {
      const storedData = await AsyncStorage.getItem(COMPLICATION_DATA_KEY);
      if (storedData) {
        this.currentData = JSON.parse(storedData);
      }

      const lastRefresh = await AsyncStorage.getItem(COMPLICATION_REFRESH_KEY);
      if (lastRefresh) {
        this.lastRefreshTime = parseInt(lastRefresh, 10);
      }
    } catch (error) {
      console.error('[ComplicationProvider] Failed to load persisted data:', error);
    }
  }

  // ==========================================
  // DATA GENERATION
  // ==========================================

  /**
   * Generate complication data from ORACLE state
   */
  generateComplicationData(
    phase: OODAPhase,
    signals: WatchSignal[],
    currentStep: WatchStep | null,
    planProgress: number,
    pendingGhostActions: number,
    nextAction: { title: string; time: number } | null
  ): ComplicationData {
    // Find top signal by urgency
    const urgencyOrder: SignalUrgency[] = ['critical', 'high', 'medium', 'low'];
    const topSignal = signals.length > 0
      ? signals.sort((a, b) => urgencyOrder.indexOf(a.urgency) - urgencyOrder.indexOf(b.urgency))[0]
      : null;

    const data: ComplicationData = {
      phase,
      phaseColor: OODA_COLORS[phase],
      signalCount: signals.length,
      topSignalTitle: topSignal?.title || null,
      topSignalUrgency: topSignal?.urgency || null,
      planProgress,
      currentStepTitle: currentStep?.title || null,
      pendingGhostActions,
      nextActionTitle: nextAction?.title || null,
      nextActionTime: nextAction?.time || null,
      lastUpdated: Date.now(),
    };

    this.currentData = data;
    this.persistData();

    return data;
  }

  /**
   * Get current complication data
   */
  getCurrentData(): ComplicationData | null {
    return this.currentData;
  }

  // ==========================================
  // COMPLICATION TEMPLATES
  // ==========================================

  /**
   * Generate template for Circular Small complication
   * Shows: Phase icon with color
   */
  getCircularSmallTemplate(): ComplicationTemplate {
    const data = this.currentData;
    return {
      family: 'circularSmall',
      type: 'CLKComplicationTemplateCircularSmallRingImage',
      data: {
        imageProvider: {
          systemImage: OODA_ICONS[data?.phase || 'idle'],
          tintColor: data?.phaseColor || OODA_COLORS.idle,
        },
        fillFraction: (data?.planProgress || 0) / 100,
        ringStyle: 'open',
      },
    };
  }

  /**
   * Generate template for Modular Small complication
   * Shows: Phase initial with color
   */
  getModularSmallTemplate(): ComplicationTemplate {
    const data = this.currentData;
    const phaseInitial = (data?.phase || 'I').charAt(0).toUpperCase();

    return {
      family: 'modularSmall',
      type: 'CLKComplicationTemplateModularSmallSimpleText',
      data: {
        textProvider: {
          text: phaseInitial,
          tintColor: data?.phaseColor || OODA_COLORS.idle,
        },
      },
    };
  }

  /**
   * Generate template for Modular Large complication
   * Shows: Phase, top signal, and progress
   */
  getModularLargeTemplate(): ComplicationTemplate {
    const data = this.currentData;

    return {
      family: 'modularLarge',
      type: 'CLKComplicationTemplateModularLargeStandardBody',
      data: {
        headerTextProvider: {
          text: `ORACLE - ${(data?.phase || 'IDLE').toUpperCase()}`,
          tintColor: data?.phaseColor || OODA_COLORS.idle,
        },
        body1TextProvider: {
          text: data?.topSignalTitle || 'No active signals',
          tintColor: data?.topSignalUrgency
            ? URGENCY_COLORS[data.topSignalUrgency]
            : '#888888',
        },
        body2TextProvider: {
          text: data?.currentStepTitle || `${data?.signalCount || 0} signals`,
        },
      },
    };
  }

  /**
   * Generate template for Graphic Corner complication
   * Shows: Phase gauge with progress
   */
  getGraphicCornerTemplate(): ComplicationTemplate {
    const data = this.currentData;

    return {
      family: 'graphicCorner',
      type: 'CLKComplicationTemplateGraphicCornerGaugeText',
      data: {
        gaugeProvider: {
          fillFraction: (data?.planProgress || 0) / 100,
          gaugeColors: [OODA_COLORS.idle, data?.phaseColor || OODA_COLORS.idle],
          gaugeColorLocations: [0, 1],
        },
        leadingTextProvider: {
          text: (data?.phase || 'I').charAt(0).toUpperCase(),
        },
        trailingTextProvider: {
          text: `${data?.planProgress || 0}%`,
        },
        outerTextProvider: {
          text: data?.currentStepTitle || '',
        },
      },
    };
  }

  /**
   * Generate template for Graphic Circular complication
   * Shows: Phase ring with icon
   */
  getGraphicCircularTemplate(): ComplicationTemplate {
    const data = this.currentData;

    return {
      family: 'graphicCircular',
      type: 'CLKComplicationTemplateGraphicCircularOpenGaugeImage',
      data: {
        gaugeProvider: {
          fillFraction: (data?.planProgress || 0) / 100,
          gaugeColors: [data?.phaseColor || OODA_COLORS.idle],
        },
        centerTextProvider: {
          text: (data?.phase || 'I').charAt(0).toUpperCase(),
          tintColor: data?.phaseColor || OODA_COLORS.idle,
        },
        bottomTextProvider: {
          text: data?.signalCount?.toString() || '0',
        },
      },
    };
  }

  /**
   * Generate template for Graphic Rectangular complication
   * Shows: Full mini dashboard
   */
  getGraphicRectangularTemplate(): ComplicationTemplate {
    const data = this.currentData;

    return {
      family: 'graphicRectangular',
      type: 'CLKComplicationTemplateGraphicRectangularStandardBody',
      data: {
        headerTextProvider: {
          text: `ORACLE`,
          tintColor: data?.phaseColor || OODA_COLORS.idle,
        },
        headerImageProvider: {
          systemImage: OODA_ICONS[data?.phase || 'idle'],
          tintColor: data?.phaseColor || OODA_COLORS.idle,
        },
        body1TextProvider: {
          text: data?.topSignalTitle || 'No signals',
          tintColor: data?.topSignalUrgency
            ? URGENCY_COLORS[data.topSignalUrgency]
            : '#FFFFFF',
        },
        body2TextProvider: {
          text: data?.pendingGhostActions
            ? `${data.pendingGhostActions} actions pending`
            : data?.currentStepTitle || `Progress: ${data?.planProgress || 0}%`,
        },
      },
    };
  }

  /**
   * Get template for a specific complication family
   */
  getTemplateForFamily(family: ComplicationFamily): ComplicationTemplate {
    switch (family) {
      case 'circularSmall':
        return this.getCircularSmallTemplate();
      case 'modularSmall':
        return this.getModularSmallTemplate();
      case 'modularLarge':
        return this.getModularLargeTemplate();
      case 'graphicCorner':
        return this.getGraphicCornerTemplate();
      case 'graphicCircular':
        return this.getGraphicCircularTemplate();
      case 'graphicRectangular':
        return this.getGraphicRectangularTemplate();
      default:
        // Default to circular small for unsupported families
        return this.getCircularSmallTemplate();
    }
  }

  /**
   * Get all supported complication templates
   */
  getAllTemplates(): ComplicationTemplate[] {
    return [
      this.getCircularSmallTemplate(),
      this.getModularSmallTemplate(),
      this.getModularLargeTemplate(),
      this.getGraphicCornerTemplate(),
      this.getGraphicCircularTemplate(),
      this.getGraphicRectangularTemplate(),
    ];
  }

  // ==========================================
  // REFRESH SCHEDULE
  // ==========================================

  /**
   * Start the refresh schedule (15 minute minimum)
   */
  startRefreshSchedule(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    // Check and refresh every 15 minutes
    this.refreshTimer = setInterval(() => {
      this.checkAndRefresh();
    }, MIN_REFRESH_INTERVAL);
  }

  /**
   * Stop the refresh schedule
   */
  stopRefreshSchedule(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Check if refresh is needed and perform if so
   */
  async checkAndRefresh(): Promise<boolean> {
    const now = Date.now();
    const timeSinceLastRefresh = now - this.lastRefreshTime;

    if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL) {
      console.log('[ComplicationProvider] Skipping refresh, too soon');
      return false;
    }

    // Push update to Watch
    await this.pushToWatch();
    this.lastRefreshTime = now;
    await AsyncStorage.setItem(COMPLICATION_REFRESH_KEY, now.toString());

    return true;
  }

  /**
   * Force refresh complications (ignores minimum interval)
   */
  async forceRefresh(): Promise<void> {
    await this.pushToWatch();
    this.lastRefreshTime = Date.now();
    await AsyncStorage.setItem(COMPLICATION_REFRESH_KEY, this.lastRefreshTime.toString());
  }

  /**
   * Push complication data to Watch
   */
  private async pushToWatch(): Promise<void> {
    if (!this.currentData) {
      console.log('[ComplicationProvider] No data to push');
      return;
    }

    await watchBridge.updateComplication({
      phase: this.currentData.phase,
      phaseColor: this.currentData.phaseColor,
      signalCount: this.currentData.signalCount,
      topUrgency: this.currentData.topSignalUrgency || 'low',
      planProgress: this.currentData.planProgress,
      nextAction: this.currentData.nextActionTitle,
    });

    console.log('[ComplicationProvider] Pushed update to Watch');
  }

  // ==========================================
  // PERSISTENCE
  // ==========================================

  private async persistData(): Promise<void> {
    if (!this.currentData) return;

    try {
      await AsyncStorage.setItem(COMPLICATION_DATA_KEY, JSON.stringify(this.currentData));
    } catch (error) {
      console.error('[ComplicationProvider] Failed to persist data:', error);
    }
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  cleanup(): void {
    this.stopRefreshSchedule();
    this.currentData = null;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const complicationDataProvider = new OracleComplicationDataProvider();

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useComplicationData() {
  const [data, setData] = useState<ComplicationData | null>(
    complicationDataProvider.getCurrentData()
  );

  useEffect(() => {
    complicationDataProvider.initialize();
    return () => complicationDataProvider.cleanup();
  }, []);

  const updateData = useCallback(
    (
      phase: OODAPhase,
      signals: WatchSignal[],
      currentStep: WatchStep | null,
      planProgress: number,
      pendingGhostActions: number,
      nextAction: { title: string; time: number } | null
    ) => {
      const newData = complicationDataProvider.generateComplicationData(
        phase,
        signals,
        currentStep,
        planProgress,
        pendingGhostActions,
        nextAction
      );
      setData(newData);
    },
    []
  );

  const forceRefresh = useCallback(async () => {
    await complicationDataProvider.forceRefresh();
  }, []);

  const getTemplate = useCallback((family: ComplicationFamily) => {
    return complicationDataProvider.getTemplateForFamily(family);
  }, []);

  const getAllTemplates = useCallback(() => {
    return complicationDataProvider.getAllTemplates();
  }, []);

  return {
    data,
    updateData,
    forceRefresh,
    getTemplate,
    getAllTemplates,
  };
}

export default complicationDataProvider;
