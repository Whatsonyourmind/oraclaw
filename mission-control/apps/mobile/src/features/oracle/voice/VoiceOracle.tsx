/**
 * VoiceOracle Component
 * Story adv-22 - Voice command mobile interface
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  Modal,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { oracleVoiceService, VoiceCommand, CommandResult } from '../../../services/oracleVoice';
import { ORACLE_COLORS } from '../../../store/oracle';

const { width, height } = Dimensions.get('window');

// Waveform bar count
const WAVE_BARS = 20;

// Command result display
interface CommandDisplayProps {
  result: CommandResult | null;
  isProcessing: boolean;
}

const CommandDisplay: React.FC<CommandDisplayProps> = ({ result, isProcessing }) => {
  if (isProcessing) {
    return (
      <View style={styles.commandDisplay}>
        <Animated.View style={styles.processingDots}>
          <ProcessingDots />
        </Animated.View>
        <Text style={styles.processingText}>Processing...</Text>
      </View>
    );
  }

  if (!result) return null;

  const getCommandIcon = (command: VoiceCommand): string => {
    switch (command) {
      case 'scan': return 'radio';
      case 'decide': return 'git-compare';
      case 'plan': return 'rocket';
      case 'status': return 'analytics';
      case 'help': return 'help-circle';
      case 'create': return 'add-circle';
      case 'stop': return 'close-circle';
      default: return 'help';
    }
  };

  const getCommandColor = (command: VoiceCommand): string => {
    switch (command) {
      case 'scan': return ORACLE_COLORS.observe;
      case 'decide': return ORACLE_COLORS.decide;
      case 'plan': return ORACLE_COLORS.act;
      case 'status': return ORACLE_COLORS.orient;
      default: return '#888';
    }
  };

  return (
    <View style={styles.commandDisplay}>
      <View style={[styles.commandIconContainer, { backgroundColor: `${getCommandColor(result.command)}20` }]}>
        <Ionicons
          name={getCommandIcon(result.command) as any}
          size={32}
          color={getCommandColor(result.command)}
        />
      </View>
      <Text style={styles.commandText}>
        {result.command === 'unknown' ? 'Command not recognized' : `"${result.transcript}"`}
      </Text>
      {result.command !== 'unknown' && (
        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              {
                width: `${result.confidence * 100}%`,
                backgroundColor: getCommandColor(result.command),
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

// Processing dots animation
const ProcessingDots: React.FC = () => {
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      ).start();
    };

    animate(dot1Anim, 0);
    animate(dot2Anim, 150);
    animate(dot3Anim, 300);
  }, []);

  return (
    <View style={styles.dotsContainer}>
      {[dot1Anim, dot2Anim, dot3Anim].map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -10],
                  }),
                },
              ],
              opacity: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 1],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
};

// Waveform visualization
interface WaveformProps {
  isActive: boolean;
  volume: number;
}

const Waveform: React.FC<WaveformProps> = ({ isActive, volume }) => {
  const barAnims = useRef(
    Array(WAVE_BARS)
      .fill(0)
      .map(() => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (isActive) {
      const animations = barAnims.map((anim, i) => {
        const baseHeight = 0.2 + volume * 0.5;
        const variation = Math.sin(Date.now() / 200 + i * 0.5) * 0.3;
        const targetHeight = Math.max(0.1, Math.min(1, baseHeight + variation));

        return Animated.timing(anim, {
          toValue: targetHeight,
          duration: 100,
          useNativeDriver: false,
        });
      });

      Animated.parallel(animations).start();
    } else {
      const animations = barAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 0.2,
          duration: 300,
          useNativeDriver: false,
        })
      );
      Animated.parallel(animations).start();
    }
  }, [isActive, volume]);

  return (
    <View style={styles.waveformContainer}>
      {barAnims.map((anim, i) => {
        const isCenter = Math.abs(i - WAVE_BARS / 2) < 3;
        return (
          <Animated.View
            key={i}
            style={[
              styles.waveBar,
              {
                height: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 60],
                }),
                backgroundColor: isActive
                  ? isCenter
                    ? ORACLE_COLORS.observe
                    : `${ORACLE_COLORS.observe}80`
                  : '#333',
              },
            ]}
          />
        );
      })}
    </View>
  );
};

// Main push-to-talk button
interface TalkButtonProps {
  isListening: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  disabled: boolean;
}

const TalkButton: React.FC<TalkButtonProps> = ({ isListening, onPressIn, onPressOut, disabled }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isListening) {
      Animated.spring(scaleAnim, {
        toValue: 1.1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start();

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start();

      pulseAnim.setValue(0);
    }
  }, [isListening]);

  return (
    <View style={styles.talkButtonContainer}>
      {/* Pulse ring */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            opacity: pulseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 0],
            }),
            transform: [
              {
                scale: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.5],
                }),
              },
            ],
          },
        ]}
      />

      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.talkButton,
            isListening && styles.talkButtonActive,
            disabled && styles.talkButtonDisabled,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Ionicons
            name={isListening ? 'mic' : 'mic-outline'}
            size={48}
            color={isListening ? '#FFF' : disabled ? '#666' : ORACLE_COLORS.observe}
          />
        </Animated.View>
      </TouchableOpacity>

      <Text style={styles.talkButtonLabel}>
        {isListening ? 'Listening...' : disabled ? 'Permission Required' : 'Hold to Speak'}
      </Text>
    </View>
  );
};

