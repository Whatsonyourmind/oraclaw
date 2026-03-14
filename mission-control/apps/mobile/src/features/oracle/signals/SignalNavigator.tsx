/**
 * SignalNavigator Component
 * Main navigation hub for signals with filtering, sorting, and view modes
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Signal, SignalType, UrgencyLevel, ImpactLevel } from '@mission-control/shared-types';
import { ORACLE_COLORS, ORACLE_TIMING, getUrgencyColor, getImpactColor } from '../theme';

// ============================================================================
// TYPES
// ============================================================================

export type ViewMode = 'list' | 'grid' | 'timeline' | 'graph';
export type SortOption = 'priority' | 'date' | 'impact' | 'urgency' | 'confidence';
export type SortDirection = 'asc' | 'desc';

export interface SignalFilter {
  types: SignalType[];
  urgencies: UrgencyLevel[];
  impacts: ImpactLevel[];
  sources: string[];
  dateRange: {
    start?: string;
    end?: string;
  };
  search: string;
  status: ('active' | 'acknowledged' | 'dismissed' | 'resolved')[];
  minConfidence?: number;
}

export interface SignalNavigatorProps {
  signals: Signal[];
  onSignalPress: (signal: Signal) => void;
  onViewModeChange?: (mode: ViewMode) => void;
  onFilterChange?: (filter: SignalFilter) => void;
  onSortChange?: (sort: SortOption, direction: SortDirection) => void;
  onQuickAction?: (action: string, signals: Signal[]) => void;
  initialViewMode?: ViewMode;
  showQuickActions?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SIGNAL_TYPES: SignalType[] = [
  'deadline', 'conflict', 'opportunity', 'risk', 'anomaly', 'pattern', 'dependency', 'resource'
];

const URGENCY_LEVELS: UrgencyLevel[] = ['critical', 'high', 'medium', 'low'];
const IMPACT_LEVELS: ImpactLevel[] = ['critical', 'high', 'medium', 'low'];

const VIEW_MODE_ICONS: Record<ViewMode, string> = {
  list: 'list-outline',
  grid: 'grid-outline',
  timeline: 'time-outline',
  graph: 'git-network-outline',
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'priority', label: 'Priority' },
  { value: 'date', label: 'Date' },
  { value: 'impact', label: 'Impact' },
  { value: 'urgency', label: 'Urgency' },
  { value: 'confidence', label: 'Confidence' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export const SignalNavigator: React.FC<SignalNavigatorProps> = ({
  signals,
  onSignalPress,
  onViewModeChange,
  onFilterChange,
  onSortChange,
  onQuickAction,
  initialViewMode = 'list',
  showQuickActions = true,
}) => {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [sortOption, setSortOption] = useState<SortOption>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filter, setFilter] = useState<SignalFilter>({
    types: [],
    urgencies: [],
    impacts: [],
    sources: [],
    dateRange: {},
    search: '',
    status: ['active'],
  });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [selectedSignals, setSelectedSignals] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Animation
  const filterBarAnim = useRef(new Animated.Value(0)).current;

  // Memoized filtered and sorted signals
  const filteredSignals = useMemo(() => {
    let result = [...signals];

    // Apply search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(searchLower) ||
          s.description?.toLowerCase().includes(searchLower)
      );
    }

    // Apply type filter
    if (filter.types.length > 0) {
      result = result.filter((s) => filter.types.includes(s.signal_type));
    }

    // Apply urgency filter
    if (filter.urgencies.length > 0) {
      result = result.filter((s) => filter.urgencies.includes(s.urgency));
    }

    // Apply impact filter
    if (filter.impacts.length > 0) {
      result = result.filter((s) => filter.impacts.includes(s.impact));
    }

    // Apply status filter
    if (filter.status.length > 0) {
      result = result.filter((s) => filter.status.includes(s.status));
    }

    // Apply source filter
    if (filter.sources.length > 0) {
      result = result.filter((s) => {
        const source = s.source_data?.source || '';
        return filter.sources.includes(source);
      });
    }

    // Apply date range filter
    if (filter.dateRange.start) {
      result = result.filter((s) => s.created_at >= filter.dateRange.start!);
    }
    if (filter.dateRange.end) {
      result = result.filter((s) => s.created_at <= filter.dateRange.end!);
    }

    // Apply confidence filter
    if (filter.minConfidence !== undefined) {
      result = result.filter((s) => s.confidence >= filter.minConfidence!);
    }

    return result;
  }, [signals, filter]);

  const sortedSignals = useMemo(() => {
    const sorted = [...filteredSignals];
    const urgencyOrder: Record<UrgencyLevel, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const impactOrder: Record<ImpactLevel, number> = { critical: 4, high: 3, medium: 2, low: 1 };

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortOption) {
        case 'priority':
          // Combined urgency and impact
          comparison =
            (urgencyOrder[b.urgency] + impactOrder[b.impact]) -
            (urgencyOrder[a.urgency] + impactOrder[a.impact]);
          break;
        case 'date':
          comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case 'impact':
          comparison = impactOrder[b.impact] - impactOrder[a.impact];
          break;
        case 'urgency':
          comparison = urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
          break;
        case 'confidence':
          comparison = b.confidence - a.confidence;
          break;
      }

      return sortDirection === 'desc' ? comparison : -comparison;
    });

    return sorted;
  }, [filteredSignals, sortOption, sortDirection]);

  // Get unique sources from signals
  const availableSources = useMemo(() => {
    const sources = new Set<string>();
    signals.forEach((s) => {
      if (s.source_data?.source) {
        sources.add(s.source_data.source);
      }
    });
    return Array.from(sources);
  }, [signals]);

  // Handlers
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    onViewModeChange?.(mode);
  }, [onViewModeChange]);

  const handleSortChange = useCallback((option: SortOption) => {
    if (option === sortOption) {
      const newDirection = sortDirection === 'desc' ? 'asc' : 'desc';
      setSortDirection(newDirection);
      onSortChange?.(option, newDirection);
    } else {
      setSortOption(option);
      setSortDirection('desc');
      onSortChange?.(option, 'desc');
    }
    setShowSortModal(false);
  }, [sortOption, sortDirection, onSortChange]);

  const handleFilterToggle = useCallback((
    key: 'types' | 'urgencies' | 'impacts' | 'status' | 'sources',
    value: any
  ) => {
    setFilter((prev) => {
      const current = prev[key] as any[];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      const newFilter = { ...prev, [key]: updated };
      onFilterChange?.(newFilter);
      return newFilter;
    });
  }, [onFilterChange]);

  const handleSearchChange = useCallback((text: string) => {
    setFilter((prev) => {
      const newFilter = { ...prev, search: text };
      onFilterChange?.(newFilter);
      return newFilter;
    });
  }, [onFilterChange]);

  const handleClearFilters = useCallback(() => {
    const clearedFilter: SignalFilter = {
      types: [],
      urgencies: [],
      impacts: [],
      sources: [],
      dateRange: {},
      search: '',
      status: ['active'],
    };
    setFilter(clearedFilter);
    onFilterChange?.(clearedFilter);
  }, [onFilterChange]);

  const handleSignalSelect = useCallback((signalId: string) => {
    setSelectedSignals((prev) => {
      const updated = new Set(prev);
      if (updated.has(signalId)) {
        updated.delete(signalId);
      } else {
        updated.add(signalId);
      }
      return updated;
    });
  }, []);

  const handleQuickAction = useCallback((action: string) => {
    const selected = sortedSignals.filter((s) => selectedSignals.has(s.id));
    onQuickAction?.(action, selected);
    setSelectedSignals(new Set());
    setIsSelectionMode(false);
  }, [sortedSignals, selectedSignals, onQuickAction]);

  const activeFilterCount = useMemo(() => {
    return (
      filter.types.length +
      filter.urgencies.length +
      filter.impacts.length +
      filter.sources.length +
      (filter.dateRange.start ? 1 : 0) +
      (filter.dateRange.end ? 1 : 0) +
      (filter.minConfidence !== undefined ? 1 : 0)
    );
  }, [filter]);

  // Render functions
  const renderFilterChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterChipsContainer}
      contentContainerStyle={styles.filterChipsContent}
    >
      {/* Type chips */}
      {filter.types.map((type) => (
        <TouchableOpacity
          key={type}
          style={[styles.filterChip, styles.activeChip]}
          onPress={() => handleFilterToggle('types', type)}
        >
          <Text style={styles.filterChipText}>{type}</Text>
          <Ionicons name="close" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      ))}

      {/* Urgency chips */}
      {filter.urgencies.map((urgency) => (
        <TouchableOpacity
          key={urgency}
          style={[styles.filterChip, { backgroundColor: getUrgencyColor(urgency) }]}
          onPress={() => handleFilterToggle('urgencies', urgency)}
        >
          <Text style={styles.filterChipTextDark}>{urgency}</Text>
          <Ionicons name="close" size={14} color="#000000" />
        </TouchableOpacity>
      ))}

      {/* Impact chips */}
      {filter.impacts.map((impact) => (
        <TouchableOpacity
          key={`impact-${impact}`}
          style={[styles.filterChip, { backgroundColor: getImpactColor(impact) }]}
          onPress={() => handleFilterToggle('impacts', impact)}
        >
          <Text style={styles.filterChipTextDark}>{impact} impact</Text>
          <Ionicons name="close" size={14} color="#000000" />
        </TouchableOpacity>
      ))}

      {/* Clear all */}
      {activeFilterCount > 0 && (
        <TouchableOpacity
          style={styles.clearFiltersButton}
          onPress={handleClearFilters}
        >
          <Text style={styles.clearFiltersText}>Clear all</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  const renderSignalItem = ({ item: signal }: { item: Signal }) => {
    const isSelected = selectedSignals.has(signal.id);
    const urgencyColor = getUrgencyColor(signal.urgency);

    return (
      <TouchableOpacity
        style={[
          styles.signalItem,
          isSelected && styles.signalItemSelected,
          { borderLeftColor: urgencyColor },
        ]}
        onPress={() => isSelectionMode ? handleSignalSelect(signal.id) : onSignalPress(signal)}
        onLongPress={() => {
          setIsSelectionMode(true);
          handleSignalSelect(signal.id);
        }}
      >
        {isSelectionMode && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#000000" />}
          </View>
        )}

        <View style={styles.signalItemContent}>
          <View style={styles.signalItemHeader}>
            <Text style={styles.signalType}>
              {signal.signal_type.toUpperCase().replace('_', ' ')}
            </Text>
            <Text style={styles.signalTime}>
              {new Date(signal.created_at).toLocaleDateString()}
            </Text>
          </View>

          <Text style={styles.signalTitle} numberOfLines={2}>
            {signal.title}
          </Text>

          {signal.description && (
            <Text style={styles.signalDescription} numberOfLines={1}>
              {signal.description}
            </Text>
          )}

          <View style={styles.signalBadges}>
            <View style={[styles.badge, { backgroundColor: urgencyColor }]}>
              <Text style={styles.badgeText}>{signal.urgency.toUpperCase()}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: getImpactColor(signal.impact) }]}>
              <Text style={styles.badgeText}>{signal.impact.toUpperCase()}</Text>
            </View>
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>
                {Math.round(signal.confidence * 100)}%
              </Text>
            </View>
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={20}
          color="#666666"
          style={styles.signalChevron}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SIGNALS</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="filter-outline" size={22} color={ORACLE_COLORS.observe} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#888888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search signals..."
          placeholderTextColor="#666666"
          value={filter.search}
          onChangeText={handleSearchChange}
        />
        {filter.search.length > 0 && (
          <TouchableOpacity onPress={() => handleSearchChange('')}>
            <Ionicons name="close-circle" size={18} color="#888888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      {activeFilterCount > 0 && renderFilterChips()}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        {/* View Mode Switcher */}
        <View style={styles.viewModeSwitcher}>
          {(Object.keys(VIEW_MODE_ICONS) as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.viewModeButton,
                viewMode === mode && styles.viewModeButtonActive,
              ]}
              onPress={() => handleViewModeChange(mode)}
            >
              <Ionicons
                name={VIEW_MODE_ICONS[mode] as any}
                size={18}
                color={viewMode === mode ? ORACLE_COLORS.observe : '#888888'}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sort Button */}
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
        >
          <Text style={styles.sortButtonText}>
            {SORT_OPTIONS.find((o) => o.value === sortOption)?.label}
          </Text>
          <Ionicons
            name={sortDirection === 'desc' ? 'arrow-down' : 'arrow-up'}
            size={14}
            color={ORACLE_COLORS.observe}
          />
        </TouchableOpacity>

        {/* Count */}
        <Text style={styles.countText}>
          {sortedSignals.length} signal{sortedSignals.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Quick Actions Toolbar (when in selection mode) */}
      {isSelectionMode && showQuickActions && (
        <View style={styles.quickActionsBar}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => handleQuickAction('acknowledge')}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#00FF88" />
            <Text style={styles.quickActionText}>Acknowledge</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => handleQuickAction('dismiss')}
          >
            <Ionicons name="close-circle-outline" size={20} color="#FF6B6B" />
            <Text style={styles.quickActionText}>Dismiss</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => handleQuickAction('group')}
          >
            <Ionicons name="layers-outline" size={20} color={ORACLE_COLORS.observe} />
            <Text style={styles.quickActionText}>Group</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickActionCancel}
            onPress={() => {
              setIsSelectionMode(false);
              setSelectedSignals(new Set());
            }}
          >
            <Text style={styles.quickActionCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Signal List */}
      <FlatList
        data={sortedSignals}
        renderItem={renderSignalItem}
        keyExtractor={(item) => item.id}
        style={styles.signalList}
        contentContainerStyle={styles.signalListContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="radio-outline" size={48} color="#444444" />
            <Text style={styles.emptyStateText}>No signals match your filters</Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleClearFilters}
              >
                <Text style={styles.emptyStateButtonText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Signals</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Signal Types */}
              <Text style={styles.filterSectionTitle}>Signal Type</Text>
              <View style={styles.filterOptionsGrid}>
                {SIGNAL_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterOption,
                      filter.types.includes(type) && styles.filterOptionActive,
                    ]}
                    onPress={() => handleFilterToggle('types', type)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filter.types.includes(type) && styles.filterOptionTextActive,
                      ]}
                    >
                      {type.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Urgency */}
              <Text style={styles.filterSectionTitle}>Urgency</Text>
              <View style={styles.filterOptionsRow}>
                {URGENCY_LEVELS.map((urgency) => (
                  <TouchableOpacity
                    key={urgency}
                    style={[
                      styles.filterOption,
                      filter.urgencies.includes(urgency) && {
                        backgroundColor: getUrgencyColor(urgency),
                      },
                    ]}
                    onPress={() => handleFilterToggle('urgencies', urgency)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filter.urgencies.includes(urgency) && styles.filterOptionTextDark,
                      ]}
                    >
                      {urgency}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Impact */}
              <Text style={styles.filterSectionTitle}>Impact</Text>
              <View style={styles.filterOptionsRow}>
                {IMPACT_LEVELS.map((impact) => (
                  <TouchableOpacity
                    key={impact}
                    style={[
                      styles.filterOption,
                      filter.impacts.includes(impact) && {
                        backgroundColor: getImpactColor(impact),
                      },
                    ]}
                    onPress={() => handleFilterToggle('impacts', impact)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filter.impacts.includes(impact) && styles.filterOptionTextDark,
                      ]}
                    >
                      {impact}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sources */}
              {availableSources.length > 0 && (
                <>
                  <Text style={styles.filterSectionTitle}>Source</Text>
                  <View style={styles.filterOptionsGrid}>
                    {availableSources.map((source) => (
                      <TouchableOpacity
                        key={source}
                        style={[
                          styles.filterOption,
                          filter.sources.includes(source) && styles.filterOptionActive,
                        ]}
                        onPress={() => handleFilterToggle('sources', source)}
                      >
                        <Text
                          style={[
                            styles.filterOptionText,
                            filter.sources.includes(source) && styles.filterOptionTextActive,
                          ]}
                        >
                          {source}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalClearButton}
                onPress={() => {
                  handleClearFilters();
                  setShowFilterModal(false);
                }}
              >
                <Text style={styles.modalClearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyButton}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.modalApplyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={styles.sortModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.sortModalContent}>
            <Text style={styles.sortModalTitle}>Sort By</Text>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sortOption,
                  sortOption === option.value && styles.sortOptionActive,
                ]}
                onPress={() => handleSortChange(option.value)}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortOption === option.value && styles.sortOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {sortOption === option.value && (
                  <Ionicons
                    name={sortDirection === 'desc' ? 'arrow-down' : 'arrow-up'}
                    size={16}
                    color={ORACLE_COLORS.observe}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

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
    borderBottomColor: '#222222',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ORACLE_COLORS.observe,
    letterSpacing: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: ORACLE_COLORS.decide,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 14,
  },
  filterChipsContainer: {
    maxHeight: 40,
    marginBottom: 8,
  },
  filterChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333333',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  activeChip: {
    backgroundColor: ORACLE_COLORS.observe,
  },
  filterChipText: {
    fontSize: 12,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  filterChipTextDark: {
    fontSize: 12,
    color: '#000000',
    textTransform: 'capitalize',
  },
  clearFiltersButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearFiltersText: {
    fontSize: 12,
    color: ORACLE_COLORS.decide,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 2,
  },
  viewModeButton: {
    padding: 8,
    borderRadius: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#333333',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    gap: 4,
  },
  sortButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  countText: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#888888',
  },
  quickActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  quickActionCancel: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickActionCancelText: {
    fontSize: 12,
    color: ORACLE_COLORS.decide,
  },
  signalList: {
    flex: 1,
  },
  signalListContent: {
    padding: 16,
  },
  signalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  signalItemSelected: {
    backgroundColor: '#2A2A2A',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666666',
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: ORACLE_COLORS.observe,
    borderColor: ORACLE_COLORS.observe,
  },
  signalItemContent: {
    flex: 1,
    padding: 12,
  },
  signalItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  signalType: {
    fontSize: 10,
    color: '#888888',
    letterSpacing: 0.5,
  },
  signalTime: {
    fontSize: 10,
    color: '#666666',
  },
  signalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  signalDescription: {
    fontSize: 12,
    color: '#AAAAAA',
    marginBottom: 8,
  },
  signalBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#333333',
  },
  confidenceText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  signalChevron: {
    marginRight: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 12,
  },
  emptyStateButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#333333',
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontSize: 14,
    color: ORACLE_COLORS.observe,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalScroll: {
    padding: 16,
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888888',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#333333',
    borderWidth: 1,
    borderColor: '#444444',
  },
  filterOptionActive: {
    backgroundColor: ORACLE_COLORS.observe,
    borderColor: ORACLE_COLORS.observe,
  },
  filterOptionText: {
    fontSize: 13,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  filterOptionTextActive: {
    color: '#000000',
    fontWeight: '600',
  },
  filterOptionTextDark: {
    color: '#000000',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  modalClearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#666666',
    alignItems: 'center',
  },
  modalClearButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalApplyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: ORACLE_COLORS.observe,
    alignItems: 'center',
  },
  modalApplyButtonText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: 'bold',
  },
  sortModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    minWidth: 200,
  },
  sortModalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888888',
    marginBottom: 12,
  },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sortOptionActive: {
    backgroundColor: '#333333',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  sortOptionTextActive: {
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
});

export default SignalNavigator;
