import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Meeting, Decision, FollowUp } from '@mission-control/shared-types';
import { styles } from './styles';

interface MeetingDebriefProps {
  meeting: Meeting;
  onFollowUpSelect: (followUp: FollowUp) => void;
  onSaveDossier: () => void;
  onClose: () => void;
}

export const MeetingDebrief: React.FC<MeetingDebriefProps> = ({
  meeting,
  onFollowUpSelect,
  onSaveDossier,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [sound, setSound] = useState<Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.9);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadAudio = async () => {
    if (!meeting.audio_path) return;
    
    try {
      const { sound: audioSound } = await Audio.Sound.createAsync(
        { uri: meeting.audio_path },
        {
          shouldPlay: false,
          isLooping: false,
        },
        onPlaybackStatusUpdate
      );
      
      setSound(audioSound);
    } catch (error) {
      console.error('Failed to load audio:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPlaybackPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }
  };

  const togglePlayback = async () => {
    if (!sound) {
      await loadAudio();
      return;
    }

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Playback error:', error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return '#00FF88';
    if (confidence > 0.6) return '#FFA500';
    return '#FF4444';
  };

  const DecisionCard: React.FC<{ decision: Decision; index: number }> = ({ decision, index }) => (
    <Animated.View 
      style={[
        styles.decisionCard,
        { 
          opacity: fadeAnim,
          transform: [{ 
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50 * index, 0]
            })
          }]
        }
      ]}
    >
      <View style={styles.decisionHeader}>
        <View style={[styles.confidenceIndicator, { backgroundColor: getConfidenceColor(decision.confidence) }]} />
        <Text style={styles.decisionNumber}>DECISIONE {index + 1}</Text>
        <Text style={styles.confidenceText}>{Math.round(decision.confidence * 100)}%</Text>
      </View>
      
      <Text style={styles.decisionText}>{decision.description}</Text>
      
      {(decision.owner || decision.deadline) && (
        <View style={styles.decisionMeta}>
          {decision.owner && (
            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={14} color="#00FF88" />
              <Text style={styles.metaText}>{decision.owner}</Text>
            </View>
          )}
          {decision.deadline && (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#00FF88" />
              <Text style={styles.metaText}>{decision.deadline}</Text>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );

  const FollowUpCard: React.FC<{ followUp: FollowUp }> = ({ followUp }) => {
    const icons = {
      email: 'mail-outline',
      task: 'checkmark-circle-outline',
      reminder: 'notifications-outline'
    };

    return (
      <TouchableOpacity 
        style={styles.followUpCard}
        onPress={() => onFollowUpSelect(followUp)}
      >
        <View style={styles.followUpHeader}>
          <Ionicons 
            name={icons[followUp.type as keyof typeof icons] || 'document-outline'} 
            size={20} 
            color="#00FF88" 
          />
          <Text style={styles.followUpType}>{followUp.type.toUpperCase()}</Text>
          <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(followUp.confidence) }]}>
            <Text style={styles.confidenceBadgeText}>{Math.round(followUp.confidence * 100)}%</Text>
          </View>
        </View>
        
        <Text style={styles.followUpContent}>{followUp.content}</Text>
        
        {followUp.recipient && (
          <View style={styles.recipientRow}>
            <Ionicons name="send-outline" size={14} color="#FFA500" />
            <Text style={styles.recipientText}>{followUp.recipient}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const slideAnim = new Animated.Value(0);

  return (
    <Animated.View 
      style={[
        styles.debriefContainer,
        { paddingTop: insets.top, opacity: fadeAnim }
      ]}
    >
      {/* Header */}
      <View style={styles.debriefHeader}>
        <View style={styles.headerRow}>
          <Ionicons name="mic-outline" size={24} color="#00FF88" />
          <Text style={styles.headerTitle}>DEBRIEF RIUNIONE</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-outline" size={24} color="#FF4444" />
          </TouchableOpacity>
        </View>
        
        {meeting.title && (
          <Text style={styles.meetingTitle}>{meeting.title}</Text>
        )}
      </View>

      {/* Audio Player */}
      {meeting.audio_path && (
        <View style={styles.audioPlayer}>
          <TouchableOpacity 
            style={styles.playButton}
            onPress={togglePlayback}
          >
            <Ionicons 
              name={isPlaying ? "pause-outline" : "play-outline"} 
              size={24} 
              color="#000" 
            />
          </TouchableOpacity>
          
          <View style={styles.audioInfo}>
            <Text style={styles.audioTime}>
              {formatTime(playbackPosition)} / {formatTime(duration)}
            </Text>
            <View style={styles.audioProgress}>
              <View 
                style={[
                  styles.audioProgressFill,
                  { width: `${duration > 0 ? (playbackPosition / duration) * 100 : 0}%` }
                ]}
              />
            </View>
          </View>
        </View>
      )}

      <ScrollView style={styles.debriefContent} showsVerticalScrollIndicator={false}>
        {/* Decisions */}
        {meeting.decisions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              DECISIONI ({meeting.decisions.length})
            </Text>
            {meeting.decisions.map((decision, index) => (
              <DecisionCard key={index} decision={decision} index={index} />
            ))}
          </View>
        )}

        {/* Follow-ups */}
        {meeting.follow_ups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              AZIONI SUCCESSIVE ({meeting.follow_ups.length})
            </Text>
            {meeting.follow_ups.map((followUp, index) => (
              <FollowUpCard key={index} followUp={followUp} />
            ))}
          </View>
        )}

        {/* Transcript preview */}
        {meeting.transcript && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TRASCRIZIONE</Text>
            <View style={styles.transcriptContainer}>
              <Text style={styles.transcriptText}>
                {meeting.transcript.length > 300 
                  ? `${meeting.transcript.slice(0, 300)}...` 
                  : meeting.transcript}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer controls */}
      <View style={[styles.debriefFooter, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity 
          style={[styles.footerButton, styles.footerButtonSecondary]}
          onPress={onClose}
        >
          <Ionicons name="close-outline" size={18} color="#00FF88" />
          <Text style={styles.footerButtonTextSecondary}>CHIUDI</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={onSaveDossier}
        >
          <Ionicons name="save-outline" size={18} color="#000" />
          <Text style={styles.footerButtonText}>SALVA DOSSIER</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};