/**
 * ORACLE Export Center Screen
 * Story adv-29 - Data export interface
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ORACLE_COLORS } from '../theme';

// Types
type ExportType = 'decisions' | 'predictions' | 'analytics' | 'journal' | 'signals' | 'scenarios' | 'all';
type ExportFormat = 'json' | 'csv' | 'pdf';

interface ExportTypeOption {
  type: ExportType;
  label: string;
  description: string;
  icon: string;
  recordCount: number;
}

interface ExportFormatOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: string;
}

// Mock data for export types
const EXPORT_TYPES: ExportTypeOption[] = [
  { type: 'decisions', label: 'Decisions', description: 'All ORACLE decisions with options and outcomes', icon: '⚖️', recordCount: 15 },
  { type: 'predictions', label: 'Predictions', description: 'Prediction history with accuracy tracking', icon: '🎯', recordCount: 42 },
  { type: 'analytics', label: 'Analytics', description: 'Usage metrics and performance data', icon: '📊', recordCount: 1 },
  { type: 'journal', label: 'Journal', description: 'Decision journal entries and reflections', icon: '📓', recordCount: 8 },
  { type: 'signals', label: 'Signals', description: 'Detected signals and their status', icon: '📡', recordCount: 23 },
  { type: 'scenarios', label: 'Scenarios', description: 'What-if scenarios and analysis', icon: '🔮', recordCount: 5 },
  { type: 'all', label: 'Complete Export', description: 'All ORACLE data in one export', icon: '📦', recordCount: 94 },
];

const EXPORT_FORMATS: ExportFormatOption[] = [
  { format: 'json', label: 'JSON', description: 'Structured data, best for backups', icon: '{ }' },
  { format: 'csv', label: 'CSV', description: 'Spreadsheet compatible', icon: '📋' },
  { format: 'pdf', label: 'PDF Report', description: 'Formatted for sharing', icon: '📄' },
];

const API_BASE = 'http://localhost:3001';

export default function ExportCenter() {
  const [selectedType, setSelectedType] = useState<ExportType | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [useDateRange, setUseDateRange] = useState(false);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [anonymize, setAnonymize] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [exportResult, setExportResult] = useState<{
    filename: string;
    size: number;
    record_count: number;
  } | null>(null);

  const estimateExport = useCallback(async () => {
    if (!selectedType) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/oracle/export/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          format: selectedFormat,
          date_range: useDateRange ? {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          } : undefined,
        }),
      });

      const result = await response.json();
      if (result.success) {
        return result.data;
      }
    } catch (error) {
      console.error('Estimate error:', error);
    } finally {
      setIsLoading(false);
    }
    return null;
  }, [selectedType, selectedFormat, useDateRange, startDate, endDate]);

  const generatePreview = useCallback(async () => {
    if (!selectedType) {
      Alert.alert('Select Type', 'Please select an export type first');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/oracle/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          format: selectedFormat,
          date_range: useDateRange ? {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          } : undefined,
          anonymize,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setExportResult({
          filename: result.data.filename,
          size: result.data.size,
          record_count: result.data.record_count,
        });
        setPreviewContent(result.data.preview || 'Preview not available for large exports');
        setShowPreview(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to generate preview');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, selectedFormat, useDateRange, startDate, endDate, anonymize]);

  const performExport = useCallback(async () => {
    if (!selectedType) {
      Alert.alert('Select Type', 'Please select an export type first');
      return;
    }

    setIsLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      params.append('format', selectedFormat);
      if (useDateRange) {
        params.append('start_date', startDate.toISOString());
        params.append('end_date', endDate.toISOString());
      }
      if (anonymize) {
        params.append('anonymize', 'true');
      }

      const response = await fetch(`${API_BASE}/api/oracle/export/${selectedType}?${params}`, {
        method: 'GET',
      });

      if (response.ok) {
        const content = await response.text();
        const filename = response.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') ||
          `oracle_${selectedType}_export.${selectedFormat}`;

        // Share the exported content
        await Share.share({
          message: content,
          title: filename,
        });

        Alert.alert('Success', `Export ready: ${filename}`);
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Export failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, selectedFormat, useDateRange, startDate, endDate, anonymize]);

  const renderTypeCard = (option: ExportTypeOption) => {
    const isSelected = selectedType === option.type;

    return (
      <TouchableOpacity
        key={option.type}
        style={[styles.typeCard, isSelected && styles.typeCardSelected]}
        onPress={() => setSelectedType(option.type)}
      >
        <View style={styles.typeCardHeader}>
          <Text style={styles.typeIcon}>{option.icon}</Text>
          <View style={styles.typeInfo}>
            <Text style={styles.typeLabel}>{option.label}</Text>
            <Text style={styles.typeDescription}>{option.description}</Text>
          </View>
          {isSelected && (
            <View style={styles.checkmark}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
        </View>
        <Text style={styles.recordCount}>{option.recordCount} records</Text>
      </TouchableOpacity>
    );
  };

  const renderFormatOption = (option: ExportFormatOption) => {
    const isSelected = selectedFormat === option.format;

    return (
      <TouchableOpacity
        key={option.format}
        style={[styles.formatOption, isSelected && styles.formatOptionSelected]}
        onPress={() => setSelectedFormat(option.format)}
      >
        <Text style={styles.formatIcon}>{option.icon}</Text>
        <Text style={[styles.formatLabel, isSelected && styles.formatLabelSelected]}>
          {option.label}
        </Text>
        <Text style={styles.formatDesc}>{option.description}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Export Center</Text>
          <Text style={styles.subtitle}>Export your ORACLE data securely</Text>
        </View>

        {/* Export Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What to Export</Text>
          {EXPORT_TYPES.map(renderTypeCard)}
        </View>

        {/* Format Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Format</Text>
          <View style={styles.formatContainer}>
            {EXPORT_FORMATS.map(renderFormatOption)}
          </View>
        </View>

        {/* Date Range */}
        <View style={styles.section}>
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>Filter by Date Range</Text>
              <Text style={styles.optionDescription}>Only export data within a specific period</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, useDateRange && styles.toggleActive]}
              onPress={() => setUseDateRange(!useDateRange)}
            >
              <View style={[styles.toggleThumb, useDateRange && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>

          {useDateRange && (
            <View style={styles.dateRangeContainer}>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={styles.dateLabel}>From</Text>
                <Text style={styles.dateValue}>{startDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
              <Text style={styles.dateArrow}>→</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={styles.dateLabel}>To</Text>
                <Text style={styles.dateValue}>{endDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>
          )}

          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              onChange={(event, date) => {
                setShowStartPicker(false);
                if (date) setStartDate(date);
              }}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              onChange={(event, date) => {
                setShowEndPicker(false);
                if (date) setEndDate(date);
              }}
            />
          )}
        </View>

        {/* Privacy Options */}
        <View style={styles.section}>
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Text style={styles.optionLabel}>Anonymize Data</Text>
              <Text style={styles.optionDescription}>Remove or hash personal identifiers</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, anonymize && styles.toggleActive]}
              onPress={() => setAnonymize(!anonymize)}
            >
              <View style={[styles.toggleThumb, anonymize && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={generatePreview}
            disabled={!selectedType || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={ORACLE_COLORS.observe} />
            ) : (
              <Text style={styles.previewButtonText}>Preview</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportButton, (!selectedType || isLoading) && styles.exportButtonDisabled]}
            onPress={performExport}
            disabled={!selectedType || isLoading}
          >
            <Text style={styles.exportButtonText}>Export & Share</Text>
          </TouchableOpacity>
        </View>

        {/* Export Summary */}
        {selectedType && (
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Export Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type:</Text>
              <Text style={styles.summaryValue}>
                {EXPORT_TYPES.find(t => t.type === selectedType)?.label}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Format:</Text>
              <Text style={styles.summaryValue}>
                {EXPORT_FORMATS.find(f => f.format === selectedFormat)?.label}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date Range:</Text>
              <Text style={styles.summaryValue}>
                {useDateRange ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}` : 'All time'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Privacy:</Text>
              <Text style={styles.summaryValue}>
                {anonymize ? 'Anonymized' : 'Full data'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Preview Modal */}
      <Modal visible={showPreview} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export Preview</Text>
              <TouchableOpacity onPress={() => setShowPreview(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            {exportResult && (
              <View style={styles.previewMeta}>
                <Text style={styles.previewFilename}>{exportResult.filename}</Text>
                <Text style={styles.previewStats}>
                  {exportResult.record_count} records • {(exportResult.size / 1024).toFixed(1)} KB
                </Text>
              </View>
            )}

            <ScrollView style={styles.previewScroll}>
              <Text style={styles.previewText}>{previewContent}</Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowPreview(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalExportButton}
                onPress={() => {
                  setShowPreview(false);
                  performExport();
                }}
              >
                <Text style={styles.modalExportText}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    color: '#888',
    marginTop: 4,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  typeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardSelected: {
    borderColor: ORACLE_COLORS.observe,
  },
  typeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  typeInfo: {
    flex: 1,
  },
  typeLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  typeDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ORACLE_COLORS.observe,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#000',
    fontWeight: 'bold',
  },
  recordCount: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  formatContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  formatOption: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  formatOptionSelected: {
    borderColor: ORACLE_COLORS.observe,
  },
  formatIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  formatLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  formatLabelSelected: {
    color: ORACLE_COLORS.observe,
  },
  formatDesc: {
    color: '#666',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  optionInfo: {
    flex: 1,
    marginRight: 16,
  },
  optionLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  optionDescription: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: ORACLE_COLORS.observe,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#666',
  },
  toggleThumbActive: {
    backgroundColor: '#fff',
    marginLeft: 22,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  dateButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
  },
  dateLabel: {
    color: '#888',
    fontSize: 11,
    marginBottom: 4,
  },
  dateValue: {
    color: '#fff',
    fontSize: 14,
  },
  dateArrow: {
    color: '#666',
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  previewButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ORACLE_COLORS.observe,
  },
  previewButtonText: {
    color: ORACLE_COLORS.observe,
    fontSize: 16,
    fontWeight: '600',
  },
  exportButton: {
    flex: 2,
    backgroundColor: ORACLE_COLORS.observe,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  exportButtonDisabled: {
    backgroundColor: '#333',
  },
  exportButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  summary: {
    margin: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    color: '#888',
    fontSize: 13,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
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
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    color: '#888',
    fontSize: 28,
    lineHeight: 28,
  },
  previewMeta: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  previewFilename: {
    color: ORACLE_COLORS.observe,
    fontSize: 14,
    fontWeight: '600',
  },
  previewStats: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  previewScroll: {
    maxHeight: 300,
    padding: 16,
  },
  previewText: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  modalExportButton: {
    flex: 2,
    backgroundColor: ORACLE_COLORS.observe,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalExportText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
