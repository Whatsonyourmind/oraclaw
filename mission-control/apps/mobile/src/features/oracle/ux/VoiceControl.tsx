/**
 * VoiceControl Component
 * Story ux-2 - Voice Command System
 *
 * Features:
 * - Text-to-speech with expo-speech
 * - Audio recording with expo-av
 * - Natural language command patterns
 * - Visual feedback during listening
 * - Offline basic command recognition
 *
 * Command patterns:
 * - "What's my top priority?"
 * - "Show me risks"
 * - "Reschedule my meeting"
 * - "Start a decision"
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useUXStore } from '../../../store/oracle/uxStore';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

// Voice command types
export interface VoiceCommand {
  action: string;
  params?: Record<string, unknown>;
  confidence: number;
  originalText: string;
}

// Command pattern definition
interface CommandPattern {
  regex: RegExp;
  action: string;
  description: string;
  example: string;
  params?: (match: RegExpMatchArray) => Record<string, unknown>;
}

// Available command patterns
const COMMAND_PATTERNS: CommandPattern[] = [
  {
    regex: /(?:what(?:'s| is)|show me) (?:my )?top priorit(?:y|ies)/i,
    action: 'showTopPriority',
    description: 'Show your top priorities',
    example: "What's my top priority?",
  },
  {
    regex: /show (?:me )?(?:the )?risks/i,
    action: 'showRisks',
    description: 'Display current risks',
    example: 'Show me risks',
  },
  {
    regex: /reschedule (?:my )?(?:the )?meeting(?: (?:to|for) (.+))?/i,
    action: 'rescheduleMeeting',
    description: 'Reschedule a meeting',
    example: 'Reschedule my meeting',
    params: (match) => ({ targetTime: match[1] || null }),
  },
  {
    regex: /start (?:a |new )?decision/i,
    action: 'startDecision',
    description: 'Begin a new decision process',
    example: 'Start a decision',
  },
  {
    regex: /(?:show |open )?(?:the )?dashboard/i,
    action: 'showDashboard',
    description: 'Open the main dashboard',
    example: 'Show dashboard',
  },
  {
    regex: /(?:what(?:'s| is)|show me) (?:my )?schedule(?: for (.+))?/i,
    action: 'showSchedule',
    description: 'View your schedule',
    example: "What's my schedule?",
    params: (match) => ({ date: match[1] || 'today' }),
  },
  {
    regex: /(?:mark |set )(.+) (?:as )?complete(?:d)?/i,
    action: 'markComplete',
    description: 'Mark an item as complete',
    example: 'Mark task as complete',
    params: (match) => ({ item: match[1] }),
  },
  {
    regex: /(?:add |create )(?:a )?(?:new )?(?:task|todo|item)(?: called| named)? (.+)/i,
    action: 'addTask',
    description: 'Create a new task',
    example: 'Add task called Review documents',
    params: (match) => ({ title: match[1] }),
  },
  {
    regex: /(?:set |switch to )(.+) mode/i,
    action: 'setMode',
    description: 'Switch UI mode',
    example: 'Set focus mode',
    params: (match) => ({ mode: match[1].toLowerCase() }),
  },
  {
    regex: /(?:help|what can (?:you|I) (?:do|say))/i,
    action: 'showHelp',
    description: 'Show available commands',
    example: 'Help',
  },
  {
    regex: /(?:cancel|stop|nevermind|never mind)/i,
    action: 'cancel',
    description: 'Cancel current action',
    example: 'Cancel',
  },
];

/**
 * Parse voice command transcript and return matched command
 * Time Complexity: O(n * m) where n = patterns, m = transcript length
 * Space Complexity: O(1)
 */
