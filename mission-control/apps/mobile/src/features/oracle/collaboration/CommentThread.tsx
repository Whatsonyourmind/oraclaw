/**
 * CommentThread Component
 *
 * Full-featured comment UI with threading, @mentions autocomplete,
 * reactions picker, and thread resolution.
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
} from 'react-native';

// Types
interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  parentId?: string;
  mentions: Mention[];
  reactions: Reaction[];
  status: 'active' | 'edited' | 'deleted' | 'resolved';
  isResolution?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

interface Mention {
  id: string;
  name: string;
  type: 'user' | 'team';
}

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

interface MentionSuggestion {
  id: string;
  name: string;
  type: 'user' | 'team';
  avatar?: string;
}

interface CommentThreadProps {
  threadId: string;
  comments?: Comment[];
  currentUserId: string;
  isResolved?: boolean;
  onAddComment?: (content: string, parentId?: string) => Promise<void>;
  onEditComment?: (commentId: string, content: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onReact?: (commentId: string, emoji: string) => Promise<void>;
  onResolve?: (resolutionComment?: string) => Promise<void>;
  onMentionSearch?: (query: string) => Promise<MentionSuggestion[]>;
  loading?: boolean;
}

// Mock data
const mockComments: Comment[] = [
  {
    id: '1',
    content: 'We need to address this signal before it impacts our Q2 targets. @alice can you take a look at the data?',
    authorId: 'user1',
    authorName: 'Bob Smith',
    mentions: [{ id: 'alice', name: 'alice', type: 'user' }],
    reactions: [
      { emoji: '1F44D', count: 3, users: ['user2', 'user3', 'user4'], hasReacted: true },
      { emoji: '1F4A1', count: 1, users: ['user2'], hasReacted: false },
    ],
    status: 'active',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '2',
    content: 'Looking into it now. Initial analysis shows we might need to adjust our pricing strategy.',
    authorId: 'alice',
    authorName: 'Alice Johnson',
    parentId: '1',
    mentions: [],
    reactions: [
      { emoji: '2705', count: 2, users: ['user1', 'user3'], hasReacted: false },
    ],
    status: 'active',
    createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
  },
  {
    id: '3',
    content: 'I can help with the market analysis portion. @team-analytics lets sync up tomorrow.',
    authorId: 'user3',
    authorName: 'Carol Davis',
    parentId: '1',
    mentions: [{ id: 'team-analytics', name: 'team-analytics', type: 'team' }],
    reactions: [],
    status: 'active',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
];

const mockSuggestions: MentionSuggestion[] = [
  { id: 'alice', name: 'Alice Johnson', type: 'user' },
  { id: 'bob', name: 'Bob Smith', type: 'user' },
  { id: 'carol', name: 'Carol Davis', type: 'user' },
  { id: 'team-analytics', name: 'Analytics Team', type: 'team' },
  { id: 'team-strategy', name: 'Strategy Team', type: 'team' },
];

const EMOJI_OPTIONS = [
  { emoji: '1F44D', label: 'thumbs up' },
  { emoji: '2764', label: 'heart' },
  { emoji: '1F389', label: 'party' },
  { emoji: '1F4A1', label: 'idea' },
  { emoji: '2705', label: 'check' },
  { emoji: '1F440', label: 'eyes' },
  { emoji: '1F914', label: 'thinking' },
  { emoji: '1F64F', label: 'pray' },
];

export const CommentThread: React.FC<CommentThreadProps> = ({
  threadId,
  comments = mockComments,
  currentUserId,
  isResolved = false,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onReact,
  onResolve,
  onMentionSearch,
  loading = false,
}) => {
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');

  const inputRef = useRef<TextInput>(null);

  const handleTextChange = useCallback(async (text: string) => {
    setNewComment(text);

    // Check for @ mentions
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex >= 0) {
      const afterAt = text.substring(lastAtIndex + 1);
      const spaceIndex = afterAt.indexOf(' ');

      if (spaceIndex === -1 && afterAt.length > 0) {
        setMentionQuery(afterAt);
        setShowMentions(true);

        if (onMentionSearch) {
          const suggestions = await onMentionSearch(afterAt);
          setMentionSuggestions(suggestions);
        } else {
          const filtered = mockSuggestions.filter(s =>
            s.name.toLowerCase().includes(afterAt.toLowerCase())
          );
          setMentionSuggestions(filtered);
        }
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, [onMentionSearch]);

  const handleSelectMention = useCallback((suggestion: MentionSuggestion) => {
    const lastAtIndex = newComment.lastIndexOf('@');
    const beforeMention = newComment.substring(0, lastAtIndex);
    const newText = `${beforeMention}@${suggestion.name} `;
    setNewComment(newText);
    setShowMentions(false);
    inputRef.current?.focus();
  }, [newComment]);

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim()) return;

    if (editingComment) {
      await onEditComment?.(editingComment.id, newComment);
      setEditingComment(null);
    } else {
      await onAddComment?.(newComment, replyingTo?.id);
      setReplyingTo(null);
    }

    setNewComment('');
  }, [newComment, editingComment, replyingTo, onAddComment, onEditComment]);

  const handleReact = useCallback(async (commentId: string, emoji: string) => {
    await onReact?.(commentId, emoji);
    setShowReactionPicker(null);
  }, [onReact]);

  const handleResolve = useCallback(async () => {
    await onResolve?.(resolutionNote || undefined);
    setShowResolveModal(false);
    setResolutionNote('');
  }, [resolutionNote, onResolve]);

  const formatTime = (date: Date): string => {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getEmojiFromCode = (code: string): string => {
    try {
      return String.fromCodePoint(parseInt(code, 16));
    } catch {
      return code;
    }
  };

  const renderReaction = (reaction: Reaction, commentId: string) => (
    <TouchableOpacity
      key={reaction.emoji}
      style={[
        styles.reactionBadge,
        reaction.hasReacted && styles.reactionBadgeActive,
      ]}
      onPress={() => handleReact(commentId, reaction.emoji)}
    >
      <Text style={styles.reactionEmoji}>{getEmojiFromCode(reaction.emoji)}</Text>
      <Text style={[
        styles.reactionCount,
        reaction.hasReacted && styles.reactionCountActive,
      ]}>
        {reaction.count}
      </Text>
    </TouchableOpacity>
  );

  const renderComment = ({ item: comment, index }: { item: Comment; index: number }) => {
    const isReply = !!comment.parentId;
    const isOwn = comment.authorId === currentUserId;

    return (
      <View style={[styles.commentContainer, isReply && styles.replyContainer]}>
        {isReply && <View style={styles.threadLine} />}

        <View style={styles.commentCard}>
          {comment.isResolution && (
            <View style={styles.resolutionBadge}>
              <Text style={styles.resolutionBadgeText}>Resolution</Text>
            </View>
          )}

          <View style={styles.commentHeader}>
            <View style={styles.authorAvatar}>
              <Text style={styles.authorAvatarText}>
                {comment.authorName.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{comment.authorName}</Text>
              <Text style={styles.commentTime}>
                {formatTime(comment.createdAt)}
                {comment.status === 'edited' && ' (edited)'}
              </Text>
            </View>

            {isOwn && (
              <View style={styles.commentActions}>
                <TouchableOpacity
                  style={styles.commentAction}
                  onPress={() => {
                    setEditingComment(comment);
                    setNewComment(comment.content);
                    inputRef.current?.focus();
                  }}
                >
                  <Text style={styles.commentActionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.commentAction}
                  onPress={() => onDeleteComment?.(comment.id)}
                >
                  <Text style={[styles.commentActionText, styles.deleteAction]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.commentContent}>
            {comment.content.split(/(@\w+)/g).map((part, i) => {
              if (part.startsWith('@')) {
                return (
                  <Text key={i} style={styles.mentionText}>
                    {part}
                  </Text>
                );
              }
              return part;
            })}
          </Text>

          <View style={styles.commentFooter}>
            <View style={styles.reactions}>
              {comment.reactions.map(reaction => renderReaction(reaction, comment.id))}
              <TouchableOpacity
                style={styles.addReactionButton}
                onPress={() => setShowReactionPicker(comment.id)}
              >
                <Text style={styles.addReactionIcon}>+</Text>
              </TouchableOpacity>
            </View>

            {!isReply && (
              <TouchableOpacity
                style={styles.replyButton}
                onPress={() => {
                  setReplyingTo(comment);
                  inputRef.current?.focus();
                }}
              >
                <Text style={styles.replyButtonText}>Reply</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Reaction Picker Modal */}
        {showReactionPicker === comment.id && (
          <View style={styles.reactionPicker}>
            {EMOJI_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.emoji}
                style={styles.emojiOption}
                onPress={() => handleReact(comment.id, option.emoji)}
              >
                <Text style={styles.emojiOptionText}>{getEmojiFromCode(option.emoji)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderMentionSuggestion = ({ item }: { item: MentionSuggestion }) => (
    <TouchableOpacity
      style={styles.mentionSuggestion}
      onPress={() => handleSelectMention(item)}
    >
      <View style={styles.mentionAvatar}>
        <Text style={styles.mentionAvatarText}>
          {item.type === 'team' ? '#' : item.name[0]}
        </Text>
      </View>
      <View>
        <Text style={styles.mentionName}>{item.name}</Text>
        <Text style={styles.mentionType}>{item.type}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Thread Status */}
      {isResolved && (
        <View style={styles.resolvedBanner}>
          <Text style={styles.resolvedIcon}>check</Text>
          <Text style={styles.resolvedText}>This thread has been resolved</Text>
        </View>
      )}

      {/* Comments List */}
      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.commentsList}
        showsVerticalScrollIndicator={false}
      />

      {/* Mention Suggestions */}
      {showMentions && mentionSuggestions.length > 0 && (
        <View style={styles.mentionSuggestionsContainer}>
          <FlatList
            data={mentionSuggestions}
            renderItem={renderMentionSuggestion}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="always"
          />
        </View>
      )}

      {/* Reply/Edit Indicator */}
      {(replyingTo || editingComment) && (
        <View style={styles.replyIndicator}>
          <Text style={styles.replyIndicatorText}>
            {editingComment ? 'Editing comment' : `Replying to ${replyingTo?.authorName}`}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setReplyingTo(null);
              setEditingComment(null);
              setNewComment('');
            }}
          >
            <Text style={styles.cancelReplyText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Add a comment..."
          placeholderTextColor="#9CA3AF"
          value={newComment}
          onChangeText={handleTextChange}
          multiline
          maxLength={2000}
        />
        <View style={styles.inputActions}>
          {!isResolved && (
            <TouchableOpacity
              style={styles.resolveButton}
              onPress={() => setShowResolveModal(true)}
            >
              <Text style={styles.resolveButtonText}>Resolve</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
            onPress={handleSubmit}
            disabled={!newComment.trim()}
          >
            <Text style={styles.sendButtonText}>
              {editingComment ? 'Save' : 'Send'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Resolve Modal */}
      <Modal
        visible={showResolveModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowResolveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resolveModal}>
            <Text style={styles.resolveModalTitle}>Resolve Thread</Text>
            <Text style={styles.resolveModalDescription}>
              Add an optional resolution note to summarize the outcome.
            </Text>

            <TextInput
              style={styles.resolutionInput}
              placeholder="Resolution summary (optional)..."
              placeholderTextColor="#9CA3AF"
              value={resolutionNote}
              onChangeText={setResolutionNote}
              multiline
              numberOfLines={3}
            />

            <View style={styles.resolveModalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowResolveModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmResolveButton}
                onPress={handleResolve}
              >
                <Text style={styles.confirmResolveText}>Resolve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  resolvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  resolvedIcon: {
    fontSize: 16,
    color: '#059669',
    marginRight: 8,
  },
  resolvedText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
  },
  commentsList: {
    padding: 16,
  },
  commentContainer: {
    marginBottom: 16,
  },
  replyContainer: {
    marginLeft: 24,
  },
  threadLine: {
    position: 'absolute',
    left: -12,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#E5E7EB',
  },
  commentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  resolutionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 8,
  },
  resolutionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  authorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  authorAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  commentTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  commentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  commentAction: {
    padding: 4,
  },
  commentActionText: {
    fontSize: 12,
    color: '#6B7280',
  },
  deleteAction: {
    color: '#EF4444',
  },
  commentContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  mentionText: {
    color: '#3B82F6',
    fontWeight: '500',
  },
  commentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reactions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reactionBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  reactionCountActive: {
    color: '#2563EB',
  },
  addReactionButton: {
    width: 28,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addReactionIcon: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  replyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  replyButtonText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  reactionPicker: {
    position: 'absolute',
    top: -50,
    left: 16,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  emojiOption: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOptionText: {
    fontSize: 20,
  },
  mentionSuggestionsContainer: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    maxHeight: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  mentionSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  mentionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  mentionAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  mentionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  mentionType: {
    fontSize: 12,
    color: '#6B7280',
  },
  replyIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#DBEAFE',
  },
  replyIndicatorText: {
    fontSize: 13,
    color: '#3B82F6',
  },
  cancelReplyText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    maxHeight: 100,
    marginBottom: 10,
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  resolveButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
  },
  resolveButtonText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  sendButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  sendButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resolveModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  resolveModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  resolveModalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  resolutionInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  resolveModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
  confirmResolveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#10B981',
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmResolveText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default CommentThread;
