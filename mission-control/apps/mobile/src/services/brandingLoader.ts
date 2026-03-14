/**
 * brandingLoader.ts
 * Story wl-4 - Dynamic branding loader
 *
 * Features:
 * - Fetch brand config on app load
 * - Apply theme dynamically
 * - Cache brand config locally
 * - Fallback to default theme
 * - Hot-reload on config change
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type {
  WhiteLabelConfig,
  ThemeVariant,
  ResolvedTheme,
  BrandConfig,
  BrandingContext,
  ThemeMode,
} from '@mission-control/shared-types';

// Default ORACLE theme colors
const DEFAULT_ORACLE_COLORS = {
  observe: '#00BFFF',
  orient: '#FFD700',
  decide: '#FF6B6B',
  act: '#00FF88',
};

// Default resolved theme (dark mode)
const DEFAULT_THEME: ResolvedTheme = {
  colors: {
    primary: '#00BFFF',
    secondary: '#FFD700',
    accent: '#FF6B6B',
    success: '#00FF88',
    warning: '#FFA500',
    error: '#FF4444',
    background: {
      primary: '#0a0a0a',
      secondary: '#111111',
      tertiary: '#1a1a1a',
    },
    surface: {
      primary: '#111111',
      secondary: '#1a1a1a',
      elevated: '#222222',
    },
    text: {
      primary: '#ffffff',
      secondary: '#cccccc',
      muted: '#888888',
      inverse: '#000000',
    },
    border: {
      primary: '#333333',
      secondary: '#222222',
    },
    ooda: DEFAULT_ORACLE_COLORS,
  },
  typography: {
    fontFamily: 'Inter',
    headingFontFamily: 'Inter',
    fontScale: 1.0,
  },
  brand: {
    name: 'ORACLE',
    tagline: 'Autonomous Intelligence Loop',
  },
  components: {
    button: {},
    card: {},
    input: {},
    modal: {},
  },
  mode: 'dark',
  variantType: 'dark',
  isAccessible: true,
};

// Light mode variant
const LIGHT_THEME: ResolvedTheme = {
  ...DEFAULT_THEME,
  colors: {
    ...DEFAULT_THEME.colors,
    background: {
      primary: '#ffffff',
      secondary: '#f5f5f5',
      tertiary: '#eeeeee',
    },
    surface: {
      primary: '#ffffff',
      secondary: '#f5f5f5',
      elevated: '#ffffff',
    },
    text: {
      primary: '#000000',
      secondary: '#333333',
      muted: '#666666',
      inverse: '#ffffff',
    },
    border: {
      primary: '#dddddd',
      secondary: '#eeeeee',
    },
  },
  mode: 'light',
  variantType: 'light',
};

// Storage keys
const STORAGE_KEYS = {
  BRAND_CONFIG: '@oracle/brand_config',
  LAST_UPDATED: '@oracle/brand_config_updated',
  THEME_MODE: '@oracle/theme_mode',
};

// Cache TTL (15 minutes)
const CACHE_TTL = 15 * 60 * 1000;

// API base URL (would come from env in production)
const API_BASE = 'http://localhost:3000/api';

type BrandingListener = (theme: ResolvedTheme) => void;

class BrandingLoaderService {
  private config: WhiteLabelConfig | null = null;
  private activeTheme: ResolvedTheme = DEFAULT_THEME;
  private listeners: Set<BrandingListener> = new Set();
  private lastFetch: number = 0;
  private isLoading: boolean = false;
  private error: string | null = null;
  private themeMode: ThemeMode = 'dark';

  /**
   * Initialize the branding loader
   * Should be called on app startup
   */
  async initialize(): Promise<ResolvedTheme> {
    try {
      // Load cached config first for fast startup
      await this.loadCachedConfig();

      // Then fetch fresh config in background
      this.fetchBrandConfig().catch(console.error);

      return this.activeTheme;
    } catch (error) {
      console.error('Failed to initialize branding:', error);
      return DEFAULT_THEME;
    }
  }

  /**
   * Load cached configuration from AsyncStorage
   */
  private async loadCachedConfig(): Promise<void> {
    try {
      const [configStr, lastUpdatedStr, themeModeStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.BRAND_CONFIG),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_UPDATED),
        AsyncStorage.getItem(STORAGE_KEYS.THEME_MODE),
      ]);

      if (themeModeStr) {
        this.themeMode = themeModeStr as ThemeMode;
      }

      if (configStr) {
        this.config = JSON.parse(configStr);
        this.activeTheme = this.resolveTheme(this.config!);

        // Check if cache is stale
        const lastUpdated = lastUpdatedStr ? parseInt(lastUpdatedStr, 10) : 0;
        if (Date.now() - lastUpdated > CACHE_TTL) {
          // Cache is stale, will be refreshed
          console.log('Brand config cache is stale, will refresh');
        }
      }
    } catch (error) {
      console.error('Failed to load cached config:', error);
    }
  }

  /**
   * Fetch brand configuration from API
   */
  async fetchBrandConfig(): Promise<WhiteLabelConfig | null> {
    if (this.isLoading) {
      return this.config;
    }

    this.isLoading = true;
    this.error = null;

    try {
      // In production, this would fetch from the API based on domain or org
      const response = await fetch(`${API_BASE}/oracle/whitelabel/config`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch brand config: ${response.status}`);
      }

      const data = await response.json();
      this.config = data.config;

      // Cache the config
      await this.cacheConfig();

      // Resolve and apply theme
      this.activeTheme = this.resolveTheme(this.config!);
      this.notifyListeners();

      this.lastFetch = Date.now();
      return this.config;
    } catch (error) {
      console.error('Failed to fetch brand config:', error);
      this.error = error instanceof Error ? error.message : 'Unknown error';

      // Use cached or default config
      if (!this.config) {
        this.activeTheme = DEFAULT_THEME;
      }

      return this.config;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Cache configuration to AsyncStorage
   */
  private async cacheConfig(): Promise<void> {
    if (!this.config) return;

    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.BRAND_CONFIG, JSON.stringify(this.config)),
        AsyncStorage.setItem(STORAGE_KEYS.LAST_UPDATED, Date.now().toString()),
      ]);
    } catch (error) {
      console.error('Failed to cache brand config:', error);
    }
  }

  /**
   * Resolve a complete theme from config
   */
  private resolveTheme(config: WhiteLabelConfig): ResolvedTheme {
    const baseTheme = this.themeMode === 'light' ? LIGHT_THEME : DEFAULT_THEME;

    return {
      colors: {
        primary: config.primary_color || baseTheme.colors.primary,
        secondary: config.secondary_color || baseTheme.colors.secondary,
        accent: config.accent_color || baseTheme.colors.accent,
        success: config.success_color || baseTheme.colors.success,
        warning: config.warning_color || baseTheme.colors.warning,
        error: config.error_color || baseTheme.colors.error,
        background: baseTheme.colors.background,
        surface: baseTheme.colors.surface,
        text: baseTheme.colors.text,
        border: baseTheme.colors.border,
        ooda: {
          observe: config.observe_color || DEFAULT_ORACLE_COLORS.observe,
          orient: config.orient_color || DEFAULT_ORACLE_COLORS.orient,
          decide: config.decide_color || DEFAULT_ORACLE_COLORS.decide,
          act: config.act_color || DEFAULT_ORACLE_COLORS.act,
        },
      },
      typography: {
        fontFamily: config.font_family || baseTheme.typography.fontFamily,
        headingFontFamily: config.heading_font_family || config.font_family || baseTheme.typography.headingFontFamily,
        fontScale: config.font_scale || baseTheme.typography.fontScale,
      },
      brand: {
        name: config.brand_name,
        tagline: config.brand_tagline,
        logoUrl: config.logo_url,
        logoDarkUrl: config.logo_dark_url,
        faviconUrl: config.favicon_url,
      },
      components: baseTheme.components,
      mode: this.themeMode,
      variantType: this.themeMode === 'light' ? 'light' : 'dark',
      isAccessible: true,
    };
  }

  /**
   * Apply a theme variant
   */
  applyThemeVariant(variant: ThemeVariant): void {
    this.activeTheme = {
      ...this.activeTheme,
      colors: {
        ...this.activeTheme.colors,
        background: {
          primary: variant.background_primary,
          secondary: variant.background_secondary,
          tertiary: variant.background_tertiary || variant.background_secondary,
        },
        surface: {
          primary: variant.surface_primary,
          secondary: variant.surface_secondary || variant.surface_primary,
          elevated: variant.surface_elevated || variant.surface_primary,
        },
        text: {
          primary: variant.text_primary,
          secondary: variant.text_secondary,
          muted: variant.text_muted || variant.text_secondary,
          inverse: variant.text_inverse || this.activeTheme.colors.text.inverse,
        },
        border: {
          primary: variant.border_primary || this.activeTheme.colors.border.primary,
          secondary: variant.border_secondary || this.activeTheme.colors.border.secondary,
        },
        ooda: {
          observe: variant.phase_observe || this.activeTheme.colors.ooda.observe,
          orient: variant.phase_orient || this.activeTheme.colors.ooda.orient,
          decide: variant.phase_decide || this.activeTheme.colors.ooda.decide,
          act: variant.phase_act || this.activeTheme.colors.ooda.act,
        },
      },
      components: {
        button: variant.button_styles || {},
        card: variant.card_styles || {},
        input: variant.input_styles || {},
        modal: variant.modal_styles || {},
      },
      variantType: variant.variant_type,
      isAccessible: variant.is_accessible,
    };

    this.notifyListeners();
  }

  /**
   * Set theme mode (light/dark/system)
   */
  async setThemeMode(mode: ThemeMode): Promise<void> {
    this.themeMode = mode;
    await AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);

    if (this.config) {
      this.activeTheme = this.resolveTheme(this.config);
    } else {
      this.activeTheme = mode === 'light' ? LIGHT_THEME : DEFAULT_THEME;
    }

    this.notifyListeners();
  }

  /**
   * Get current theme mode
   */
  getThemeMode(): ThemeMode {
    return this.themeMode;
  }

  /**
   * Get the currently active theme
   */
  getActiveTheme(): ResolvedTheme {
    return this.activeTheme;
  }

  /**
   * Get the current brand config
   */
  getConfig(): WhiteLabelConfig | null {
    return this.config;
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: string): boolean {
    if (!this.config?.features_enabled) {
      return true; // Default to enabled if no config
    }
    return this.config.features_enabled[feature] ?? true;
  }

  /**
   * Get loading state
   */
  isLoadingConfig(): boolean {
    return this.isLoading;
  }

  /**
   * Get error state
   */
  getError(): string | null {
    return this.error;
  }

  /**
   * Subscribe to theme changes
   */
  subscribe(listener: BrandingListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current theme
    listener(this.activeTheme);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of theme change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.activeTheme);
      } catch (error) {
        console.error('Error in branding listener:', error);
      }
    });
  }

  /**
   * Force reload configuration
   */
  async reload(): Promise<void> {
    await this.fetchBrandConfig();
  }

  /**
   * Clear cached configuration
   */
  async clearCache(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.BRAND_CONFIG),
      AsyncStorage.removeItem(STORAGE_KEYS.LAST_UPDATED),
    ]);
    this.config = null;
    this.activeTheme = DEFAULT_THEME;
    this.notifyListeners();
  }

  /**
   * Get full brand config for context provider
   */
  getBrandingContext(): BrandingContext {
    return {
      config: this.config,
      theme: this.activeTheme,
      isLoading: this.isLoading,
      error: this.error,
      reload: this.reload.bind(this),
    };
  }
}

// Export singleton instance
export const brandingLoader = new BrandingLoaderService();

// Export default theme for fallback
export { DEFAULT_THEME, LIGHT_THEME, DEFAULT_ORACLE_COLORS };

// React hook for using branding in components
import { useState, useEffect, useCallback } from 'react';

export function useBranding(): BrandingContext {
  const [context, setContext] = useState<BrandingContext>(brandingLoader.getBrandingContext());

  useEffect(() => {
    const unsubscribe = brandingLoader.subscribe((theme) => {
      setContext(brandingLoader.getBrandingContext());
    });

    return unsubscribe;
  }, []);

  const reload = useCallback(async () => {
    await brandingLoader.reload();
  }, []);

  return {
    ...context,
    reload,
  };
}

export function useTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(brandingLoader.getActiveTheme());

  useEffect(() => {
    const unsubscribe = brandingLoader.subscribe(setTheme);
    return unsubscribe;
  }, []);

  return theme;
}

export function useFeatureFlag(feature: string): boolean {
  const { config } = useBranding();
  return brandingLoader.isFeatureEnabled(feature);
}

export function useOODAColors(): typeof DEFAULT_ORACLE_COLORS {
  const theme = useTheme();
  return theme.colors.ooda;
}
