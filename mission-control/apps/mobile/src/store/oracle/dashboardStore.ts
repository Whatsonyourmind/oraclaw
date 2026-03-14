/**
 * ORACLE Dashboard Store - Dashboard Layout State Management
 * Story ux-5 - Personalized Dashboard Builder
 *
 * Manages:
 * - Widget library and configurations
 * - Drag-and-drop widget placement
 * - Grid layout system (2x3, 3x4 options)
 * - Multiple saved layouts
 * - Context-based auto-switching
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ContextMode } from './adaptiveStore';

// Widget types
export type WidgetType =
  | 'priority'
  | 'signals'
  | 'decisions'
  | 'schedule'
  | 'progress'
  | 'risks'
  | 'quick-actions'
  | 'metrics'
  | 'radar'
  | 'timeline';

// Grid layout options
export type GridLayout = '2x3' | '3x4' | '2x4' | '3x3';

// Widget definition
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  position: { row: number; col: number };
  size: { rows: number; cols: number };
  config: WidgetConfig;
  visible: boolean;
  locked: boolean;
}

// Widget configuration
export interface WidgetConfig {
  title?: string;
  refreshInterval?: number;
  showHeader?: boolean;
  maxItems?: number;
  filters?: Record<string, unknown>;
  theme?: 'light' | 'dark' | 'transparent';
  customStyles?: Record<string, unknown>;
}

// Widget library entry
export interface WidgetLibraryEntry {
  type: WidgetType;
  name: string;
  description: string;
  icon: string;
  defaultSize: { rows: number; cols: number };
  minSize: { rows: number; cols: number };
  maxSize: { rows: number; cols: number };
  defaultConfig: WidgetConfig;
  category: 'core' | 'analytics' | 'actions' | 'planning';
}

// Saved layout
export interface SavedLayout {
  id: string;
  name: string;
  description?: string;
  gridLayout: GridLayout;
  widgets: DashboardWidget[];
  createdAt: number;
  updatedAt: number;
  isDefault: boolean;
  contextBinding?: ContextMode;
}

// Dashboard State
export interface DashboardState {
  // Current state
  activeLayoutId: string;
  gridLayout: GridLayout;
  widgets: DashboardWidget[];
  editMode: boolean;
  selectedWidgetId: string | null;

  // Saved layouts
  savedLayouts: SavedLayout[];

  // Context bindings
  contextBindings: Record<ContextMode, string | null>; // context -> layoutId

  // Drag state
  dragging: boolean;
  dragWidgetId: string | null;
  dragPosition: { row: number; col: number } | null;

  // Widget library
  widgetLibrary: WidgetLibraryEntry[];

  // Actions - Layout Management
  createLayout: (name: string, description?: string) => string;
  deleteLayout: (layoutId: string) => void;
  duplicateLayout: (layoutId: string) => string;
  renameLayout: (layoutId: string, name: string) => void;
  loadLayout: (layoutId: string) => void;
  saveCurrentLayout: () => void;
  setDefaultLayout: (layoutId: string) => void;

  // Actions - Grid
  setGridLayout: (layout: GridLayout) => void;

  // Actions - Widgets
  addWidget: (type: WidgetType, position?: { row: number; col: number }) => string;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, updates: Partial<DashboardWidget>) => void;
  updateWidgetConfig: (widgetId: string, config: Partial<WidgetConfig>) => void;
  moveWidget: (widgetId: string, newPosition: { row: number; col: number }) => void;
  resizeWidget: (widgetId: string, newSize: { rows: number; cols: number }) => void;
  toggleWidgetVisibility: (widgetId: string) => void;
  toggleWidgetLock: (widgetId: string) => void;
  reorderWidgets: (orderedIds: string[]) => void;

  // Actions - Edit Mode
  setEditMode: (enabled: boolean) => void;
  selectWidget: (widgetId: string | null) => void;

  // Actions - Drag & Drop
  startDrag: (widgetId: string) => void;
  updateDragPosition: (position: { row: number; col: number }) => void;
  endDrag: () => void;
  cancelDrag: () => void;

  // Actions - Context Binding
  bindLayoutToContext: (layoutId: string, context: ContextMode) => void;
  unbindLayoutFromContext: (context: ContextMode) => void;
  getLayoutForContext: (context: ContextMode) => string | null;
  applyContextLayout: (context: ContextMode) => void;

  // Utilities
  getAvailablePosition: () => { row: number; col: number };
  isPositionOccupied: (row: number, col: number, excludeWidgetId?: string) => boolean;
  getGridDimensions: () => { rows: number; cols: number };
  validateWidgetPlacement: (widgetId: string, position: { row: number; col: number }, size: { rows: number; cols: number }) => boolean;

  reset: () => void;
}

// Widget library definitions
const WIDGET_LIBRARY: WidgetLibraryEntry[] = [
  {
    type: 'priority',
    name: 'Priority List',
    description: 'Your top priority items',
    icon: 'flag',
    defaultSize: { rows: 1, cols: 2 },
    minSize: { rows: 1, cols: 1 },
    maxSize: { rows: 2, cols: 2 },
    defaultConfig: { maxItems: 5, showHeader: true },
    category: 'core',
  },
  {
    type: 'signals',
    name: 'Active Signals',
    description: 'Current signals requiring attention',
    icon: 'radio',
    defaultSize: { rows: 1, cols: 1 },
    minSize: { rows: 1, cols: 1 },
    maxSize: { rows: 2, cols: 2 },
    defaultConfig: { maxItems: 5, filters: { status: 'active' } },
    category: 'core',
  },
  {
    type: 'decisions',
    name: 'Pending Decisions',
    description: 'Decisions awaiting your input',
    icon: 'git-branch',
    defaultSize: { rows: 1, cols: 1 },
    minSize: { rows: 1, cols: 1 },
    maxSize: { rows: 2, cols: 2 },
    defaultConfig: { maxItems: 3, filters: { status: 'pending' } },
    category: 'core',
  },
  {
    type: 'schedule',
    name: 'Schedule',
    description: 'Your upcoming schedule',
    icon: 'calendar',
    defaultSize: { rows: 1, cols: 2 },
    minSize: { rows: 1, cols: 1 },
    maxSize: { rows: 2, cols: 2 },
    defaultConfig: { showHeader: true },
    category: 'planning',
  },
  {
    type: 'progress',
    name: 'Progress Tracker',
    description: 'Track your daily progress',
    icon: 'trending-up',
    defaultSize: { rows: 1, cols: 1 },
    minSize: { rows: 1, cols: 1 },
    maxSize: { rows: 2, cols: 2 },
    defaultConfig: {},
    category: 'analytics',
  },
  {
    type: 'risks',
    name: 'Risk Monitor',
    description: 'Active risks and warnings',
    icon: 'warning',
    defaultSize: { rows: 1, cols: 1 },
    minSize: { rows: 1, cols: 1 },
    maxSize: { rows: 2, cols: 2 },
    defaultConfig: { maxItems: 5 },
    category: 'analytics',
  },
  {
    type: 'quick-actions',
    name: 'Quick Actions',
    description: 'One-tap action buttons',
    icon: 'flash',
    defaultSize: { rows: 1, cols: 1 },
    minSize: { rows: 1, cols: 1 },
    maxSize: { rows: 2, cols: 2 },
    defaultConfig: {},
    category: 'actions',
  },
  {
    type: 'metrics',
    name: 'Key Metrics',
    description: 'Important metrics at a glance',
    icon: 'stats-chart',
    defaultSize: { rows: 1, cols: 2 },
    minSize: { rows: 1, cols: 1 },
    maxSize: { rows: 2, cols: 2 },
    defaultConfig: {},
    category: 'analytics',
  },
  {
    type: 'radar',
    name: 'RADAR View',
    description: 'Visual signal radar',
    icon: 'scan',
    defaultSize: { rows: 2, cols: 2 },
    minSize: { rows: 1, cols: 1 },
    maxSize: { rows: 3, cols: 3 },
    defaultConfig: {},
    category: 'core',
  },
  {
    type: 'timeline',
    name: 'Activity Timeline',
    description: 'Recent activity stream',
    icon: 'time',
    defaultSize: { rows: 2, cols: 1 },
    minSize: { rows: 1, cols: 1 },
    maxSize: { rows: 3, cols: 2 },
    defaultConfig: { maxItems: 10 },
    category: 'analytics',
  },
];

// Default widgets for initial layout
const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: 'widget-priority-1',
    type: 'priority',
    position: { row: 0, col: 0 },
    size: { rows: 1, cols: 2 },
    config: { maxItems: 5, showHeader: true },
    visible: true,
    locked: false,
  },
  {
    id: 'widget-signals-1',
    type: 'signals',
    position: { row: 1, col: 0 },
    size: { rows: 1, cols: 1 },
    config: { maxItems: 5 },
    visible: true,
    locked: false,
  },
  {
    id: 'widget-decisions-1',
    type: 'decisions',
    position: { row: 1, col: 1 },
    size: { rows: 1, cols: 1 },
    config: { maxItems: 3 },
    visible: true,
    locked: false,
  },
  {
    id: 'widget-schedule-1',
    type: 'schedule',
    position: { row: 2, col: 0 },
    size: { rows: 1, cols: 2 },
    config: { showHeader: true },
    visible: true,
    locked: false,
  },
];

// Default saved layouts
const DEFAULT_LAYOUTS: SavedLayout[] = [
  {
    id: 'layout-default',
    name: 'Default',
    description: 'Standard ORACLE dashboard',
    gridLayout: '2x3',
    widgets: DEFAULT_WIDGETS,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: true,
    contextBinding: undefined,
  },
  {
    id: 'layout-meeting',
    name: 'Meeting',
    description: 'Simplified view for meetings',
    gridLayout: '2x3',
    widgets: [
      {
        id: 'widget-qa-1',
        type: 'quick-actions',
        position: { row: 0, col: 0 },
        size: { rows: 2, cols: 2 },
        config: {},
        visible: true,
        locked: false,
      },
      {
        id: 'widget-schedule-2',
        type: 'schedule',
        position: { row: 2, col: 0 },
        size: { rows: 1, cols: 2 },
        config: {},
        visible: true,
        locked: false,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: false,
    contextBinding: 'meeting',
  },
  {
    id: 'layout-focus',
    name: 'Focus',
    description: 'Minimal distractions for deep work',
    gridLayout: '2x3',
    widgets: [
      {
        id: 'widget-priority-2',
        type: 'priority',
        position: { row: 0, col: 0 },
        size: { rows: 1, cols: 2 },
        config: { maxItems: 3 },
        visible: true,
        locked: false,
      },
      {
        id: 'widget-progress-1',
        type: 'progress',
        position: { row: 1, col: 0 },
        size: { rows: 2, cols: 2 },
        config: {},
        visible: true,
        locked: false,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDefault: false,
    contextBinding: 'deepwork',
  },
];

// Initial state
const initialState = {
  activeLayoutId: 'layout-default',
  gridLayout: '2x3' as GridLayout,
  widgets: DEFAULT_WIDGETS,
  editMode: false,
  selectedWidgetId: null,

  savedLayouts: DEFAULT_LAYOUTS,

  contextBindings: {
    meeting: 'layout-meeting',
    deepwork: 'layout-focus',
    planning: null,
    commute: null,
    default: 'layout-default',
  } as Record<ContextMode, string | null>,

  dragging: false,
  dragWidgetId: null,
  dragPosition: null,

  widgetLibrary: WIDGET_LIBRARY,
};

/**
 * Dashboard Store
 * Manages widget layouts and dashboard customization
 */
