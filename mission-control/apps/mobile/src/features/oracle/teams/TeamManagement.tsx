/**
 * Team Management Screen
 * Story team-4 - Main team management interface
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  Organization,
  Team,
  TeamMember,
  TeamMemberRole,
  OrganizationWithTeams,
} from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../theme';

// Mock data for demo
const mockOrganization: OrganizationWithTeams = {
  id: '1',
  owner_id: 'user-1',
  name: 'My Company',
  slug: 'my-company',
  plan: 'pro',
  is_active: true,
  settings: {},
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  teams: [
    {
      id: 'team-1',
      org_id: '1',
      name: 'Engineering',
      description: 'Product development team',
      is_default: true,
      settings: {},
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      member_count: 5,
    },
    {
      id: 'team-2',
      org_id: '1',
      name: 'Design',
      description: 'UX and visual design team',
      is_default: false,
      settings: {},
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      member_count: 3,
    },
  ],
  team_count: 2,
};

// Role colors
const ROLE_COLORS: Record<TeamMemberRole, string> = {
  owner: ORACLE_COLORS.decide,
  admin: ORACLE_COLORS.orient,
  member: ORACLE_COLORS.observe,
  viewer: '#808080',
};

// Plan badges
const PLAN_BADGES: Record<string, { color: string; label: string }> = {
  free: { color: '#666', label: 'Free' },
  pro: { color: ORACLE_COLORS.observe, label: 'Pro' },
  business: { color: ORACLE_COLORS.orient, label: 'Business' },
  enterprise: { color: ORACLE_COLORS.decide, label: 'Enterprise' },
};

interface TeamCardProps {
  team: Team;
  onPress: () => void;
  isDefault: boolean;
}

function TeamCard({ team, onPress, isDefault }: TeamCardProps) {
  return (
    <TouchableOpacity style={styles.teamCard} onPress={onPress}>
      <View style={styles.teamCardHeader}>
        <View style={styles.teamIconContainer}>
          <Ionicons name="people" size={24} color={ORACLE_COLORS.observe} />
        </View>
        <View style={styles.teamCardInfo}>
          <View style={styles.teamNameRow}>
            <Text style={styles.teamName}>{team.name}</Text>
            {isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>
          <Text style={styles.teamDescription} numberOfLines={1}>
            {team.description || 'No description'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
      <View style={styles.teamCardFooter}>
        <Ionicons name="person-outline" size={14} color="#888" />
        <Text style={styles.memberCount}>{team.member_count || 0} members</Text>
      </View>
    </TouchableOpacity>
  );
}

interface CreateTeamModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}

function CreateTeamModal({ visible, onClose, onCreate }: CreateTeamModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Team name is required');
      return;
    }
    onCreate(name.trim(), description.trim());
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Team</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Team Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Enter team name"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter team description"
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Team</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface Props {
  navigation: any;
}

export function TeamManagement({ navigation }: Props) {
  const [organization, setOrganization] = useState<OrganizationWithTeams | null>(mockOrganization);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // In production, fetch from API
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleCreateTeam = (name: string, description: string) => {
    // In production, call API
    Alert.alert('Success', `Team "${name}" created`);
  };

  const handleTeamPress = (team: Team) => {
    navigation.navigate('MemberList', { team });
  };

  const handleOrgSettings = () => {
    navigation.navigate('OrgSettings', { organization });
  };

  if (!organization) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={64} color="#444" />
          <Text style={styles.emptyStateTitle}>No Organization</Text>
          <Text style={styles.emptyStateText}>
            Create or join an organization to collaborate with your team.
          </Text>
          <TouchableOpacity style={styles.createOrgButton}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createOrgButtonText}>Create Organization</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const planBadge = PLAN_BADGES[organization.plan];

  return (
    <SafeAreaView style={styles.container}>
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
        {/* Organization Header */}
        <View style={styles.orgHeader}>
          <View style={styles.orgLogoContainer}>
            <Ionicons name="business" size={32} color={ORACLE_COLORS.orient} />
          </View>
          <View style={styles.orgInfo}>
            <Text style={styles.orgName}>{organization.name}</Text>
            <View style={styles.planBadge}>
              <Text style={[styles.planBadgeText, { color: planBadge.color }]}>
                {planBadge.label}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.settingsButton} onPress={handleOrgSettings}>
            <Ionicons name="settings-outline" size={24} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{organization.team_count}</Text>
            <Text style={styles.statLabel}>Teams</Text>
          </View>
          <View style={[styles.statItem, styles.statItemBorder]}>
            <Text style={styles.statValue}>
              {organization.teams.reduce((sum, t) => sum + (t.member_count || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: ORACLE_COLORS.act }]}>
              {organization.is_active ? 'Active' : 'Inactive'}
            </Text>
            <Text style={styles.statLabel}>Status</Text>
          </View>
        </View>

        {/* Teams Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Teams</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setCreateModalVisible(true)}
            >
              <Ionicons name="add" size={20} color={ORACLE_COLORS.observe} />
              <Text style={styles.addButtonText}>New Team</Text>
            </TouchableOpacity>
          </View>

          {organization.teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onPress={() => handleTeamPress(team)}
              isDefault={team.is_default}
            />
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('InviteMember')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: ORACLE_COLORS.observe + '22' }]}>
                <Ionicons name="person-add" size={24} color={ORACLE_COLORS.observe} />
              </View>
              <Text style={styles.quickActionText}>Invite Member</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('TeamSettings')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: ORACLE_COLORS.orient + '22' }]}>
                <Ionicons name="cog" size={24} color={ORACLE_COLORS.orient} />
              </View>
              <Text style={styles.quickActionText}>Team Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickAction}>
              <View style={[styles.quickActionIcon, { backgroundColor: ORACLE_COLORS.decide + '22' }]}>
                <Ionicons name="analytics" size={24} color={ORACLE_COLORS.decide} />
              </View>
              <Text style={styles.quickActionText}>Analytics</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <CreateTeamModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={handleCreateTeam}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  orgLogoContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  settingsButton: {
    padding: 8,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#111',
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#333',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: ORACLE_COLORS.observe + '22',
    borderRadius: 8,
  },
  addButtonText: {
    color: ORACLE_COLORS.observe,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  teamCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  teamCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: ORACLE_COLORS.observe + '22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  teamCardInfo: {
    flex: 1,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  defaultBadge: {
    backgroundColor: ORACLE_COLORS.observe + '33',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  defaultBadgeText: {
    color: ORACLE_COLORS.observe,
    fontSize: 10,
    fontWeight: '600',
  },
  teamDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  teamCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  memberCount: {
    color: '#888',
    fontSize: 13,
    marginLeft: 6,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    color: '#888',
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  createOrgButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.observe,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createOrgButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.observe,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default TeamManagement;
