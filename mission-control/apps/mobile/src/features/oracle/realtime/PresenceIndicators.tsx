/**
 * ORACLE Presence Indicators
 * Story rt-5 - Visual indicators for collaborative presence
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';
import { PresenceUser } from '../../../hooks/useOracleRealtime';

const { width } = Dimensions.get('window');

// ============================================================================
// AVATAR COMPONENT
// ============================================================================

interface AvatarProps {
  user: PresenceUser;
  size?: number;
  showStatus?: boolean;
  showName?: boolean;
}

export function Avatar({ user, size = 36, showStatus = true, showName = false }: AvatarProps) {
  const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getColorFromId = (id: string): string => {
    // Generate consistent color from user ID
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const isOnline = Date.now() - user.lastSeen < 60000; // Consider online if seen in last minute

  return (
    <View style={[styles.avatarContainer, { width: size, height: size }]}>
      {user.avatar ? (
        <Image
          source={{ uri: user.avatar }}
          style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.avatarPlaceholder,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: getColorFromId(user.id),
            },
          ]}
        >
          <Text style={[styles.avatarInitials, { fontSize: size * 0.4 }]}>
            {getInitials(user.name)}
          </Text>
        </View>
      )}
      {showStatus && (
        <View
          style={[
            styles.statusDot,
            {
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: size * 0.15,
              bottom: 0,
              right: 0,
              backgroundColor: isOnline ? '#00FF88' : '#808080',
              borderWidth: size * 0.06,
            },
          ]}
        />
      )}
      {showName && user.name && (
        <Text style={styles.avatarName} numberOfLines={1}>
          {user.name}
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// AVATAR LIST (Stacked Avatars)
// ============================================================================

interface AvatarListProps {
  users: PresenceUser[];
  maxVisible?: number;
  size?: number;
  overlap?: number;
  showCount?: boolean;
  onPress?: () => void;
}

export function AvatarList({
  users,
  maxVisible = 4,
  size = 32,
  overlap = 8,
  showCount = true,
  onPress,
}: AvatarListProps) {
  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = users.length - maxVisible;

  return (
    <View style={styles.avatarList}>
      {visibleUsers.map((user, index) => (
        <View
          key={user.id}
          style={[
            styles.avatarListItem,
            {
              marginLeft: index > 0 ? -overlap : 0,
              zIndex: maxVisible - index,
            },
          ]}
        >
          <Avatar user={user} size={size} showStatus={false} />
        </View>
      ))}
      {showCount && remainingCount > 0 && (
        <View
          style={[
            styles.avatarOverflow,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -overlap,
            },
          ]}
        >
          <Text style={[styles.avatarOverflowText, { fontSize: size * 0.35 }]}>
            +{remainingCount}
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// ACTIVE VIEWERS PANEL
// ============================================================================

interface ActiveViewersPanelProps {
  users: PresenceUser[];
  currentUserId: string;
  title?: string;
}

export function ActiveViewersPanel({
  users,
  currentUserId,
  title = 'Viewing now',
}: ActiveViewersPanelProps) {
  const otherUsers = users.filter(u => u.id !== currentUserId);

  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <View style={styles.viewersPanel}>
      <View style={styles.viewersPanelHeader}>
        <Ionicons name="eye" size={14} color="#888" />
        <Text style={styles.viewersPanelTitle}>{title}</Text>
        <View style={styles.viewersPanelCount}>
          <Text style={styles.viewersPanelCountText}>{otherUsers.length}</Text>
        </View>
      </View>
      <View style={styles.viewersPanelContent}>
        <AvatarList users={otherUsers} maxVisible={5} size={28} />
      </View>
    </View>
  );
}

// ============================================================================
// TYPING INDICATOR
// ============================================================================

interface TypingIndicatorProps {
  users: PresenceUser[];
  currentUserId: string;
}

export function TypingIndicator({ users, currentUserId }: TypingIndicatorProps) {
  const typingUsers = users.filter(u => u.id !== currentUserId && u.isTyping);
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (typingUsers.length === 0) return;

    const createDotAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createDotAnimation(dot1Anim, 0);
    const anim2 = createDotAnimation(dot2Anim, 150);
    const anim3 = createDotAnimation(dot3Anim, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [typingUsers.length, dot1Anim, dot2Anim, dot3Anim]);

  if (typingUsers.length === 0) return null;

  const getTypingText = (): string => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].name || 'Someone'} is typing`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].name || 'Someone'} and ${typingUsers[1].name || 'another'} are typing`;
    } else {
      return `${typingUsers.length} people are typing`;
    }
  };

  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingDots}>
        <Animated.View style={[styles.typingDot, { opacity: dot1Anim }]} />
        <Animated.View style={[styles.typingDot, { opacity: dot2Anim }]} />
        <Animated.View style={[styles.typingDot, { opacity: dot3Anim }]} />
      </View>
      <Text style={styles.typingText}>{getTypingText()}</Text>
    </View>
  );
}

// ============================================================================
// EDITING INDICATOR
// ============================================================================

interface EditingIndicatorProps {
  user: PresenceUser | null;
  fieldName?: string;
}

export function EditingIndicator({ user, fieldName }: EditingIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!user) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [user, pulseAnim]);

  if (!user) return null;

  return (
    <Animated.View style={[styles.editingContainer, { opacity: pulseAnim }]}>
      <Avatar user={user} size={20} showStatus={false} />
      <Text style={styles.editingText}>
        {user.name || 'Someone'} is editing{fieldName ? ` ${fieldName}` : ''}
      </Text>
    </Animated.View>
  );
}

// ============================================================================
// CURSOR POSITION OVERLAY
// ============================================================================

interface CursorPosition {
  x: number;
  y: number;
}

interface UserCursor {
  user: PresenceUser;
  position: CursorPosition;
}

interface CursorOverlayProps {
  cursors: UserCursor[];
  containerWidth: number;
  containerHeight: number;
}

export function CursorOverlay({ cursors, containerWidth, containerHeight }: CursorOverlayProps) {
  return (
    <View style={[styles.cursorOverlay, { width: containerWidth, height: containerHeight }]} pointerEvents="none">
      {cursors.map(cursor => {
        // Convert relative position to absolute
        const x = (cursor.position.x / 100) * containerWidth;
        const y = (cursor.position.y / 100) * containerHeight;

        return (
          <UserCursorIndicator
            key={cursor.user.id}
            user={cursor.user}
            x={x}
            y={y}
          />
        );
      })}
    </View>
  );
}

interface UserCursorIndicatorProps {
  user: PresenceUser;
  x: number;
  y: number;
}

function UserCursorIndicator({ user, x, y }: UserCursorIndicatorProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const getColorFromId = (id: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const color = getColorFromId(user.id);

  return (
    <Animated.View
      style={[
        styles.userCursor,
        {
          left: x,
          top: y,
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={[styles.cursorPointer, { borderTopColor: color }]} />
      <View style={[styles.cursorLabel, { backgroundColor: color }]}>
        <Text style={styles.cursorLabelText}>{user.name || 'User'}</Text>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// PRESENCE STATUS BAR
// ============================================================================

interface PresenceStatusBarProps {
  users: PresenceUser[];
  currentUserId: string;
  isConnected: boolean;
}

export function PresenceStatusBar({
  users,
  currentUserId,
  isConnected,
}: PresenceStatusBarProps) {
  const otherUsers = users.filter(u => u.id !== currentUserId);
  const typingUsers = otherUsers.filter(u => u.isTyping);

  return (
    <View style={styles.presenceBar}>
      <View style={styles.presenceBarLeft}>
        <View
          style={[
            styles.presenceBarDot,
            { backgroundColor: isConnected ? '#00FF88' : '#808080' },
          ]}
        />
        <Text style={styles.presenceBarText}>
          {isConnected ? 'Connected' : 'Connecting...'}
        </Text>
      </View>

      <View style={styles.presenceBarRight}>
        {typingUsers.length > 0 && (
          <View style={styles.presenceBarTyping}>
            <Ionicons name="create-outline" size={14} color="#FFD700" />
          </View>
        )}
        {otherUsers.length > 0 && (
          <AvatarList
            users={otherUsers}
            maxVisible={3}
            size={24}
            overlap={6}
            showCount={true}
          />
        )}
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Avatar
  avatarContainer: {
    position: 'relative',
  },
  avatarImage: {
    backgroundColor: '#333',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  statusDot: {
    position: 'absolute',
    borderColor: '#0a0a0a',
  },
  avatarName: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 60,
  },

  // Avatar List
  avatarList: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarListItem: {
    borderWidth: 2,
    borderColor: '#0a0a0a',
    borderRadius: 100,
  },
  avatarOverflow: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  avatarOverflowText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  // Viewers Panel
  viewersPanel: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  viewersPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  viewersPanelTitle: {
    color: '#888',
    fontSize: 11,
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  viewersPanelCount: {
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  viewersPanelCountText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  viewersPanelContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Typing Indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#888',
    marginHorizontal: 2,
  },
  typingText: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },

  // Editing Indicator
  editingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  editingText: {
    color: '#FFD700',
    fontSize: 11,
    marginLeft: 6,
  },

  // Cursor Overlay
  cursorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  userCursor: {
    position: 'absolute',
  },
  cursorPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '-20deg' }],
  },
  cursorLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: -2,
    marginLeft: 8,
  },
  cursorLabelText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '600',
  },

  // Presence Bar
  presenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  presenceBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presenceBarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  presenceBarText: {
    color: '#888',
    fontSize: 12,
  },
  presenceBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presenceBarTyping: {
    marginRight: 12,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  Avatar,
  AvatarList,
  ActiveViewersPanel,
  TypingIndicator,
  EditingIndicator,
  CursorOverlay,
  PresenceStatusBar,
};
