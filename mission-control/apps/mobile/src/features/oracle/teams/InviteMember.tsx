/**
 * Invite Member Screen
 * Story team-4 - Team member invitation flow
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Team, TeamMemberRole } from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../theme';

interface RoleOption {
  role: Exclude<TeamMemberRole, 'owner'>;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'admin',
    title: 'Admin',
    description: 'Can manage team settings, members, and all content',
    icon: 'shield',
    color: ORACLE_COLORS.orient,
  },
  {
    role: 'member',
    title: 'Member',
    description: 'Can create and edit content, view analytics',
    icon: 'person',
    color: ORACLE_COLORS.observe,
  },
  {
    role: 'viewer',
    title: 'Viewer',
    description: 'Can only view content, no editing permissions',
    icon: 'eye',
    color: '#808080',
  },
];

interface RoleSelectorProps {
  selectedRole: Exclude<TeamMemberRole, 'owner'>;
  onSelectRole: (role: Exclude<TeamMemberRole, 'owner'>) => void;
}

function RoleSelector({ selectedRole, onSelectRole }: RoleSelectorProps) {
  return (
    <View style={styles.roleSelector}>
      {ROLE_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.role}
          style={[
            styles.roleOption,
            selectedRole === option.role && styles.roleOptionSelected,
            selectedRole === option.role && { borderColor: option.color },
          ]}
          onPress={() => onSelectRole(option.role)}
        >
          <View style={[styles.roleIconContainer, { backgroundColor: option.color + '22' }]}>
            <Ionicons name={option.icon as any} size={24} color={option.color} />
          </View>
          <View style={styles.roleInfo}>
            <Text style={styles.roleTitle}>{option.title}</Text>
            <Text style={styles.roleDescription}>{option.description}</Text>
          </View>
          {selectedRole === option.role && (
            <Ionicons name="checkmark-circle" size={24} color={option.color} />
          )}
        </TouchableOpacity>
      ))}
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

export function InviteMember({ navigation, route }: Props) {
  const team = route.params?.team;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<TeamMemberRole, 'owner'>>('member');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSendInvite = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    // In production, call API
    await new Promise(resolve => setTimeout(resolve, 1000));

    setLoading(false);

    Alert.alert(
      'Invite Sent',
      `An invitation has been sent to ${email.trim()}`,
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Invite Member</Text>
            <View style={{ width: 40 }} />
          </View>

          {team && (
            <View style={styles.teamInfo}>
              <Ionicons name="people" size={20} color={ORACLE_COLORS.observe} />
              <Text style={styles.teamName}>{team.name}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email Address</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="colleague@company.com"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Role Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Role</Text>
            <RoleSelector selectedRole={role} onSelectRole={setRole} />
          </View>

          {/* Personal Message */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Personal Message <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Add a personal note to your invitation..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Invite Preview */}
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>Invite Preview</Text>
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Ionicons name="mail-outline" size={24} color={ORACLE_COLORS.observe} />
                <Text style={styles.previewHeaderText}>Email Invitation</Text>
              </View>
              <Text style={styles.previewText}>
                You're invited to join{' '}
                <Text style={styles.previewHighlight}>{team?.name || 'the team'}</Text> as a{' '}
                <Text style={styles.previewHighlight}>{role}</Text>.
              </Text>
              {message.trim() && (
                <View style={styles.previewMessage}>
                  <Text style={styles.previewMessageLabel}>Personal note:</Text>
                  <Text style={styles.previewMessageText}>{message}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Send Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.sendButton, loading && styles.sendButtonDisabled]}
            onPress={handleSendInvite}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.sendButtonText}>Sending...</Text>
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.sendButtonText}>Send Invitation</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: ORACLE_COLORS.observe + '11',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  teamName: {
    color: ORACLE_COLORS.observe,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  optional: {
    color: '#666',
    fontWeight: '400',
  },
  textInput: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  roleSelector: {
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
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 13,
    color: '#888',
  },
  previewSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
  },
  previewCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
    borderStyle: 'dashed',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewHeaderText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 8,
  },
  previewText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 22,
  },
  previewHighlight: {
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
  previewMessage: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  previewMessageLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  previewMessageText: {
    color: '#aaa',
    fontSize: 13,
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.observe,
    paddingVertical: 16,
    borderRadius: 12,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default InviteMember;
