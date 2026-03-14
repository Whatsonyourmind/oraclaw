/**
 * CurrentPlan.tsx
 * Story sub-3 - Current subscription status
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Subscription, SubscriptionPlan, UsageTracking } from '@mission-control/shared-types';

const ORACLE_COLORS = {
  observe: '#00BFFF',
  orient: '#FFD700',
  decide: '#FF6B6B',
  act: '#00FF88',
};

interface UsageBarProps {
  label: string;
  current: number;
  limit: number;
  unit?: string;
}

const UsageBar: React.FC<UsageBarProps> = ({ label, current, limit, unit = '' }) => {
  const percentage = limit === -1 ? 0 : Math.min((current / limit) * 100, 100);
  const isUnlimited = limit === -1;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  return (
    <View style={styles.usageItem}>
      <View style={styles.usageHeader}>
        <Text style={styles.usageLabel}>{label}</Text>
        <Text style={styles.usageValue}>
          {current.toLocaleString()}{unit} / {isUnlimited ? 'Unlimited' : `${limit.toLocaleString()}${unit}`}
        </Text>
      </View>
      {!isUnlimited && (
        <View style={styles.usageBarBg}>
          <View
            style={[
              styles.usageBarFill,
              { width: `${percentage}%` },
              isWarning && styles.usageBarWarning,
              isCritical && styles.usageBarCritical,
            ]}
          />
        </View>
      )}
    </View>
  );
};

export const CurrentPlan: React.FC<{ onUpgrade?: () => void }> = ({ onUpgrade }) => {
  // Mock data
  const subscription: Subscription = {
    id: 'sub_123',
    user_id: 'user_123',
    plan_id: 'plan_pro',
    status: 'active',
    billing_cycle: 'monthly',
    current_period_start: '2026-01-01T00:00:00Z',
    current_period_end: '2026-02-01T00:00:00Z',
    cancel_at_period_end: false,
    usage_reset_at: '2026-01-01T00:00:00Z',
    metadata: {},
    created_at: '2025-12-01T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  };

  const plan: SubscriptionPlan = {
    id: 'plan_pro',
    name: 'Pro',
    slug: 'pro',
    description: 'For individuals who need more power',
    plan_tier: 'pro',
    price_monthly: 19.99,
    price_yearly: 199.99,
    currency: 'USD',
    max_users: 1,
    max_teams: 3,
    max_signals_per_day: 500,
    max_decisions_per_month: 100,
    max_ai_requests_per_day: 500,
    max_storage_mb: 5000,
    max_integrations: 10,
    trial_days: 14,
    features_included: {
      oracle: true,
      analytics: true,
      ai_tuning: true,
      voice: true,
      widgets: true,
      export: true,
      api_access: false,
      sso: false,
      audit_logs: false,
      priority_support: false,
    },
    is_active: true,
    is_featured: true,
    display_order: 2,
    metadata: {},
    created_at: '',
    updated_at: '',
  };

  const usage: UsageTracking = {
    id: 'usage_123',
    subscription_id: 'sub_123',
    user_id: 'user_123',
    period_start: '2026-01-01T00:00:00Z',
    period_end: '2026-02-01T00:00:00Z',
    signals_count: 342,
    decisions_count: 45,
    ai_requests_count: 287,
    storage_used_mb: 1250,
    team_members_count: 1,
    api_calls_count: 0,
    signals_limit: 500,
    decisions_limit: 100,
    ai_requests_limit: 500,
    storage_limit_mb: 5000,
    signals_usage_percent: 68.4,
    metadata: {},
    created_at: '',
    updated_at: '',
  };

  const daysRemaining = Math.ceil(
    (new Date(subscription.current_period_end!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const handleCancelSubscription = useCallback(() => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel? Your subscription will remain active until the end of the current billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Subscription Canceled', 'Your subscription will end on ' + new Date(subscription.current_period_end!).toLocaleDateString());
          },
        },
      ]
    );
  }, [subscription.current_period_end]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content}>
        {/* Plan Overview */}
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{subscription.status}</Text>
              </View>
            </View>
            <View style={styles.priceBox}>
              <Text style={styles.price}>${plan.price_monthly}</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
          </View>

          <View style={styles.billingInfo}>
            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>Billing Cycle</Text>
              <Text style={styles.billingValue}>{subscription.billing_cycle}</Text>
            </View>
            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>Next Billing Date</Text>
              <Text style={styles.billingValue}>
                {new Date(subscription.current_period_end!).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.billingRow}>
              <Text style={styles.billingLabel}>Days Remaining</Text>
              <Text style={styles.billingValue}>{daysRemaining} days</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
              <Ionicons name="arrow-up-circle-outline" size={20} color="#000" />
              <Text style={styles.upgradeButtonText}>Upgrade Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSubscription}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Usage Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Usage</Text>
          <View style={styles.usageCard}>
            <UsageBar
              label="Signals Today"
              current={usage.signals_count}
              limit={plan.max_signals_per_day}
            />
            <UsageBar
              label="Decisions This Month"
              current={usage.decisions_count}
              limit={plan.max_decisions_per_month}
            />
            <UsageBar
              label="AI Requests Today"
              current={usage.ai_requests_count}
              limit={plan.max_ai_requests_per_day}
            />
            <UsageBar
              label="Storage"
              current={usage.storage_used_mb}
              limit={plan.max_storage_mb}
              unit="MB"
            />
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Included Features</Text>
          <View style={styles.featuresGrid}>
            {Object.entries(plan.features_included)
              .filter(([, enabled]) => enabled)
              .map(([feature]) => (
                <View key={feature} style={styles.featureChip}>
                  <Ionicons name="checkmark" size={14} color={ORACLE_COLORS.act} />
                  <Text style={styles.featureChipText}>
                    {feature.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Text>
                </View>
              ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  planCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: ORACLE_COLORS.orient,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  planName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORACLE_COLORS.act,
  },
  statusText: {
    fontSize: 13,
    color: ORACLE_COLORS.act,
    textTransform: 'capitalize',
  },
  priceBox: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  pricePeriod: {
    fontSize: 14,
    color: '#888',
  },
  billingInfo: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  billingLabel: {
    fontSize: 14,
    color: '#888',
  },
  billingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  upgradeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.orient,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  usageCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  usageItem: {
    gap: 8,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  usageLabel: {
    fontSize: 14,
    color: '#fff',
  },
  usageValue: {
    fontSize: 13,
    color: '#888',
  },
  usageBarBg: {
    height: 6,
    backgroundColor: '#222',
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 3,
  },
  usageBarWarning: {
    backgroundColor: ORACLE_COLORS.orient,
  },
  usageBarCritical: {
    backgroundColor: ORACLE_COLORS.decide,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  featureChipText: {
    fontSize: 12,
    color: '#fff',
  },
});

export default CurrentPlan;
