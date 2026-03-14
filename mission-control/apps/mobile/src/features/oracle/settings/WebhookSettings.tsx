/**
 * WebhookSettings Component
 * Story adv-11 - Webhook configuration and management screen
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  TextInput,
  StyleSheet,
  Modal,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Webhook, WebhookEventType, WebhookTestResult } from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../../../store/oracle';
import { oracleStyles } from '../theme';

// Available event types
const EVENT_TYPES: Array<{ type: WebhookEventType; category: string; description: string }> = [
  { type: 'signal.detected', category: 'observe', description: 'New signal detected' },
  { type: 'signal.critical', category: 'observe', description: 'Critical signal detected' },
  { type: 'context.generated', category: 'orient', description: 'Strategic context generated' },
  { type: 'decision.created', category: 'decide', description: 'Decision created' },
  { type: 'decision.made', category: 'decide', description: 'Decision finalized' },
  { type: 'plan.started', category: 'act', description: 'Execution plan started' },
  { type: 'plan.completed', category: 'act', description: 'Execution plan completed' },
  { type: 'step.completed', category: 'act', description: 'Step completed' },
  { type: 'prediction.resolved', category: 'prediction', description: 'Prediction resolved' },
  { type: 'ghost_action.ready', category: 'system', description: 'Ghost action ready' },
  { type: 'system.error', category: 'system', description: 'System error occurred' },
];

const CATEGORY_COLORS: Record<string, string> = {
  observe: ORACLE_COLORS.observe,
  orient: ORACLE_COLORS.orient,
  decide: ORACLE_COLORS.decide,
  act: ORACLE_COLORS.act,
  prediction: '#9B59B6',
  system: '#888888',
};

// Mock data
const MOCK_WEBHOOKS: Webhook[] = [
  {
    id: '1',
    user_id: 'mock-user-id',
    name: 'Slack Notifications',
    description: 'Send critical signals to Slack',
    url: 'https://hooks.slack.com/services/xxx',
    secret: 'abc123***xyz789',
    events: ['signal.critical', 'decision.made', 'plan.completed'],
    headers: {},
    is_active: true,
    retry_count: 3,
    retry_delay_seconds: 60,
    timeout_seconds: 30,
    last_triggered_at: '2026-01-30T12:00:00Z',
    last_success_at: '2026-01-30T12:00:00Z',
    success_count: 45,
    failure_count: 2,
    metadata: {},
    created_at: '2026-01-15T08:00:00Z',
    updated_at: '2026-01-30T12:00:00Z',
  },
  {
    id: '2',
    user_id: 'mock-user-id',
    name: 'Analytics Pipeline',
    description: 'Send events to analytics system',
    url: 'https://api.analytics.com/webhook',
    secret: 'def456***uvw012',
    events: ['signal.detected', 'decision.created', 'plan.started'],
    headers: {},
    is_active: false,
    retry_count: 3,
    retry_delay_seconds: 60,
    timeout_seconds: 30,
    last_failure_at: '2026-01-29T15:30:00Z',
    success_count: 120,
    failure_count: 8,
    metadata: {},
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-29T15:30:00Z',
  },
];

interface WebhookCardProps {
  webhook: Webhook;
  onPress: () => void;
  onToggle: (active: boolean) => void;
  onTest: () => void;
}

const WebhookCard: React.FC<WebhookCardProps> = ({ webhook, onPress, onToggle, onTest }) => {
  const successRate = webhook.success_count + webhook.failure_count > 0
    ? (webhook.success_count / (webhook.success_count + webhook.failure_count)) * 100
    : 100;

  const statusColor = webhook.is_active
    ? successRate >= 90 ? '#00FF88' : successRate >= 70 ? '#FFD700' : '#FF6B6B'
    : '#666666';

  return (
    <TouchableOpacity style={styles.webhookCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.webhookHeader}>
        <View style={styles.webhookTitleRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.webhookName}>{webhook.name}</Text>
        </View>
        <Switch
          value={webhook.is_active}
          onValueChange={onToggle}
          trackColor={{ false: '#333333', true: `${ORACLE_COLORS.act}80` }}
          thumbColor={webhook.is_active ? ORACLE_COLORS.act : '#666666'}
        />
      </View>

      {webhook.description && (
        <Text style={styles.webhookDescription}>{webhook.description}</Text>
      )}

      <Text style={styles.webhookUrl} numberOfLines={1}>{webhook.url}</Text>

      {/* Event tags */}
      <View style={styles.eventTags}>
        {webhook.events.slice(0, 3).map((event) => {
          const eventInfo = EVENT_TYPES.find((e) => e.type === event);
          return (
            <View
              key={event}
              style={[styles.eventTag, { backgroundColor: `${CATEGORY_COLORS[eventInfo?.category || 'system']}20` }]}
            >
              <Text style={[styles.eventTagText, { color: CATEGORY_COLORS[eventInfo?.category || 'system'] }]}>
                {event}
              </Text>
            </View>
          );
        })}
        {webhook.events.length > 3 && (
          <Text style={styles.moreEvents}>+{webhook.events.length - 3}</Text>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.webhookStats}>
        <View style={styles.webhookStat}>
          <Text style={styles.webhookStatValue}>{webhook.success_count}</Text>
          <Text style={styles.webhookStatLabel}>Delivered</Text>
        </View>
        <View style={styles.webhookStat}>
          <Text style={[styles.webhookStatValue, webhook.failure_count > 0 && { color: '#FF6B6B' }]}>
            {webhook.failure_count}
          </Text>
          <Text style={styles.webhookStatLabel}>Failed</Text>
        </View>
        <View style={styles.webhookStat}>
          <Text style={[styles.webhookStatValue, { color: statusColor }]}>
            {successRate.toFixed(0)}%
          </Text>
          <Text style={styles.webhookStatLabel}>Success</Text>
        </View>
        <TouchableOpacity style={styles.testButton} onPress={onTest}>
          <Ionicons name="play-outline" size={16} color={ORACLE_COLORS.observe} />
          <Text style={styles.testButtonText}>Test</Text>
        </TouchableOpacity>
      </View>

      {/* Last activity */}
      {webhook.last_triggered_at && (
        <Text style={styles.lastActivity}>
          Last triggered: {new Date(webhook.last_triggered_at).toLocaleDateString()}
        </Text>
      )}
    </TouchableOpacity>
  );
};

