/**
 * SubscriptionPlans.tsx
 * Story sub-3 - Plan comparison and selection
 *
 * Features:
 * - Plan comparison with features
 * - Current plan indicator
 * - Upgrade/downgrade flow
 * - Billing cycle toggle
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { SubscriptionPlan, BillingCycle, PlanFeatures } from '@mission-control/shared-types';

const ORACLE_COLORS = {
  observe: '#00BFFF',
  orient: '#FFD700',
  decide: '#FF6B6B',
  act: '#00FF88',
};

// Mock plans data
const MOCK_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_free',
    name: 'Free',
    slug: 'free',
    description: 'Get started with ORACLE basics',
    plan_tier: 'free',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'USD',
    max_users: 1,
    max_teams: 1,
    max_signals_per_day: 50,
    max_decisions_per_month: 20,
    max_ai_requests_per_day: 50,
    max_storage_mb: 100,
    max_integrations: 3,
    trial_days: 0,
    features_included: {
      oracle: true,
      analytics: false,
      ai_tuning: false,
      voice: false,
      widgets: false,
      export: false,
      api_access: false,
      sso: false,
      audit_logs: false,
      priority_support: false,
    },
    is_active: true,
    is_featured: false,
    display_order: 1,
    metadata: {},
    created_at: '',
    updated_at: '',
  },
  {
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
    badge_text: 'Most Popular',
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
  },
  {
    id: 'plan_business',
    name: 'Business',
    slug: 'business',
    description: 'For teams and organizations',
    plan_tier: 'business',
    price_monthly: 49.99,
    price_yearly: 499.99,
    currency: 'USD',
    max_users: 10,
    max_teams: 10,
    max_signals_per_day: 2000,
    max_decisions_per_month: 500,
    max_ai_requests_per_day: 2000,
    max_storage_mb: 50000,
    max_integrations: -1,
    trial_days: 14,
    features_included: {
      oracle: true,
      analytics: true,
      ai_tuning: true,
      voice: true,
      widgets: true,
      export: true,
      api_access: true,
      sso: false,
      audit_logs: true,
      priority_support: true,
    },
    is_active: true,
    is_featured: false,
    display_order: 3,
    metadata: {},
    created_at: '',
    updated_at: '',
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'For large organizations with advanced needs',
    plan_tier: 'enterprise',
    price_monthly: 199.99,
    price_yearly: 1999.99,
    currency: 'USD',
    max_users: -1,
    max_teams: -1,
    max_signals_per_day: -1,
    max_decisions_per_month: -1,
    max_ai_requests_per_day: -1,
    max_storage_mb: -1,
    max_integrations: -1,
    trial_days: 30,
    features_included: {
      oracle: true,
      analytics: true,
      ai_tuning: true,
      voice: true,
      widgets: true,
      export: true,
      api_access: true,
      sso: true,
      audit_logs: true,
      priority_support: true,
    },
    is_active: true,
    is_featured: false,
    display_order: 4,
    metadata: {},
    created_at: '',
    updated_at: '',
  },
];

const FEATURE_LABELS: Record<keyof PlanFeatures, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  oracle: { label: 'ORACLE System', icon: 'eye-outline' },
  analytics: { label: 'Analytics Dashboard', icon: 'bar-chart-outline' },
  ai_tuning: { label: 'AI Fine-tuning', icon: 'settings-outline' },
  voice: { label: 'Voice Commands', icon: 'mic-outline' },
  widgets: { label: 'Home Widgets', icon: 'apps-outline' },
  export: { label: 'Data Export', icon: 'download-outline' },
  api_access: { label: 'API Access', icon: 'code-outline' },
  sso: { label: 'SSO/SAML', icon: 'key-outline' },
  audit_logs: { label: 'Audit Logs', icon: 'document-text-outline' },
  priority_support: { label: 'Priority Support', icon: 'headset-outline' },
};

interface PlanCardProps {
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  isCurrentPlan: boolean;
  onSelect: () => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, billingCycle, isCurrentPlan, onSelect }) => {
  const price = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  const monthlyEquivalent = billingCycle === 'yearly' ? price / 12 : price;
  const savings = billingCycle === 'yearly' ? (plan.price_monthly * 12) - plan.price_yearly : 0;

  return (
    <View style={[styles.planCard, plan.is_featured && styles.featuredCard, isCurrentPlan && styles.currentPlanCard]}>
      {plan.badge_text && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{plan.badge_text}</Text>
        </View>
      )}
      {isCurrentPlan && (
        <View style={[styles.badge, styles.currentBadge]}>
          <Text style={styles.badgeText}>Current Plan</Text>
        </View>
      )}

      <Text style={styles.planName}>{plan.name}</Text>
      <Text style={styles.planDescription}>{plan.description}</Text>

      <View style={styles.priceContainer}>
        <Text style={styles.currency}>$</Text>
        <Text style={styles.price}>{monthlyEquivalent.toFixed(2)}</Text>
        <Text style={styles.period}>/mo</Text>
      </View>

      {billingCycle === 'yearly' && savings > 0 && (
        <View style={styles.savingsBadge}>
          <Text style={styles.savingsText}>Save ${savings.toFixed(0)}/year</Text>
        </View>
      )}

      <View style={styles.limitsSection}>
        <View style={styles.limitRow}>
          <Text style={styles.limitLabel}>Users</Text>
          <Text style={styles.limitValue}>
            {plan.max_users === -1 ? 'Unlimited' : plan.max_users}
          </Text>
        </View>
        <View style={styles.limitRow}>
          <Text style={styles.limitLabel}>Signals/day</Text>
          <Text style={styles.limitValue}>
            {plan.max_signals_per_day === -1 ? 'Unlimited' : plan.max_signals_per_day}
          </Text>
        </View>
        <View style={styles.limitRow}>
          <Text style={styles.limitLabel}>AI Requests/day</Text>
          <Text style={styles.limitValue}>
            {plan.max_ai_requests_per_day === -1 ? 'Unlimited' : plan.max_ai_requests_per_day}
          </Text>
        </View>
        <View style={styles.limitRow}>
          <Text style={styles.limitLabel}>Storage</Text>
          <Text style={styles.limitValue}>
            {plan.max_storage_mb === -1 ? 'Unlimited' : `${(plan.max_storage_mb / 1000).toFixed(0)}GB`}
          </Text>
        </View>
      </View>

      <View style={styles.featuresSection}>
        {Object.entries(plan.features_included).map(([key, enabled]) => {
          const feature = FEATURE_LABELS[key as keyof PlanFeatures];
          if (!feature) return null;
          return (
            <View key={key} style={styles.featureRow}>
              <Ionicons
                name={enabled ? 'checkmark-circle' : 'close-circle-outline'}
                size={18}
                color={enabled ? ORACLE_COLORS.act : '#444'}
              />
              <Text style={[styles.featureText, !enabled && styles.featureDisabled]}>
                {feature.label}
              </Text>
            </View>
          );
        })}
      </View>

      {plan.trial_days > 0 && !isCurrentPlan && (
        <Text style={styles.trialText}>{plan.trial_days}-day free trial</Text>
      )}

      <TouchableOpacity
        style={[
          styles.selectButton,
          plan.is_featured && styles.featuredButton,
          isCurrentPlan && styles.currentButton,
        ]}
        onPress={onSelect}
        disabled={isCurrentPlan}
      >
        <Text style={[styles.selectButtonText, isCurrentPlan && styles.currentButtonText]}>
          {isCurrentPlan ? 'Current Plan' : plan.price_monthly === 0 ? 'Get Started' : 'Upgrade'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export const SubscriptionPlans: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState('plan_free'); // Mock current plan

  const handleSelectPlan = useCallback(async (plan: SubscriptionPlan) => {
    if (plan.id === currentPlanId) return;

    const isUpgrade = MOCK_PLANS.findIndex((p) => p.id === plan.id) >
      MOCK_PLANS.findIndex((p) => p.id === currentPlanId);

    Alert.alert(
      isUpgrade ? 'Upgrade Plan' : 'Change Plan',
      `${isUpgrade ? 'Upgrade' : 'Switch'} to ${plan.name} for $${
        billingCycle === 'yearly' ? plan.price_yearly.toFixed(2) : plan.price_monthly.toFixed(2)
      }/${billingCycle === 'yearly' ? 'year' : 'month'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isUpgrade ? 'Upgrade' : 'Switch',
          onPress: async () => {
            setIsLoading(true);
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1500));
            setCurrentPlanId(plan.id);
            setIsLoading(false);
            Alert.alert('Success', `You are now on the ${plan.name} plan!`);
          },
        },
      ]
    );
  }, [billingCycle, currentPlanId]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <Text style={styles.headerSubtitle}>
          Select the plan that best fits your needs
        </Text>
      </View>

      {/* Billing Cycle Toggle */}
      <View style={styles.cycleToggle}>
        <TouchableOpacity
          style={[styles.cycleOption, billingCycle === 'monthly' && styles.cycleOptionActive]}
          onPress={() => setBillingCycle('monthly')}
        >
          <Text style={[styles.cycleText, billingCycle === 'monthly' && styles.cycleTextActive]}>
            Monthly
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cycleOption, billingCycle === 'yearly' && styles.cycleOptionActive]}
          onPress={() => setBillingCycle('yearly')}
        >
          <Text style={[styles.cycleText, billingCycle === 'yearly' && styles.cycleTextActive]}>
            Yearly
          </Text>
          <View style={styles.saveTag}>
            <Text style={styles.saveTagText}>Save 17%</Text>
          </View>
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={ORACLE_COLORS.orient} />
        </View>
      )}

      <ScrollView style={styles.plansContainer} showsVerticalScrollIndicator={false}>
        {MOCK_PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            billingCycle={billingCycle}
            isCurrentPlan={plan.id === currentPlanId}
            onSelect={() => handleSelectPlan(plan)}
          />
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            All plans include 24/7 system availability and regular updates.
          </Text>
          <Text style={styles.footerText}>
            Enterprise customers can contact us for custom pricing.
          </Text>
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
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  cycleToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 4,
  },
  cycleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  cycleOptionActive: {
    backgroundColor: ORACLE_COLORS.orient,
  },
  cycleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  cycleTextActive: {
    color: '#000',
  },
  saveTag: {
    backgroundColor: ORACLE_COLORS.act,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  plansContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  planCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
    position: 'relative',
  },
  featuredCard: {
    borderColor: ORACLE_COLORS.orient,
    borderWidth: 2,
  },
  currentPlanCard: {
    borderColor: ORACLE_COLORS.act,
    borderWidth: 2,
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: ORACLE_COLORS.orient,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentBadge: {
    backgroundColor: ORACLE_COLORS.act,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  currency: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  price: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
  },
  period: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    marginLeft: 4,
  },
  savingsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: ORACLE_COLORS.act,
  },
  limitsSection: {
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  limitLabel: {
    fontSize: 13,
    color: '#888',
  },
  limitValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  featuresSection: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: '#fff',
  },
  featureDisabled: {
    color: '#444',
  },
  trialText: {
    fontSize: 12,
    color: ORACLE_COLORS.observe,
    textAlign: 'center',
    marginBottom: 12,
  },
  selectButton: {
    backgroundColor: '#222',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  featuredButton: {
    backgroundColor: ORACLE_COLORS.orient,
  },
  currentButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: ORACLE_COLORS.act,
  },
  selectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  currentButtonText: {
    color: ORACLE_COLORS.act,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default SubscriptionPlans;