// Transcription display
interface TranscriptionProps {
  text: string;
  isPartial: boolean;
}

const Transcription: React.FC<TranscriptionProps> = ({ text, isPartial }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (text) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [text]);

  if (!text) return null;

  return (
    <Animated.View style={[styles.transcription, { opacity: fadeAnim }]}>
      <Text style={[styles.transcriptionText, isPartial && styles.transcriptionPartial]}>
        "{text}"
        {isPartial && <Text style={styles.cursor}>|</Text>}
      </Text>
    </Animated.View>
  );
};

// Help Modal
interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ visible, onClose }) => {
  const commands = [
    { cmd: 'Scan / Radar', desc: 'Start environmental scan', icon: 'radio', color: ORACLE_COLORS.observe },
    { cmd: 'Decide / Options', desc: 'View pending decisions', icon: 'git-compare', color: ORACLE_COLORS.decide },
    { cmd: 'Plan / Execute', desc: 'View active plans', icon: 'rocket', color: ORACLE_COLORS.act },
    { cmd: 'Status', desc: 'Get ORACLE status', icon: 'analytics', color: ORACLE_COLORS.orient },
    { cmd: 'Create [type]', desc: 'Create new signal', icon: 'add-circle', color: '#4CAF50' },
    { cmd: 'Help', desc: 'Show commands', icon: 'help-circle', color: '#9E9E9E' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.helpModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Voice Commands</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <View style={styles.commandsList}>
            {commands.map((item, i) => (
              <View key={i} style={styles.commandItem}>
                <View style={[styles.commandItemIcon, { backgroundColor: `${item.color}20` }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.commandItemContent}>
                  <Text style={styles.commandItemTitle}>"{item.cmd}"</Text>
                  <Text style={styles.commandItemDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.helpNote}>
            Hold the microphone button and speak clearly. Release when done.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

// Main Component
export const VoiceOracle: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [partialText, setPartialText] = useState('');
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize voice service
    const init = async () => {
      await oracleVoiceService.initialize();
      const permission = await oracleVoiceService.requestPermission();
      setHasPermission(permission);
    };
    init();
  }, []);

  const handlePressIn = useCallback(async () => {
    setError(null);
    setCommandResult(null);
    setPartialText('');

    await oracleVoiceService.startListening({
      onStart: () => {
        setIsListening(true);
      },
      onStop: () => {
        setIsListening(false);
        setVolume(0);
      },
      onPartialResult: (partial) => {
        setPartialText(partial);
      },
      onResult: async (result) => {
        setIsProcessing(true);
        setCommandResult(result);

        // Speak the response if enabled
        if (autoSpeak) {
          await oracleVoiceService.speakCommandResponse(result);
        }

        setIsProcessing(false);
      },
      onError: (err) => {
        setError(err.message);
        setIsListening(false);
      },
      onVolumeChange: (vol) => {
        setVolume(vol);
      },
    });
  }, [autoSpeak]);

  const handlePressOut = useCallback(() => {
    oracleVoiceService.stopListening();
  }, []);

  const handleRequestPermission = async () => {
    const granted = await oracleVoiceService.requestPermission();
    setHasPermission(granted);
    if (!granted) {
      setError('Microphone permission is required for voice commands');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Voice Control</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setShowHelp(true)}>
            <Ionicons name="help-circle-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        {/* Command result display */}
        <View style={styles.resultSection}>
          <CommandDisplay result={commandResult} isProcessing={isProcessing} />
        </View>

        {/* Transcription */}
        <Transcription text={partialText} isPartial={isListening} />

        {/* Waveform */}
        <View style={styles.waveformSection}>
          <Waveform isActive={isListening} volume={volume} />
        </View>

        {/* Push-to-talk button */}
        <TalkButton
          isListening={isListening}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={!hasPermission}
        />

        {/* Permission request */}
        {!hasPermission && (
          <TouchableOpacity style={styles.permissionButton} onPress={handleRequestPermission}>
            <Text style={styles.permissionButtonText}>Grant Microphone Permission</Text>
          </TouchableOpacity>
        )}

        {/* Error display */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={16} color="#F44336" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      {/* Settings */}
      <View style={styles.settingsSection}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name="volume-high" size={20} color="#888" />
            <Text style={styles.settingLabel}>Speak Responses</Text>
          </View>
          <Switch
            value={autoSpeak}
            onValueChange={setAutoSpeak}
            trackColor={{ false: '#333', true: `${ORACLE_COLORS.observe}60` }}
            thumbColor={autoSpeak ? ORACLE_COLORS.observe : '#666'}
          />
        </View>
      </View>

      {/* Help Modal */}
      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  resultSection: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  commandDisplay: {
    alignItems: 'center',
  },
  commandIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  commandText: {
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  confidenceBar: {
    width: 100,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  processingText: {
    fontSize: 16,
    color: '#888',
    marginTop: 12,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORACLE_COLORS.observe,
    marginHorizontal: 4,
  },
  transcription: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 30,
  },
  transcriptionText: {
    fontSize: 18,
    color: '#FFF',
    fontStyle: 'italic',
  },
  transcriptionPartial: {
    color: '#888',
  },
  cursor: {
    color: ORACLE_COLORS.observe,
  },
  waveformSection: {
    height: 80,
    justifyContent: 'center',
    marginBottom: 40,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  waveBar: {
    width: 4,
    marginHorizontal: 2,
    borderRadius: 2,
  },
  talkButtonContainer: {
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: ORACLE_COLORS.observe,
  },
  talkButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: ORACLE_COLORS.observe,
  },
  talkButtonActive: {
    backgroundColor: ORACLE_COLORS.observe,
    borderColor: '#FFF',
  },
  talkButtonDisabled: {
    borderColor: '#444',
    opacity: 0.5,
  },
  talkButtonLabel: {
    marginTop: 16,
    fontSize: 16,
    color: '#888',
  },
  permissionButton: {
    marginTop: 30,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 20,
  },
  permissionButtonText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 8,
  },
  settingsSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    color: '#FFF',
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  helpModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
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
    color: '#FFF',
  },
  commandsList: {
    marginBottom: 20,
  },
  commandItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  commandItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commandItemContent: {
    marginLeft: 12,
    flex: 1,
  },
  commandItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  commandItemDesc: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  helpNote: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default VoiceOracle;
