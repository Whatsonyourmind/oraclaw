/**
 * Member List Screen
 * Story team-4 - Team members with roles display
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Team, TeamMember, TeamMemberRole, User } from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../theme';

// Role configuration
const ROLE_CONFIG: Record<TeamMemberRole, { color: string; icon: string; label: string }> = {
  owner: { color: ORACLE_COLORS.decide, icon: 'star', label: 'Owner' },
  admin: { color: ORACLE_COLORS.orient, icon: 'shield', label: 'Admin' },
  member: { color: ORACLE_COLORS.observe, icon: 'person', label: 'Member' },
  viewer: { color: '#808080', icon: 'eye', label: 'Viewer' },
};

// Mock data
const mockMembers: (TeamMember & { user: User })[] = [
  {
    id: '1',
    team_id: 'team-1',
    user_id: 'user-1',
    role: 'owner',
    joined_at: '2024-01-15T00:00:00Z',
    permissions: { can_invite: true, can_manage_members: true },
    metadata: {},
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    user: {
      id: 'user-1',
      email: 'owner@company.com',
      created_at: '2024-01-01T00:00:00Z',
      subscription_tier: 'pro',
    },
  },
  {
    id: '2',
    team_id: 'team-1',
    user_id: 'user-2',
    role: 'admin',
    joined_at: '2024-02-01T00:00:00Z',
    permissions: { can_invite: true, can_manage_members: true },
    metadata: {},
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
    user: {
      id: 'user-2',
      email: 'admin@company.com',
      created_at: '2024-01-15T00:00:00Z',
      subscription_tier: 'pro',
    },
  },
  {
    id: '3',
    team_id: 'team-1',
    user_id: 'user-3',
    role: 'member',
    joined_at: '2024-02-15T00:00:00Z',
    permissions: { can_invite: false, can_manage_members: false },
    metadata: {},
    created_at: '2024-02-15T00:00:00Z',
    updated_at: '2024-02-15T00:00:00Z',
    user: {
      id: 'user-3',
      email: 'developer@company.com',
      created_at: '2024-02-01T00:00:00Z',
      subscription_tier: 'free',
    },
  },
  {
    id: '4',
    team_id: 'team-1',
    user_id: 'user-4',
    role: 'viewer',
    joined_at: '2024-03-01T00:00:00Z',
    permissions: { can_invite: false, can_manage_members: false },
    metadata: {},
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z',
    user: {
      id: 'user-4',
      email: 'viewer@company.com',
      created_at: '2024-02-15T00:00:00Z',
      subscription_tier: 'free',
    },
  },
];

interface MemberCardProps {
  member: TeamMember & { user: User };
  isCurrentUser: boolean;
  canManage: boolean;
  onRoleChange: () => void;
  onRemove: () => void;
}

function MemberCard({ member, isCurrentUser, canManage, onRoleChange, onRemove }: MemberCardProps) {
  const roleConfig = ROLE_CONFIG[member.role];
  const initials = member.user.email.substring(0, 2).toUpperCase();
  const joinDate = new Date(member.joined_at).toLocaleDateString();

  return (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <View style={[styles.avatar, { backgroundColor: roleConfig.color + '33' }]}>
          <Text style={[styles.avatarText, { color: roleConfig.color }]}>{initials}</Text>
        </View>
        <View style={styles.memberDetails}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberEmail}>{member.user.email}</Text>
            {isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>You</Text>
              </View>
            )}
          </View>
          <View style={styles.memberMeta}>
            <View style={[styles.roleBadge, { backgroundColor: roleConfig.color + '22' }]}>
              <Ionicons name={roleConfig.icon as any} size={12} color={roleConfig.color} />
              <Text style={[styles.roleBadgeText, { color: roleConfig.color }]}>
                {roleConfig.label}
              </Text>
            </View>
            <Text style={styles.joinDate}>Joined {joinDate}</Text>
          </View>
        </View>
      </View>

      {canManage && !isCurrentUser && member.role !== 'owner' && (
        <View style={styles.memberActions}>
          <TouchableOpacity style={styles.actionButton} onPress={onRoleChange}>
            <Ionicons name="swap-horizontal" size={18} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onRemove}>
            <Ionicons name="trash-outline" size={18} color={ORACLE_COLORS.decide} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

interface RoleChangeModalProps {
  visible: boolean;
  member: (TeamMember & { user: User }) | null;
  onClose: () => void;
  onConfirm: (newRole: TeamMemberRole) => void;
}

function RoleChangeModal({ visible, member, onClose, onConfirm }: RoleChangeModalProps) {
  const [selectedRole, setSelectedRole] = useState<TeamMemberRole | null>(null);

  if (!member) return null;

  const availableRoles: TeamMemberRole[] = ['admin', 'member', 'viewer'];

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
            <Text style={styles.modalTitle}>Change Role</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>
            Select a new role for {member.user.email}
          </Text>

          <View style={styles.roleOptions}>
            {availableRoles.map((role) => {
              const config = ROLE_CONFIG[role];
              const isSelected = selectedRole === role || (!selectedRole && member.role === role);

              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    isSelected && styles.roleOptionSelected,
                    isSelected && { borderColor: config.color },
                  ]}
                  onPress={() => setSelectedRole(role)}
                >
                  <View style={[styles.roleIconContainer, { backgroundColor: config.color + '22' }]}>
                    <Ionicons name={config.icon as any} size={24} color={config.color} />
                  </View>
                  <Text style={styles.roleOptionText}>{config.label}</Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={config.color} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                !selectedRole && styles.confirmButtonDisabled,
              ]}
              onPress={() => selectedRole && onConfirm(selectedRole)}
              disabled={!selectedRole}
            >
              <Text style={styles.confirmButtonText}>Update Role</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface Props {
  navigation: any;
  route: {
    params: {
      team: Team;
    };
  };
}

export function MemberList({ navigation, route }: Props) {
  const { team } = route.params;
  const [members, setMembers] = useState(mockMembers);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<(TeamMember & { user: User }) | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const currentUserId = 'user-1'; // Mock current user
  const currentMember = members.find((m) => m.user_id === currentUserId);
  const canManage = currentMember && ['owner', 'admin'].includes(currentMember.role);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleRoleChange = (member: TeamMember & { user: User }) => {
    setSelectedMember(member);
    setRoleModalVisible(true);
  };

  const handleConfirmRoleChange = (newRole: TeamMemberRole) => {
    if (selectedMember) {
      // In production, call API
      setMembers(prev =>
        prev.map(m =>
          m.id === selectedMember.id ? { ...m, role: newRole } : m
        )
      );
      Alert.alert('Success', `Role updated to ${ROLE_CONFIG[newRole].label}`);
    }
    setRoleModalVisible(false);
    setSelectedMember(null);
  };

  const handleRemoveMember = (member: TeamMember & { user: User }) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.user.email} from ${team.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            // In production, call API
            setMembers(prev => prev.filter(m => m.id !== member.id));
            Alert.alert('Success', 'Member removed');
          },
        },
      ]
    );
  };

  // Group members by role
  const membersByRole: Record<TeamMemberRole, typeof members> = {
    owner: members.filter(m => m.role === 'owner'),
    admin: members.filter(m => m.role === 'admin'),
    member: members.filter(m => m.role === 'member'),
    viewer: members.filter(m => m.role === 'viewer'),
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
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{team.name}</Text>
          <Text style={styles.subtitle}>{members.length} members</Text>
        </View>
        <TouchableOpacity
          style={styles.inviteButton}
          onPress={() => navigation.navigate('InviteMember', { team })}
        >
          <Ionicons name="person-add" size={20} color={ORACLE_COLORS.observe} />
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
        {/* Render members by role */}
        {(['owner', 'admin', 'member', 'viewer'] as TeamMemberRole[]).map(role => {
          const roleMembers = membersByRole[role];
          if (roleMembers.length === 0) return null;

          const config = ROLE_CONFIG[role];

          return (
            <View key={role} style={styles.roleSection}>
              <View style={styles.roleSectionHeader}>
                <Ionicons name={config.icon as any} size={16} color={config.color} />
                <Text style={[styles.roleSectionTitle, { color: config.color }]}>
                  {config.label}s ({roleMembers.length})
                </Text>
              </View>

              {roleMembers.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  isCurrentUser={member.user_id === currentUserId}
                  canManage={!!canManage}
                  onRoleChange={() => handleRoleChange(member)}
                  onRemove={() => handleRemoveMember(member)}
                />
              ))}
            </View>
          );
        })}

        {/* Pending Invites Placeholder */}
        <View style={styles.pendingSection}>
          <View style={styles.pendingSectionHeader}>
            <Ionicons name="mail-outline" size={16} color="#888" />
            <Text style={styles.pendingSectionTitle}>Pending Invites (0)</Text>
          </View>
          <Text style={styles.pendingPlaceholder}>
            No pending invitations
          </Text>
        </View>
      </ScrollView>

      <RoleChangeModal
        visible={roleModalVisible}
        member={selectedMember}
        onClose={() => {
          setRoleModalVisible(false);
          setSelectedMember(null);
        }}
        onConfirm={handleConfirmRoleChange}
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
    color: '#888',
    marginTop: 2,
  },
  inviteButton: {
    padding: 8,
    backgroundColor: ORACLE_COLORS.observe + '22',
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  roleSection: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  roleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberDetails: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberEmail: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  youBadge: {
    backgroundColor: ORACLE_COLORS.observe + '33',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  youBadgeText: {
    color: ORACLE_COLORS.observe,
    fontSize: 10,
    fontWeight: '600',
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  joinDate: {
    fontSize: 11,
    color: '#666',
    marginLeft: 8,
  },
  memberActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  pendingSection: {
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 32,
  },
  pendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pendingSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginLeft: 8,
  },
  pendingPlaceholder: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 24,
    backgroundColor: '#111',
    borderRadius: 12,
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
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  roleOptions: {
    gap: 12,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#222',
    borderRadius: 12,
    padding: 16,
  },
  roleOptionSelected: {
    backgroundColor: '#1a1a1a',
  },
  roleIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
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
  confirmButton: {
    backgroundColor: ORACLE_COLORS.observe,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MemberList;
