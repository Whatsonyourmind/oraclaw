import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Briefing, Priority, TimeWindow, RecommendedAction } from '@mission-control/shared-types';
import { styles } from './styles';

interface BriefingScreenProps {
  briefing: Briefing;
  onActionSelect: (action: RecommendedAction) => void;
  onDelegationSelect: (delegation: any) => void;
  onClose: () => void;
}

export const BriefingScreen: React.FC<BriefingScreenProps> = ({
  briefing,
  onActionSelect,
  onDelegationSelect,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [currentTime, setCurrentTime] = useState(40);
  const [isPlaying, setIsPlaying] = useState(false);
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  useEffect(() => {
    // Cinematic entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-play countdown
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev <= 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
    const colors = {
      high: '#FF4444',
      medium: '#FFA500', 
      low: '#00FF88'
    };

    return (
      <View style={[styles.priorityBadge, { backgroundColor: colors[priority.urgency] }]}>
        <Text style={styles.priorityText}>{priority.title}</Text>
        <Text style={styles.priorityConfidence}>{Math.round(priority.confidence * 100)}%</Text>
      </View>
    );
  };

  const TimeSlot: React.FC<{ window: TimeWindow }> = ({ window }) => (
    <View style={styles.timeSlot}>
      <Ionicons name="time-outline" size={16} color="#00FF88" />
      <Text style={styles.timeText}>{window.start} - {window.end}</Text>
      <Text style={styles.timePurpose}>{window.purpose}</Text>
    </View>
  );

  const ActionItem: React.FC<{ action: RecommendedAction }> = ({ action }) => (
    <TouchableOpacity 
      style={styles.actionItem}
      onPress={() => onActionSelect(action)}
    >
      <View style={styles.actionHeader}>
        <Ionicons name="arrow-forward-circle" size={20} color="#00FF88" />
        <Text style={styles.actionText}>{action.description}</Text>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceBadgeText}>{Math.round(action.confidence * 100)}%</Text>
        </View>
      </View>
      <View style={styles.effortIndicator}>
        <Text style={styles.effortText}>Sforzo: {action.effort}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Animated.View 
      style={[
        styles.briefingContainer,
        { paddingTop: insets.top, opacity: fadeAnim }
      ]}
    >
      {/* Header with countdown */}
      <View style={styles.briefingHeader}>
        <View style={styles.briefingTitleRow}>
          <Ionicons name="analytics-outline" size={24} color="#00FF88" />
          <Text style={styles.briefingTitle}>RESOCONTO OPERATIVO</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-outline" size={24} color="#FF4444" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.countdownContainer}>
          <TouchableOpacity 
            style={styles.playButton}
            onPress={() => setIsPlaying(!isPlaying)}
          >
            <Ionicons 
              name={isPlaying ? "pause-outline" : "play-outline"} 
              size={20} 
              color="#000" 
            />
          </TouchableOpacity>
          <Text style={styles.countdownText}>{formatTime(currentTime)}</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(currentTime / 40) * 100}%` }
              ]} 
            />
          </View>
        </View>
      </View>

      <Animated.ScrollView 
        style={[styles.briefingContent, { transform: [{ translateY: slideAnim }] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>RIEPILOGO</Text>
          <Text style={styles.summaryText}>{briefing.summary}</Text>
        </View>

        {/* Priorities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRIORITÀ</Text>
          <View style={styles.prioritiesContainer}>
            {briefing.priorities.map((priority, index) => (
              <PriorityBadge key={index} priority={priority} />
            ))}
          </View>
        </View>

        {/* Time Windows */}
        {briefing.time_windows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FINESTRE TEMPORALI</Text>
            {briefing.time_windows.map((window, index) => (
              <TimeSlot key={index} window={window} />
            ))}
          </View>
        )}

        {/* Recommended Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AZIONI CONSIGLIATE</Text>
          {briefing.recommended_actions.map((action, index) => (
            <ActionItem key={index} action={action} />
          ))}
        </View>

        {/* Delegation Opportunities */}
        {briefing.delegation_opportunities && briefing.delegation_opportunities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OPPORTUNITÀ DI DELEGA</Text>
            {briefing.delegation_opportunities.map((delegation, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.delegationItem}
                onPress={() => onDelegationSelect(delegation)}
              >
                <Ionicons name="people-outline" size={18} color="#FFA500" />
                <View style={styles.delegationContent}>
                  <Text style={styles.delegationTask}>{delegation.task}</Text>
                  <Text style={styles.delegationTo}>A: {delegation.to_who}</Text>
                </View>
                <View style={styles.delegationConfidence}>
                  <Text style={styles.confidenceBadgeText}>
                    {Math.round(delegation.confidence * 100)}%
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.ScrollView>

      {/* Bottom controls */}
      <View style={[styles.briefingFooter, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity 
          style={[styles.briefingButton, styles.briefingButtonSecondary]}
          onPress={onClose}
        >
          <Text style={styles.briefingButtonTextSecondary}>CHIUDI</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.briefingButton}
          onPress={() => {
            briefing.recommended_actions.forEach(action => {
              if (action.confidence > 0.8) {
                onActionSelect(action);
              }
            });
          }}
        >
          <Text style={styles.briefingButtonText}>ACCETTA TUTTO</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};