export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Layout Management
      /**
       * Create a new layout
       * Time Complexity: O(n) where n = current widgets
       */
      createLayout: (name, description) => {
        const id = `layout-${Date.now()}`;
        const newLayout: SavedLayout = {
          id,
          name,
          description,
          gridLayout: get().gridLayout,
          widgets: [...get().widgets],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isDefault: false,
        };

        set((state) => ({
          savedLayouts: [...state.savedLayouts, newLayout],
          activeLayoutId: id,
        }));

        return id;
      },

      /**
       * Delete a layout
       */
      deleteLayout: (layoutId) => {
        const layout = get().savedLayouts.find((l) => l.id === layoutId);
        if (layout?.isDefault) return; // Can't delete default

        set((state) => ({
          savedLayouts: state.savedLayouts.filter((l) => l.id !== layoutId),
          activeLayoutId:
            state.activeLayoutId === layoutId
              ? state.savedLayouts.find((l) => l.isDefault)?.id || 'layout-default'
              : state.activeLayoutId,
        }));
      },

      /**
       * Duplicate a layout
       */
      duplicateLayout: (layoutId) => {
        const layout = get().savedLayouts.find((l) => l.id === layoutId);
        if (!layout) return layoutId;

        const id = `layout-${Date.now()}`;
        const newLayout: SavedLayout = {
          ...layout,
          id,
          name: `${layout.name} (Copy)`,
          isDefault: false,
          contextBinding: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          widgets: layout.widgets.map((w) => ({
            ...w,
            id: `widget-${w.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          })),
        };

        set((state) => ({
          savedLayouts: [...state.savedLayouts, newLayout],
        }));

        return id;
      },

      /**
       * Rename a layout
       */
      renameLayout: (layoutId, name) => {
        set((state) => ({
          savedLayouts: state.savedLayouts.map((l) =>
            l.id === layoutId ? { ...l, name, updatedAt: Date.now() } : l
          ),
        }));
      },

      /**
       * Load a layout
       */
      loadLayout: (layoutId) => {
        const layout = get().savedLayouts.find((l) => l.id === layoutId);
        if (!layout) return;

        set({
          activeLayoutId: layoutId,
          gridLayout: layout.gridLayout,
          widgets: layout.widgets.map((w) => ({ ...w })),
          editMode: false,
          selectedWidgetId: null,
        });
      },

      /**
       * Save current state to active layout
       */
      saveCurrentLayout: () => {
        set((state) => ({
          savedLayouts: state.savedLayouts.map((l) =>
            l.id === state.activeLayoutId
              ? {
                  ...l,
                  gridLayout: state.gridLayout,
                  widgets: state.widgets.map((w) => ({ ...w })),
                  updatedAt: Date.now(),
                }
              : l
          ),
        }));
      },

      /**
       * Set default layout
       */
      setDefaultLayout: (layoutId) => {
        set((state) => ({
          savedLayouts: state.savedLayouts.map((l) => ({
            ...l,
            isDefault: l.id === layoutId,
          })),
        }));
      },

      // Grid
      setGridLayout: (layout) => set({ gridLayout: layout }),

      // Widgets
      /**
       * Add a new widget
       * Time Complexity: O(n) for finding available position
       */
      addWidget: (type, position) => {
        const library = get().widgetLibrary.find((w) => w.type === type);
        if (!library) return '';

        const id = `widget-${type}-${Date.now()}`;
        const pos = position || get().getAvailablePosition();

        const newWidget: DashboardWidget = {
          id,
          type,
          position: pos,
          size: library.defaultSize,
          config: { ...library.defaultConfig },
          visible: true,
          locked: false,
        };

        set((state) => ({
          widgets: [...state.widgets, newWidget],
        }));

        return id;
      },

      /**
       * Remove a widget
       */
      removeWidget: (widgetId) => {
        set((state) => ({
          widgets: state.widgets.filter((w) => w.id !== widgetId),
          selectedWidgetId:
            state.selectedWidgetId === widgetId ? null : state.selectedWidgetId,
        }));
      },

      /**
       * Update widget properties
       */
      updateWidget: (widgetId, updates) => {
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === widgetId ? { ...w, ...updates } : w
          ),
        }));
      },

      /**
       * Update widget configuration
       */
      updateWidgetConfig: (widgetId, config) => {
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === widgetId ? { ...w, config: { ...w.config, ...config } } : w
          ),
        }));
      },

      /**
       * Move widget to new position
       */
      moveWidget: (widgetId, newPosition) => {
        const widget = get().widgets.find((w) => w.id === widgetId);
        if (!widget || widget.locked) return;

        if (get().validateWidgetPlacement(widgetId, newPosition, widget.size)) {
          set((state) => ({
            widgets: state.widgets.map((w) =>
              w.id === widgetId ? { ...w, position: newPosition } : w
            ),
          }));
        }
      },

      /**
       * Resize widget
       */
      resizeWidget: (widgetId, newSize) => {
        const widget = get().widgets.find((w) => w.id === widgetId);
        if (!widget || widget.locked) return;

        const library = get().widgetLibrary.find((l) => l.type === widget.type);
        if (!library) return;

        // Clamp to min/max size
        const clampedSize = {
          rows: Math.min(Math.max(newSize.rows, library.minSize.rows), library.maxSize.rows),
          cols: Math.min(Math.max(newSize.cols, library.minSize.cols), library.maxSize.cols),
        };

        if (get().validateWidgetPlacement(widgetId, widget.position, clampedSize)) {
          set((state) => ({
            widgets: state.widgets.map((w) =>
              w.id === widgetId ? { ...w, size: clampedSize } : w
            ),
          }));
        }
      },

      /**
       * Toggle widget visibility
       */
      toggleWidgetVisibility: (widgetId) => {
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === widgetId ? { ...w, visible: !w.visible } : w
          ),
        }));
      },

      /**
       * Toggle widget lock
       */
      toggleWidgetLock: (widgetId) => {
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === widgetId ? { ...w, locked: !w.locked } : w
          ),
        }));
      },

      /**
       * Reorder widgets (for drag list)
       */
      reorderWidgets: (orderedIds) => {
        const widgetMap = new Map(get().widgets.map((w) => [w.id, w]));
        const reordered = orderedIds
          .map((id) => widgetMap.get(id))
          .filter((w): w is DashboardWidget => w !== undefined);

        set({ widgets: reordered });
      },

      // Edit Mode
      setEditMode: (enabled) => set({ editMode: enabled }),
      selectWidget: (widgetId) => set({ selectedWidgetId: widgetId }),

      // Drag & Drop
      startDrag: (widgetId) => {
        const widget = get().widgets.find((w) => w.id === widgetId);
        if (!widget || widget.locked) return;

        set({
          dragging: true,
          dragWidgetId: widgetId,
          dragPosition: widget.position,
        });
      },

      updateDragPosition: (position) => {
        set({ dragPosition: position });
      },

      endDrag: () => {
        const { dragWidgetId, dragPosition } = get();
        if (dragWidgetId && dragPosition) {
          get().moveWidget(dragWidgetId, dragPosition);
        }
        set({
          dragging: false,
          dragWidgetId: null,
          dragPosition: null,
        });
      },

      cancelDrag: () => {
        set({
          dragging: false,
          dragWidgetId: null,
          dragPosition: null,
        });
      },

      // Context Binding
      bindLayoutToContext: (layoutId, context) => {
        set((state) => ({
          contextBindings: { ...state.contextBindings, [context]: layoutId },
          savedLayouts: state.savedLayouts.map((l) =>
            l.id === layoutId
              ? { ...l, contextBinding: context }
              : l.contextBinding === context
              ? { ...l, contextBinding: undefined }
              : l
          ),
        }));
      },

      unbindLayoutFromContext: (context) => {
        set((state) => ({
          contextBindings: { ...state.contextBindings, [context]: null },
          savedLayouts: state.savedLayouts.map((l) =>
            l.contextBinding === context ? { ...l, contextBinding: undefined } : l
          ),
        }));
      },

      getLayoutForContext: (context) => {
        return get().contextBindings[context] || null;
      },

      applyContextLayout: (context) => {
        const layoutId = get().contextBindings[context];
        if (layoutId) {
          get().loadLayout(layoutId);
        }
      },

      // Utilities
      /**
       * Find next available position for a new widget
       * Time Complexity: O(rows * cols * n) where n = widgets
       */
      getAvailablePosition: () => {
        const { rows, cols } = get().getGridDimensions();

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            if (!get().isPositionOccupied(row, col)) {
              return { row, col };
            }
          }
        }

        // No space available, return 0,0 (will overlap)
        return { row: 0, col: 0 };
      },

      /**
       * Check if a position is occupied by any widget
       * Time Complexity: O(n) where n = widgets
       */
      isPositionOccupied: (row, col, excludeWidgetId) => {
        return get().widgets.some((w) => {
          if (w.id === excludeWidgetId) return false;
          if (!w.visible) return false;

          const endRow = w.position.row + w.size.rows - 1;
          const endCol = w.position.col + w.size.cols - 1;

          return (
            row >= w.position.row &&
            row <= endRow &&
            col >= w.position.col &&
            col <= endCol
          );
        });
      },

      /**
       * Get grid dimensions based on layout
       */
      getGridDimensions: () => {
        const layout = get().gridLayout;
        const [cols, rows] = layout.split('x').map(Number);
        return { rows, cols };
      },

      /**
       * Validate widget placement
       * Time Complexity: O(n) where n = widgets
       */
      validateWidgetPlacement: (widgetId, position, size) => {
        const { rows, cols } = get().getGridDimensions();

        // Check bounds
        if (
          position.row < 0 ||
          position.col < 0 ||
          position.row + size.rows > rows ||
          position.col + size.cols > cols
        ) {
          return false;
        }

        // Check overlap with other widgets
        for (let r = position.row; r < position.row + size.rows; r++) {
          for (let c = position.col; c < position.col + size.cols; c++) {
            if (get().isPositionOccupied(r, c, widgetId)) {
              return false;
            }
          }
        }

        return true;
      },

      reset: () => set(initialState),
    }),
    {
      name: 'oracle-dashboard-storage',
      partialize: (state) => ({
        activeLayoutId: state.activeLayoutId,
        savedLayouts: state.savedLayouts,
        contextBindings: state.contextBindings,
      }),
    }
  )
);

// Selectors
export const useDashboardSelectors = {
  visibleWidgets: () =>
    useDashboardStore((state) => state.widgets.filter((w) => w.visible)),

  activeLayout: () =>
    useDashboardStore((state) =>
      state.savedLayouts.find((l) => l.id === state.activeLayoutId)
    ),

  layoutNames: () =>
    useDashboardStore((state) => state.savedLayouts.map((l) => l.name)),

  widgetsByCategory: () =>
    useDashboardStore((state) => {
      const categories: Record<string, WidgetLibraryEntry[]> = {
        core: [],
        analytics: [],
        actions: [],
        planning: [],
      };
      state.widgetLibrary.forEach((w) => {
        categories[w.category].push(w);
      });
      return categories;
    }),

  gridInfo: () =>
    useDashboardStore((state) => ({
      layout: state.gridLayout,
      ...state.getGridDimensions(),
    })),

  selectedWidget: () =>
    useDashboardStore((state) =>
      state.selectedWidgetId
        ? state.widgets.find((w) => w.id === state.selectedWidgetId)
        : null
    ),

  canAddWidget: () =>
    useDashboardStore((state) => {
      const { rows, cols } = state.getGridDimensions();
      const totalCells = rows * cols;
      const usedCells = state.widgets
        .filter((w) => w.visible)
        .reduce((sum, w) => sum + w.size.rows * w.size.cols, 0);
      return usedCells < totalCells;
    }),
};

export default useDashboardStore;