export const parseVoiceCommand = (transcript: string): VoiceCommand | null => {
  const normalizedText = transcript.trim().toLowerCase();

  if (!normalizedText) return null;

  for (const pattern of COMMAND_PATTERNS) {
    const match = normalizedText.match(pattern.regex);
    if (match) {
      return {
        action: pattern.action,
        params: pattern.params ? pattern.params(match) : undefined,
        confidence: 0.9, // High confidence for exact pattern match
        originalText: transcript,
      };
    }
  }

  // No exact match - try fuzzy matching for offline basic recognition
  const fuzzyMatch = fuzzyMatchCommand(normalizedText);
  if (fuzzyMatch) {
    return {
      action: fuzzyMatch.action,
      params: undefined,
      confidence: fuzzyMatch.confidence,
      originalText: transcript,
    };
  }

  return null;
};

/**
 * Fuzzy match command for offline basic recognition
 * Uses simple keyword matching
 */
const fuzzyMatchCommand = (text: string): { action: string; confidence: number } | null => {
  const keywords: Record<string, { action: string; weight: number }[]> = {
    priority: [{ action: 'showTopPriority', weight: 0.7 }],
    important: [{ action: 'showTopPriority', weight: 0.6 }],
    urgent: [{ action: 'showTopPriority', weight: 0.6 }],
    risk: [{ action: 'showRisks', weight: 0.7 }],
    danger: [{ action: 'showRisks', weight: 0.5 }],
    meeting: [{ action: 'rescheduleMeeting', weight: 0.5 }],
    calendar: [{ action: 'showSchedule', weight: 0.6 }],
    schedule: [{ action: 'showSchedule', weight: 0.7 }],
    decide: [{ action: 'startDecision', weight: 0.6 }],
    decision: [{ action: 'startDecision', weight: 0.7 }],
    dashboard: [{ action: 'showDashboard', weight: 0.8 }],
    home: [{ action: 'showDashboard', weight: 0.5 }],
    complete: [{ action: 'markComplete', weight: 0.6 }],
    done: [{ action: 'markComplete', weight: 0.5 }],
    finish: [{ action: 'markComplete', weight: 0.5 }],
    task: [{ action: 'addTask', weight: 0.4 }],
    help: [{ action: 'showHelp', weight: 0.9 }],
    stop: [{ action: 'cancel', weight: 0.8 }],
    cancel: [{ action: 'cancel', weight: 0.9 }],
  };

  let bestMatch: { action: string; confidence: number } | null = null;

  const words = text.split(/\s+/);
  for (const word of words) {
    const matches = keywords[word];
    if (matches) {
      for (const match of matches) {
        if (!bestMatch || match.weight > bestMatch.confidence) {
          bestMatch = { action: match.action, confidence: match.weight };
        }
      }
    }
  }

  return bestMatch && bestMatch.confidence >= 0.5 ? bestMatch : null;
};

interface VoiceControlProps {
  onCommand: (command: VoiceCommand) => void;
  onError?: (error: string) => void;
  autoListen?: boolean;
}

/**
 * VoiceControl Component
 * Provides voice command interface with visual feedback
 */
