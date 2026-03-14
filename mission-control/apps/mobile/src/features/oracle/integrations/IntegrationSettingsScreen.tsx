/**
 * ORACLE Integration Settings Screen
 * Story int-9 - UI for managing all integrations
 *
 * Features:
 * - List of available integrations
 * - Connection status for each
 * - Connect/disconnect buttons
 * - Sync frequency settings
 * - Last sync timestamp
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';

// ============================================================================
// TYPES
// ============================================================================

export type IntegrationProvider =
  | 'google_calendar'
  | 'apple_calendar'
  | 'todoist'
  | 'notion'
  | 'slack'
  | 'gmail'
  | 'outlook'
  | 'zapier'
  | 'ifttt';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface IntegrationInfo {
  id: IntegrationProvider;
  name: string;
  description: string;
  icon: string;
  category: 'calendar' | 'tasks' | 'documents' | 'communication' | 'automation';
  status: ConnectionStatus;
  lastSync?: Date;
  syncFrequency?: number; // minutes
  accountInfo?: string;
  error?: string;
}

interface IntegrationSettingsScreenProps {
  integrations: IntegrationInfo[];
  onConnect: (provider: IntegrationProvider) => Promise<void>;
  onDisconnect: (provider: IntegrationProvider) => Promise<void>;
  onSyncNow: (provider: IntegrationProvider) => Promise<void>;
  onUpdateFrequency: (provider: IntegrationProvider, minutes: number) => Promise<void>;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ORACLE_COLORS = {
  observe: '#00BFFF',
  orient: '#FFD700',
  decide: '#FF6B6B',
  act: '#00FF88',
  idle: '#808080',
};

const STATUS_COLORS = {
  connected: '#00FF88',
  disconnected: '#808080',
  connecting: '#FFD700',
  error: '#FF6B6B',
};

const CATEGORY_ICONS = {
  calendar: '📅',
  tasks: '✅',
  documents: '📄',
  communication: '💬',
  automation: '⚡',
};

const SYNC_FREQUENCIES = [
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '4 hours', value: 240 },
  { label: 'Manual only', value: 0 },
];

// ============================================================================
// COMPONENTS
// ============================================================================

const IntegrationCard: React.FC<{
  integration: IntegrationInfo;
  onConnect: () => void;
  onDisconnect: () => void;
  onSyncNow: () => void;
  onUpdateFrequency: (minutes: number) => void;
  isLoading: boolean;
}> = ({
  integration,
  onConnect,
  onDisconnect,
  onSyncNow,
  onUpdateFrequency,
  isLoading,
}) => {
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const isConnected = integration.status === 'connected';
  const statusColor = STATUS_COLORS[integration.status];

  const formatLastSync = (date?: Date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardIcon}>{integration.icon}</Text>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{integration.name}</Text>
            <Text style={styles.cardDescription}>{integration.description}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {integration.status}
          </Text>
        </View>
      </View>

      {integration.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {integration.error}</Text>
        </View>
      )}

      {isConnected && (
        <View style={styles.cardDetails}>
          {integration.accountInfo && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account</Text>
              <Text style={styles.detailValue}>{integration.accountInfo}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Last Sync</Text>
            <Text style={styles.detailValue}>{formatLastSync(integration.lastSync)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sync Frequency</Text>
            <TouchableOpacity onPress={() => setShowFrequencyPicker(!showFrequencyPicker)}>
              <Text style={[styles.detailValue, styles.detailValueClickable]}>
                {integration.syncFrequency
                  ? `Every ${integration.syncFrequency} min`
                  : 'Manual only'} ▼
              </Text>
            </TouchableOpacity>
          </View>

          {showFrequencyPicker && (
            <View style={styles.frequencyPicker}>
              {SYNC_FREQUENCIES.map(freq => (
                <TouchableOpacity
                  key={freq.value}
                  style={[
                    styles.frequencyOption,
                    integration.syncFrequency === freq.value && styles.frequencyOptionSelected,
                  ]}
                  onPress={() => {
                    onUpdateFrequency(freq.value);
                    setShowFrequencyPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.frequencyOptionText,
                      integration.syncFrequency === freq.value && styles.frequencyOptionTextSelected,
                    ]}
                  >
                    {freq.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.cardActions}>
        {isLoading ? (
          <ActivityIndicator size="small" color={ORACLE_COLORS.observe} />
        ) : isConnected ? (
          <>
            <TouchableOpacity style={styles.actionButtonSecondary} onPress={onSyncNow}>
              <Text style={styles.actionButtonSecondaryText}>Sync Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButtonDanger} onPress={onDisconnect}>
              <Text style={styles.actionButtonDangerText}>Disconnect</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.actionButtonPrimary} onPress={onConnect}>
            <Text style={styles.actionButtonPrimaryText}>Connect</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const CategorySection: React.FC<{
  category: string;
  integrations: IntegrationInfo[];
  onConnect: (provider: IntegrationProvider) => Promise<void>;
  onDisconnect: (provider: IntegrationProvider) => Promise<void>;
  onSyncNow: (provider: IntegrationProvider) => Promise<void>;
  onUpdateFrequency: (provider: IntegrationProvider, minutes: number) => Promise<void>;
  loadingProviders: Set<IntegrationProvider>;
}> = ({
  category,
  integrations,
  onConnect,
  onDisconnect,
  onSyncNow,
  onUpdateFrequency,
  loadingProviders,
}) => {
  const categoryIcon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || '🔌';
  const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{categoryIcon}</Text>
        <Text style={styles.sectionTitle}>{categoryTitle}</Text>
        <Text style={styles.sectionCount}>
          {integrations.filter(i => i.status === 'connected').length}/{integrations.length}
        </Text>
      </View>
      {integrations.map(integration => (
        <IntegrationCard
          key={integration.id}
          integration={integration}
          onConnect={() => onConnect(integration.id)}
          onDisconnect={() => onDisconnect(integration.id)}
          onSyncNow={() => onSyncNow(integration.id)}
          onUpdateFrequency={(minutes) => onUpdateFrequency(integration.id, minutes)}
          isLoading={loadingProviders.has(integration.id)}
        />
      ))}
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const IntegrationSettingsScreen: React.FC<IntegrationSettingsScreenProps> = ({
  integrations,
  onConnect,
  onDisconnect,
  onSyncNow,
  onUpdateFrequency,
  onRefresh,
  isRefreshing = false,
}) => {
  const [loadingProviders, setLoadingProviders] = useState<Set<IntegrationProvider>>(new Set());

  const handleAction = useCallback(async (
    provider: IntegrationProvider,
    action: () => Promise<void>
  ) => {
    setLoadingProviders(prev => new Set([...prev, provider]));
    try {
      await action();
    } finally {
      setLoadingProviders(prev => {
        const next = new Set(prev);
        next.delete(provider);
        return next;
      });
    }
  }, []);

  // Group integrations by category
  const groupedIntegrations = integrations.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = [];
    }
    acc[integration.category].push(integration);
    return acc;
  }, {} as Record<string, IntegrationInfo[]>);

  const categories = ['calendar', 'tasks', 'documents', 'communication', 'automation'];
  const connectedCount = integrations.filter(i => i.status === 'connected').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Integrations</Text>
        <Text style={styles.headerSubtitle}>
          {connectedCount} of {integrations.length} connected
        </Text>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{connectedCount}</Text>
          <Text style={styles.summaryLabel}>Connected</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {integrations.filter(i => i.status === 'error').length}
          </Text>
          <Text style={styles.summaryLabel}>Errors</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {integrations.length - connectedCount}
          </Text>
          <Text style={styles.summaryLabel}>Available</Text>
        </View>
      </View>

      {/* Integration List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={ORACLE_COLORS.observe}
          />
        }
      >
        {categories.map(category => {
          const categoryIntegrations = groupedIntegrations[category];
          if (!categoryIntegrations?.length) return null;

          return (
            <CategorySection
              key={category}
              category={category}
              integrations={categoryIntegrations}
              onConnect={(p) => handleAction(p, () => onConnect(p))}
              onDisconnect={(p) => handleAction(p, () => onDisconnect(p))}
              onSyncNow={(p) => handleAction(p, () => onSyncNow(p))}
              onUpdateFrequency={(p, m) => handleAction(p, () => onUpdateFrequency(p, m))}
              loadingProviders={loadingProviders}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#808080',
    marginTop: 4,
  },
  summary: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: ORACLE_COLORS.observe,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#808080',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#1a1a2e',
    marginVertical: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
  },
  sectionCount: {
    fontSize: 12,
    color: '#808080',
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  cardDescription: {
    fontSize: 12,
    color: '#808080',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  errorContainer: {
    backgroundColor: '#FF6B6B20',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
  },
  cardDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a3e',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#808080',
  },
  detailValue: {
    fontSize: 12,
    color: '#ffffff',
  },
  detailValueClickable: {
    color: ORACLE_COLORS.observe,
  },
  frequencyPicker: {
    backgroundColor: '#0a0a0f',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  frequencyOption: {
    padding: 12,
    borderRadius: 6,
  },
  frequencyOptionSelected: {
    backgroundColor: ORACLE_COLORS.observe + '20',
  },
  frequencyOptionText: {
    fontSize: 14,
    color: '#808080',
  },
  frequencyOptionTextSelected: {
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: ORACLE_COLORS.observe,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonPrimaryText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonSecondary: {
    backgroundColor: '#2a2a3e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonSecondaryText: {
    color: '#ffffff',
    fontSize: 14,
  },
  actionButtonDanger: {
    backgroundColor: '#FF6B6B20',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonDangerText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
});

export default IntegrationSettingsScreen;
