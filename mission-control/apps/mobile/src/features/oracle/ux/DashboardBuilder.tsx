/**
 * DashboardBuilder Component
 * Story ux-5 - Custom Dashboard Builder
 *
 * Features:
 * - Drag-and-drop widget placement
 * - Widget library (charts, metrics, lists, calendars)
 * - Grid-based layout system
 * - Widget configuration panels
 * - Save/load custom layouts
 * - Preset templates
 * - Responsive breakpoints
 * - Real-time data binding
 *
 * Time Complexity: O(n) for grid calculations, O(n log n) for widget sorting
 * Space Complexity: O(n) where n = number of widgets
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  Layout,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useUXStore,
  useUXSelectors,
  DashboardWidget,
  WidgetType,
} from '../../../store/oracle/uxStore';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_COLUMNS = 2;
const GRID_GAP = 12;
const GRID_PADDING = 16;
const CELL_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
const CELL_HEIGHT = 120;

// Responsive breakpoints
export type Breakpoint = 'compact' | 'regular' | 'expanded';

export const getBreakpoint = (width: number): Breakpoint => {
  if (width < 375) return 'compact';
  if (width < 768) return 'regular';
  return 'expanded';
};

export const getGridColumns = (breakpoint: Breakpoint): number => {
  switch (breakpoint) {
    case 'compact': return 1;
    case 'regular': return 2;
    case 'expanded': return 3;
  }
};

// Widget type definitions
export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
  configOptions: WidgetConfigOption[];
  dataBindings?: DataBinding[];
}

export interface WidgetConfigOption {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'toggle' | 'color';
  defaultValue: unknown;
  options?: Array<{ label: string; value: unknown }>;
}

// Real-time data binding
export interface DataBinding {
  key: string;
  source: 'signals' | 'decisions' | 'calendar' | 'metrics' | 'custom';
  query?: string;
  refreshInterval?: number; // ms
  transform?: (data: unknown) => unknown;
}

// Layout template definition
export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  widgets: Partial<DashboardWidget>[];
  category: 'productivity' | 'analytics' | 'minimal' | 'custom';
  previewColor: string;
}

// Widget library
const WIDGET_LIBRARY: WidgetDefinition[] = [
  {
    type: 'priority',
    name: 'Priorities',
    description: 'Top priority items requiring attention',
    icon: 'flag',
    color: ORACLE_COLORS.decide,
    defaultSize: { width: 2, height: 1 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 2, height: 2 },
    configOptions: [
      { key: 'showCount', label: 'Items to show', type: 'number', defaultValue: 5 },
      { key: 'showUrgency', label: 'Show urgency', type: 'toggle', defaultValue: true },
      { key: 'sortBy', label: 'Sort by', type: 'select', defaultValue: 'urgency',
        options: [{ label: 'Urgency', value: 'urgency' }, { label: 'Date', value: 'date' }, { label: 'Name', value: 'name' }] },
    ],
    dataBindings: [
      { key: 'items', source: 'signals', query: 'priority > 0.7', refreshInterval: 30000 },
    ],
  },
  {
    type: 'signals',
    name: 'Signals',
    description: 'Active signals from connected sources',
    icon: 'radio',
    color: ORACLE_COLORS.observe,
    defaultSize: { width: 1, height: 1 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 2, height: 2 },
    configOptions: [
      {
        key: 'filter',
        label: 'Filter',
        type: 'select',
        defaultValue: 'active',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'All', value: 'all' },
          { label: 'Critical', value: 'critical' },
        ],
      },
      { key: 'showSource', label: 'Show source', type: 'toggle', defaultValue: true },
    ],
    dataBindings: [
      { key: 'signals', source: 'signals', refreshInterval: 10000 },
    ],
  },
  {
    type: 'decisions',
    name: 'Decisions',
    description: 'Pending decisions awaiting your input',
    icon: 'git-branch',
    color: ORACLE_COLORS.orient,
    defaultSize: { width: 1, height: 1 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 2, height: 2 },
    configOptions: [
      { key: 'showPending', label: 'Show pending only', type: 'toggle', defaultValue: true },
      { key: 'showDeadline', label: 'Show deadlines', type: 'toggle', defaultValue: true },
    ],
    dataBindings: [
      { key: 'decisions', source: 'decisions', query: 'status = pending', refreshInterval: 15000 },
    ],
  },
  {
    type: 'schedule',
    name: 'Schedule',
    description: 'Calendar and upcoming events',
    icon: 'calendar',
    color: '#9B59B6',
    defaultSize: { width: 2, height: 1 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 2, height: 3 },
    configOptions: [
      {
        key: 'view',
        label: 'View',
        type: 'select',
        defaultValue: 'today',
        options: [
          { label: 'Today', value: 'today' },
          { label: 'Week', value: 'week' },
          { label: 'Month', value: 'month' },
        ],
      },
      { key: 'showTime', label: 'Show times', type: 'toggle', defaultValue: true },
      { key: 'showLocation', label: 'Show location', type: 'toggle', defaultValue: false },
    ],
    dataBindings: [
      { key: 'events', source: 'calendar', refreshInterval: 60000 },
    ],
  },
  {
    type: 'risks',
    name: 'Risks',
    description: 'Current risk factors and alerts',
    icon: 'warning',
    color: '#FF4444',
    defaultSize: { width: 2, height: 1 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 2, height: 2 },
    configOptions: [
      { key: 'showMitigations', label: 'Show mitigations', type: 'toggle', defaultValue: true },
      { key: 'minSeverity', label: 'Minimum severity', type: 'select', defaultValue: 'medium',
        options: [{ label: 'Low', value: 'low' }, { label: 'Medium', value: 'medium' }, { label: 'High', value: 'high' }] },
    ],
    dataBindings: [
      { key: 'risks', source: 'signals', query: 'type = risk', refreshInterval: 30000 },
    ],
  },
  {
    type: 'progress',
    name: 'Progress',
    description: 'Track goals and milestones',
    icon: 'analytics',
    color: ORACLE_COLORS.act,
    defaultSize: { width: 2, height: 1 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 2, height: 2 },
    configOptions: [
      {
        key: 'period',
        label: 'Period',
        type: 'select',
        defaultValue: 'week',
        options: [
          { label: 'Today', value: 'today' },
          { label: 'Week', value: 'week' },
          { label: 'Month', value: 'month' },
          { label: 'Quarter', value: 'quarter' },
        ],
      },
      { key: 'showTarget', label: 'Show target', type: 'toggle', defaultValue: true },
    ],
    dataBindings: [
      { key: 'progress', source: 'metrics', query: 'type = goal', refreshInterval: 60000 },
    ],
  },
  {
    type: 'quick-actions',
    name: 'Quick Actions',
    description: 'One-tap action buttons',
    icon: 'flash',
    color: ORACLE_COLORS.observe,
    defaultSize: { width: 2, height: 2 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 2, height: 2 },
    configOptions: [
      { key: 'columns', label: 'Columns', type: 'number', defaultValue: 2 },
      { key: 'showLabels', label: 'Show labels', type: 'toggle', defaultValue: true },
    ],
  },
  {
    type: 'metrics',
    name: 'Metrics',
    description: 'Key performance indicators',
    icon: 'speedometer',
    color: '#3498DB',
    defaultSize: { width: 2, height: 1 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 2, height: 2 },
    configOptions: [
      {
        key: 'layout',
        label: 'Layout',
        type: 'select',
        defaultValue: 'grid',
        options: [
          { label: 'Grid', value: 'grid' },
          { label: 'List', value: 'list' },
          { label: 'Cards', value: 'cards' },
        ],
      },
      { key: 'showTrend', label: 'Show trends', type: 'toggle', defaultValue: true },
      { key: 'showSparkline', label: 'Show sparklines', type: 'toggle', defaultValue: false },
    ],
    dataBindings: [
      { key: 'metrics', source: 'metrics', refreshInterval: 30000 },
    ],
  },
];

// Preset layout templates
const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Overview',
    description: 'High-level metrics and decisions',
    icon: 'briefcase',
    category: 'productivity',
    previewColor: ORACLE_COLORS.act,
    widgets: [
      { type: 'priority', position: { row: 0, col: 0 }, size: { width: 2, height: 1 }, config: { showCount: 3 } },
      { type: 'metrics', position: { row: 1, col: 0 }, size: { width: 1, height: 1 }, config: { layout: 'grid' } },
      { type: 'decisions', position: { row: 1, col: 1 }, size: { width: 1, height: 1 }, config: { showPending: true } },
      { type: 'schedule', position: { row: 2, col: 0 }, size: { width: 2, height: 1 }, config: { view: 'today' } },
    ],
  },
  {
    id: 'focus',
    name: 'Focus Mode',
    description: 'Minimal distractions, maximum productivity',
    icon: 'eye',
    category: 'minimal',
    previewColor: ORACLE_COLORS.orient,
    widgets: [
      { type: 'priority', position: { row: 0, col: 0 }, size: { width: 2, height: 1 }, config: { showCount: 3 } },
      { type: 'progress', position: { row: 1, col: 0 }, size: { width: 2, height: 1 }, config: { period: 'today' } },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics Dashboard',
    description: 'Data-driven insights and metrics',
    icon: 'bar-chart',
    category: 'analytics',
    previewColor: ORACLE_COLORS.observe,
    widgets: [
      { type: 'metrics', position: { row: 0, col: 0 }, size: { width: 2, height: 1 }, config: { showTrend: true } },
      { type: 'signals', position: { row: 1, col: 0 }, size: { width: 1, height: 1 }, config: { filter: 'all' } },
      { type: 'risks', position: { row: 1, col: 1 }, size: { width: 1, height: 1 }, config: { showMitigations: true } },
      { type: 'progress', position: { row: 2, col: 0 }, size: { width: 2, height: 1 }, config: { period: 'week' } },
    ],
  },
  {
    id: 'action',
    name: 'Action Center',
    description: 'Quick actions and immediate tasks',
    icon: 'flash',
    category: 'productivity',
    previewColor: ORACLE_COLORS.decide,
    widgets: [
      { type: 'quick-actions', position: { row: 0, col: 0 }, size: { width: 2, height: 2 }, config: { columns: 2 } },
      { type: 'schedule', position: { row: 2, col: 0 }, size: { width: 2, height: 1 }, config: { view: 'today' } },
    ],
  },
  {
    id: 'meeting',
    name: 'Meeting Mode',
    description: 'Optimized for during meetings',
    icon: 'people',
    category: 'productivity',
    previewColor: '#9B59B6',
    widgets: [
      { type: 'schedule', position: { row: 0, col: 0 }, size: { width: 2, height: 1 }, config: { view: 'today', showLocation: true } },
      { type: 'quick-actions', position: { row: 1, col: 0 }, size: { width: 2, height: 1 }, config: { columns: 4 } },
      { type: 'decisions', position: { row: 2, col: 0 }, size: { width: 2, height: 1 }, config: { showPending: true } },
    ],
  },
  {
    id: 'risk-monitor',
    name: 'Risk Monitor',
    description: 'Track and mitigate risks',
    icon: 'shield',
    category: 'analytics',
    previewColor: '#FF4444',
    widgets: [
      { type: 'risks', position: { row: 0, col: 0 }, size: { width: 2, height: 1 }, config: { showMitigations: true } },
      { type: 'signals', position: { row: 1, col: 0 }, size: { width: 1, height: 1 }, config: { filter: 'critical' } },
      { type: 'metrics', position: { row: 1, col: 1 }, size: { width: 1, height: 1 }, config: { showTrend: true } },
    ],
  },
];

interface DashboardBuilderProps {
  onLayoutChange?: (widgets: DashboardWidget[]) => void;
  onSave?: (name: string, widgets: DashboardWidget[]) => void;
  initialEditMode?: boolean;
}

/**
 * DashboardBuilder Component
 * Provides drag-and-drop dashboard customization
 */