export const VoiceControl: React.FC<VoiceControlProps> = ({
  onCommand,
  onError,
  autoListen = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  const {
    voiceEnabled,
    voiceConfig,
    setVoiceEnabled,
    setListening,
    addVoiceCommand,
  } = useUXStore();

  // Request audio permissions on mount
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        setPermissionGranted(status === 'granted');
        if (status !== 'granted') {
          onError?.('Microphone permission denied');
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
        onError?.('Failed to request microphone permissions');
      }
    };

    requestPermissions();
  }, [onError]);

  // Pulse animation while listening
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      waveAnim.setValue(0);
    }
  }, [isListening, pulseAnim, waveAnim]);

  // Speak text using TTS
  const speak = useCallback(async (text: string) => {
    if (!voiceConfig.feedbackMode || voiceConfig.feedbackMode === 'visual') {
      return;
    }

    try {
      await Speech.speak(text, {
        language: voiceConfig.language || 'en-US',
        pitch: 1.0,
        rate: 0.9,
      });
    } catch (error) {
      console.error('TTS error:', error);
    }
  }, [voiceConfig.feedbackMode, voiceConfig.language]);

  // Start recording
  const startListening = useCallback(async () => {
    if (!permissionGranted) {
      onError?.('Microphone permission not granted');
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsListening(true);
      setListening(true);
      setTranscript('');

      // Provide audio feedback
      if (voiceConfig.feedbackMode !== 'visual') {
        await speak('Listening...');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      onError?.('Failed to start recording');
    }
  }, [permissionGranted, setListening, speak, voiceConfig.feedbackMode, onError]);

  // Stop recording and process
  const stopListening = useCallback(async () => {
    if (!recording) return;

    try {
      setIsListening(false);
      setListening(false);

      await recording.stopAndUnloadAsync();

      // In a production app, you would:
      // 1. Get the audio file URI
      // 2. Send it to a speech-to-text service (Google, AWS, etc.)
      // 3. Process the transcript

      // For demo purposes, simulate a transcript
      // In production, replace this with actual STT integration
      const uri = recording.getURI();
      console.log('Recording saved to:', uri);

      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // For demo, use a placeholder transcript
      // In production, this would come from STT service
      const simulatedTranscript = "what's my top priority";
      setTranscript(simulatedTranscript);

      // Parse the command
      const command = parseVoiceCommand(simulatedTranscript);

      if (command) {
        setLastCommand(command);
        addVoiceCommand(command.originalText, command.action);
        onCommand(command);

        // Speak confirmation
        const confirmations: Record<string, string> = {
          showTopPriority: 'Showing your top priorities',
          showRisks: 'Displaying current risks',
          rescheduleMeeting: 'Opening meeting scheduler',
          startDecision: 'Starting decision process',
          showDashboard: 'Opening dashboard',
          showSchedule: 'Showing your schedule',
          showHelp: 'Here are available commands',
          cancel: 'Cancelled',
        };

        const confirmation = confirmations[command.action] || `Executing ${command.action}`;
        await speak(confirmation);
      } else {
        await speak("I didn't understand that. Try saying 'help' for available commands.");
        onError?.('Command not recognized');
      }

      setRecording(null);
    } catch (error) {
      console.error('Error stopping recording:', error);
      onError?.('Failed to process recording');
      setRecording(null);
    }
  }, [recording, setListening, addVoiceCommand, onCommand, speak, onError]);

  // Toggle listening state
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Wave animation interpolation
  const waveScale = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });

  const waveOpacity = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0],
  });

  if (!voiceEnabled) {
    return (
      <TouchableOpacity
        style={styles.enableButton}
        onPress={() => setVoiceEnabled(true)}
      >
        <Ionicons name="mic-off-outline" size={20} color="#888888" />
        <Text style={styles.enableText}>Enable Voice Commands</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Main voice button */}
      <View style={styles.buttonContainer}>
        {/* Wave animation */}
        {isListening && (
          <>
            <Animated.View
              style={[
                styles.wave,
                {
                  transform: [{ scale: waveScale }],
                  opacity: waveOpacity,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.wave,
                {
                  transform: [{ scale: Animated.add(waveScale, 0.5) }],
                  opacity: Animated.multiply(waveOpacity, 0.5),
                },
              ]}
            />
          </>
        )}

        {/* Main button */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[
              styles.voiceButton,
              isListening && styles.voiceButtonActive,
            ]}
            onPress={toggleListening}
            disabled={!permissionGranted}
          >
            <Ionicons
              name={isListening ? 'mic' : 'mic-outline'}
              size={32}
              color={isListening ? '#000000' : ORACLE_COLORS.observe}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Status text */}
      <Text style={styles.statusText}>
        {isListening
          ? 'Listening...'
          : transcript
          ? `"${transcript}"`
          : 'Tap to speak'}
      </Text>

      {/* Last command feedback */}
      {lastCommand && (
        <View style={styles.commandFeedback}>
          <Ionicons name="checkmark-circle" size={16} color={ORACLE_COLORS.act} />
          <Text style={styles.commandText}>
            {lastCommand.action} ({Math.round(lastCommand.confidence * 100)}% confident)
          </Text>
        </View>
      )}

      {/* Help button */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => setShowHelp(true)}
      >
        <Ionicons name="help-circle-outline" size={20} color="#888888" />
        <Text style={styles.helpButtonText}>Voice Commands</Text>
      </TouchableOpacity>

      {/* Help modal */}
      <Modal
        visible={showHelp}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHelp(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Available Voice Commands</Text>
              <TouchableOpacity onPress={() => setShowHelp(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={COMMAND_PATTERNS.filter((p) => p.action !== 'cancel')}
              keyExtractor={(item) => item.action}
              renderItem={({ item }) => (
                <View style={styles.commandItem}>
                  <Text style={styles.commandExample}>"{item.example}"</Text>
                  <Text style={styles.commandDescription}>{item.description}</Text>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

/**
 * VoiceButton - Minimal floating voice button
 */
interface VoiceButtonProps {
  onCommand: (command: VoiceCommand) => void;
  size?: 'small' | 'medium' | 'large';
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onCommand,
  size = 'medium',
}) => {
  const [isListening, setIsListening] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const { voiceEnabled } = useUXStore();

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  const sizes = {
    small: { button: 40, icon: 20 },
    medium: { button: 56, icon: 28 },
    large: { button: 72, icon: 36 },
  };

  const currentSize = sizes[size];

  if (!voiceEnabled) return null;

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={[
          styles.floatingButton,
          {
            width: currentSize.button,
            height: currentSize.button,
            borderRadius: currentSize.button / 2,
          },
          isListening && styles.floatingButtonActive,
        ]}
        onPress={() => setIsListening(!isListening)}
      >
        <Ionicons
          name={isListening ? 'mic' : 'mic-outline'}
          size={currentSize.icon}
          color={isListening ? '#000000' : '#FFFFFF'}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Hook for voice command functionality
 */
export const useVoiceCommands = () => {
  const { voiceEnabled, voiceConfig, setVoiceEnabled, updateVoiceConfig, voiceCommandHistory } = useUXStore();

  const speak = useCallback(async (text: string, options?: Speech.SpeechOptions) => {
    if (!voiceEnabled) return;

    try {
      await Speech.speak(text, {
        language: voiceConfig.language || 'en-US',
        pitch: 1.0,
        rate: 0.9,
        ...options,
      });
    } catch (error) {
      console.error('TTS error:', error);
    }
  }, [voiceEnabled, voiceConfig.language]);

  const stopSpeaking = useCallback(async () => {
    try {
      await Speech.stop();
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  }, []);

  const isSpeaking = useCallback(async (): Promise<boolean> => {
    try {
      return await Speech.isSpeakingAsync();
    } catch {
      return false;
    }
  }, []);

  return {
    voiceEnabled,
    voiceConfig,
    setVoiceEnabled,
    updateVoiceConfig,
    voiceCommandHistory,
    speak,
    stopSpeaking,
    isSpeaking,
    parseCommand: parseVoiceCommand,
    availableCommands: COMMAND_PATTERNS,
  };
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  buttonContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  wave: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ORACLE_COLORS.observe,
  },
  voiceButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: ORACLE_COLORS.observe,
  },
  voiceButtonActive: {
    backgroundColor: ORACLE_COLORS.observe,
    borderColor: ORACLE_COLORS.observe,
  },
  statusText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 12,
  },
  commandFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 12,
  },
  commandText: {
    fontSize: 12,
    color: ORACLE_COLORS.act,
    marginLeft: 6,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpButtonText: {
    fontSize: 12,
    color: '#888888',
    marginLeft: 4,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  enableText: {
    fontSize: 14,
    color: '#888888',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  commandItem: {
    paddingVertical: 12,
  },
  commandExample: {
    fontSize: 16,
    color: ORACLE_COLORS.observe,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  commandDescription: {
    fontSize: 14,
    color: '#888888',
  },
  separator: {
    height: 1,
    backgroundColor: '#333333',
  },
  floatingButton: {
    backgroundColor: ORACLE_COLORS.observe,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ORACLE_COLORS.observe,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingButtonActive: {
    backgroundColor: ORACLE_COLORS.act,
    shadowColor: ORACLE_COLORS.act,
  },
});

export default VoiceControl;