interface AddWebhookModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (webhook: Partial<Webhook>) => void;
}

const AddWebhookModal: React.FC<AddWebhookModalProps> = ({ visible, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleEvent = (event: WebhookEventType) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Name is required';
    if (!url.trim()) newErrors.url = 'URL is required';
    else {
      try {
        new URL(url);
      } catch {
        newErrors.url = 'Invalid URL format';
      }
    }
    if (selectedEvents.length === 0) newErrors.events = 'Select at least one event';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave({
        name,
        description,
        url,
        events: selectedEvents,
      });
      // Reset form
      setName('');
      setDescription('');
      setUrl('');
      setSelectedEvents([]);
      setErrors({});
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Webhook</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#888888" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Name *</Text>
              <TextInput
                style={[styles.formInput, errors.name && styles.formInputError]}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Slack Notifications"
                placeholderTextColor="#666666"
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={styles.formInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor="#666666"
              />
            </View>

            {/* URL */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Webhook URL *</Text>
              <TextInput
                style={[styles.formInput, errors.url && styles.formInputError]}
                value={url}
                onChangeText={setUrl}
                placeholder="https://..."
                placeholderTextColor="#666666"
                keyboardType="url"
                autoCapitalize="none"
              />
              {errors.url && <Text style={styles.errorText}>{errors.url}</Text>}
            </View>

            {/* Events */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Events *</Text>
              {errors.events && <Text style={styles.errorText}>{errors.events}</Text>}
              <View style={styles.eventList}>
                {EVENT_TYPES.map((event) => {
                  const isSelected = selectedEvents.includes(event.type);
                  const color = CATEGORY_COLORS[event.category];

                  return (
                    <TouchableOpacity
                      key={event.type}
                      style={[
                        styles.eventItem,
                        isSelected && { borderColor: color, backgroundColor: `${color}15` },
                      ]}
                      onPress={() => toggleEvent(event.type)}
                    >
                      <View style={styles.eventItemHeader}>
                        <View style={[styles.categoryDot, { backgroundColor: color }]} />
                        <Text style={styles.eventItemType}>{event.type}</Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color={color} />
                        )}
                      </View>
                      <Text style={styles.eventItemDesc}>{event.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Ionicons name="add" size={18} color="#000000" />
              <Text style={styles.saveButtonText}>Add Webhook</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const WebhookSettings: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [webhooks, setWebhooks] = useState<Webhook[]>(MOCK_WEBHOOKS);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // In production: fetch from API
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsRefreshing(false);
  }, []);

  const handleToggleWebhook = (webhookId: string, active: boolean) => {
    setWebhooks((prev) =>
      prev.map((w) => (w.id === webhookId ? { ...w, is_active: active } : w))
    );
    // In production: API call to update
  };

  const handleTestWebhook = async (webhookId: string) => {
    setTestingId(webhookId);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const success = Math.random() > 0.2;

    Alert.alert(
      success ? 'Test Successful' : 'Test Failed',
      success
        ? 'The test webhook was delivered successfully.'
        : 'Failed to deliver test webhook. Check the URL and try again.',
      [{ text: 'OK' }]
    );

    setTestingId(null);
  };

  const handleAddWebhook = (webhookData: Partial<Webhook>) => {
    const newWebhook: Webhook = {
      id: crypto.randomUUID(),
      user_id: 'mock-user-id',
      name: webhookData.name || '',
      description: webhookData.description,
      url: webhookData.url || '',
      secret: 'new-secret-***-hidden',
      events: webhookData.events || [],
      headers: {},
      is_active: true,
      retry_count: 3,
      retry_delay_seconds: 60,
      timeout_seconds: 30,
      success_count: 0,
      failure_count: 0,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setWebhooks((prev) => [newWebhook, ...prev]);
    setShowAddModal(false);

    Alert.alert('Webhook Added', 'Your webhook has been created. Make sure to copy the secret for signature verification.');
  };

  const handleDeleteWebhook = (webhookId: string) => {
    Alert.alert(
      'Delete Webhook',
      'Are you sure you want to delete this webhook? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
          },
        },
      ]
    );
  };

  const activeCount = webhooks.filter((w) => w.is_active).length;
  const totalDeliveries = webhooks.reduce((sum, w) => sum + w.success_count + w.failure_count, 0);

  return (
    <View style={[oracleStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Webhooks</Text>
          <Text style={styles.headerSubtitle}>{activeCount} active, {totalDeliveries} total deliveries</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={24} color="#000000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={oracleStyles.content}
        contentContainerStyle={oracleStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#00BFFF"
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ORACLE_COLORS.observe} />
            <Text style={styles.loadingText}>Loading webhooks...</Text>
          </View>
        ) : webhooks.length === 0 ? (
          <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
            <Ionicons name="link-outline" size={48} color="#444444" />
            <Text style={styles.emptyTitle}>No Webhooks</Text>
            <Text style={styles.emptyText}>
              Webhooks let you receive real-time notifications when events occur in ORACLE.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => setShowAddModal(true)}>
              <Ionicons name="add" size={18} color="#000000" />
              <Text style={styles.emptyButtonText}>Add First Webhook</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            {webhooks.map((webhook) => (
              <WebhookCard
                key={webhook.id}
                webhook={webhook}
                onPress={() => handleDeleteWebhook(webhook.id)}
                onToggle={(active) => handleToggleWebhook(webhook.id, active)}
                onTest={() => handleTestWebhook(webhook.id)}
              />
            ))}

            {/* Info card */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle-outline" size={20} color="#888888" />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Webhook Security</Text>
                <Text style={styles.infoText}>
                  All webhooks include an HMAC-SHA256 signature in the X-Webhook-Signature header.
                  Verify this signature using your secret to ensure requests are from ORACLE.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Testing overlay */}
      {testingId && (
        <View style={styles.testingOverlay}>
          <ActivityIndicator size="small" color={ORACLE_COLORS.observe} />
          <Text style={styles.testingText}>Sending test webhook...</Text>
        </View>
      )}

      {/* Add Webhook Modal */}
      <AddWebhookModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddWebhook}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORACLE_COLORS.act,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#888888',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.act,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  webhookCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  webhookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  webhookTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  webhookName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  webhookDescription: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 8,
  },
  webhookUrl: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  eventTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  eventTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 4,
  },
  eventTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  moreEvents: {
    fontSize: 10,
    color: '#888888',
    alignSelf: 'center',
  },
  webhookStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 12,
  },
  webhookStat: {
    flex: 1,
    alignItems: 'center',
  },
  webhookStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  webhookStatLabel: {
    fontSize: 10,
    color: '#888888',
    marginTop: 2,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${ORACLE_COLORS.observe}20`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  testButtonText: {
    fontSize: 12,
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
    marginLeft: 4,
  },
  lastActivity: {
    fontSize: 11,
    color: '#666666',
    marginTop: 8,
    textAlign: 'right',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#888888',
    lineHeight: 18,
  },
  testingOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#252525',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  testingText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 12,
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#252525',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333333',
  },
  formInputError: {
    borderColor: '#FF6B6B',
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 4,
  },
  eventList: {
    marginTop: 8,
  },
  eventItem: {
    backgroundColor: '#252525',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  eventItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  eventItemType: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  eventItemDesc: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
    marginLeft: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#888888',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.act,
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
});

export default WebhookSettings;
