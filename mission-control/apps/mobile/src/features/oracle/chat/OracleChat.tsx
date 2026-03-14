/**
 * ORACLE Chat Screen
 * Story adv-25 - Natural language chat interface with ORACLE
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ORACLE_COLORS } from '../theme';

// Message types
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  confidence?: number;
  data?: any;
  suggestions?: string[];
  isError?: boolean;
}

interface RichCard {
  type: 'signal' | 'decision' | 'prediction' | 'stat';
  title: string;
  subtitle?: string;
  value?: string | number;
  color?: string;
  icon?: string;
}

// Storage key for message history
const CHAT_HISTORY_KEY = '@oracle_chat_history';
const MAX_STORED_MESSAGES = 100;

// API configuration
const API_BASE = 'http://localhost:3001';

export default function OracleChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingAnimation = useRef(new Animated.Value(0)).current;

  // Load message history on mount
  useEffect(() => {
    loadMessageHistory();
  }, []);

  // Save messages when they change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessageHistory();
    }
  }, [messages]);

  // Typing animation
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnimation, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(typingAnimation, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      typingAnimation.setValue(0);
    }
  }, [isLoading]);

  const loadMessageHistory = async () => {
    try {
      const stored = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setMessages(parsed.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })));
        setConversationId(parsed.conversationId);
      } else {
        // Add welcome message
        addWelcomeMessage();
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      addWelcomeMessage();
    }
  };

  const saveMessageHistory = async () => {
    try {
      const toSave = messages.slice(-MAX_STORED_MESSAGES);
      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify({
        messages: toSave,
        conversationId,
      }));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };

  const addWelcomeMessage = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm ORACLE, your intelligent assistant. I can help you with:\n\n" +
        "- Checking your status and signals\n" +
        "- Making predictions and decisions\n" +
        "- Analyzing patterns and recommendations\n" +
        "- Answering questions about your data\n\n" +
        "What would you like to know?",
      timestamp: new Date(),
      suggestions: [
        "What's my current status?",
        "Show me urgent signals",
        "What decisions need attention?",
        "How am I doing this week?",
      ],
    }]);
  };

  const sendMessage = async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/oracle/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedText,
          conversation_id: conversationId,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        const { intent, response: queryResponse, confidence, data, conversation_id } = result.data;

        setConversationId(conversation_id);

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: queryResponse.answer,
          timestamp: new Date(),
          intent,
          confidence,
          data: queryResponse.data,
          suggestions: queryResponse.suggestions,
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(result.error || 'Failed to process query');
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm having trouble connecting. Please try again.",
        timestamp: new Date(),
        isError: true,
        suggestions: ["Try again", "Check status"],
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSuggestionPress = (suggestion: string) => {
    setInputText(suggestion);
    // Auto-send if it looks like a complete question
    if (suggestion.endsWith('?') || suggestion.includes('Show') || suggestion.includes('Check')) {
      setTimeout(() => {
        setInputText(suggestion);
        sendMessage();
      }, 100);
    }
  };

  const clearHistory = async () => {
    await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
    setConversationId(null);
    addWelcomeMessage();
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.messageRow, isUser && styles.userMessageRow]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>O</Text>
          </View>
        )}

        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          item.isError && styles.errorBubble,
        ]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {item.content}
          </Text>

          {/* Rich data cards */}
          {item.data && <RichDataSection data={item.data} />}

          {/* Confidence indicator */}
          {item.confidence !== undefined && !isUser && (
            <View style={styles.confidenceContainer}>
              <View style={styles.confidenceBar}>
                <View
                  style={[styles.confidenceFill, { width: `${item.confidence * 100}%` }]}
                />
              </View>
              <Text style={styles.confidenceText}>
                {Math.round(item.confidence * 100)}% confident
              </Text>
            </View>
          )}

          {/* Quick reply suggestions */}
          {item.suggestions && item.suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {item.suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestionPress(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {isUser && (
          <View style={[styles.avatarContainer, styles.userAvatar]}>
            <Text style={styles.avatarText}>U</Text>
          </View>
        )}
      </View>
    );
  };

  const renderTypingIndicator = () => {
    if (!isLoading) return null;

    return (
      <View style={styles.typingContainer}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>O</Text>
        </View>
        <View style={styles.typingBubble}>
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={[
                styles.typingDot,
                {
                  opacity: typingAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: index === 0 ? [0.3, 1, 0.3] :
                                index === 1 ? [1, 0.3, 1] : [0.3, 1, 0.3],
                  }),
                },
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.oracleBadge}>
            <Text style={styles.oracleBadgeText}>ORACLE</Text>
          </View>
          <View style={styles.statusDot} />
        </View>
        <TouchableOpacity onPress={clearHistory} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        ListFooterComponent={renderTypingIndicator}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask ORACLE anything..."
          placeholderTextColor="#666"
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>→</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// Rich data section component
function RichDataSection({ data }: { data: any }) {
  if (!data) return null;

  // Handle different data types
  if (data.signals && Array.isArray(data.signals)) {
    return (
      <View style={styles.richDataContainer}>
        {data.signals.slice(0, 3).map((signal: any, index: number) => (
          <RichCard
            key={index}
            type="signal"
            title={signal.title}
            subtitle={signal.urgency}
            color={getUrgencyColor(signal.urgency)}
            icon={getUrgencyIcon(signal.urgency)}
          />
        ))}
        {data.signals.length > 3 && (
          <Text style={styles.moreText}>+{data.signals.length - 3} more</Text>
        )}
      </View>
    );
  }

  if (data.decisions && Array.isArray(data.decisions)) {
    return (
      <View style={styles.richDataContainer}>
        {data.decisions.slice(0, 3).map((decision: any, index: number) => (
          <RichCard
            key={index}
            type="decision"
            title={decision.title}
            subtitle={decision.status}
            color={ORACLE_COLORS.decide}
            icon="⚖️"
          />
        ))}
      </View>
    );
  }

  if (data.stats) {
    return (
      <View style={styles.statsContainer}>
        {Object.entries(data.stats).slice(0, 4).map(([key, value]: [string, any], index) => (
          <View key={index} style={styles.statCard}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{formatLabel(key)}</Text>
          </View>
        ))}
      </View>
    );
  }

  return null;
}

// Rich card component
function RichCard({ type, title, subtitle, color, icon }: RichCard) {
  return (
    <View style={[styles.richCard, { borderLeftColor: color || ORACLE_COLORS.observe }]}>
      <Text style={styles.richCardIcon}>{icon}</Text>
      <View style={styles.richCardContent}>
        <Text style={styles.richCardTitle} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.richCardSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

// Helper functions
function getUrgencyColor(urgency: string): string {
  switch (urgency?.toLowerCase()) {
    case 'critical': return '#ff4444';
    case 'high': return '#ff8c00';
    case 'medium': return '#ffd700';
    case 'low': return '#00bfff';
    default: return '#666';
  }
}

function getUrgencyIcon(urgency: string): string {
  switch (urgency?.toLowerCase()) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oracleBadge: {
    backgroundColor: ORACLE_COLORS.observe,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  oracleBadgeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff88',
    marginLeft: 8,
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#666',
    fontSize: 14,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ORACLE_COLORS.observe,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userAvatar: {
    backgroundColor: '#444',
    marginRight: 0,
    marginLeft: 8,
  },
  avatarText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  assistantBubble: {
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: ORACLE_COLORS.observe,
    borderBottomRightRadius: 4,
  },
  errorBubble: {
    backgroundColor: '#331111',
    borderColor: '#ff4444',
    borderWidth: 1,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#000',
  },
  timestamp: {
    color: '#666',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'right',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  confidenceBar: {
    flex: 1,
    height: 3,
    backgroundColor: '#333',
    borderRadius: 1.5,
    marginRight: 8,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 1.5,
  },
  confidenceText: {
    color: '#666',
    fontSize: 10,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  suggestionText: {
    color: ORACLE_COLORS.observe,
    fontSize: 12,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  typingBubble: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORACLE_COLORS.observe,
    marginHorizontal: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#0a0a0a',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORACLE_COLORS.observe,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
  sendButtonText: {
    color: '#000',
    fontSize: 20,
    fontWeight: 'bold',
  },
  richDataContainer: {
    marginTop: 12,
  },
  richCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginBottom: 6,
  },
  richCardIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  richCardContent: {
    flex: 1,
  },
  richCardTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  richCardSubtitle: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  moreText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  statCard: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    minWidth: '45%',
    alignItems: 'center',
  },
  statValue: {
    color: ORACLE_COLORS.observe,
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
});
