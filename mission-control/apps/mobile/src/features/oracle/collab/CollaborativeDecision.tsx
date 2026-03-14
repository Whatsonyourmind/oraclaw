/**
 * CollaborativeDecision Component
 * Story adv-20 - Collaborative decision mobile screen
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  FlatList,
  Alert,
  Share,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  DecisionCollaborator,
  DecisionVote,
  DecisionComment,
  VoteAggregation,
  CollaboratorRole,
  VoteType,
} from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../../../store/oracle';
import { oracleStyles } from '../theme';

const { width, height } = Dimensions.get('window');

// Role configuration
const ROLE_CONFIG: Record<CollaboratorRole, { icon: string; color: string; label: string }> = {
  owner: { icon: 'crown', color: '#FFD700', label: 'Owner' },
  editor: { icon: 'pencil', color: '#4CAF50', label: 'Editor' },
  voter: { icon: 'checkmark-circle', color: '#2196F3', label: 'Voter' },
  viewer: { icon: 'eye', color: '#9E9E9E', label: 'Viewer' },
};

// Vote type configuration
const VOTE_CONFIG: Record<VoteType, { icon: string; color: string; label: string }> = {
  approve: { icon: 'thumbs-up', color: '#4CAF50', label: 'Approve' },
  reject: { icon: 'thumbs-down', color: '#F44336', label: 'Reject' },
  abstain: { icon: 'remove-circle', color: '#9E9E9E', label: 'Abstain' },
  preference: { icon: 'star', color: '#FF9800', label: 'Ranked' },
};

// Mock data
const MOCK_DECISION = {
  id: 'dec-1',
  title: 'Q2 Marketing Strategy',
  description: 'Decide on the primary marketing channel for Q2 2026',
  status: 'analyzing',
  options: [
    { id: 'opt-1', title: 'Social Media Focus', description: 'Increase social media presence with influencer partnerships' },
    { id: 'opt-2', title: 'Content Marketing', description: 'Invest in SEO and blog content' },
    { id: 'opt-3', title: 'Paid Advertising', description: 'Run targeted Google and Meta ad campaigns' },
  ],
};

const MOCK_COLLABORATORS: DecisionCollaborator[] = [
  {
    id: 'c1',
    decision_id: 'dec-1',
    user_id: 'u1',
    role: 'owner',
    status: 'accepted',
    joined_at: '2026-01-15T10:00:00.000Z',
    notify_on_vote: true,
    notify_on_comment: true,
    notify_on_update: true,
    metadata: {},
    created_at: '2026-01-15T10:00:00.000Z',
    updated_at: '2026-01-15T10:00:00.000Z',
    user: { id: 'u1', email: 'alice@example.com', display_name: 'Alice Smith', avatar_url: undefined },
  },
  {
    id: 'c2',
    decision_id: 'dec-1',
    user_id: 'u2',
    role: 'voter',
    status: 'accepted',
    joined_at: '2026-01-16T09:00:00.000Z',
    notify_on_vote: true,
    notify_on_comment: true,
    notify_on_update: true,
    metadata: {},
    created_at: '2026-01-16T09:00:00.000Z',
    updated_at: '2026-01-16T09:00:00.000Z',
    user: { id: 'u2', email: 'bob@example.com', display_name: 'Bob Johnson', avatar_url: undefined },
  },
  {
    id: 'c3',
    decision_id: 'dec-1',
    user_id: 'u3',
    role: 'voter',
    status: 'pending',
    notify_on_vote: true,
    notify_on_comment: true,
    notify_on_update: true,
    metadata: {},
    created_at: '2026-01-17T11:00:00.000Z',
    updated_at: '2026-01-17T11:00:00.000Z',
    invited_email: 'carol@example.com',
  },
];

const MOCK_VOTES: DecisionVote[] = [
  {
    id: 'v1',
    decision_id: 'dec-1',
    option_id: 'opt-1',
    user_id: 'u1',
    vote_type: 'approve',
    weight: 1,
    rationale: 'Social media has the best ROI for our target demographic',
    confidence: 0.85,
    is_final: false,
    metadata: {},
    created_at: '2026-01-20T10:00:00.000Z',
    updated_at: '2026-01-20T10:00:00.000Z',
    user: { id: 'u1', email: 'alice@example.com', display_name: 'Alice Smith' },
  },
  {
    id: 'v2',
    decision_id: 'dec-1',
    option_id: 'opt-2',
    user_id: 'u2',
    vote_type: 'approve',
    weight: 1,
    rationale: 'Content marketing provides long-term value',
    confidence: 0.75,
    is_final: true,
    finalized_at: '2026-01-21T14:00:00.000Z',
    metadata: {},
    created_at: '2026-01-21T14:00:00.000Z',
    updated_at: '2026-01-21T14:00:00.000Z',
    user: { id: 'u2', email: 'bob@example.com', display_name: 'Bob Johnson' },
  },
];

const MOCK_AGGREGATION: VoteAggregation[] = [
  {
    id: 'a1',
    decision_id: 'dec-1',
    option_id: 'opt-1',
    total_votes: 1,
    approve_count: 1,
    reject_count: 0,
    abstain_count: 0,
    weighted_approve: 1,
    weighted_reject: 0,
    net_score: 1,
    avg_confidence: 0.85,
    last_calculated_at: '2026-01-20T10:00:00.000Z',
    created_at: '2026-01-20T10:00:00.000Z',
    updated_at: '2026-01-20T10:00:00.000Z',
  },
  {
    id: 'a2',
    decision_id: 'dec-1',
    option_id: 'opt-2',
    total_votes: 1,
    approve_count: 1,
    reject_count: 0,
    abstain_count: 0,
    weighted_approve: 1,
    weighted_reject: 0,
    net_score: 1,
    avg_confidence: 0.75,
    last_calculated_at: '2026-01-21T14:00:00.000Z',
    created_at: '2026-01-21T14:00:00.000Z',
    updated_at: '2026-01-21T14:00:00.000Z',
  },
];

const MOCK_COMMENTS: DecisionComment[] = [
  {
    id: 'cm1',
    decision_id: 'dec-1',
    option_id: 'opt-1',
    user_id: 'u1',
    content: 'I think this aligns well with our Gen Z target market',
    content_type: 'text',
    mentions: [],
    reactions: { '': ['u2'] },
    is_edited: false,
    is_deleted: false,
    metadata: {},
    created_at: '2026-01-20T10:30:00.000Z',
    updated_at: '2026-01-20T10:30:00.000Z',
    user: { id: 'u1', email: 'alice@example.com', display_name: 'Alice Smith' },
  },
  {
    id: 'cm2',
    decision_id: 'dec-1',
    option_id: 'opt-1',
    user_id: 'u2',
    parent_id: 'cm1',
    content: 'Good point! We should consider TikTok specifically.',
    content_type: 'text',
    mentions: [],
    reactions: {},
    is_edited: false,
    is_deleted: false,
    metadata: {},
    created_at: '2026-01-20T11:00:00.000Z',
    updated_at: '2026-01-20T11:00:00.000Z',
    user: { id: 'u2', email: 'bob@example.com', display_name: 'Bob Johnson' },
  },
];

// Avatar Component
interface AvatarProps {
  name?: string;
  email?: string;
  size?: number;
  color?: string;
}

const Avatar: React.FC<AvatarProps> = ({ name, email, size = 32, color }) => {
  const initial = name ? name.charAt(0).toUpperCase() : email ? email.charAt(0).toUpperCase() : '?';
  const bgColor = color || `hsl(${(initial.charCodeAt(0) * 137) % 360}, 60%, 45%)`;

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.45 }]}>{initial}</Text>
    </View>
  );
};

// Collaborator Card Component
interface CollaboratorCardProps {
  collaborator: DecisionCollaborator;
  isCurrentUser: boolean;
  canManage: boolean;
  onChangeRole: (role: CollaboratorRole) => void;
  onRemove: () => void;
}

const CollaboratorCard: React.FC<CollaboratorCardProps> = ({
  collaborator,
  isCurrentUser,
  canManage,
  onChangeRole,
  onRemove,
}) => {
  const roleConfig = ROLE_CONFIG[collaborator.role];
  const name = collaborator.user?.display_name || collaborator.invited_email;
  const isPending = collaborator.status === 'pending';

  return (
    <View style={styles.collaboratorCard}>
      <Avatar name={name} email={collaborator.invited_email} size={40} />
      <View style={styles.collaboratorInfo}>
        <Text style={styles.collaboratorName}>
          {name}
          {isCurrentUser && <Text style={styles.youTag}> (You)</Text>}
        </Text>
        <View style={styles.collaboratorMeta}>
          <View style={[styles.roleBadge, { backgroundColor: `${roleConfig.color}20` }]}>
            <Ionicons name={roleConfig.icon as any} size={12} color={roleConfig.color} />
            <Text style={[styles.roleText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
          </View>
          {isPending && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
        </View>
      </View>
      {canManage && !isCurrentUser && collaborator.role !== 'owner' && (
        <TouchableOpacity style={styles.collaboratorAction} onPress={onRemove}>
          <Ionicons name="close-circle" size={24} color="#F44336" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Option Card with Voting
interface OptionCardProps {
  option: { id: string; title: string; description: string };
  aggregation?: VoteAggregation;
  userVote?: DecisionVote;
  comments: DecisionComment[];
  canVote: boolean;
  onVote: (optionId: string, voteType: VoteType) => void;
  onViewComments: () => void;
}

const OptionCard: React.FC<OptionCardProps> = ({
  option,
  aggregation,
  userVote,
  comments,
  canVote,
  onVote,
  onViewComments,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const [showVoteOptions, setShowVoteOptions] = useState(false);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  const totalVotes = aggregation?.total_votes || 0;
  const netScore = aggregation?.net_score || 0;

  return (
    <Animated.View style={[styles.optionCard, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.optionHeader}>
        <Text style={styles.optionTitle}>{option.title}</Text>
        {userVote && (
          <View style={[styles.votedBadge, { backgroundColor: `${VOTE_CONFIG[userVote.vote_type].color}20` }]}>
            <Ionicons
              name={VOTE_CONFIG[userVote.vote_type].icon as any}
              size={12}
              color={VOTE_CONFIG[userVote.vote_type].color}
            />
            <Text style={[styles.votedText, { color: VOTE_CONFIG[userVote.vote_type].color }]}>
              Voted
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.optionDescription}>{option.description}</Text>

      {/* Vote Stats */}
      <View style={styles.voteStats}>
        <View style={styles.voteStatItem}>
          <Ionicons name="people" size={14} color="#888" />
          <Text style={styles.voteStatText}>{totalVotes} votes</Text>
        </View>
        <View style={styles.voteStatItem}>
          <Ionicons
            name={netScore >= 0 ? 'trending-up' : 'trending-down'}
            size={14}
            color={netScore >= 0 ? '#4CAF50' : '#F44336'}
          />
          <Text style={[styles.voteStatText, { color: netScore >= 0 ? '#4CAF50' : '#F44336' }]}>
            {netScore >= 0 ? '+' : ''}{netScore.toFixed(1)}
          </Text>
        </View>
        {aggregation?.avg_confidence && (
          <View style={styles.voteStatItem}>
            <Ionicons name="shield-checkmark" size={14} color="#888" />
            <Text style={styles.voteStatText}>
              {Math.round(aggregation.avg_confidence * 100)}% conf
            </Text>
          </View>
        )}
      </View>

      {/* Vote Breakdown Bar */}
      {totalVotes > 0 && (
        <View style={styles.voteBar}>
          {aggregation && aggregation.approve_count > 0 && (
            <View
              style={[
                styles.voteBarSegment,
                {
                  flex: aggregation.approve_count,
                  backgroundColor: VOTE_CONFIG.approve.color,
                },
              ]}
            />
          )}
          {aggregation && aggregation.reject_count > 0 && (
            <View
              style={[
                styles.voteBarSegment,
                {
                  flex: aggregation.reject_count,
                  backgroundColor: VOTE_CONFIG.reject.color,
                },
              ]}
            />
          )}
          {aggregation && aggregation.abstain_count > 0 && (
            <View
              style={[
                styles.voteBarSegment,
                {
                  flex: aggregation.abstain_count,
                  backgroundColor: VOTE_CONFIG.abstain.color,
                },
              ]}
            />
          )}
        </View>
      )}

      {/* Vote Actions */}
      {canVote && (
        <View style={styles.voteActions}>
          {showVoteOptions ? (
            <View style={styles.voteOptionsRow}>
              {(['approve', 'reject', 'abstain'] as VoteType[]).map((voteType) => {
                const config = VOTE_CONFIG[voteType];
                const isSelected = userVote?.vote_type === voteType;
                return (
                  <TouchableOpacity
                    key={voteType}
                    style={[
                      styles.voteOption,
                      isSelected && { backgroundColor: `${config.color}30`, borderColor: config.color },
                    ]}
                    onPress={() => {
                      onVote(option.id, voteType);
                      setShowVoteOptions(false);
                    }}
                  >
                    <Ionicons name={config.icon as any} size={18} color={config.color} />
                    <Text style={[styles.voteOptionText, { color: config.color }]}>{config.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <TouchableOpacity style={styles.castVoteButton} onPress={() => setShowVoteOptions(true)}>
              <Ionicons name="hand-right" size={16} color={ORACLE_COLORS.decide} />
              <Text style={styles.castVoteText}>{userVote ? 'Change Vote' : 'Cast Vote'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Comments indicator */}
      <TouchableOpacity style={styles.commentsIndicator} onPress={onViewComments}>
        <Ionicons name="chatbubbles" size={16} color="#888" />
        <Text style={styles.commentsCount}>{comments.length} comments</Text>
        <Ionicons name="chevron-forward" size={16} color="#888" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// Comment Component
interface CommentItemProps {
  comment: DecisionComment;
  isReply?: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, isReply, onReply, onReact }) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.commentItem, isReply && styles.commentReply]}>
      <Avatar name={comment.user?.display_name} email={comment.user?.email} size={28} />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{comment.user?.display_name || 'Unknown'}</Text>
          <Text style={styles.commentTime}>{formatDate(comment.created_at)}</Text>
        </View>
        <Text style={styles.commentText}>{comment.content}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.commentAction} onPress={() => onReact('')}>
            <Text style={styles.reactionText}>
              {Object.keys(comment.reactions).length > 0 ? '' : '+'} {Object.values(comment.reactions).flat().length || ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commentAction} onPress={onReply}>
            <Text style={styles.replyText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Comments Modal
interface CommentsModalProps {
  visible: boolean;
  optionId: string;
  optionTitle: string;
  comments: DecisionComment[];
  onClose: () => void;
  onAddComment: (content: string) => void;
}

const CommentsModal: React.FC<CommentsModalProps> = ({
  visible,
  optionId,
  optionTitle,
  comments,
  onClose,
  onAddComment,
}) => {
  const [newComment, setNewComment] = useState('');

  const handleSubmit = () => {
    if (newComment.trim()) {
      onAddComment(newComment.trim());
      setNewComment('');
    }
  };

  // Build threaded structure
  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.commentsModalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Discussion</Text>
              <Text style={styles.modalSubtitle}>{optionTitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.commentsScroll}>
            {rootComments.map((comment) => (
              <View key={comment.id}>
                <CommentItem
                  comment={comment}
                  onReply={() => {}}
                  onReact={() => {}}
                />
                {getReplies(comment.id).map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    isReply
                    onReply={() => {}}
                    onReact={() => {}}
                  />
                ))}
              </View>
            ))}
            {comments.length === 0 && (
              <View style={styles.emptyComments}>
                <Ionicons name="chatbubbles-outline" size={48} color="#444" />
                <Text style={styles.emptyCommentsText}>No comments yet</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              placeholderTextColor="#666"
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
              onPress={handleSubmit}
              disabled={!newComment.trim()}
            >
              <Ionicons name="send" size={20} color={newComment.trim() ? ORACLE_COLORS.decide : '#666'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Invite Modal
interface InviteModalProps {
  visible: boolean;
  onClose: () => void;
  onInvite: (email: string, role: CollaboratorRole) => void;
}

const InviteModal: React.FC<InviteModalProps> = ({ visible, onClose, onInvite }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('voter');

  const handleInvite = () => {
    if (email.trim() && email.includes('@')) {
      onInvite(email.trim(), role);
      setEmail('');
      setRole('voter');
      onClose();
    } else {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.inviteModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite Collaborator</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleOptions}>
              {(['voter', 'editor', 'viewer'] as CollaboratorRole[]).map((r) => {
                const config = ROLE_CONFIG[r];
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleOption, role === r && styles.roleOptionActive]}
                    onPress={() => setRole(r)}
                  >
                    <Ionicons name={config.icon as any} size={16} color={role === r ? config.color : '#888'} />
                    <Text style={[styles.roleOptionText, role === r && { color: config.color }]}>
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity style={styles.inviteButton} onPress={handleInvite}>
            <Ionicons name="person-add" size={18} color="#FFF" />
            <Text style={styles.inviteButtonText}>Send Invitation</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Share Modal
interface ShareModalProps {
  visible: boolean;
  shareUrl: string;
  onClose: () => void;
  onShare: () => void;
  onCopy: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ visible, shareUrl, onClose, onShare, onCopy }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.shareModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Share Decision</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <View style={styles.shareUrlContainer}>
            <Text style={styles.shareUrl} numberOfLines={1}>{shareUrl}</Text>
          </View>

          <View style={styles.shareActions}>
            <TouchableOpacity style={styles.shareAction} onPress={onCopy}>
              <Ionicons name="copy" size={24} color={ORACLE_COLORS.decide} />
              <Text style={styles.shareActionText}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareAction} onPress={onShare}>
              <Ionicons name="share-social" size={24} color={ORACLE_COLORS.decide} />
              <Text style={styles.shareActionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Main Component
export const CollaborativeDecision: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [decision] = useState(MOCK_DECISION);
  const [collaborators, setCollaborators] = useState(MOCK_COLLABORATORS);
  const [votes, setVotes] = useState(MOCK_VOTES);
  const [aggregation, setAggregation] = useState(MOCK_AGGREGATION);
  const [comments, setComments] = useState(MOCK_COMMENTS);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [commentsModal, setCommentsModal] = useState<{ visible: boolean; optionId: string; optionTitle: string }>({
    visible: false,
    optionId: '',
    optionTitle: '',
  });

  const currentUserId = 'u1'; // Mock current user
  const currentUserRole = collaborators.find((c) => c.user_id === currentUserId)?.role || 'viewer';
  const canVote = ['owner', 'editor', 'voter'].includes(currentUserRole);
  const canManage = ['owner', 'editor'].includes(currentUserRole);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleVote = (optionId: string, voteType: VoteType) => {
    const existingVoteIndex = votes.findIndex((v) => v.option_id === optionId && v.user_id === currentUserId);
    const now = new Date().toISOString();

    if (existingVoteIndex >= 0) {
      const updated = [...votes];
      updated[existingVoteIndex] = { ...updated[existingVoteIndex], vote_type: voteType, updated_at: now };
      setVotes(updated);
    } else {
      const newVote: DecisionVote = {
        id: `v-${Date.now()}`,
        decision_id: decision.id,
        option_id: optionId,
        user_id: currentUserId,
        vote_type: voteType,
        weight: 1,
        is_final: false,
        metadata: {},
        created_at: now,
        updated_at: now,
      };
      setVotes([...votes, newVote]);
    }
    // In production: call API and update aggregation
  };

  const handleInvite = (email: string, role: CollaboratorRole) => {
    const newCollaborator: DecisionCollaborator = {
      id: `c-${Date.now()}`,
      decision_id: decision.id,
      user_id: '',
      role,
      status: 'pending',
      invited_email: email,
      invited_by: currentUserId,
      notify_on_vote: true,
      notify_on_comment: true,
      notify_on_update: true,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setCollaborators([...collaborators, newCollaborator]);
    Alert.alert('Invitation Sent', `Invited ${email} as ${role}`);
  };

  const handleAddComment = (content: string) => {
    const newComment: DecisionComment = {
      id: `cm-${Date.now()}`,
      decision_id: decision.id,
      option_id: commentsModal.optionId,
      user_id: currentUserId,
      content,
      content_type: 'text',
      mentions: [],
      reactions: {},
      is_edited: false,
      is_deleted: false,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: { id: currentUserId, email: 'alice@example.com', display_name: 'Alice Smith' },
    };
    setComments([...comments, newComment]);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this decision: ${decision.title}\nhttps://oracle.missioncontrol.app/shared/abc123`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleCopyLink = () => {
    Clipboard.setString('https://oracle.missioncontrol.app/shared/abc123');
    Alert.alert('Copied', 'Link copied to clipboard');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title} numberOfLines={1}>{decision.title}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{decision.status}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerAction} onPress={() => setShowShareModal(true)}>
            <Ionicons name="share-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          {canManage && (
            <TouchableOpacity style={styles.headerAction} onPress={() => setShowInviteModal(true)}>
              <Ionicons name="person-add-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Description */}
        <Text style={styles.description}>{decision.description}</Text>

        {/* Collaborators Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collaborators</Text>
            <View style={styles.collaboratorAvatars}>
              {collaborators.slice(0, 5).map((c, i) => (
                <View key={c.id} style={[styles.stackedAvatar, { marginLeft: i > 0 ? -8 : 0, zIndex: 5 - i }]}>
                  <Avatar name={c.user?.display_name} email={c.invited_email} size={28} />
                </View>
              ))}
              {collaborators.length > 5 && (
                <View style={[styles.stackedAvatar, styles.moreAvatar, { marginLeft: -8 }]}>
                  <Text style={styles.moreAvatarText}>+{collaborators.length - 5}</Text>
                </View>
              )}
            </View>
          </View>

          {collaborators.map((c) => (
            <CollaboratorCard
              key={c.id}
              collaborator={c}
              isCurrentUser={c.user_id === currentUserId}
              canManage={canManage}
              onChangeRole={(role) => {}}
              onRemove={() => {
                Alert.alert('Remove', `Remove ${c.user?.display_name || c.invited_email}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => setCollaborators(collaborators.filter((col) => col.id !== c.id)),
                  },
                ]);
              }}
            />
          ))}
        </View>

        {/* Options Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Options</Text>
          {decision.options.map((option) => {
            const optionAggregation = aggregation.find((a) => a.option_id === option.id);
            const userVote = votes.find((v) => v.option_id === option.id && v.user_id === currentUserId);
            const optionComments = comments.filter((c) => c.option_id === option.id);

            return (
              <OptionCard
                key={option.id}
                option={option}
                aggregation={optionAggregation}
                userVote={userVote}
                comments={optionComments}
                canVote={canVote}
                onVote={handleVote}
                onViewComments={() =>
                  setCommentsModal({ visible: true, optionId: option.id, optionTitle: option.title })
                }
              />
            );
          })}
        </View>

        {/* Live Vote Count */}
        <View style={styles.liveVoteSection}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live Vote Count</Text>
          </View>
          <View style={styles.voteTotals}>
            <Text style={styles.voteTotalItem}>
              <Ionicons name="thumbs-up" size={14} color={VOTE_CONFIG.approve.color} />{' '}
              {aggregation.reduce((sum, a) => sum + a.approve_count, 0)}
            </Text>
            <Text style={styles.voteTotalItem}>
              <Ionicons name="thumbs-down" size={14} color={VOTE_CONFIG.reject.color} />{' '}
              {aggregation.reduce((sum, a) => sum + a.reject_count, 0)}
            </Text>
            <Text style={styles.voteTotalItem}>
              <Ionicons name="remove-circle" size={14} color={VOTE_CONFIG.abstain.color} />{' '}
              {aggregation.reduce((sum, a) => sum + a.abstain_count, 0)}
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Comments Modal */}
      <CommentsModal
        visible={commentsModal.visible}
        optionId={commentsModal.optionId}
        optionTitle={commentsModal.optionTitle}
        comments={comments.filter((c) => c.option_id === commentsModal.optionId)}
        onClose={() => setCommentsModal({ ...commentsModal, visible: false })}
        onAddComment={handleAddComment}
      />

      {/* Invite Modal */}
      <InviteModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInvite}
      />

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        shareUrl="https://oracle.missioncontrol.app/shared/abc123"
        onClose={() => setShowShareModal(false)}
        onShare={handleShare}
        onCopy={handleCopyLink}
      />
    </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: `${ORACLE_COLORS.decide}30`,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    color: ORACLE_COLORS.decide,
    textTransform: 'capitalize',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 15,
    color: '#888',
    marginBottom: 20,
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
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
    color: '#FFF',
  },
  collaboratorAvatars: {
    flexDirection: 'row',
  },
  stackedAvatar: {
    borderWidth: 2,
    borderColor: '#0a0a0a',
    borderRadius: 16,
  },
  moreAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreAvatarText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  collaboratorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: '600',
  },
  collaboratorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  collaboratorName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFF',
    marginBottom: 4,
  },
  youTag: {
    color: '#888',
    fontWeight: '400',
  },
  collaboratorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  pendingBadge: {
    backgroundColor: '#FF980030',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  pendingText: {
    fontSize: 11,
    color: '#FF9800',
  },
  collaboratorAction: {
    padding: 4,
  },
  optionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  votedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  votedText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
    lineHeight: 20,
  },
  voteStats: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  voteStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  voteStatText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  voteBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#333',
    marginBottom: 12,
  },
  voteBarSegment: {
    height: '100%',
  },
  voteActions: {
    marginBottom: 8,
  },
  voteOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  voteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  voteOptionText: {
    fontSize: 13,
    marginLeft: 6,
  },
  castVoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: `${ORACLE_COLORS.decide}20`,
    borderRadius: 12,
  },
  castVoteText: {
    fontSize: 14,
    color: ORACLE_COLORS.decide,
    fontWeight: '500',
    marginLeft: 6,
  },
  commentsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  commentsCount: {
    flex: 1,
    fontSize: 13,
    color: '#888',
    marginLeft: 6,
  },
  liveVoteSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  liveText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  voteTotals: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  voteTotalItem: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  commentsModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  commentsScroll: {
    maxHeight: height * 0.5,
    padding: 20,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentReply: {
    marginLeft: 36,
  },
  commentContent: {
    flex: 1,
    marginLeft: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  commentText: {
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: 6,
  },
  commentAction: {
    marginRight: 16,
  },
  reactionText: {
    fontSize: 13,
  },
  replyText: {
    fontSize: 13,
    color: '#888',
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCommentsText: {
    fontSize: 15,
    color: '#666',
    marginTop: 12,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  inviteModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 16,
  },
  roleOptions: {
    flexDirection: 'row',
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
  },
  roleOptionActive: {
    borderColor: ORACLE_COLORS.decide,
    backgroundColor: `${ORACLE_COLORS.decide}20`,
  },
  roleOptionText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 6,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.decide,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  inviteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  shareModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  shareUrlContainer: {
    backgroundColor: '#0a0a0a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  shareUrl: {
    fontSize: 14,
    color: '#888',
  },
  shareActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  shareAction: {
    alignItems: 'center',
    padding: 16,
  },
  shareActionText: {
    fontSize: 14,
    color: '#FFF',
    marginTop: 8,
  },
});

export default CollaborativeDecision;
