/**
 * SignalFilters Component
 * Advanced filtering with saved presets and natural language input
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { SignalType, UrgencyLevel, ImpactLevel } from '@mission-control/shared-types';
import { ORACLE_COLORS, getUrgencyColor, getImpactColor } from '../theme';

// ============================================================================
// TYPES
// ============================================================================

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filter: SignalFilterCriteria;
  isDefault?: boolean;
  createdAt: string;
  usageCount: number;
}

export interface SignalFilterCriteria {
  types: SignalType[];
  urgencies: UrgencyLevel[];
  impacts: ImpactLevel[];
  statuses: ('active' | 'acknowledged' | 'dismissed' | 'resolved')[];
  sources: string[];
  dateRange: {
    start?: string;
    end?: string;
  };
  confidenceRange: {
    min?: number;
    max?: number;
  };
  searchQuery: string;
  tags: string[];
  assignees: string[];
  projects: string[];
  customRules: CustomFilterRule[];
}

export interface CustomFilterRule {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: any;
  conjunction: 'and' | 'or';
}

export interface ParsedNLQuery {
  types?: SignalType[];
  urgencies?: UrgencyLevel[];
  impacts?: ImpactLevel[];
  timeframe?: string;
  keywords?: string[];
  confidence: number;
  interpretation: string;
}

export interface SignalFiltersProps {
  currentFilter: SignalFilterCriteria;
  presets: FilterPreset[];
  availableSources: string[];
  availableTags: string[];
  availableAssignees: string[];
  availableProjects: string[];
  onFilterChange: (filter: SignalFilterCriteria) => void;
  onPresetSave: (name: string, description?: string) => void;
  onPresetLoad: (preset: FilterPreset) => void;
  onPresetDelete: (presetId: string) => void;
  onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SIGNAL_TYPES: { value: SignalType; label: string; icon: string }[] = [
  { value: 'deadline', label: 'Deadline', icon: 'alarm-outline' },
  { value: 'conflict', label: 'Conflict', icon: 'git-compare-outline' },
  { value: 'opportunity', label: 'Opportunity', icon: 'bulb-outline' },
  { value: 'risk', label: 'Risk', icon: 'warning-outline' },
  { value: 'anomaly', label: 'Anomaly', icon: 'trending-up-outline' },
  { value: 'pattern', label: 'Pattern', icon: 'analytics-outline' },
  { value: 'dependency', label: 'Dependency', icon: 'git-network-outline' },
  { value: 'resource', label: 'Resource', icon: 'cube-outline' },
];

const URGENCY_LEVELS: UrgencyLevel[] = ['critical', 'high', 'medium', 'low'];
const IMPACT_LEVELS: ImpactLevel[] = ['critical', 'high', 'medium', 'low'];
const STATUS_OPTIONS = ['active', 'acknowledged', 'dismissed', 'resolved'] as const;

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: 'week' },
  { label: 'Last 30 days', value: 'month' },
  { label: 'Last 90 days', value: 'quarter' },
  { label: 'Custom', value: 'custom' },
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'Is one of' },
  { value: 'not_in', label: 'Is not one of' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export const SignalFilters: React.FC<SignalFiltersProps> = ({
  currentFilter,
  presets,
  availableSources,
  availableTags,
  availableAssignees,
  availableProjects,
  onFilterChange,
  onPresetSave,
  onPresetLoad,
  onPresetDelete,
  onClose,
}) => {
  // State
  const [activeSection, setActiveSection] = useState<string | null>('types');
  const [nlQuery, setNlQuery] = useState('');
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [showQueryBuilder, setShowQueryBuilder] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [nlParsedQuery, setNlParsedQuery] = useState<ParsedNLQuery | null>(null);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (currentFilter.types.length > 0) count++;
    if (currentFilter.urgencies.length > 0) count++;
    if (currentFilter.impacts.length > 0) count++;
    if (currentFilter.statuses.length > 0 && currentFilter.statuses.length < 4) count++;
    if (currentFilter.sources.length > 0) count++;
    if (currentFilter.dateRange.start || currentFilter.dateRange.end) count++;
    if (currentFilter.confidenceRange.min !== undefined || currentFilter.confidenceRange.max !== undefined) count++;
    if (currentFilter.searchQuery) count++;
    if (currentFilter.tags.length > 0) count++;
    if (currentFilter.assignees.length > 0) count++;
    if (currentFilter.projects.length > 0) count++;
    if (currentFilter.customRules.length > 0) count++;
    return count;
  }, [currentFilter]);

  // Toggle filter option
  const toggleOption = useCallback(
    <K extends keyof SignalFilterCriteria>(
      key: K,
      value: SignalFilterCriteria[K] extends any[] ? SignalFilterCriteria[K][number] : never
    ) => {
      const current = currentFilter[key] as any[];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onFilterChange({ ...currentFilter, [key]: updated });
    },
    [currentFilter, onFilterChange]
  );

  // Parse natural language query
  const parseNaturalLanguage = useCallback((query: string) => {
    const queryLower = query.toLowerCase();
    const parsed: ParsedNLQuery = {
      confidence: 0.5,
      interpretation: '',
      keywords: [],
    };

    // Parse urgency
    if (queryLower.includes('critical') || queryLower.includes('urgent')) {
      parsed.urgencies = ['critical'];
      parsed.confidence += 0.1;
    } else if (queryLower.includes('high priority') || queryLower.includes('important')) {
      parsed.urgencies = ['critical', 'high'];
      parsed.confidence += 0.1;
    }

    // Parse types
    SIGNAL_TYPES.forEach((type) => {
      if (queryLower.includes(type.value) || queryLower.includes(type.label.toLowerCase())) {
        if (!parsed.types) parsed.types = [];
        parsed.types.push(type.value);
        parsed.confidence += 0.1;
      }
    });

    // Parse timeframe
    if (queryLower.includes('today') || queryLower.includes('now')) {
      parsed.timeframe = 'today';
      parsed.confidence += 0.1;
    } else if (queryLower.includes('this week') || queryLower.includes('last 7 days')) {
      parsed.timeframe = 'week';
      parsed.confidence += 0.1;
    } else if (queryLower.includes('this month') || queryLower.includes('last 30 days')) {
      parsed.timeframe = 'month';
      parsed.confidence += 0.1;
    }

    // Extract keywords
    const words = query.split(/\s+/).filter((w) => w.length > 2);
    const stopWords = ['the', 'and', 'for', 'with', 'show', 'find', 'get', 'all', 'signals'];
    parsed.keywords = words.filter((w) => !stopWords.includes(w.toLowerCase()));

    // Build interpretation
    const parts: string[] = [];
    if (parsed.types?.length) parts.push(`type: ${parsed.types.join(', ')}`);
    if (parsed.urgencies?.length) parts.push(`urgency: ${parsed.urgencies.join(', ')}`);
    if (parsed.timeframe) parts.push(`timeframe: ${parsed.timeframe}`);
    if (parsed.keywords?.length) parts.push(`keywords: ${parsed.keywords.join(', ')}`);

    parsed.interpretation = parts.length > 0 ? parts.join(' | ') : 'No specific filters detected';
    parsed.confidence = Math.min(1, parsed.confidence);

    return parsed;
  }, []);

  // Apply natural language query
  const applyNLQuery = useCallback(() => {
    if (!nlQuery.trim()) return;

    const parsed = parseNaturalLanguage(nlQuery);
    setNlParsedQuery(parsed);

    // Apply parsed filters
    const updatedFilter = { ...currentFilter };

    if (parsed.types?.length) {
      updatedFilter.types = parsed.types;
    }
    if (parsed.urgencies?.length) {
      updatedFilter.urgencies = parsed.urgencies;
    }
    if (parsed.keywords?.length) {
      updatedFilter.searchQuery = parsed.keywords.join(' ');
    }
    if (parsed.timeframe) {
      const now = new Date();
      let start: Date;

      switch (parsed.timeframe) {
        case 'today':
          start = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = new Date();
      }
      updatedFilter.dateRange = { start: start.toISOString() };
    }

    onFilterChange(updatedFilter);
  }, [nlQuery, parseNaturalLanguage, currentFilter, onFilterChange]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    onFilterChange({
      types: [],
      urgencies: [],
      impacts: [],
      statuses: ['active'],
      sources: [],
      dateRange: {},
      confidenceRange: {},
      searchQuery: '',
      tags: [],
      assignees: [],
      projects: [],
      customRules: [],
    });
    setNlQuery('');
    setNlParsedQuery(null);
  }, [onFilterChange]);

  // Save preset
  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) {
      Alert.alert('Error', 'Please enter a preset name');
      return;
    }
    onPresetSave(presetName.trim(), presetDescription.trim() || undefined);
    setShowSavePresetModal(false);
    setPresetName('');
    setPresetDescription('');
  }, [presetName, presetDescription, onPresetSave]);

  // Add custom rule
  const addCustomRule = useCallback(() => {
    const newRule: CustomFilterRule = {
      id: crypto.randomUUID(),
      field: 'title',
      operator: 'contains',
      value: '',
      conjunction: 'and',
    };
    onFilterChange({
      ...currentFilter,
      customRules: [...currentFilter.customRules, newRule],
    });
  }, [currentFilter, onFilterChange]);

  // Update custom rule
  const updateCustomRule = useCallback(
    (ruleId: string, updates: Partial<CustomFilterRule>) => {
      const updatedRules = currentFilter.customRules.map((rule) =>
        rule.id === ruleId ? { ...rule, ...updates } : rule
      );
      onFilterChange({ ...currentFilter, customRules: updatedRules });
    },
    [currentFilter, onFilterChange]
  );

  // Delete custom rule
  const deleteCustomRule = useCallback(
    (ruleId: string) => {
      const updatedRules = currentFilter.customRules.filter((rule) => rule.id !== ruleId);
      onFilterChange({ ...currentFilter, customRules: updatedRules });
    },
    [currentFilter, onFilterChange]
  );

  // Render section header
  const renderSectionHeader = (title: string, section: string, count?: number) => (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={() => setActiveSection(activeSection === section ? null : section)}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRight}>
        {count !== undefined && count > 0 && (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{count}</Text>
          </View>
        )}
        <Ionicons
          name={activeSection === section ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#888888"
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Filters</Text>
        <View style={styles.headerActions}>
          {activeFilterCount > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={clearAllFilters}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Natural Language Input */}
        <View style={styles.nlSection}>
          <Text style={styles.nlLabel}>Natural Language Filter</Text>
          <View style={styles.nlInputContainer}>
            <Ionicons name="search-outline" size={18} color="#888888" />
            <TextInput
              style={styles.nlInput}
              placeholder='e.g., "show critical deadlines this week"'
              placeholderTextColor="#666666"
              value={nlQuery}
              onChangeText={setNlQuery}
              onSubmitEditing={applyNLQuery}
            />
            {nlQuery.length > 0 && (
              <TouchableOpacity onPress={applyNLQuery}>
                <Ionicons name="arrow-forward-circle" size={24} color={ORACLE_COLORS.observe} />
              </TouchableOpacity>
            )}
          </View>
          {nlParsedQuery && (
            <View style={styles.nlParsedContainer}>
              <Text style={styles.nlParsedLabel}>Interpreted as:</Text>
              <Text style={styles.nlParsedText}>{nlParsedQuery.interpretation}</Text>
              <View style={styles.nlConfidence}>
                <Text style={styles.nlConfidenceLabel}>Confidence:</Text>
                <View style={styles.nlConfidenceBar}>
                  <View
                    style={[
                      styles.nlConfidenceFill,
                      { width: `${nlParsedQuery.confidence * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.nlConfidenceValue}>
                  {Math.round(nlParsedQuery.confidence * 100)}%
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Saved Presets */}
        <View style={styles.presetsSection}>
          <View style={styles.presetsHeader}>
            <Text style={styles.presetsTitle}>Saved Presets</Text>
            <View style={styles.presetsActions}>
              <TouchableOpacity
                style={styles.presetActionButton}
                onPress={() => setShowPresetModal(true)}
              >
                <Ionicons name="folder-outline" size={18} color={ORACLE_COLORS.observe} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetActionButton}
                onPress={() => setShowSavePresetModal(true)}
              >
                <Ionicons name="save-outline" size={18} color={ORACLE_COLORS.observe} />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {presets.slice(0, 5).map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={styles.presetChip}
                onPress={() => onPresetLoad(preset)}
              >
                <Text style={styles.presetChipText}>{preset.name}</Text>
              </TouchableOpacity>
            ))}
            {presets.length > 5 && (
              <TouchableOpacity
                style={styles.presetChipMore}
                onPress={() => setShowPresetModal(true)}
              >
                <Text style={styles.presetChipMoreText}>+{presets.length - 5} more</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Signal Types */}
        {renderSectionHeader('Signal Type', 'types', currentFilter.types.length)}
        {activeSection === 'types' && (
          <View style={styles.optionsGrid}>
            {SIGNAL_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.optionButton,
                  currentFilter.types.includes(type.value) && styles.optionButtonActive,
                ]}
                onPress={() => toggleOption('types', type.value)}
              >
                <Ionicons
                  name={type.icon as any}
                  size={16}
                  color={currentFilter.types.includes(type.value) ? '#000000' : '#FFFFFF'}
                />
                <Text
                  style={[
                    styles.optionText,
                    currentFilter.types.includes(type.value) && styles.optionTextActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Urgency */}
        {renderSectionHeader('Urgency', 'urgency', currentFilter.urgencies.length)}
        {activeSection === 'urgency' && (
          <View style={styles.optionsRow}>
            {URGENCY_LEVELS.map((urgency) => (
              <TouchableOpacity
                key={urgency}
                style={[
                  styles.urgencyButton,
                  currentFilter.urgencies.includes(urgency) && {
                    backgroundColor: getUrgencyColor(urgency),
                  },
                ]}
                onPress={() => toggleOption('urgencies', urgency)}
              >
                <Text
                  style={[
                    styles.urgencyText,
                    currentFilter.urgencies.includes(urgency) && styles.urgencyTextActive,
                  ]}
                >
                  {urgency}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Impact */}
        {renderSectionHeader('Impact', 'impact', currentFilter.impacts.length)}
        {activeSection === 'impact' && (
          <View style={styles.optionsRow}>
            {IMPACT_LEVELS.map((impact) => (
              <TouchableOpacity
                key={impact}
                style={[
                  styles.impactButton,
                  currentFilter.impacts.includes(impact) && {
                    backgroundColor: getImpactColor(impact),
                  },
                ]}
                onPress={() => toggleOption('impacts', impact)}
              >
                <Text
                  style={[
                    styles.impactText,
                    currentFilter.impacts.includes(impact) && styles.impactTextActive,
                  ]}
                >
                  {impact}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Status */}
        {renderSectionHeader('Status', 'status', currentFilter.statuses.length < 4 ? currentFilter.statuses.length : 0)}
        {activeSection === 'status' && (
          <View style={styles.optionsRow}>
            {STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusButton,
                  currentFilter.statuses.includes(status) && styles.statusButtonActive,
                ]}
                onPress={() => toggleOption('statuses', status)}
              >
                <Text
                  style={[
                    styles.statusText,
                    currentFilter.statuses.includes(status) && styles.statusTextActive,
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Date Range */}
        {renderSectionHeader(
          'Date Range',
          'date',
          currentFilter.dateRange.start || currentFilter.dateRange.end ? 1 : 0
        )}
        {activeSection === 'date' && (
          <View style={styles.dateSection}>
            <View style={styles.datePresetsRow}>
              {DATE_PRESETS.map((preset) => (
                <TouchableOpacity
                  key={preset.value}
                  style={styles.datePresetButton}
                  onPress={() => {
                    if (preset.value === 'custom') {
                      // Show custom date picker
                    } else {
                      const now = new Date();
                      let start: Date;
                      switch (preset.value) {
                        case 'today':
                          start = new Date(now.setHours(0, 0, 0, 0));
                          break;
                        case 'week':
                          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                          break;
                        case 'month':
                          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                          break;
                        case 'quarter':
                          start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                          break;
                        default:
                          start = now;
                      }
                      onFilterChange({
                        ...currentFilter,
                        dateRange: { start: start.toISOString() },
                      });
                    }
                  }}
                >
                  <Text style={styles.datePresetText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Confidence Range */}
        {renderSectionHeader(
          'Confidence',
          'confidence',
          currentFilter.confidenceRange.min !== undefined ||
            currentFilter.confidenceRange.max !== undefined
            ? 1
            : 0
        )}
        {activeSection === 'confidence' && (
          <View style={styles.confidenceSection}>
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Min:</Text>
              <View style={styles.confidenceButtons}>
                {[0, 25, 50, 75, 90].map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.confidenceButton,
                      currentFilter.confidenceRange.min === value / 100 &&
                        styles.confidenceButtonActive,
                    ]}
                    onPress={() =>
                      onFilterChange({
                        ...currentFilter,
                        confidenceRange: {
                          ...currentFilter.confidenceRange,
                          min: value / 100,
                        },
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.confidenceButtonText,
                        currentFilter.confidenceRange.min === value / 100 &&
                          styles.confidenceButtonTextActive,
                      ]}
                    >
                      {value}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Custom Query Builder */}
        {renderSectionHeader('Advanced Rules', 'advanced', currentFilter.customRules.length)}
        {activeSection === 'advanced' && (
          <View style={styles.advancedSection}>
            {currentFilter.customRules.map((rule, index) => (
              <View key={rule.id} style={styles.customRule}>
                {index > 0 && (
                  <TouchableOpacity
                    style={styles.conjunctionButton}
                    onPress={() =>
                      updateCustomRule(rule.id, {
                        conjunction: rule.conjunction === 'and' ? 'or' : 'and',
                      })
                    }
                  >
                    <Text style={styles.conjunctionText}>{rule.conjunction.toUpperCase()}</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.ruleRow}>
                  <TextInput
                    style={styles.ruleField}
                    value={rule.field}
                    onChangeText={(text) => updateCustomRule(rule.id, { field: text })}
                    placeholder="Field"
                    placeholderTextColor="#666666"
                  />
                  <TouchableOpacity style={styles.ruleOperator}>
                    <Text style={styles.ruleOperatorText}>
                      {OPERATORS.find((o) => o.value === rule.operator)?.label || rule.operator}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.ruleValue}
                    value={rule.value}
                    onChangeText={(text) => updateCustomRule(rule.id, { value: text })}
                    placeholder="Value"
                    placeholderTextColor="#666666"
                  />
                  <TouchableOpacity
                    style={styles.ruleDelete}
                    onPress={() => deleteCustomRule(rule.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addRuleButton} onPress={addCustomRule}>
              <Ionicons name="add" size={18} color={ORACLE_COLORS.observe} />
              <Text style={styles.addRuleText}>Add Rule</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Apply Button */}
      <View style={styles.footer}>
        <View style={styles.footerInfo}>
          <Text style={styles.footerText}>
            {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
          </Text>
        </View>
        <TouchableOpacity style={styles.applyButton} onPress={onClose}>
          <Text style={styles.applyButtonText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>

      {/* Presets Modal */}
      <Modal
        visible={showPresetModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPresetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Saved Presets</Text>
              <TouchableOpacity onPress={() => setShowPresetModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={presets}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.presetItem}
                  onPress={() => {
                    onPresetLoad(item);
                    setShowPresetModal(false);
                  }}
                >
                  <View style={styles.presetItemInfo}>
                    <Text style={styles.presetItemName}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.presetItemDescription}>{item.description}</Text>
                    )}
                    <Text style={styles.presetItemUsage}>Used {item.usageCount} times</Text>
                  </View>
                  <TouchableOpacity onPress={() => onPresetDelete(item.id)}>
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No saved presets</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Save Preset Modal */}
      <Modal
        visible={showSavePresetModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSavePresetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.savePresetModal}>
            <Text style={styles.savePresetTitle}>Save Filter Preset</Text>
            <TextInput
              style={styles.savePresetInput}
              placeholder="Preset name"
              placeholderTextColor="#666666"
              value={presetName}
              onChangeText={setPresetName}
            />
            <TextInput
              style={[styles.savePresetInput, styles.savePresetTextarea]}
              placeholder="Description (optional)"
              placeholderTextColor="#666666"
              value={presetDescription}
              onChangeText={setPresetDescription}
              multiline
            />
            <View style={styles.savePresetActions}>
              <TouchableOpacity
                style={styles.savePresetCancel}
                onPress={() => setShowSavePresetModal(false)}
              >
                <Text style={styles.savePresetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.savePresetSave} onPress={handleSavePreset}>
                <Text style={styles.savePresetSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  closeButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerActions: {},
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonText: {
    fontSize: 13,
    color: ORACLE_COLORS.decide,
  },
  scrollView: {
    flex: 1,
  },
  nlSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  nlLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 8,
  },
  nlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  nlInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  nlParsedContainer: {
    marginTop: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
  },
  nlParsedLabel: {
    fontSize: 11,
    color: '#888888',
    marginBottom: 4,
  },
  nlParsedText: {
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  nlConfidence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nlConfidenceLabel: {
    fontSize: 11,
    color: '#666666',
  },
  nlConfidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
  },
  nlConfidenceFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 2,
  },
  nlConfidenceValue: {
    fontSize: 11,
    color: '#FFFFFF',
    width: 35,
    textAlign: 'right',
  },
  presetsSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  presetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  presetsTitle: {
    fontSize: 12,
    color: '#888888',
  },
  presetsActions: {
    flexDirection: 'row',
    gap: 12,
  },
  presetActionButton: {
    padding: 4,
  },
  presetChip: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  presetChipText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  presetChipMore: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  presetChipMoreText: {
    fontSize: 13,
    color: ORACLE_COLORS.observe,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionBadge: {
    backgroundColor: ORACLE_COLORS.observe,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    gap: 6,
  },
  optionButtonActive: {
    backgroundColor: ORACLE_COLORS.observe,
    borderColor: ORACLE_COLORS.observe,
  },
  optionText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  optionTextActive: {
    color: '#000000',
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  urgencyButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  urgencyText: {
    fontSize: 12,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  urgencyTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  impactButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  impactText: {
    fontSize: 12,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  impactTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  statusButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  statusButtonActive: {
    backgroundColor: ORACLE_COLORS.observe,
    borderColor: ORACLE_COLORS.observe,
  },
  statusText: {
    fontSize: 11,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  statusTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  dateSection: {
    padding: 12,
  },
  datePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  datePresetButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
  },
  datePresetText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  confidenceSection: {
    padding: 12,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confidenceLabel: {
    fontSize: 13,
    color: '#888888',
    width: 40,
  },
  confidenceButtons: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  confidenceButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
  },
  confidenceButtonActive: {
    backgroundColor: ORACLE_COLORS.observe,
  },
  confidenceButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  confidenceButtonTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  advancedSection: {
    padding: 12,
  },
  customRule: {
    marginBottom: 12,
  },
  conjunctionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#333333',
    borderRadius: 4,
    marginBottom: 8,
  },
  conjunctionText: {
    fontSize: 11,
    color: ORACLE_COLORS.observe,
    fontWeight: 'bold',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleField: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#FFFFFF',
  },
  ruleOperator: {
    backgroundColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ruleOperatorText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  ruleValue: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#FFFFFF',
  },
  ruleDelete: {
    padding: 8,
  },
  addRuleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    borderStyle: 'dashed',
  },
  addRuleText: {
    fontSize: 13,
    color: ORACLE_COLORS.observe,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#222222',
  },
  footerInfo: {
    flex: 1,
  },
  footerText: {
    fontSize: 13,
    color: '#888888',
  },
  applyButton: {
    backgroundColor: ORACLE_COLORS.observe,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
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
    maxHeight: '70%',
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
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  presetItemInfo: {
    flex: 1,
  },
  presetItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  presetItemDescription: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  presetItemUsage: {
    fontSize: 11,
    color: '#666666',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666666',
    padding: 32,
  },
  savePresetModal: {
    backgroundColor: '#1A1A1A',
    margin: 32,
    borderRadius: 16,
    padding: 20,
  },
  savePresetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  savePresetInput: {
    backgroundColor: '#333333',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  savePresetTextarea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  savePresetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  savePresetCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#666666',
    alignItems: 'center',
  },
  savePresetCancelText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  savePresetSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: ORACLE_COLORS.observe,
    alignItems: 'center',
  },
  savePresetSaveText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
});

export default SignalFilters;
