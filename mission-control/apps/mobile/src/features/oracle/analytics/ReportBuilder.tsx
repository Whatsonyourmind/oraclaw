/**
 * ORACLE Report Builder
 * UI for creating custom reports with templates, metric selection, and export
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Types
interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  preview?: string;
}

interface Metric {
  id: string;
  name: string;
  category: string;
  description: string;
  selected: boolean;
}

interface DateRangePreset {
  id: string;
  label: string;
  value: string;
}

interface ExportFormat {
  id: string;
  label: string;
  icon: string;
  description: string;
}

interface ReportConfig {
  templateId: string;
  name: string;
  dateRange: {
    preset: string;
    start?: Date;
    end?: Date;
  };
  metrics: string[];
  format: string;
  includeCharts: boolean;
  includeInsights: boolean;
  includeRecommendations: boolean;
}

interface ReportBuilderProps {
  templates: ReportTemplate[];
  availableMetrics: Metric[];
  onGenerateReport: (config: ReportConfig) => Promise<void>;
  onPreviewReport: (config: ReportConfig) => void;
  onScheduleReport?: (config: ReportConfig) => void;
  loading?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DATE_RANGE_PRESETS: DateRangePreset[] = [
  { id: 'today', label: 'Today', value: 'today' },
  { id: 'yesterday', label: 'Yesterday', value: 'yesterday' },
  { id: 'this_week', label: 'This Week', value: 'this_week' },
  { id: 'last_week', label: 'Last Week', value: 'last_week' },
  { id: 'this_month', label: 'This Month', value: 'this_month' },
  { id: 'last_month', label: 'Last Month', value: 'last_month' },
  { id: 'last_7_days', label: 'Last 7 Days', value: 'last_7_days' },
  { id: 'last_30_days', label: 'Last 30 Days', value: 'last_30_days' },
  { id: 'last_90_days', label: 'Last 90 Days', value: 'last_90_days' },
  { id: 'custom', label: 'Custom Range', value: 'custom' },
];

const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'pdf', label: 'PDF', icon: 'PDF', description: 'Best for printing and sharing' },
  { id: 'csv', label: 'CSV', icon: 'CSV', description: 'Best for data analysis' },
  { id: 'json', label: 'JSON', icon: 'JSON', description: 'Best for integrations' },
  { id: 'html', label: 'HTML', icon: 'HTML', description: 'Best for web viewing' },
];

// Template Card Component
const TemplateCard: React.FC<{
  template: ReportTemplate;
  selected: boolean;
  onSelect: () => void;
}> = ({ template, selected, onSelect }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    onSelect();
  };

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
      <Animated.View
        style={[
          styles.templateCard,
          selected && styles.templateCardSelected,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.templateIcon}>
          <Text style={styles.templateIconText}>{template.icon}</Text>
        </View>
        <Text style={styles.templateName}>{template.name}</Text>
        <Text style={styles.templateDescription} numberOfLines={2}>
          {template.description}
        </Text>
        {selected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Metric Selector Item
const MetricItem: React.FC<{
  metric: Metric;
  onToggle: () => void;
}> = ({ metric, onToggle }) => {
  return (
    <TouchableOpacity
      style={[styles.metricItem, metric.selected && styles.metricItemSelected]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      activeOpacity={0.7}
    >
      <View style={styles.metricInfo}>
        <Text style={styles.metricName}>{metric.name}</Text>
        <Text style={styles.metricCategory}>{metric.category}</Text>
      </View>
      <View
        style={[
          styles.metricCheckbox,
          metric.selected && styles.metricCheckboxSelected,
        ]}
      >
        {metric.selected && <Text style={styles.metricCheckmark}>Check</Text>}
      </View>
    </TouchableOpacity>
  );
};

// Date Range Selector
const DateRangeSelector: React.FC<{
  selectedPreset: string;
  onSelectPreset: (preset: string) => void;
  customStart?: Date;
  customEnd?: Date;
  onCustomDateChange?: (start: Date, end: Date) => void;
}> = ({ selectedPreset, onSelectPreset }) => {
  return (
    <View style={styles.dateRangeContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateRangeScroll}
      >
        {DATE_RANGE_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.id}
            style={[
              styles.dateRangeChip,
              selectedPreset === preset.id && styles.dateRangeChipSelected,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelectPreset(preset.id);
            }}
          >
            <Text
              style={[
                styles.dateRangeChipText,
                selectedPreset === preset.id && styles.dateRangeChipTextSelected,
              ]}
            >
              {preset.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Export Format Selector
const FormatSelector: React.FC<{
  selectedFormat: string;
  onSelectFormat: (format: string) => void;
}> = ({ selectedFormat, onSelectFormat }) => {
  return (
    <View style={styles.formatContainer}>
      {EXPORT_FORMATS.map((format) => (
        <TouchableOpacity
          key={format.id}
          style={[
            styles.formatCard,
            selectedFormat === format.id && styles.formatCardSelected,
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelectFormat(format.id);
          }}
        >
          <Text style={styles.formatIcon}>{format.icon}</Text>
          <Text
            style={[
              styles.formatLabel,
              selectedFormat === format.id && styles.formatLabelSelected,
            ]}
          >
            {format.label}
          </Text>
          <Text style={styles.formatDescription}>{format.description}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Preview Modal
const PreviewModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  config: ReportConfig;
  template?: ReportTemplate;
}> = ({ visible, onClose, config, template }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Report Preview</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.previewContent}>
          {/* Report Header */}
          <View style={styles.previewHeader}>
            <Text style={styles.previewReportName}>{config.name || 'Untitled Report'}</Text>
            <Text style={styles.previewTemplateName}>
              Template: {template?.name || 'Custom'}
            </Text>
            <Text style={styles.previewDateRange}>
              Period: {DATE_RANGE_PRESETS.find(p => p.id === config.dateRange.preset)?.label}
            </Text>
          </View>

          {/* Metrics Preview */}
          <View style={styles.previewSection}>
            <Text style={styles.previewSectionTitle}>
              Selected Metrics ({config.metrics.length})
            </Text>
            <View style={styles.previewMetrics}>
              {config.metrics.map((metricId) => (
                <View key={metricId} style={styles.previewMetricChip}>
                  <Text style={styles.previewMetricText}>{metricId}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Options Preview */}
          <View style={styles.previewSection}>
            <Text style={styles.previewSectionTitle}>Report Options</Text>
            <View style={styles.previewOptions}>
              <Text style={styles.previewOptionItem}>
                Include Charts: {config.includeCharts ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.previewOptionItem}>
                Include Insights: {config.includeInsights ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.previewOptionItem}>
                Include Recommendations: {config.includeRecommendations ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.previewOptionItem}>
                Export Format: {config.format.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Sample Preview */}
          <View style={styles.previewSection}>
            <Text style={styles.previewSectionTitle}>Preview</Text>
            <View style={styles.samplePreview}>
              <View style={styles.sampleChart}>
                <Text style={styles.sampleChartText}>Chart Preview</Text>
              </View>
              <View style={styles.sampleStats}>
                <View style={styles.sampleStatItem}>
                  <Text style={styles.sampleStatValue}>--</Text>
                  <Text style={styles.sampleStatLabel}>Tasks</Text>
                </View>
                <View style={styles.sampleStatItem}>
                  <Text style={styles.sampleStatValue}>--</Text>
                  <Text style={styles.sampleStatLabel}>Focus Hours</Text>
                </View>
                <View style={styles.sampleStatItem}>
                  <Text style={styles.sampleStatValue}>--</Text>
                  <Text style={styles.sampleStatLabel}>Score</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

// Main Component
export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  templates,
  availableMetrics,
  onGenerateReport,
  onPreviewReport,
  onScheduleReport,
  loading = false,
}) => {
  const [step, setStep] = useState<'template' | 'configure' | 'preview'>('template');
  const [config, setConfig] = useState<ReportConfig>({
    templateId: '',
    name: '',
    dateRange: { preset: 'last_week' },
    metrics: [],
    format: 'pdf',
    includeCharts: true,
    includeInsights: true,
    includeRecommendations: true,
  });
  const [metrics, setMetrics] = useState<Metric[]>(availableMetrics);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  const selectedTemplate = templates.find(t => t.id === config.templateId);

  const handleTemplateSelect = (templateId: string) => {
    setConfig(prev => ({ ...prev, templateId }));
    // Auto-select default metrics for template
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setConfig(prev => ({
        ...prev,
        name: `${template.name} - ${new Date().toLocaleDateString()}`,
      }));
    }
  };

  const handleMetricToggle = (metricId: string) => {
    setMetrics(prev =>
      prev.map(m =>
        m.id === metricId ? { ...m, selected: !m.selected } : m
      )
    );
    setConfig(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metricId)
        ? prev.metrics.filter(id => id !== metricId)
        : [...prev.metrics, metricId],
    }));
  };

  const handleSelectAllMetrics = () => {
    const allSelected = metrics.every(m => m.selected);
    setMetrics(prev => prev.map(m => ({ ...m, selected: !allSelected })));
    setConfig(prev => ({
      ...prev,
      metrics: allSelected ? [] : metrics.map(m => m.id),
    }));
  };

  const handleGenerate = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGenerating(true);
    try {
      await onGenerateReport(config);
    } finally {
      setGenerating(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'template':
        return config.templateId !== '';
      case 'configure':
        return config.metrics.length > 0 && config.name.trim() !== '';
      default:
        return true;
    }
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step === 'template') setStep('configure');
    else if (step === 'configure') setStep('preview');
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 'configure') setStep('template');
    else if (step === 'preview') setStep('configure');
  };

  return (
    <View style={styles.container}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressSteps}>
          {['Template', 'Configure', 'Generate'].map((label, index) => {
            const stepNames = ['template', 'configure', 'preview'];
            const currentIndex = stepNames.indexOf(step);
            const isActive = index <= currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <React.Fragment key={label}>
                <View style={styles.progressStep}>
                  <View
                    style={[
                      styles.progressDot,
                      isActive && styles.progressDotActive,
                      isCurrent && styles.progressDotCurrent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.progressDotText,
                        isActive && styles.progressDotTextActive,
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.progressLabel,
                      isActive && styles.progressLabelActive,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
                {index < 2 && (
                  <View
                    style={[
                      styles.progressLine,
                      isActive && styles.progressLineActive,
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>

      {/* Step Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Template Selection */}
        {step === 'template' && (
          <View>
            <Text style={styles.stepTitle}>Choose a Template</Text>
            <Text style={styles.stepDescription}>
              Select a report template to get started
            </Text>
            <View style={styles.templatesGrid}>
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  selected={config.templateId === template.id}
                  onSelect={() => handleTemplateSelect(template.id)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Configuration */}
        {step === 'configure' && (
          <View>
            {/* Report Name */}
            <Text style={styles.stepTitle}>Configure Your Report</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Report Name</Text>
              <TextInput
                style={styles.textInput}
                value={config.name}
                onChangeText={(text) => setConfig(prev => ({ ...prev, name: text }))}
                placeholder="Enter report name"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Date Range */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Date Range</Text>
              <DateRangeSelector
                selectedPreset={config.dateRange.preset}
                onSelectPreset={(preset) =>
                  setConfig(prev => ({ ...prev, dateRange: { preset } }))
                }
              />
            </View>

            {/* Metrics */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldLabel}>Metrics</Text>
                <TouchableOpacity onPress={handleSelectAllMetrics}>
                  <Text style={styles.selectAllText}>
                    {metrics.every(m => m.selected) ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.metricsContainer}>
                {metrics.map((metric) => (
                  <MetricItem
                    key={metric.id}
                    metric={metric}
                    onToggle={() => handleMetricToggle(metric.id)}
                  />
                ))}
              </View>
            </View>

            {/* Options */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Options</Text>
              <View style={styles.optionsContainer}>
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Include Charts</Text>
                  <Switch
                    value={config.includeCharts}
                    onValueChange={(value) =>
                      setConfig(prev => ({ ...prev, includeCharts: value }))
                    }
                    trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
                    thumbColor={config.includeCharts ? '#4F46E5' : '#F3F4F6'}
                  />
                </View>
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Include Insights</Text>
                  <Switch
                    value={config.includeInsights}
                    onValueChange={(value) =>
                      setConfig(prev => ({ ...prev, includeInsights: value }))
                    }
                    trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
                    thumbColor={config.includeInsights ? '#4F46E5' : '#F3F4F6'}
                  />
                </View>
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Include Recommendations</Text>
                  <Switch
                    value={config.includeRecommendations}
                    onValueChange={(value) =>
                      setConfig(prev => ({ ...prev, includeRecommendations: value }))
                    }
                    trackColor={{ false: '#D1D5DB', true: '#818CF8' }}
                    thumbColor={config.includeRecommendations ? '#4F46E5' : '#F3F4F6'}
                  />
                </View>
              </View>
            </View>

            {/* Export Format */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Export Format</Text>
              <FormatSelector
                selectedFormat={config.format}
                onSelectFormat={(format) =>
                  setConfig(prev => ({ ...prev, format }))
                }
              />
            </View>
          </View>
        )}

        {/* Step 3: Preview & Generate */}
        {step === 'preview' && (
          <View>
            <Text style={styles.stepTitle}>Review & Generate</Text>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{config.name}</Text>
              <Text style={styles.summarySubtitle}>
                {selectedTemplate?.name} | {config.metrics.length} metrics
              </Text>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Date Range:</Text>
                <Text style={styles.summaryValue}>
                  {DATE_RANGE_PRESETS.find(p => p.id === config.dateRange.preset)?.label}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Format:</Text>
                <Text style={styles.summaryValue}>{config.format.toUpperCase()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Charts:</Text>
                <Text style={styles.summaryValue}>
                  {config.includeCharts ? 'Included' : 'Not included'}
                </Text>
              </View>
            </View>

            {/* Preview Button */}
            <TouchableOpacity
              style={styles.previewButton}
              onPress={() => setShowPreview(true)}
            >
              <Text style={styles.previewButtonText}>Preview Report</Text>
            </TouchableOpacity>

            {/* Schedule Option */}
            {onScheduleReport && (
              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onScheduleReport(config);
                }}
              >
                <Text style={styles.scheduleButtonText}>Schedule This Report</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {step !== 'template' && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        {step !== 'preview' ? (
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.generateButton, generating && styles.generateButtonLoading]}
            onPress={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.generateButtonText}>Generate Report</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Preview Modal */}
      <PreviewModal
        visible={showPreview}
        onClose={() => setShowPreview(false)}
        config={config}
        template={selectedTemplate}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressDotActive: {
    backgroundColor: '#4F46E5',
  },
  progressDotCurrent: {
    borderWidth: 3,
    borderColor: '#818CF8',
  },
  progressDotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  progressDotTextActive: {
    color: '#FFFFFF',
  },
  progressLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  progressLabelActive: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
    marginBottom: 20,
  },
  progressLineActive: {
    backgroundColor: '#4F46E5',
  },

  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 100,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },

  // Templates
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  templateCard: {
    width: (SCREEN_WIDTH - 64) / 2,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  templateCardSelected: {
    borderColor: '#4F46E5',
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  templateIconText: {
    fontSize: 24,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#4F46E5',
    borderRadius: 6,
  },
  selectedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Fields
  fieldGroup: {
    marginBottom: 24,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  selectAllText: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
  },

  // Date Range
  dateRangeContainer: {
    marginHorizontal: -24,
  },
  dateRangeScroll: {
    paddingHorizontal: 24,
    gap: 8,
  },
  dateRangeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateRangeChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  dateRangeChipText: {
    fontSize: 14,
    color: '#374151',
  },
  dateRangeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Metrics
  metricsContainer: {
    gap: 8,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metricItemSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  metricInfo: {
    flex: 1,
  },
  metricName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  metricCategory: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  metricCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricCheckboxSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  metricCheckmark: {
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Options
  optionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  optionLabel: {
    fontSize: 15,
    color: '#374151',
  },

  // Format
  formatContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  formatCard: {
    flex: 1,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  formatCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  formatIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  formatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  formatLabelSelected: {
    color: '#4F46E5',
  },
  formatDescription: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Summary
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  previewButton: {
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4F46E5',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
  scheduleButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  scheduleButtonText: {
    fontSize: 14,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },

  // Bottom Actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 24,
    paddingBottom: 34,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  nextButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  generateButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    alignItems: 'center',
  },
  generateButtonLoading: {
    backgroundColor: '#86EFAC',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  previewContent: {
    flex: 1,
    padding: 24,
  },
  previewHeader: {
    marginBottom: 24,
  },
  previewReportName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  previewTemplateName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  previewDateRange: {
    fontSize: 14,
    color: '#6B7280',
  },
  previewSection: {
    marginBottom: 24,
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  previewMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewMetricChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
  },
  previewMetricText: {
    fontSize: 12,
    color: '#374151',
  },
  previewOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  previewOptionItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  samplePreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  sampleChart: {
    height: 120,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sampleChartText: {
    color: '#9CA3AF',
  },
  sampleStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  sampleStatItem: {
    alignItems: 'center',
  },
  sampleStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  sampleStatLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
});

export default ReportBuilder;
