/**
 * BriefingAudio Component
 * Audio playback of briefing with TTS-ready features
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORACLE_COLORS } from '../../../store/oracle';

const { width } = Dimensions.get('window');

// ============================================================================
// Types
// ============================================================================

export interface AudioSegment {
  id: string;
  text: string;
  type: 'greeting' | 'section_title' | 'content' | 'sign_off' | 'quote';
  sectionIndex?: number;
  duration?: number; // Estimated duration in milliseconds
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentSegmentIndex: number;
  progress: number;
  totalDuration: number;
  elapsedTime: number;
}

interface BriefingAudioProps {
  script: string;
  segments?: AudioSegment[];
  briefingTitle?: string;
  onPlaybackStateChange?: (state: AudioPlaybackState) => void;
  onComplete?: () => void;
  autoPlay?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

const parseScriptToSegments = (script: string): AudioSegment[] => {
  const segments: AudioSegment[] = [];
  const lines = script.split('\n').filter((line) => line.trim());

  let sectionIndex = 0;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let type: AudioSegment['type'] = 'content';

    // Detect section titles (all caps with colon)
    if (/^[A-Z\s]+:$/.test(trimmed)) {
      type = 'section_title';
      sectionIndex++;
    } else if (index === 0 || trimmed.includes('Good morning') || trimmed.includes('Good afternoon') || trimmed.includes('Good evening')) {
      type = 'greeting';
    } else if (trimmed.includes('End of briefing') || trimmed.includes('Stay focused') || trimmed.includes('Go make it happen')) {
      type = 'sign_off';
    } else if (trimmed.startsWith('"') && trimmed.includes(' - ')) {
      type = 'quote';
    }

    // Estimate duration based on word count (avg 150 words per minute)
    const wordCount = trimmed.split(/\s+/).length;
    const duration = Math.ceil((wordCount / 150) * 60 * 1000);

    segments.push({
      id: `segment-${index}`,
      text: trimmed,
      type,
      sectionIndex: type === 'section_title' || type === 'content' ? sectionIndex : undefined,
      duration,
    });
  });

  return segments;
};

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// ============================================================================
// Waveform Visualization Component
// ============================================================================

interface WaveformProps {
  isPlaying: boolean;
  color: string;
}

const Waveform: React.FC<WaveformProps> = ({ isPlaying, color }) => {
  const bars = Array.from({ length: 20 }, (_, i) => i);
  const animations = useRef(bars.map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (isPlaying) {
      const animationConfigs = animations.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 0.7 + 0.3,
              duration: 300 + Math.random() * 200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 300 + Math.random() * 200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ])
        );
      });

      Animated.parallel(animationConfigs).start();
    } else {
      animations.forEach((anim) => anim.setValue(0.3));
    }

    return () => {
      animations.forEach((anim) => anim.stopAnimation());
    };
  }, [isPlaying]);

  return (
    <View style={styles.waveformContainer}>
      {bars.map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waveformBar,
            {
              backgroundColor: color,
              height: animations[index].interpolate({
                inputRange: [0, 1],
                outputRange: ['20%', '100%'],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
};

// ============================================================================
// Segment Display Component
// ============================================================================

interface SegmentDisplayProps {
  segments: AudioSegment[];
  currentIndex: number;
  onSegmentPress: (index: number) => void;
}

const SegmentDisplay: React.FC<SegmentDisplayProps> = ({
  segments,
  currentIndex,
  onSegmentPress,
}) => {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Auto-scroll to current segment
    if (scrollRef.current && currentIndex >= 0) {
      const yOffset = Math.max(0, currentIndex * 60 - 100);
      scrollRef.current.scrollTo({ y: yOffset, animated: true });
    }
  }, [currentIndex]);

  const getSegmentStyle = (type: AudioSegment['type']) => {
    switch (type) {
      case 'greeting':
        return { color: ORACLE_COLORS.act };
      case 'section_title':
        return { color: ORACLE_COLORS.orient, fontWeight: '600' as const };
      case 'sign_off':
        return { color: ORACLE_COLORS.observe };
      case 'quote':
        return { color: '#888', fontStyle: 'italic' as const };
      default:
        return { color: '#CCC' };
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.segmentList}
      showsVerticalScrollIndicator={false}
    >
      {segments.map((segment, index) => (
        <TouchableOpacity
          key={segment.id}
          style={[
            styles.segmentItem,
            index === currentIndex && styles.segmentItemActive,
          ]}
          onPress={() => onSegmentPress(index)}
          activeOpacity={0.7}
        >
          <View style={styles.segmentIndicator}>
            {index < currentIndex && (
              <Ionicons name="checkmark" size={14} color={ORACLE_COLORS.act} />
            )}
            {index === currentIndex && (
              <View style={styles.currentIndicator} />
            )}
            {index > currentIndex && (
              <View style={styles.pendingIndicator} />
            )}
          </View>
          <Text
            style={[
              styles.segmentText,
              getSegmentStyle(segment.type),
              index === currentIndex && styles.segmentTextActive,
            ]}
            numberOfLines={segment.type === 'section_title' ? 1 : 3}
          >
            {segment.text}
          </Text>
        </TouchableOpacity>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

// ============================================================================
// Main BriefingAudio Component
// ============================================================================

export const BriefingAudio: React.FC<BriefingAudioProps> = ({
  script,
  segments: providedSegments,
  briefingTitle,
  onPlaybackStateChange,
  onComplete,
  autoPlay = false,
}) => {
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>({
    isPlaying: false,
    isPaused: false,
    currentSegmentIndex: -1,
    progress: 0,
    totalDuration: 0,
    elapsedTime: 0,
  });

  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showTranscript, setShowTranscript] = useState(true);

  const segments = providedSegments || parseScriptToSegments(script);
  const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 2000), 0);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const playbackTimer = useRef<NodeJS.Timeout | null>(null);

  // Pulse animation for play button
  useEffect(() => {
    if (!playbackState.isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [playbackState.isPlaying]);

  // Simulate playback
  useEffect(() => {
    if (playbackState.isPlaying && !playbackState.isPaused) {
      const currentSegment = segments[playbackState.currentSegmentIndex];
      const segmentDuration = (currentSegment?.duration || 2000) / playbackSpeed;

      playbackTimer.current = setTimeout(() => {
        if (playbackState.currentSegmentIndex < segments.length - 1) {
          setPlaybackState((prev) => ({
            ...prev,
            currentSegmentIndex: prev.currentSegmentIndex + 1,
            elapsedTime: segments.slice(0, prev.currentSegmentIndex + 1).reduce(
              (sum, seg) => sum + (seg.duration || 2000),
              0
            ),
          }));
        } else {
          // Playback complete
          setPlaybackState((prev) => ({
            ...prev,
            isPlaying: false,
            isPaused: false,
          }));
          onComplete?.();
        }
      }, segmentDuration);
    }

    return () => {
      if (playbackTimer.current) {
        clearTimeout(playbackTimer.current);
      }
    };
  }, [playbackState.isPlaying, playbackState.isPaused, playbackState.currentSegmentIndex, playbackSpeed]);

  // Update progress animation
  useEffect(() => {
    const progress = playbackState.elapsedTime / totalDuration;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [playbackState.elapsedTime, totalDuration]);

  // Notify parent of state changes
  useEffect(() => {
    onPlaybackStateChange?.({
      ...playbackState,
      totalDuration,
    });
  }, [playbackState, totalDuration]);

  // Auto-play on mount if enabled
  useEffect(() => {
    if (autoPlay) {
      handlePlay();
    }
  }, [autoPlay]);

  const handlePlay = useCallback(() => {
    setPlaybackState((prev) => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      currentSegmentIndex: prev.currentSegmentIndex < 0 ? 0 : prev.currentSegmentIndex,
    }));
  }, []);

  const handlePause = useCallback(() => {
    setPlaybackState((prev) => ({
      ...prev,
      isPaused: true,
    }));
  }, []);

  const handleStop = useCallback(() => {
    setPlaybackState({
      isPlaying: false,
      isPaused: false,
      currentSegmentIndex: -1,
      progress: 0,
      totalDuration,
      elapsedTime: 0,
    });
  }, [totalDuration]);

  const handleSeekToSegment = useCallback((index: number) => {
    const elapsedTime = segments.slice(0, index).reduce(
      (sum, seg) => sum + (seg.duration || 2000),
      0
    );
    setPlaybackState((prev) => ({
      ...prev,
      currentSegmentIndex: index,
      elapsedTime,
      isPlaying: true,
      isPaused: false,
    }));
  }, [segments]);

  const handleSkipBack = useCallback(() => {
    if (playbackState.currentSegmentIndex > 0) {
      handleSeekToSegment(playbackState.currentSegmentIndex - 1);
    }
  }, [playbackState.currentSegmentIndex, handleSeekToSegment]);

  const handleSkipForward = useCallback(() => {
    if (playbackState.currentSegmentIndex < segments.length - 1) {
      handleSeekToSegment(playbackState.currentSegmentIndex + 1);
    }
  }, [playbackState.currentSegmentIndex, segments.length, handleSeekToSegment]);

  const toggleSpeed = useCallback(() => {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);
  }, [playbackSpeed]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{briefingTitle || 'Briefing Audio'}</Text>
        <TouchableOpacity
          style={styles.transcriptToggle}
          onPress={() => setShowTranscript(!showTranscript)}
        >
          <Ionicons
            name={showTranscript ? 'document-text' : 'document-text-outline'}
            size={20}
            color={showTranscript ? ORACLE_COLORS.observe : '#888'}
          />
        </TouchableOpacity>
      </View>

      {/* Waveform / Visualization */}
      <View style={styles.visualizerContainer}>
        <Waveform
          isPlaying={playbackState.isPlaying && !playbackState.isPaused}
          color={ORACLE_COLORS.observe}
        />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.timeText}>{formatTime(playbackState.elapsedTime)}</Text>
        <View style={styles.progressBarOuter}>
          <Animated.View
            style={[
              styles.progressBarInner,
              { width: progressWidth },
            ]}
          />
        </View>
        <Text style={styles.timeText}>{formatTime(totalDuration)}</Text>
      </View>

      {/* Playback Controls */}
      <View style={styles.controls}>
        {/* Speed Control */}
        <TouchableOpacity style={styles.speedButton} onPress={toggleSpeed}>
          <Text style={styles.speedText}>{playbackSpeed}x</Text>
        </TouchableOpacity>

        {/* Skip Back */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleSkipBack}
          disabled={playbackState.currentSegmentIndex <= 0}
        >
          <Ionicons
            name="play-skip-back"
            size={28}
            color={playbackState.currentSegmentIndex <= 0 ? '#444' : '#FFF'}
          />
        </TouchableOpacity>

        {/* Play/Pause */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={playbackState.isPlaying && !playbackState.isPaused ? handlePause : handlePlay}
          >
            <Ionicons
              name={playbackState.isPlaying && !playbackState.isPaused ? 'pause' : 'play'}
              size={36}
              color="#000"
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Skip Forward */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleSkipForward}
          disabled={playbackState.currentSegmentIndex >= segments.length - 1}
        >
          <Ionicons
            name="play-skip-forward"
            size={28}
            color={playbackState.currentSegmentIndex >= segments.length - 1 ? '#444' : '#FFF'}
          />
        </TouchableOpacity>

        {/* Stop */}
        <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <Ionicons name="stop" size={24} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Transcript / Segment List */}
      {showTranscript && (
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptTitle}>Transcript</Text>
          <SegmentDisplay
            segments={segments}
            currentIndex={playbackState.currentSegmentIndex}
            onSegmentPress={handleSeekToSegment}
          />
        </View>
      )}
    </View>
  );
};