export const DashboardBuilder: React.FC<DashboardBuilderProps> = ({
  onLayoutChange,
  onSave,
  initialEditMode = false,
}) => {
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<DashboardWidget | null>(null);
  const [layoutName, setLayoutName] = useState('');
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getBreakpoint(SCREEN_WIDTH));

  const {
    dashboardLayout,
    savedLayouts,
    activeLayoutName,
    editMode,
    setEditMode,
    addWidget,
    removeWidget,
    updateWidget,
    reorderWidgets,
    saveLayout,
    loadLayout,
    deleteLayout,
    hapticEnabled,
  } = useUXStore();

  const layoutNames = useUXSelectors.layoutNames();
  const visibleWidgets = useUXSelectors.visibleWidgets();

  // Calculate grid dimensions based on breakpoint
  const gridColumns = useMemo(() => getGridColumns(breakpoint), [breakpoint]);
  const cellWidth = useMemo(() => {
    const totalGap = GRID_GAP * (gridColumns - 1);
    return (SCREEN_WIDTH - GRID_PADDING * 2 - totalGap) / gridColumns;
  }, [gridColumns]);

  // Initialize edit mode
  useEffect(() => {
    if (initialEditMode) {
      setEditMode(true);
    }
  }, [initialEditMode, setEditMode]);

  // Handle dimension changes for responsive layout
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setBreakpoint(getBreakpoint(window.width));
    });
    return () => subscription.remove();
  }, []);

  // Notify layout changes
  useEffect(() => {
    onLayoutChange?.(dashboardLayout);
  }, [dashboardLayout, onLayoutChange]);

  // Trigger haptic feedback
  const triggerHaptic = useCallback(
    async (type: 'light' | 'medium' | 'heavy' | 'selection') => {
      if (!hapticEnabled) return;

      try {
        switch (type) {
          case 'light':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'medium':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'heavy':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case 'selection':
            await Haptics.selectionAsync();
            break;
        }
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    },
    [hapticEnabled]
  );

  // Add widget from library
  const handleAddWidget = useCallback((definition: WidgetDefinition) => {
    // Find next available position
    const occupiedPositions = new Set(
      dashboardLayout.map((w) => `${w.position.row}-${w.position.col}`)
    );

    let row = 0;
    let col = 0;
    while (occupiedPositions.has(`${row}-${col}`)) {
      col++;
      if (col >= gridColumns) {
        col = 0;
        row++;
      }
    }

    const newWidget: DashboardWidget = {
      id: `${definition.type}-${Date.now()}`,
      type: definition.type,
      position: { row, col },
      size: { ...definition.defaultSize },
      config: definition.configOptions.reduce((acc, opt) => {
        acc[opt.key] = opt.defaultValue;
        return acc;
      }, {} as Record<string, unknown>),
      visible: true,
    };

    addWidget(newWidget);
    setShowWidgetLibrary(false);
    triggerHaptic('medium');
  }, [dashboardLayout, gridColumns, addWidget, triggerHaptic]);

  // Apply template
  const handleApplyTemplate = useCallback((template: LayoutTemplate) => {
    const newWidgets: DashboardWidget[] = template.widgets.map((w, index) => ({
      id: `${w.type}-${Date.now()}-${index}`,
      type: w.type!,
      position: w.position || { row: 0, col: 0 },
      size: w.size || { width: 1, height: 1 },
      config: w.config || {},
      visible: true,
    }));

    reorderWidgets(newWidgets);
    setShowTemplates(false);
    triggerHaptic('medium');
  }, [reorderWidgets, triggerHaptic]);

  // Save current layout
  const handleSaveLayout = useCallback(() => {
    if (!layoutName.trim()) {
      Alert.alert('Error', 'Please enter a layout name');
      return;
    }

    saveLayout(layoutName.trim());
    onSave?.(layoutName.trim(), dashboardLayout);
    setShowSaveModal(false);
    setLayoutName('');
    triggerHaptic('medium');
  }, [layoutName, saveLayout, dashboardLayout, onSave, triggerHaptic]);

  // Delete a widget
  const handleDeleteWidget = useCallback((widgetId: string) => {
    Alert.alert(
      'Delete Widget',
      'Are you sure you want to remove this widget?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeWidget(widgetId);
            triggerHaptic('medium');
          },
        },
      ]
    );
  }, [removeWidget, triggerHaptic]);

  // Open widget configuration
  const handleConfigureWidget = useCallback((widget: DashboardWidget) => {
    setSelectedWidget(widget);
    setShowConfigPanel(true);
    triggerHaptic('light');
  }, [triggerHaptic]);

  // Update widget configuration
  const handleUpdateConfig = useCallback((key: string, value: unknown) => {
    if (!selectedWidget) return;

    updateWidget(selectedWidget.id, {
      config: { ...selectedWidget.config, [key]: value },
    });

    setSelectedWidget((prev) =>
      prev ? { ...prev, config: { ...prev.config, [key]: value } } : null
    );
  }, [selectedWidget, updateWidget]);

  // Resize widget
  const handleResizeWidget = useCallback((widgetId: string, newSize: { width: number; height: number }) => {
    updateWidget(widgetId, { size: newSize });
    triggerHaptic('light');
  }, [updateWidget, triggerHaptic]);

  // Render widget library
  const renderWidgetLibrary = () => (
    <Modal
      visible={showWidgetLibrary}
      animationType="slide"
      transparent
      onRequestClose={() => setShowWidgetLibrary(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Widget Library</Text>
            <TouchableOpacity onPress={() => setShowWidgetLibrary(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {WIDGET_LIBRARY.map((definition) => (
              <TouchableOpacity
                key={definition.type}
                style={styles.libraryItem}
                onPress={() => handleAddWidget(definition)}
              >
                <View style={[styles.libraryIcon, { backgroundColor: definition.color }]}>
                  <Ionicons name={definition.icon} size={24} color="#000000" />
                </View>
                <View style={styles.libraryContent}>
                  <Text style={styles.libraryName}>{definition.name}</Text>
                  <Text style={styles.libraryDescription}>{definition.description}</Text>
                  <View style={styles.libraryMeta}>
                    <View style={styles.librarySize}>
                      <Ionicons name="resize-outline" size={12} color="#666666" />
                      <Text style={styles.librarySizeText}>
                        {definition.defaultSize.width}x{definition.defaultSize.height}
                      </Text>
                    </View>
                    {definition.dataBindings && definition.dataBindings.length > 0 && (
                      <View style={styles.libraryDataBadge}>
                        <Ionicons name="pulse" size={10} color={ORACLE_COLORS.act} />
                        <Text style={styles.libraryDataText}>Live</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name="add-circle" size={24} color={ORACLE_COLORS.act} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Render templates modal
  const renderTemplatesModal = () => (
    <Modal
      visible={showTemplates}
      animationType="slide"
      transparent
      onRequestClose={() => setShowTemplates(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Layout Templates</Text>
            <TouchableOpacity onPress={() => setShowTemplates(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Category filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
              {['all', 'productivity', 'analytics', 'minimal'].map((cat) => (
                <TouchableOpacity key={cat} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {LAYOUT_TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateItem}
                onPress={() => handleApplyTemplate(template)}
              >
                <View style={[styles.templateIcon, { backgroundColor: template.previewColor }]}>
                  <Ionicons name={template.icon} size={24} color="#000000" />
                </View>
                <View style={styles.templateContent}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateDescription}>{template.description}</Text>
                  <View style={styles.templateMeta}>
                    <View style={[styles.templateBadge, { backgroundColor: getCategoryColor(template.category) }]}>
                      <Text style={styles.templateBadgeText}>{template.category}</Text>
                    </View>
                    <Text style={styles.templateWidgetCount}>
                      {template.widgets.length} widgets
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666666" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Render save modal
  const renderSaveModal = () => (
    <Modal
      visible={showSaveModal}
      animationType="fade"
      transparent
      onRequestClose={() => setShowSaveModal(false)}
    >
      <View style={styles.saveModalOverlay}>
        <View style={styles.saveModalContent}>
          <Text style={styles.saveModalTitle}>Save Layout</Text>
          <TextInput
            style={styles.saveInput}
            placeholder="Layout name"
            placeholderTextColor="#666666"
            value={layoutName}
            onChangeText={setLayoutName}
            autoFocus
          />
          <View style={styles.saveModalActions}>
            <TouchableOpacity
              style={styles.saveModalCancel}
              onPress={() => setShowSaveModal(false)}
            >
              <Text style={styles.saveModalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveModalConfirm}
              onPress={handleSaveLayout}
            >
              <Text style={styles.saveModalConfirmText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Render config panel
  const renderConfigPanel = () => {
    if (!selectedWidget) return null;

    const definition = WIDGET_LIBRARY.find((w) => w.type === selectedWidget.type);
    if (!definition) return null;

    return (
      <Modal
        visible={showConfigPanel}
        animationType="slide"
        transparent
        onRequestClose={() => setShowConfigPanel(false)}
      >
        <View style={styles.configPanelOverlay}>
          <Animated.View
            entering={SlideInRight}
            exiting={SlideOutRight}
            style={styles.configPanel}
          >
            <View style={styles.configPanelHeader}>
              <View style={styles.configPanelTitleRow}>
                <View style={[styles.configPanelIcon, { backgroundColor: definition.color }]}>
                  <Ionicons name={definition.icon} size={16} color="#000000" />
                </View>
                <Text style={styles.configPanelTitle}>{definition.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowConfigPanel(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Size controls */}
              <View style={styles.configSection}>
                <Text style={styles.configSectionTitle}>SIZE</Text>
                <View style={styles.sizeControls}>
                  {[
                    { width: 1, height: 1 },
                    { width: 2, height: 1 },
                    { width: 1, height: 2 },
                    { width: 2, height: 2 },
                  ].filter(size =>
                    size.width >= definition.minSize.width &&
                    size.height >= definition.minSize.height &&
                    size.width <= definition.maxSize.width &&
                    size.height <= definition.maxSize.height
                  ).map((size, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.sizeButton,
                        selectedWidget.size.width === size.width &&
                        selectedWidget.size.height === size.height && styles.sizeButtonActive,
                      ]}
                      onPress={() => handleResizeWidget(selectedWidget.id, size)}
                    >
                      <Text style={styles.sizeButtonText}>{size.width}x{size.height}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Data binding info */}
              {definition.dataBindings && definition.dataBindings.length > 0 && (
                <View style={styles.configSection}>
                  <Text style={styles.configSectionTitle}>DATA SOURCES</Text>
                  {definition.dataBindings.map((binding, i) => (
                    <View key={i} style={styles.dataBindingItem}>
                      <Ionicons name="pulse" size={16} color={ORACLE_COLORS.act} />
                      <Text style={styles.dataBindingText}>
                        {binding.source} - refreshes every {(binding.refreshInterval || 30000) / 1000}s
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Config options */}
              <View style={styles.configSection}>
                <Text style={styles.configSectionTitle}>SETTINGS</Text>
                {definition.configOptions.map((option) => (
                  <View key={option.key} style={styles.configOption}>
                    <Text style={styles.configOptionLabel}>{option.label}</Text>
                    {option.type === 'toggle' && (
                      <TouchableOpacity
                        style={[
                          styles.toggleButton,
                          selectedWidget.config[option.key] && styles.toggleButtonActive,
                        ]}
                        onPress={() => handleUpdateConfig(option.key, !selectedWidget.config[option.key])}
                      >
                        <Animated.View style={[
                          styles.toggleKnob,
                          selectedWidget.config[option.key] && styles.toggleKnobActive,
                        ]} />
                      </TouchableOpacity>
                    )}
                    {option.type === 'select' && option.options && (
                      <View style={styles.selectContainer}>
                        {option.options.map((opt) => (
                          <TouchableOpacity
                            key={String(opt.value)}
                            style={[
                              styles.selectOption,
                              selectedWidget.config[option.key] === opt.value && styles.selectOptionActive,
                            ]}
                            onPress={() => handleUpdateConfig(option.key, opt.value)}
                          >
                            <Text style={[
                              styles.selectOptionText,
                              selectedWidget.config[option.key] === opt.value && styles.selectOptionTextActive,
                            ]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {option.type === 'number' && (
                      <View style={styles.numberContainer}>
                        <TouchableOpacity
                          style={styles.numberButton}
                          onPress={() => handleUpdateConfig(
                            option.key,
                            Math.max(1, (selectedWidget.config[option.key] as number) - 1)
                          )}
                        >
                          <Ionicons name="remove" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.numberValue}>
                          {selectedWidget.config[option.key] as number}
                        </Text>
                        <TouchableOpacity
                          style={styles.numberButton}
                          onPress={() => handleUpdateConfig(
                            option.key,
                            (selectedWidget.config[option.key] as number) + 1
                          )}
                        >
                          <Ionicons name="add" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* Delete widget button */}
              <TouchableOpacity
                style={styles.deleteWidgetButton}
                onPress={() => {
                  setShowConfigPanel(false);
                  handleDeleteWidget(selectedWidget.id);
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#FF4444" />
                <Text style={styles.deleteWidgetText}>Remove Widget</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // Render saved layouts
  const renderSavedLayouts = () => (
    <View style={styles.savedLayoutsSection}>
      <Text style={styles.sectionTitle}>SAVED LAYOUTS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {layoutNames.map((name) => (
          <TouchableOpacity
            key={name}
            style={[
              styles.savedLayoutChip,
              activeLayoutName === name && styles.savedLayoutChipActive,
            ]}
            onPress={() => loadLayout(name)}
            onLongPress={() => {
              if (name !== 'Default') {
                Alert.alert(
                  'Delete Layout',
                  `Delete "${name}" layout?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteLayout(name) },
                  ]
                );
              }
            }}
          >
            <Text style={[
              styles.savedLayoutChipText,
              activeLayoutName === name && styles.savedLayoutChipTextActive,
            ]}>
              {name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Edit mode toggle and actions */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          {editMode && (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <View style={styles.editBadge}>
                <Text style={styles.editBadgeText}>EDITING</Text>
              </View>
            </Animated.View>
          )}
        </View>
        <View style={styles.headerActions}>
          {editMode && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.editActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowTemplates(true)}
              >
                <Ionicons name="copy-outline" size={20} color="#888888" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowWidgetLibrary(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color={ORACLE_COLORS.act} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowSaveModal(true)}
              >
                <Ionicons name="save-outline" size={20} color="#888888" />
              </TouchableOpacity>
            </Animated.View>
          )}
          <TouchableOpacity
            style={[styles.editToggle, editMode && styles.editToggleActive]}
            onPress={() => {
              setEditMode(!editMode);
              triggerHaptic('medium');
            }}
          >
            <Ionicons
              name={editMode ? 'checkmark' : 'create-outline'}
              size={20}
              color={editMode ? '#000000' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Breakpoint indicator */}
      {editMode && (
        <View style={styles.breakpointIndicator}>
          <Ionicons name="phone-portrait-outline" size={14} color="#666666" />
          <Text style={styles.breakpointText}>{breakpoint} ({gridColumns} cols)</Text>
        </View>
      )}

      {/* Saved layouts */}
      {editMode && renderSavedLayouts()}

      {/* Widget Grid */}
      <ScrollView
        style={styles.gridContainer}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
      >
        {visibleWidgets.map((widget, index) => (
          <DraggableWidget
            key={widget.id}
            widget={widget}
            definition={WIDGET_LIBRARY.find((w) => w.type === widget.type)!}
            editMode={editMode}
            cellWidth={cellWidth}
            cellHeight={CELL_HEIGHT}
            gridGap={GRID_GAP}
            onConfigure={() => handleConfigureWidget(widget)}
            onDelete={() => handleDeleteWidget(widget.id)}
            onDragStart={() => {
              setDraggedWidget(widget.id);
              triggerHaptic('medium');
            }}
            onDragEnd={(newPosition) => {
              setDraggedWidget(null);
              updateWidget(widget.id, { position: newPosition });
            }}
            isDragging={draggedWidget === widget.id}
            index={index}
          />
        ))}

        {/* Add widget placeholder in edit mode */}
        {editMode && (
          <TouchableOpacity
            style={[styles.addWidgetPlaceholder, { width: cellWidth * 2 + GRID_GAP }]}
            onPress={() => setShowWidgetLibrary(true)}
          >
            <Ionicons name="add" size={32} color="#666666" />
            <Text style={styles.addWidgetText}>Add Widget</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modals */}
      {renderWidgetLibrary()}
      {renderTemplatesModal()}
      {renderSaveModal()}
      {renderConfigPanel()}
    </GestureHandlerRootView>
  );
};

/**
 * DraggableWidget - Individual widget with drag-and-drop
 */
interface DraggableWidgetProps {
  widget: DashboardWidget;
  definition: WidgetDefinition;
  editMode: boolean;
  cellWidth: number;
  cellHeight: number;
  gridGap: number;
  onConfigure: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: (position: { row: number; col: number }) => void;
  isDragging: boolean;
  index: number;
}

const DraggableWidget: React.FC<DraggableWidgetProps> = ({
  widget,
  definition,
  editMode,
  cellWidth,
  cellHeight,
  gridGap,
  onConfigure,
  onDelete,
  onDragStart,
  onDragEnd,
  isDragging,
  index,
}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);

  const widgetWidth = widget.size.width * cellWidth + (widget.size.width - 1) * gridGap;
  const widgetHeight = widget.size.height * cellHeight + (widget.size.height - 1) * gridGap;

  // Long press + pan gesture for dragging
  const panGesture = Gesture.Pan()
    .enabled(editMode)
    .activateAfterLongPress(300)
    .onStart(() => {
      scale.value = withSpring(1.05);
      zIndex.value = 100;
      runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd(() => {
      // Calculate new grid position
      const newCol = Math.round(translateX.value / (cellWidth + gridGap));
      const newRow = Math.round(translateY.value / (cellHeight + gridGap));

      const finalCol = Math.max(0, Math.min(GRID_COLUMNS - widget.size.width, widget.position.col + newCol));
      const finalRow = Math.max(0, widget.position.row + newRow);

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;

      runOnJS(onDragEnd)({ row: finalRow, col: finalCol });
    });

  // Tap gesture for configuration
  const tapGesture = Gesture.Tap()
    .enabled(editMode)
    .onEnd(() => {
      runOnJS(onConfigure)();
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        entering={FadeIn.delay(index * 50)}
        layout={Layout.springify()}
        style={[
          styles.widgetContainer,
          {
            width: widgetWidth,
            height: widgetHeight,
          },
          animatedStyle,
          isDragging && styles.widgetDragging,
        ]}
      >
        {/* Widget header */}
        <View style={styles.widgetHeader}>
          <View style={[styles.widgetIcon, { backgroundColor: definition.color }]}>
            <Ionicons name={definition.icon} size={16} color="#000000" />
          </View>
          <Text style={styles.widgetTitle}>{definition.name}</Text>
          {editMode && (
            <TouchableOpacity onPress={onConfigure} style={styles.widgetConfigButton}>
              <Ionicons name="settings-outline" size={16} color="#666666" />
            </TouchableOpacity>
          )}
        </View>

        {/* Widget content placeholder */}
        <View style={styles.widgetContent}>
          <WidgetPreview type={widget.type} config={widget.config} size={widget.size} />
        </View>

        {/* Edit mode overlay */}
        {editMode && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.editOverlay}>
            <View style={styles.editHint}>
              <Ionicons name="move" size={16} color="#888888" />
              <Text style={styles.editHintText}>Hold to drag</Text>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

/**
 * WidgetPreview - Renders widget content preview
 */
interface WidgetPreviewProps {
  type: WidgetType;
  config: Record<string, unknown>;
  size: { width: number; height: number };
}

const WidgetPreview: React.FC<WidgetPreviewProps> = ({ type, config, size }) => {
  // Render different preview based on widget type
  switch (type) {
    case 'priority':
      return (
        <View style={styles.previewContent}>
          {[1, 2, 3].slice(0, size.height > 1 ? 3 : 2).map((_, i) => (
            <View key={i} style={styles.previewItem}>
              <View style={[styles.previewDot, { backgroundColor: i === 0 ? '#FF4444' : '#888888' }]} />
              <View style={[styles.previewBar, { width: `${80 - i * 15}%` }]} />
            </View>
          ))}
        </View>
      );
    case 'signals':
      return (
        <View style={styles.previewContent}>
          <View style={styles.previewSignalRow}>
            <Ionicons name="radio" size={20} color={ORACLE_COLORS.observe} />
            <Text style={styles.previewSignalCount}>12</Text>
          </View>
          <Text style={styles.previewSignalLabel}>Active signals</Text>
        </View>
      );
    case 'decisions':
      return (
        <View style={styles.previewContent}>
          <View style={styles.previewDecisionRow}>
            <Ionicons name="git-branch" size={20} color={ORACLE_COLORS.orient} />
            <Text style={styles.previewDecisionCount}>3</Text>
          </View>
          <Text style={styles.previewDecisionLabel}>Pending</Text>
        </View>
      );
    case 'schedule':
      return (
        <View style={styles.previewContent}>
          {[1, 2].map((_, i) => (
            <View key={i} style={styles.previewScheduleItem}>
              <Text style={styles.previewScheduleTime}>{9 + i * 2}:00</Text>
              <View style={styles.previewScheduleBar} />
            </View>
          ))}
        </View>
      );
    case 'metrics':
      return (
        <View style={styles.previewMetricsRow}>
          {[1, 2, 3].slice(0, size.width > 1 ? 3 : 2).map((_, i) => (
            <View key={i} style={styles.previewMetric}>
              <Text style={styles.previewMetricValue}>{85 - i * 10}%</Text>
              <View style={[styles.previewMetricBar, { height: `${85 - i * 10}%` }]} />
            </View>
          ))}
        </View>
      );
    case 'progress':
      return (
        <View style={styles.previewContent}>
          <View style={styles.previewProgressBar}>
            <View style={[styles.previewProgressFill, { width: '65%' }]} />
          </View>
          <Text style={styles.previewProgressText}>65% complete</Text>
        </View>
      );
    case 'quick-actions':
      return (
        <View style={styles.previewActionsGrid}>
          {[1, 2, 3, 4].slice(0, size.height > 1 ? 4 : 2).map((_, i) => (
            <View key={i} style={styles.previewActionButton}>
              <Ionicons name="flash" size={16} color={ORACLE_COLORS.act} />
            </View>
          ))}
        </View>
      );
    case 'risks':
      return (
        <View style={styles.previewContent}>
          <View style={styles.previewRiskRow}>
            <View style={styles.previewRiskIndicator} />
            <Text style={styles.previewRiskText}>2 High Priority</Text>
          </View>
        </View>
      );
    default:
      return (
        <View style={styles.previewContent}>
          <Text style={styles.previewPlaceholder}>Widget Preview</Text>
        </View>
      );
  }
};

// Helper functions
function getCategoryColor(category: LayoutTemplate['category']): string {
  switch (category) {
    case 'productivity':
      return ORACLE_COLORS.act;
    case 'analytics':
      return ORACLE_COLORS.observe;
    case 'minimal':
      return ORACLE_COLORS.orient;
    case 'custom':
      return '#9B59B6';
    default:
      return '#888888';
  }
}

/**
 * Hook for dashboard builder functionality
 */
export const useDashboardBuilder = () => {
  const {
    dashboardLayout,
    savedLayouts,
    activeLayoutName,
    editMode,
    setEditMode,
    addWidget,
    removeWidget,
    updateWidget,
    reorderWidgets,
    saveLayout,
    loadLayout,
    deleteLayout,
  } = useUXStore();

  const layoutNames = useUXSelectors.layoutNames();
  const visibleWidgets = useUXSelectors.visibleWidgets();

  return {
    widgets: dashboardLayout,
    visibleWidgets,
    savedLayouts,
    layoutNames,
    activeLayoutName,
    editMode,
    setEditMode,
    addWidget,
    removeWidget,
    updateWidget,
    reorderWidgets,
    saveLayout,
    loadLayout,
    deleteLayout,
    widgetLibrary: WIDGET_LIBRARY,
    templates: LAYOUT_TEMPLATES,
    getBreakpoint,
    getGridColumns,
  };
};

/**
 * QuickLayoutSwitch - Compact layout switcher
 */
interface QuickLayoutSwitchProps {
  onLayoutChange?: () => void;
}

export const QuickLayoutSwitch: React.FC<QuickLayoutSwitchProps> = ({
  onLayoutChange,
}) => {
  const { savedLayouts, activeLayoutName, loadLayout, hapticEnabled } = useUXStore();
  const layoutNames = useUXSelectors.layoutNames();

  const handleSwitch = (name: string) => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    loadLayout(name);
    onLayoutChange?.();
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.quickSwitch}
      contentContainerStyle={styles.quickSwitchContent}
    >
      {layoutNames.map((name) => (
        <TouchableOpacity
          key={name}
          style={[
            styles.quickSwitchItem,
            activeLayoutName === name && styles.quickSwitchItemActive,
          ]}
          onPress={() => handleSwitch(name)}
        >
          <Text
            style={[
              styles.quickSwitchText,
              activeLayoutName === name && styles.quickSwitchTextActive,
            ]}
          >
            {name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  editBadge: {
    backgroundColor: ORACLE_COLORS.orient,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 10,
  },
  editBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editActions: {
    flexDirection: 'row',
    marginRight: 8,
  },
  headerButton: {
    padding: 8,
    marginLeft: 4,
  },
  editToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editToggleActive: {
    backgroundColor: ORACLE_COLORS.act,
  },
  breakpointIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: '#1A1A1A',
  },
  breakpointText: {
    fontSize: 11,
    color: '#666666',
    marginLeft: 6,
  },
  savedLayoutsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666666',
    letterSpacing: 1,
    marginBottom: 8,
  },
  savedLayoutChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  savedLayoutChipActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: ORACLE_COLORS.act,
  },
  savedLayoutChipText: {
    fontSize: 12,
    color: '#888888',
  },
  savedLayoutChipTextActive: {
    color: ORACLE_COLORS.act,
  },
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    padding: GRID_PADDING,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  widgetContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    overflow: 'hidden',
  },
  widgetDragging: {
    borderColor: ORACLE_COLORS.observe,
    shadowColor: ORACLE_COLORS.observe,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  widgetIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  widgetTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  widgetConfigButton: {
    padding: 4,
  },
  widgetContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  editOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  editHintText: {
    fontSize: 12,
    color: '#888888',
    marginLeft: 6,
  },
  addWidgetPlaceholder: {
    height: CELL_HEIGHT,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333333',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addWidgetText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  categoryFilter: {
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#333333',
    borderRadius: 16,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  libraryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  libraryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libraryContent: {
    flex: 1,
    marginLeft: 12,
  },
  libraryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  libraryDescription: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  libraryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  librarySize: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  librarySizeText: {
    fontSize: 10,
    color: '#666666',
    marginLeft: 4,
  },
  libraryDataBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 10,
  },
  libraryDataText: {
    fontSize: 10,
    color: ORACLE_COLORS.act,
    marginLeft: 4,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateContent: {
    flex: 1,
    marginLeft: 12,
  },
  templateName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  templateDescription: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  templateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  templateBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    textTransform: 'uppercase',
  },
  templateWidgetCount: {
    fontSize: 11,
    color: '#666666',
    marginLeft: 10,
  },
  // Save modal
  saveModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  saveModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 300,
  },
  saveModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  saveInput: {
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  saveModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  saveModalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveModalCancelText: {
    fontSize: 14,
    color: '#888888',
  },
  saveModalConfirm: {
    backgroundColor: ORACLE_COLORS.act,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveModalConfirmText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  // Config panel
  configPanelOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  configPanel: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  configPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  configPanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  configPanelIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  configPanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  configSection: {
    marginBottom: 24,
  },
  configSectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666666',
    letterSpacing: 1,
    marginBottom: 12,
  },
  dataBindingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dataBindingText: {
    fontSize: 12,
    color: '#888888',
    marginLeft: 8,
  },
  sizeControls: {
    flexDirection: 'row',
    gap: 10,
  },
  sizeButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#333333',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  sizeButtonActive: {
    borderColor: ORACLE_COLORS.act,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
  },
  sizeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  configOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  configOptionLabel: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  toggleButton: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333333',
    padding: 3,
    justifyContent: 'center',
  },
  toggleButtonActive: {
    backgroundColor: ORACLE_COLORS.act,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#888888',
  },
  toggleKnobActive: {
    backgroundColor: '#000000',
    alignSelf: 'flex-end',
  },
  selectContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  selectOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#333333',
    borderRadius: 6,
  },
  selectOptionActive: {
    backgroundColor: ORACLE_COLORS.act,
  },
  selectOptionText: {
    fontSize: 12,
    color: '#888888',
  },
  selectOptionTextActive: {
    color: '#000000',
    fontWeight: '600',
  },
  numberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  numberButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    minWidth: 24,
    textAlign: 'center',
  },
  deleteWidgetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  deleteWidgetText: {
    fontSize: 14,
    color: '#FF4444',
    marginLeft: 8,
  },
  // Widget preview styles
  previewContent: {
    flex: 1,
    justifyContent: 'center',
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  previewBar: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
  },
  previewSignalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewSignalCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  previewSignalLabel: {
    fontSize: 11,
    color: '#666666',
    marginTop: 4,
  },
  previewDecisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewDecisionCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  previewDecisionLabel: {
    fontSize: 11,
    color: '#666666',
    marginTop: 4,
  },
  previewScheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewScheduleTime: {
    fontSize: 10,
    color: '#888888',
    width: 32,
  },
  previewScheduleBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#9B59B6',
    borderRadius: 4,
    marginLeft: 8,
  },
  previewMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    flex: 1,
  },
  previewMetric: {
    alignItems: 'center',
  },
  previewMetricValue: {
    fontSize: 10,
    color: '#888888',
    marginBottom: 4,
  },
  previewMetricBar: {
    width: 20,
    backgroundColor: '#3498DB',
    borderRadius: 4,
  },
  previewProgressBar: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  previewProgressFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.act,
  },
  previewProgressText: {
    fontSize: 11,
    color: '#666666',
    marginTop: 6,
  },
  previewActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  previewActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ORACLE_COLORS.act,
  },
  previewRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewRiskIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF4444',
    marginRight: 8,
  },
  previewRiskText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  previewPlaceholder: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  // Quick switch styles
  quickSwitch: {
    maxHeight: 40,
  },
  quickSwitchContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickSwitchItem: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    marginRight: 8,
  },
  quickSwitchItemActive: {
    backgroundColor: ORACLE_COLORS.act,
  },
  quickSwitchText: {
    fontSize: 12,
    color: '#888888',
  },
  quickSwitchTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
});

export default DashboardBuilder;
