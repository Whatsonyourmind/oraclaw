/**
 * Organization Settings Screen
 * Story team-4 - Organization-level configuration
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import type { Organization, OrgPlan, ContentVisibility } from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../theme';

// Plan details
const PLAN_DETAILS: Record<OrgPlan, { color: string; features: string[] }> = {
  free: {
    color: '#666',
    features: ['1 Team', '3 Members', 'Basic Features'],
  },
  pro: {
    color: ORACLE_COLORS.observe,
    features: ['5 Teams', '20 Members', 'Advanced Analytics', 'Integrations'],
  },
  business: {
    color: ORACLE_COLORS.orient,
    features: ['Unlimited Teams', '100 Members', 'SSO', 'Priority Support'],
  },
  enterprise: {
    color: ORACLE_COLORS.decide,
    features: ['Unlimited Everything', 'Custom Integrations', 'Dedicated Support', 'SLA'],
  },
};

interface SectionProps {
  title: string;
  icon: string;
  iconColor?: string;
  children: React.ReactNode;
}

function Section({ title, icon, iconColor = ORACLE_COLORS.observe, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      {children}
    </View>
  );
}

interface ToggleSettingProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function ToggleSetting({ label, description, value, onChange }: ToggleSettingProps) {
  return (
    <SettingRow label={label} description={description}>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#333', true: ORACLE_COLORS.observe + '88' }}
        thumbColor={value ? ORACLE_COLORS.observe : '#666'}
      />
    </SettingRow>
  );
}

interface Props {
  navigation: any;
  route: {
    params?: {
      organization?: Organization;
    };
  };
}

export function OrgSettings({ navigation, route }: Props) {
  const org = route.params?.organization;
  const [refreshing, setRefreshing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Settings state
  const [orgName, setOrgName] = useState(org?.name || '');
  const [billingEmail, setBillingEmail] = useState(org?.billing_email || '');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiDailyLimit, setAiDailyLimit] = useState(1000);
  const [require2FA, setRequire2FA] = useState(false);
  const [retentionDays, setRetentionDays] = useState(365);
  const [autoArchive, setAutoArchive] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [slackEnabled, setSlackEnabled] = useState(false);

  const planDetails = PLAN_DETAILS[org?.plan || 'free'];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleSave = () => {
    Alert.alert('Success', 'Organization settings saved', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const handleUpgrade = () => {
    navigation.navigate('SubscriptionPlans');
  };

  const handleTransferOwnership = () => {
    Alert.alert(
      'Transfer Ownership',
      'This will transfer all ownership rights to another member. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            // Navigate to member selection
          },
        },
      ]
    );
  };

  const updateSetting = <T,>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (value: T) => {
      setter(value);
      setHasChanges(true);
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Organization Settings</Text>
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
        {/* Current Plan */}
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planLabel}>Current Plan</Text>
              <Text style={[styles.planName, { color: planDetails.color }]}>
                {(org?.plan || 'free').toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
              <Text style={styles.upgradeButtonText}>Upgrade</Text>
              <Ionicons name="arrow-forward" size={16} color={ORACLE_COLORS.observe} />
            </TouchableOpacity>
          </View>
          <View style={styles.planFeatures}>
            {planDetails.features.map((feature, index) => (
              <View key={index} style={styles.planFeature}>
                <Ionicons name="checkmark" size={16} color={planDetails.color} />
                <Text style={styles.planFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Basic Info */}
        <Section title="Organization Info" icon="business">
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Organization Name</Text>
            <TextInput
              style={styles.textInput}
              value={orgName}
              onChangeText={updateSetting(setOrgName)}
              placeholder="Enter organization name"
              placeholderTextColor="#666"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Billing Email</Text>
            <TextInput
              style={styles.textInput}
              value={billingEmail}
              onChangeText={updateSetting(setBillingEmail)}
              placeholder="billing@company.com"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </Section>

        {/* AI Settings */}
        <Section title="AI Configuration" icon="sparkles" iconColor={ORACLE_COLORS.orient}>
          <ToggleSetting
            label="Enable AI Features"
            description="Use AI for predictions and recommendations"
            value={aiEnabled}
            onChange={updateSetting(setAiEnabled)}
          />
          <View style={styles.sliderSetting}>
            <View style={styles.sliderHeader}>
              <Text style={styles.settingLabel}>Daily AI Request Limit</Text>
              <Text style={styles.sliderValue}>{aiDailyLimit}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={100}
              maximumValue={10000}
              step={100}
              value={aiDailyLimit}
              onValueChange={updateSetting(setAiDailyLimit)}
              minimumTrackTintColor={ORACLE_COLORS.observe}
              maximumTrackTintColor="#333"
              thumbTintColor={ORACLE_COLORS.observe}
            />
          </View>
        </Section>

        {/* Security */}
        <Section title="Security" icon="shield" iconColor={ORACLE_COLORS.decide}>
          <ToggleSetting
            label="Require Two-Factor Authentication"
            description="All members must enable 2FA"
            value={require2FA}
            onChange={updateSetting(setRequire2FA)}
          />
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkButtonText}>Manage Allowed Domains</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkButtonText}>IP Whitelist</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </Section>

        {/* Data Retention */}
        <Section title="Data Retention" icon="archive" iconColor="#888">
          <View style={styles.sliderSetting}>
            <View style={styles.sliderHeader}>
              <Text style={styles.settingLabel}>Retention Period</Text>
              <Text style={styles.sliderValue}>{retentionDays} days</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={30}
              maximumValue={730}
              step={30}
              value={retentionDays}
              onValueChange={updateSetting(setRetentionDays)}
              minimumTrackTintColor={ORACLE_COLORS.observe}
              maximumTrackTintColor="#333"
              thumbTintColor={ORACLE_COLORS.observe}
            />
          </View>
          <ToggleSetting
            label="Auto-Archive"
            description="Automatically archive old data"
            value={autoArchive}
            onChange={updateSetting(setAutoArchive)}
          />
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon="notifications" iconColor={ORACLE_COLORS.act}>
          <ToggleSetting
            label="Email Notifications"
            description="Send notifications via email"
            value={emailNotifs}
            onChange={updateSetting(setEmailNotifs)}
          />
          <ToggleSetting
            label="Push Notifications"
            description="Send mobile push notifications"
            value={pushNotifs}
            onChange={updateSetting(setPushNotifs)}
          />
          <ToggleSetting
            label="Slack Integration"
            description="Send notifications to Slack"
            value={slackEnabled}
            onChange={updateSetting(setSlackEnabled)}
          />
        </Section>

        {/* Ownership */}
        <Section title="Ownership" icon="key" iconColor={ORACLE_COLORS.decide}>
          <TouchableOpacity style={styles.dangerButton} onPress={handleTransferOwnership}>
            <Ionicons name="swap-horizontal" size={20} color={ORACLE_COLORS.orient} />
            <Text style={[styles.dangerButtonText, { color: ORACLE_COLORS.orient }]}>
              Transfer Ownership
            </Text>
          </TouchableOpacity>
          <Text style={styles.dangerDescription}>
            Transfer ownership to another organization member
          </Text>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
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
  planCard: {
    backgroundColor: '#111',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  planName: {
    fontSize: 24,
    fontWeight: '700',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.observe + '22',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: ORACLE_COLORS.observe,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  planFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  planFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 8,
  },
  planFeatureText: {
    fontSize: 13,
    color: '#ccc',
    marginLeft: 8,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  sectionContent: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
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
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  sliderSetting: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderValue: {
    fontSize: 14,
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  linkButtonText: {
    fontSize: 15,
    color: '#fff',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: ORACLE_COLORS.orient,
    borderRadius: 8,
    marginBottom: 8,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  dangerDescription: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
});

export default OrgSettings;
