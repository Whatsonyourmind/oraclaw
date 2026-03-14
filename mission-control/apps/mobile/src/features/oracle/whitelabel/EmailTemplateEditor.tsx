/**
 * EmailTemplateEditor.tsx
 * Story wl-5 - White-label email templates
 *
 * Features:
 * - Notification emails with brand styling
 * - Invite emails with brand logo
 * - Report emails with brand colors
 * - Template preview in admin
 * - MJML support for responsive emails
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import type {
  WhiteLabelEmailTemplate,
  EmailTemplateType,
  EmailContentType,
} from '@mission-control/shared-types';

const ORACLE_COLORS = {
  observe: '#00BFFF',
  orient: '#FFD700',
  decide: '#FF6B6B',
  act: '#00FF88',
};

// Email template types with metadata
const TEMPLATE_TYPES: { type: EmailTemplateType; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { type: 'invite', label: 'Team Invite', icon: 'person-add-outline', description: 'Sent when inviting new team members' },
  { type: 'welcome', label: 'Welcome', icon: 'hand-right-outline', description: 'Sent after user registration' },
  { type: 'password_reset', label: 'Password Reset', icon: 'key-outline', description: 'Sent for password recovery' },
  { type: 'notification', label: 'Notification', icon: 'notifications-outline', description: 'General notifications' },
  { type: 'report', label: 'Report', icon: 'bar-chart-outline', description: 'Analytics and reports' },
  { type: 'digest', label: 'Daily Digest', icon: 'newspaper-outline', description: 'Daily summary emails' },
  { type: 'alert', label: 'Alert', icon: 'warning-outline', description: 'Critical alerts and warnings' },
  { type: 'reminder', label: 'Reminder', icon: 'alarm-outline', description: 'Task and deadline reminders' },
  { type: 'confirmation', label: 'Confirmation', icon: 'checkmark-circle-outline', description: 'Action confirmations' },
];

// Default variables available in all templates
const DEFAULT_VARIABLES = [
  'user_name',
  'brand_name',
  'brand_logo_url',
  'action_url',
  'support_email',
  'year',
];

// Variable-specific additions per template type
const TYPE_VARIABLES: Record<EmailTemplateType, string[]> = {
  invite: ['inviter_name', 'team_name', 'role', 'expires_at'],
  welcome: ['getting_started_url', 'features'],
  password_reset: ['reset_url', 'expires_in'],
  notification: ['notification_title', 'notification_body', 'notification_type'],
  report: ['report_title', 'report_date', 'report_data', 'chart_urls'],
  digest: ['summary', 'highlights', 'action_items', 'upcoming'],
  alert: ['alert_level', 'alert_title', 'alert_body', 'alert_time'],
  reminder: ['reminder_title', 'due_date', 'item_type', 'item_id'],
  confirmation: ['action_type', 'action_details', 'timestamp'],
};

// Default MJML templates
const DEFAULT_TEMPLATES: Record<EmailTemplateType, string> = {
  invite: `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Inter, Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#0a0a0a">
    <mj-section background-color="#111111" padding="20px">
      <mj-column>
        <mj-image src="{{brand_logo_url}}" width="120px" />
      </mj-column>
    </mj-section>
    <mj-section background-color="#1a1a1a" padding="40px 20px">
      <mj-column>
        <mj-text color="#ffffff" font-size="24px" font-weight="bold">
          You're Invited!
        </mj-text>
        <mj-text color="#cccccc" font-size="16px" line-height="1.5">
          Hi {{user_name}},<br /><br />
          {{inviter_name}} has invited you to join {{team_name}} on {{brand_name}}.
        </mj-text>
        <mj-text color="#888888" font-size="14px">
          You've been assigned the role of <strong style="color: #FFD700">{{role}}</strong>.
        </mj-text>
        <mj-button background-color="#00FF88" color="#000000" href="{{action_url}}" font-weight="bold">
          Accept Invitation
        </mj-button>
        <mj-text color="#666666" font-size="12px">
          This invitation expires {{expires_at}}.
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section padding="20px">
      <mj-column>
        <mj-text color="#666666" font-size="12px" align="center">
          © {{year}} {{brand_name}}. All rights reserved.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  welcome: `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Inter, Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#0a0a0a">
    <mj-section background-color="#00BFFF" padding="40px 20px">
      <mj-column>
        <mj-image src="{{brand_logo_url}}" width="100px" />
        <mj-text color="#ffffff" font-size="28px" font-weight="bold" align="center">
          Welcome to {{brand_name}}!
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#1a1a1a" padding="40px 20px">
      <mj-column>
        <mj-text color="#ffffff" font-size="18px">
          Hi {{user_name}},
        </mj-text>
        <mj-text color="#cccccc" font-size="16px" line-height="1.6">
          Thank you for joining {{brand_name}}! We're excited to have you on board.
        </mj-text>
        <mj-button background-color="#FFD700" color="#000000" href="{{getting_started_url}}" font-weight="bold">
          Get Started
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  password_reset: `<mjml>
  <mj-body background-color="#0a0a0a">
    <mj-section background-color="#1a1a1a" padding="40px 20px">
      <mj-column>
        <mj-text color="#ffffff" font-size="24px" font-weight="bold">
          Reset Your Password
        </mj-text>
        <mj-text color="#cccccc" font-size="16px">
          Hi {{user_name}}, we received a request to reset your password.
        </mj-text>
        <mj-button background-color="#FF6B6B" color="#ffffff" href="{{reset_url}}" font-weight="bold">
          Reset Password
        </mj-button>
        <mj-text color="#888888" font-size="12px">
          This link expires in {{expires_in}}.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  notification: `<mjml>
  <mj-body background-color="#0a0a0a">
    <mj-section background-color="#1a1a1a" padding="30px 20px">
      <mj-column>
        <mj-text color="#00BFFF" font-size="14px" font-weight="bold">
          {{notification_type}}
        </mj-text>
        <mj-text color="#ffffff" font-size="20px" font-weight="bold">
          {{notification_title}}
        </mj-text>
        <mj-text color="#cccccc" font-size="16px">
          {{notification_body}}
        </mj-text>
        <mj-button background-color="#00FF88" color="#000000" href="{{action_url}}">
          View Details
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  report: `<mjml>
  <mj-body background-color="#0a0a0a">
    <mj-section background-color="#FFD700" padding="30px 20px">
      <mj-column>
        <mj-text color="#000000" font-size="24px" font-weight="bold">
          {{report_title}}
        </mj-text>
        <mj-text color="#333333" font-size="14px">
          Report generated on {{report_date}}
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#1a1a1a" padding="20px">
      <mj-column>
        <mj-text color="#cccccc">
          {{report_data}}
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  digest: `<mjml>
  <mj-body background-color="#0a0a0a">
    <mj-section background-color="#1a1a1a" padding="30px">
      <mj-column>
        <mj-text color="#ffffff" font-size="24px" font-weight="bold">
          Your Daily Digest
        </mj-text>
        <mj-text color="#cccccc">{{summary}}</mj-text>
        <mj-divider border-color="#333333" />
        <mj-text color="#FFD700" font-weight="bold">Highlights</mj-text>
        <mj-text color="#cccccc">{{highlights}}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  alert: `<mjml>
  <mj-body background-color="#0a0a0a">
    <mj-section background-color="#FF4444" padding="20px">
      <mj-column>
        <mj-text color="#ffffff" font-size="20px" font-weight="bold">
          ⚠️ {{alert_level}}: {{alert_title}}
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#1a1a1a" padding="30px">
      <mj-column>
        <mj-text color="#cccccc">{{alert_body}}</mj-text>
        <mj-text color="#888888" font-size="12px">Triggered at {{alert_time}}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  reminder: `<mjml>
  <mj-body background-color="#0a0a0a">
    <mj-section background-color="#1a1a1a" padding="30px">
      <mj-column>
        <mj-text color="#FFA500" font-size="14px">REMINDER</mj-text>
        <mj-text color="#ffffff" font-size="20px" font-weight="bold">
          {{reminder_title}}
        </mj-text>
        <mj-text color="#cccccc">Due: {{due_date}}</mj-text>
        <mj-button background-color="#00FF88" color="#000000" href="{{action_url}}">
          View {{item_type}}
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
  confirmation: `<mjml>
  <mj-body background-color="#0a0a0a">
    <mj-section background-color="#00FF88" padding="30px">
      <mj-column>
        <mj-text color="#000000" font-size="24px" font-weight="bold" align="center">
          ✓ {{action_type}} Confirmed
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#1a1a1a" padding="30px">
      <mj-column>
        <mj-text color="#cccccc">{{action_details}}</mj-text>
        <mj-text color="#888888" font-size="12px">{{timestamp}}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
};

// Mock sample data for preview
const SAMPLE_DATA: Record<string, string> = {
  user_name: 'John Doe',
  brand_name: 'ORACLE',
  brand_logo_url: 'https://via.placeholder.com/120x40/00BFFF/ffffff?text=ORACLE',
  action_url: 'https://example.com/action',
  support_email: 'support@example.com',
  year: new Date().getFullYear().toString(),
  inviter_name: 'Jane Smith',
  team_name: 'Engineering',
  role: 'Member',
  expires_at: 'in 7 days',
  getting_started_url: 'https://example.com/start',
  features: 'Signal detection, Decision support, Execution tracking',
  reset_url: 'https://example.com/reset/abc123',
  expires_in: '1 hour',
  notification_title: 'New Signal Detected',
  notification_body: 'A high-priority signal has been detected in your radar.',
  notification_type: 'SIGNAL ALERT',
  report_title: 'Weekly Analytics Report',
  report_date: 'January 31, 2026',
  report_data: 'Predictions: 45 | Accuracy: 87% | Decisions: 12',
  summary: 'You had a productive day with 5 completed tasks.',
  highlights: '• Closed 3 decisions\n• Achieved 90% prediction accuracy\n• Team collaboration up 25%',
  action_items: '• Review pending signals\n• Complete weekly planning',
  upcoming: 'Team meeting at 2:00 PM',
  alert_level: 'CRITICAL',
  alert_title: 'System Performance Degradation',
  alert_body: 'Response times have exceeded thresholds. Investigation recommended.',
  alert_time: '10:45 AM EST',
  reminder_title: 'Quarterly Review',
  due_date: 'February 1, 2026',
  item_type: 'Event',
  item_id: 'evt_123',
  action_type: 'Subscription Update',
  action_details: 'Your plan has been upgraded to Pro.',
  timestamp: 'January 31, 2026 at 3:30 PM',
};

interface TemplateCardProps {
  template: { type: EmailTemplateType; label: string; icon: keyof typeof Ionicons.glyphMap; description: string };
  isSelected: boolean;
  onSelect: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, isSelected, onSelect }) => (
  <TouchableOpacity
    style={[styles.templateCard, isSelected && styles.templateCardSelected]}
    onPress={onSelect}
  >
    <View style={[styles.templateIcon, isSelected && styles.templateIconSelected]}>
      <Ionicons
        name={template.icon}
        size={24}
        color={isSelected ? '#000' : ORACLE_COLORS.orient}
      />
    </View>
    <View style={styles.templateInfo}>
      <Text style={[styles.templateLabel, isSelected && styles.templateLabelSelected]}>
        {template.label}
      </Text>
      <Text style={styles.templateDescription}>{template.description}</Text>
    </View>
    {isSelected && (
      <Ionicons name="checkmark-circle" size={24} color={ORACLE_COLORS.act} />
    )}
  </TouchableOpacity>
);

interface VariableChipProps {
  variable: string;
  onInsert: () => void;
}

const VariableChip: React.FC<VariableChipProps> = ({ variable, onInsert }) => (
  <TouchableOpacity style={styles.variableChip} onPress={onInsert}>
    <Text style={styles.variableChipText}>{'{{' + variable + '}}'}</Text>
  </TouchableOpacity>
);

export const EmailTemplateEditor: React.FC = () => {
  const [selectedType, setSelectedType] = useState<EmailTemplateType>('invite');
  const [subject, setSubject] = useState('You\'re invited to join {{team_name}}');
  const [body, setBody] = useState(DEFAULT_TEMPLATES.invite);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  // Available variables for selected template type
  const availableVariables = useMemo(() => {
    return [...DEFAULT_VARIABLES, ...(TYPE_VARIABLES[selectedType] || [])];
  }, [selectedType]);

  // Render preview with sample data
  const renderPreview = useCallback(async () => {
    // In production, this would call an MJML rendering service
    // For now, we'll create a simple HTML preview
    let html = body;

    // Replace variables with sample data
    for (const [key, value] of Object.entries(SAMPLE_DATA)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    // Simple MJML to HTML conversion (mock - real would use mjml library)
    html = html
      .replace(/<mjml>/g, '<html><head><style>body{margin:0;font-family:Inter,Arial,sans-serif;}</style></head>')
      .replace(/<\/mjml>/g, '</html>')
      .replace(/<mj-body/g, '<body')
      .replace(/<\/mj-body>/g, '</body>')
      .replace(/<mj-section/g, '<table width="100%" cellpadding="0" cellspacing="0"')
      .replace(/<\/mj-section>/g, '</table>')
      .replace(/<mj-column>/g, '<tr><td>')
      .replace(/<\/mj-column>/g, '</td></tr>')
      .replace(/<mj-text/g, '<div')
      .replace(/<\/mj-text>/g, '</div>')
      .replace(/<mj-button/g, '<a style="display:inline-block;padding:12px 24px;border-radius:6px;text-decoration:none;"')
      .replace(/<\/mj-button>/g, '</a>')
      .replace(/<mj-image/g, '<img style="max-width:100%;"')
      .replace(/<\/mj-image>/g, '')
      .replace(/<mj-divider/g, '<hr')
      .replace(/<\/mj-divider>/g, '')
      .replace(/<mj-head>[\s\S]*?<\/mj-head>/g, '')
      .replace(/<mj-attributes>[\s\S]*?<\/mj-attributes>/g, '');

    setPreviewHtml(html);
    setShowPreview(true);
  }, [body]);

  const handleSelectTemplate = useCallback((type: EmailTemplateType) => {
    setSelectedType(type);
    setBody(DEFAULT_TEMPLATES[type]);
    // Update subject based on type
    const subjects: Record<EmailTemplateType, string> = {
      invite: 'You\'re invited to join {{team_name}}',
      welcome: 'Welcome to {{brand_name}}!',
      password_reset: 'Reset your {{brand_name}} password',
      notification: '{{notification_title}}',
      report: '{{report_title}} - {{report_date}}',
      digest: 'Your Daily Digest from {{brand_name}}',
      alert: '[{{alert_level}}] {{alert_title}}',
      reminder: 'Reminder: {{reminder_title}}',
      confirmation: '{{action_type}} Confirmed',
    };
    setSubject(subjects[type]);
  }, []);

  const handleInsertVariable = useCallback((variable: string) => {
    setBody((prev) => prev + `{{${variable}}}`);
  }, []);

  const handleResetToDefault = useCallback(() => {
    Alert.alert(
      'Reset Template',
      'Are you sure you want to reset this template to the default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => setBody(DEFAULT_TEMPLATES[selectedType]),
        },
      ]
    );
  }, [selectedType]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert('Success', 'Email template saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Email Templates</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.previewButton} onPress={renderPreview}>
            <Ionicons name="eye-outline" size={20} color="#fff" />
            <Text style={styles.previewButtonText}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Template Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Template Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.templateList}>
              {TEMPLATE_TYPES.map((template) => (
                <TemplateCard
                  key={template.type}
                  template={template}
                  isSelected={selectedType === template.type}
                  onSelect={() => handleSelectTemplate(template.type)}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Subject Line */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subject Line</Text>
          <TextInput
            style={styles.subjectInput}
            value={subject}
            onChangeText={setSubject}
            placeholder="Email subject..."
            placeholderTextColor="#666"
          />
        </View>

        {/* Variables */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Variables</Text>
          <Text style={styles.sectionSubtitle}>Tap to insert at cursor position</Text>
          <View style={styles.variablesContainer}>
            {availableVariables.map((variable) => (
              <VariableChip
                key={variable}
                variable={variable}
                onInsert={() => handleInsertVariable(variable)}
              />
            ))}
          </View>
        </View>

        {/* Template Editor */}
        <View style={styles.section}>
          <View style={styles.editorHeader}>
            <Text style={styles.sectionTitle}>Template Body (MJML)</Text>
            <TouchableOpacity onPress={handleResetToDefault}>
              <Text style={styles.resetButton}>Reset to Default</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.templateEditor}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            placeholder="Enter MJML template..."
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Preview Modal */}
      <Modal visible={showPreview} animationType="slide">
        <SafeAreaView style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Email Preview</Text>
            <TouchableOpacity onPress={() => setShowPreview(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.previewSubject}>
            <Text style={styles.previewSubjectLabel}>Subject:</Text>
            <Text style={styles.previewSubjectText}>
              {subject.replace(/\{\{(\w+)\}\}/g, (_, key) => SAMPLE_DATA[key] || `{{${key}}}`)}
            </Text>
          </View>
          <WebView
            source={{ html: previewHtml }}
            style={styles.webView}
            originWhitelist={['*']}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: ORACLE_COLORS.orient,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },

  // Sections
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },

  // Template Cards
  templateList: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  templateCard: {
    width: 160,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  templateCardSelected: {
    borderColor: ORACLE_COLORS.orient,
    backgroundColor: '#1a1a1a',
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  templateIconSelected: {
    backgroundColor: ORACLE_COLORS.orient,
  },
  templateInfo: {
    flex: 1,
  },
  templateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  templateLabelSelected: {
    color: ORACLE_COLORS.orient,
  },
  templateDescription: {
    fontSize: 11,
    color: '#666',
    lineHeight: 14,
  },

  // Subject Input
  subjectInput: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },

  // Variables
  variablesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variableChip: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  variableChipText: {
    color: ORACLE_COLORS.observe,
    fontSize: 12,
    fontFamily: 'monospace',
  },

  // Editor
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resetButton: {
    color: ORACLE_COLORS.decide,
    fontSize: 14,
  },
  templateEditor: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 300,
    borderWidth: 1,
    borderColor: '#333',
    lineHeight: 20,
  },

  // Preview Modal
  previewContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  previewSubject: {
    padding: 16,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  previewSubjectLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  previewSubjectText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },

  bottomSpacer: {
    height: 40,
  },
});

export default EmailTemplateEditor;