// ============================================================================
// Compact Audio Player Component
// ============================================================================

interface CompactAudioPlayerProps {
  briefingTitle: string;
  duration: number;
  onPress: () => void;
}

export const CompactAudioPlayer: React.FC<CompactAudioPlayerProps> = ({
  briefingTitle,
  duration,
  onPress,
}) => {
  return (
    <TouchableOpacity style={styles.compactPlayer} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.compactPlayIcon}>
        <Ionicons name="play" size={20} color="#FFF" />
      </View>
      <View style={styles.compactInfo}>
        <Text style={styles.compactTitle}>{briefingTitle}</Text>
        <Text style={styles.compactDuration}>{formatTime(duration)}</Text>
      </View>
      <Ionicons name="headset" size={20} color="#888" />
    </TouchableOpacity>
  );
};

// ============================================================================
// Styles
// ============================================================================

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
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  transcriptToggle: {
    padding: 8,
  },
  visualizerContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    paddingHorizontal: 20,
  },
  waveformBar: {
    width: (width - 80) / 20,
    marginHorizontal: 2,
    borderRadius: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  timeText: {
    fontSize: 12,
    color: '#888',
    width: 45,
    textAlign: 'center',
  },
  progressBarOuter: {
    flex: 1,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#222',
    marginHorizontal: 20,
  },
  speedButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    position: 'absolute',
    left: 0,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  controlButton: {
    padding: 12,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ORACLE_COLORS.observe,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  stopButton: {
    padding: 12,
    position: 'absolute',
    right: 0,
  },
  transcriptContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  transcriptTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  segmentList: {
    flex: 1,
  },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  segmentItemActive: {
    backgroundColor: 'rgba(0, 191, 255, 0.1)',
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderLeftWidth: 3,
    borderLeftColor: ORACLE_COLORS.observe,
  },
  segmentIndicator: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  currentIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ORACLE_COLORS.observe,
  },
  pendingIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#444',
  },
  segmentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  segmentTextActive: {
    color: '#FFF',
    fontWeight: '500',
  },
  // Compact player styles
  compactPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  compactPlayIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORACLE_COLORS.observe,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  compactDuration: {
    fontSize: 12,
    color: '#888',
  },
});

export default BriefingAudio;
