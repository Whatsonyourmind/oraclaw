/**
 * Prompt Template Editor
 * Story ai-tune-3 - UI for editing AI prompts
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  PromptTemplate,
  PromptOperationType,
  TemplateVariable,
} from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../theme';

// Operation type labels
const OPERATION_LABELS: Record<PromptOperationType, string> = {
  radar_scan: 'Radar Scan',
  signal_analysis: 'Signal Analysis',
  context_synthesis: 'Context Synthesis',
  decision_analysis: 'Decision Analysis',
  option_evaluation: 'Option Evaluation',
  simulation: 'Simulation',
  plan_generation: 'Plan Generation',
  step_suggestion: 'Step Suggestion',
  prediction: 'Prediction',
  learning_extraction: 'Learning Extraction',
  summary: 'Summary',
  custom: 'Custom',
};

// Mock template data
const mockTemplate: PromptTemplate = {
  id: '1',
  user_id: 'user-1',
  name: 'Custom Signal Analysis',
  description: 'Analyze signals with extra focus on risk factors',
  operation_type: 'signal_analysis',
  template_content: `Analyze the following signal detected in the user's context:

Signal: {{signal_title}}
Description: {{signal_description}}
Source: {{source_type}}
Related Context: {{context}}

Provide:
1. Urgency assessment (critical/high/medium/low)
2. Impact assessment (critical/high/medium/low)
3. Risk factors specific to this signal type
4. Recommended immediate actions
5. Related signals or patterns to watch`,
  variables: [
    { name: 'signal_title', required: true, description: 'Title of the detected signal' },
    { name: 'signal_description', required: true, description: 'Detailed description' },
    { name: 'source_type', required: true, description: 'Data source type' },
    { name: 'context', required: false, description: 'Additional context', default_value: 'No additional context provided' },
  ],
  output_format: 'structured',
  version: 2,
  is_latest: true,
  is_default: false,
  is_public: false,
  is_system: false,
  usage_count: 45,
  avg_rating: 4.2,
  rating_count: 12,
  is_active: true,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Variable highlighting for template content
function highlightVariables(text: string): React.ReactNode[] {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, index) => {
    if (part.match(/^\{\{[^}]+\}\}$/)) {
      return (
        <Text key={index} style={styles.variableHighlight}>
          {part}
        </Text>
      );
    }
    return <Text key={index}>{part}</Text>;
  });
}

interface VariableEditorProps {
  variable: TemplateVariable;
  value: string;
  onChange: (value: string) => void;
}

function VariableEditor({ variable, value, onChange }: VariableEditorProps) {
  return (
    <View style={styles.variableEditor}>
      <View style={styles.variableHeader}>
        <Text style={styles.variableName}>
          {variable.name}
          {variable.required && <Text style={styles.requiredStar}> *</Text>}
        </Text>
        {variable.description && (
          <Text style={styles.variableDesc}>{variable.description}</Text>
        )}
      </View>
      <TextInput
        style={styles.variableInput}
        value={value}
        onChangeText={onChange}
        placeholder={variable.default_value || `Enter ${variable.name}`}
        placeholderTextColor="#666"
        multiline
      />
    </View>
  );
}

interface PreviewModalProps {
  visible: boolean;
  onClose: () => void;
  template: string;
  variables: Record<string, string>;
}

function PreviewModal({ visible, onClose, template, variables }: PreviewModalProps) {
  const renderedTemplate = useMemo(() => {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `[${key}]`);
    });
    return result;
  }, [template, variables]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Preview</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.previewScroll}>
            <Text style={styles.previewText}>{renderedTemplate}</Text>
          </ScrollView>
          <View style={styles.previewStats}>
            <Text style={styles.previewStatLabel}>
              Estimated tokens: {Math.ceil(renderedTemplate.length / 4)}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface Props {
  navigation: any;
  route: {
    params?: {
      template?: PromptTemplate;
      operation_type?: PromptOperationType;
    };
  };
}

export function PromptTemplateEditor({ navigation, route }: Props) {
  const existingTemplate = route.params?.template || mockTemplate;
  const operationType = route.params?.operation_type || existingTemplate?.operation_type || 'custom';

  const [refreshing, setRefreshing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Editor state
  const [name, setName] = useState(existingTemplate?.name || '');
  const [description, setDescription] = useState(existingTemplate?.description || '');
  const [templateContent, setTemplateContent] = useState(existingTemplate?.template_content || '');
  const [variables, setVariables] = useState<TemplateVariable[]>(existingTemplate?.variables || []);
  const [isPublic, setIsPublic] = useState(existingTemplate?.is_public || false);

  // Preview variables
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const updateField = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (value: T) => {
      setter(value);
      setHasChanges(true);
    };
  };

  const extractVariables = useCallback(() => {
    const matches = templateContent.match(/\{\{([^}]+)\}\}/g) || [];
    const varNames = [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];

    const newVars: TemplateVariable[] = varNames.map(name => {
      const existing = variables.find(v => v.name === name);
      return existing || { name, required: false };
    });

    setVariables(newVars);
    setHasChanges(true);
  }, [templateContent, variables]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Template name is required');
      return;
    }
    if (!templateContent.trim()) {
      Alert.alert('Error', 'Template content is required');
      return;
    }

    // In production, call API
    Alert.alert('Success', 'Template saved', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const handleResetToDefault = () => {
    Alert.alert(
      'Reset to Default',
      'This will reset the template to the system default. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            // In production, load default template
            Alert.alert('Reset', 'Template reset to default');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Prompt Template</Text>
          <Text style={styles.subtitle}>{OPERATION_LABELS[operationType]}</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges}
        >
          <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ORACLE_COLORS.observe}
          />
        }
      >
        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={updateField(setName)}
              placeholder="Template name"
              placeholderTextColor="#666"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={updateField(setDescription)}
              placeholder="Describe what this template does"
              placeholderTextColor="#666"
              multiline
              numberOfLines={2}
            />
          </View>
        </View>

        {/* Template Content */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Template Content</Text>
            <TouchableOpacity style={styles.extractButton} onPress={extractVariables}>
              <Ionicons name="code-slash" size={16} color={ORACLE_COLORS.observe} />
              <Text style={styles.extractButtonText}>Extract Variables</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editorContainer}>
            <TextInput
              style={styles.templateEditor}
              value={templateContent}
              onChangeText={updateField(setTemplateContent)}
              placeholder="Enter your prompt template..."
              placeholderTextColor="#666"
              multiline
              textAlignVertical="top"
            />
            <View style={styles.editorFooter}>
              <Text style={styles.editorHint}>
                Use {'{{variable_name}}'} for dynamic values
              </Text>
            </View>
          </View>
        </View>

        {/* Variables */}
        {variables.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Variables ({variables.length})</Text>
            <View style={styles.variablesCard}>
              {variables.map((variable, index) => (
                <View key={variable.name} style={styles.variableItem}>
                  <View style={styles.variableTag}>
                    <Text style={styles.variableTagText}>{`{{${variable.name}}}`}</Text>
                  </View>
                  <View style={styles.variableInfo}>
                    <TextInput
                      style={styles.variableDescInput}
                      value={variable.description || ''}
                      onChangeText={(desc) => {
                        const newVars = [...variables];
                        newVars[index] = { ...variable, description: desc };
                        setVariables(newVars);
                        setHasChanges(true);
                      }}
                      placeholder="Description"
                      placeholderTextColor="#666"
                    />
                    <TouchableOpacity
                      style={styles.requiredToggle}
                      onPress={() => {
                        const newVars = [...variables];
                        newVars[index] = { ...variable, required: !variable.required };
                        setVariables(newVars);
                        setHasChanges(true);
                      }}
                    >
                      <Ionicons
                        name={variable.required ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={variable.required ? ORACLE_COLORS.observe : '#666'}
                      />
                      <Text style={styles.requiredLabel}>Required</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Preview Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <TouchableOpacity
              style={styles.previewButton}
              onPress={() => setPreviewVisible(true)}
            >
              <Ionicons name="eye" size={16} color={ORACLE_COLORS.observe} />
              <Text style={styles.previewButtonText}>Full Preview</Text>
            </TouchableOpacity>
          </View>

          {variables.length > 0 && (
            <View style={styles.previewInputs}>
              {variables.slice(0, 3).map((variable) => (
                <VariableEditor
                  key={variable.name}
                  variable={variable}
                  value={previewValues[variable.name] || ''}
                  onChange={(value) =>
                    setPreviewValues(prev => ({ ...prev, [variable.name]: value }))
                  }
                />
              ))}
              {variables.length > 3 && (
                <Text style={styles.moreVariables}>
                  +{variables.length - 3} more variables in full preview
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => updateField(setIsPublic)(!isPublic)}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Public Template</Text>
              <Text style={styles.settingDesc}>
                Allow other users to use this template
              </Text>
            </View>
            <Ionicons
              name={isPublic ? 'checkbox' : 'square-outline'}
              size={24}
              color={isPublic ? ORACLE_COLORS.observe : '#666'}
            />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.resetButton} onPress={handleResetToDefault}>
            <Ionicons name="refresh" size={20} color={ORACLE_COLORS.orient} />
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <PreviewModal
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        template={templateContent}
        variables={previewValues}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: ORACLE_COLORS.observe,
    marginTop: 2,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#333',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  extractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: ORACLE_COLORS.observe + '22',
    borderRadius: 6,
  },
  extractButtonText: {
    fontSize: 12,
    color: ORACLE_COLORS.observe,
    marginLeft: 4,
  },
  editorContainer: {
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
  },
  templateEditor: {
    padding: 16,
    fontSize: 14,
    color: '#fff',
    fontFamily: 'monospace',
    minHeight: 200,
  },
  editorFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  editorHint: {
    fontSize: 12,
    color: '#666',
  },
  variablesCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
  },
  variableItem: {
    marginBottom: 16,
  },
  variableTag: {
    alignSelf: 'flex-start',
    backgroundColor: ORACLE_COLORS.observe + '33',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  variableTagText: {
    fontSize: 12,
    color: ORACLE_COLORS.observe,
    fontFamily: 'monospace',
  },
  variableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  variableDescInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    color: '#fff',
    marginRight: 12,
  },
  requiredToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requiredLabel: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  variableHighlight: {
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  previewInputs: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
  },
  variableEditor: {
    marginBottom: 12,
  },
  variableHeader: {
    marginBottom: 6,
  },
  variableName: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  requiredStar: {
    color: ORACLE_COLORS.decide,
  },
  variableDesc: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  variableInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    color: '#fff',
    minHeight: 40,
  },
  moreVariables: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: ORACLE_COLORS.observe + '22',
    borderRadius: 6,
  },
  previewButtonText: {
    fontSize: 12,
    color: ORACLE_COLORS.observe,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  settingDesc: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: ORACLE_COLORS.orient,
    borderRadius: 8,
  },
  resetButtonText: {
    color: ORACLE_COLORS.orient,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  previewScroll: {
    maxHeight: 400,
  },
  previewText: {
    fontSize: 14,
    color: '#ccc',
    fontFamily: 'monospace',
    lineHeight: 22,
  },
  previewStats: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  previewStatLabel: {
    fontSize: 12,
    color: '#888',
  },
});

export default PromptTemplateEditor;
