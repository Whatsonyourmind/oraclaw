/**
 * Team Settings Screen
 * Story team-4 - Team configuration interface
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
import type { Team, TeamSettings as Settings, ContentVisibility } from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../theme';

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

interface VisibilitySelectorProps {
  value: ContentVisibility;
  onChange: (value: ContentVisibility) => void;
}

function VisibilitySelector({ value, onChange }: VisibilitySelectorProps) {
  const options: { value: ContentVisibility; label: string; icon: string }[] = [
    { value: 'private', label: 'Private', icon: 'lock-closed' },
    { value: 'team', label: 'Team', icon: 'people' },
    { value: 'org', label: 'Organization', icon: 'business' },
  ];

  return (
    <View style={styles.visibilitySelector}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.visibilityOption,
            value === option.value && styles.visibilityOptionSelected,
          ]}
          onPress={() => onChange(option.value)}
        >
          <Ionicons
            name={option.icon as any}
            size={18}
            color={value === option.value ? ORACLE_COLORS.observe : '#666'}
          />
          <Text
            style={[
              styles.visibilityOptionText,
              value === option.value && styles.visibilityOptionTextSelected,
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

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

interface Props {
  navigation: any;
  route: {
    params?: {
      team?: Team;
    };
  };
}

export function TeamSettings({ navigation, route }: Props) {
  const team = route.params?.team;
  const [refreshing, setRefreshing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Settings state
  const [teamName, setTeamName] = useState(team?.name || '');
  const [teamDescription, setTeamDescription] = useState(team?.description || '');
  const [decisionVisibility, setDecisionVisibility] = useState<ContentVisibility>(
    team?.settings?.default_decision_visibility || 'private'
  );
  const [planVisibility, setPlanVisibility] = useState<ContentVisibility>(
    team?.settings?.default_plan_visibility || 'private'
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    team?.settings?.notifications_enabled ?? true
  );
  const [signalsEnabled, setSignalsEnabled] = useState(
    team?.settings?.features?.signals ?? true
  );
  const [decisionsEnabled, setDecisionsEnabled] = useState(
    team?.settings?.features?.decisions ?? true
  );
  const [plansEnabled, setPlansEnabled] = useState(
    team?.settings?.features?.plans ?? true
  );
  const [predictionsEnabled, setPredictionsEnabled] = useState(
    team?.settings?.features?.predictions ?? true
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleSave = () => {
    // In production, call API
    Alert.alert('Success', 'Team settings saved', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const handleDeleteTeam = () => {
    if (team?.is_default) {
      Alert.alert('Error', 'Cannot delete the default team');
      return;
    }

    Alert.alert(
      'Delete Team',
      `Are you sure you want to delete "${team?.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // In production, call API
            navigation.goBack();
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
        <Text style={styles.title}>Team Settings</Text>
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
        <Section title="Basic Information" icon="information-circle">
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Team Name</Text>
            <TextInput
              style={styles.textInput}
              value={teamName}
              onChangeText={updateSetting(setTeamName)}
              placeholder="Enter team name"
              placeholderTextColor="#666"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={teamDescription}
              onChangeText={updateSetting(setTeamDescription)}
              placeholder="Enter team description"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
            />
          </View>
        </Section>

        {/* Visibility Defaults */}
        <Section title="Default Visibility" icon="eye" iconColor={ORACLE_COLORS.orient}>
          <View style={styles.visibilityGroup}>
            <Text style={styles.visibilityLabel}>Decisions</Text>
            <Text style={styles.visibilityDescription}>
              Default visibility for new decisions
            </Text>
            <VisibilitySelector
              value={decisionVisibility}
              onChange={updateSetting(setDecisionVisibility)}
            />
          </View>
          <View style={styles.visibilityGroup}>
            <Text style={styles.visibilityLabel}>Execution Plans</Text>
            <Text style={styles.visibilityDescription}>
              Default visibility for new execution plans
            </Text>
            <VisibilitySelector
              value={planVisibility}
              onChange={updateSetting(setPlanVisibility)}
            />
          </View>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon="notifications" iconColor={ORACLE_COLORS.decide}>
          <ToggleSetting
            label="Team Notifications"
            description="Receive notifications for team activity"
            value={notificationsEnabled}
            onChange={updateSetting(setNotificationsEnabled)}
          />
        </Section>

        {/* Features */}
        <Section title="Features" icon="apps" iconColor={ORACLE_COLORS.act}>
          <ToggleSetting
            label="Signals"
            description="Enable signal detection and alerts"
            value={signalsEnabled}
            onChange={updateSetting(setSignalsEnabled)}
          />
          <ToggleSetting
            label="Decisions"
            description="Enable decision analysis and tracking"
            value={decisionsEnabled}
            onChange={updateSetting(setDecisionsEnabled)}
          />
          <ToggleSetting
            label="Execution Plans"
            description="Enable execution plan creation"
            value={plansEnabled}
            onChange={updateSetting(setPlansEnabled)}
          />
          <ToggleSetting
            label="Predictions"
            description="Enable predictive analytics"
            value={predictionsEnabled}
            onChange={updateSetting(setPredictionsEnabled)}
          />
        </Section>

        {/* Danger Zone */}
        {!team?.is_default && (
          <Section title="Danger Zone" icon="warning" iconColor={ORACLE_COLORS.decide}>
            <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteTeam}>
              <Ionicons name="trash-outline" size={20} color={ORACLE_COLORS.decide} />
              <Text style={styles.dangerButtonText}>Delete Team</Text>
            </TouchableOpacity>
            <Text style={styles.dangerDescription}>
              Permanently delete this team and all associated data. This action cannot be undone.
            </Text>
          </Section>
        )}

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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
  visibilityGroup: {
    marginBottom: 20,
  },
  visibilityLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  visibilityDescription: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    marginBottom: 12,
  },
  visibilitySelector: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
  },
  visibilityOptionSelected: {
    backgroundColor: ORACLE_COLORS.observe + '22',
  },
  visibilityOptionText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
  },
  visibilityOptionTextSelected: {
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: ORACLE_COLORS.decide,
    borderRadius: 8,
    marginBottom: 8,
  },
  dangerButtonText: {
    color: ORACLE_COLORS.decide,
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

export default TeamSettings;
