/**
 * ORACLE Voice Input Service
 * Story adv-21 - Voice command support for ORACLE
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';
import * as Speech from 'expo-speech';

// Voice command types
export type VoiceCommand = 'scan' | 'decide' | 'plan' | 'status' | 'help' | 'create' | 'stop' | 'unknown';

// Command patterns for recognition
const COMMAND_PATTERNS: Array<{ pattern: RegExp; command: VoiceCommand }> = [
  { pattern: /\b(scan|radar|observe)\b/i, command: 'scan' },
  { pattern: /\b(decide|decision|choose|options)\b/i, command: 'decide' },
  { pattern: /\b(plan|execute|action|act)\b/i, command: 'plan' },
  { pattern: /\b(status|dashboard|overview|current)\b/i, command: 'status' },
  { pattern: /\b(help|commands|what can you do)\b/i, command: 'help' },
  { pattern: /\b(create|add|new)\b/i, command: 'create' },
  { pattern: /\b(stop|cancel|nevermind|quit)\b/i, command: 'stop' },
];

// Voice service configuration
export interface VoiceConfig {
  language: string;
  autoSpeakResults: boolean;
  speakRate: number;
  speakPitch: number;
  commandTimeout: number;
  minConfidence: number;
}

const DEFAULT_CONFIG: VoiceConfig = {
  language: 'en-US',
  autoSpeakResults: true,
  speakRate: 1.0,
  speakPitch: 1.0,
  commandTimeout: 5000,
  minConfidence: 0.6,
};

// Command result type
export interface CommandResult {
  command: VoiceCommand;
  confidence: number;
  transcript: string;
  parameters?: Record<string, string>;
}

// Voice event handlers
export interface VoiceEventHandlers {
  onStart?: () => void;
  onStop?: () => void;
  onResult?: (result: CommandResult) => void;
  onPartialResult?: (partial: string) => void;
  onError?: (error: Error) => void;
  onVolumeChange?: (volume: number) => void;
}

// Speech recognition result type (simulated since expo doesn't have native speech recognition)
interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

class OracleVoiceService {
  private config: VoiceConfig = DEFAULT_CONFIG;
  private isListening = false;
  private handlers: VoiceEventHandlers = {};
  private recognitionTimeout: NodeJS.Timeout | null = null;
  private hasPermission = false;

  // Simulated recognition state (real implementation would use native module)
  private recognitionSimulator: NodeJS.Timeout | null = null;

  /**
   * Initialize voice service
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if speech synthesis is available
      const voices = await Speech.getAvailableVoicesAsync();
      console.log(`[OracleVoice] Available voices: ${voices.length}`);

      // In a real implementation, we would initialize expo-speech-recognition here
      // For now, we'll use a simulated approach

      this.hasPermission = true;
      return true;
    } catch (error) {
      console.error('[OracleVoice] Initialization error:', error);
      return false;
    }
  }

  /**
   * Request microphone permission
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'ORACLE Voice Permission',
            message: 'ORACLE needs access to your microphone for voice commands',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        this.hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        // iOS permission is handled by the native module
        this.hasPermission = true;
      }

      return this.hasPermission;
    } catch (error) {
      console.error('[OracleVoice] Permission error:', error);
      return false;
    }
  }

  /**
   * Check permission status
   */
  getPermissionStatus(): boolean {
    return this.hasPermission;
  }

  /**
   * Start listening for voice commands
   */
  async startListening(handlers: VoiceEventHandlers): Promise<void> {
    if (this.isListening) {
      console.log('[OracleVoice] Already listening');
      return;
    }

    if (!this.hasPermission) {
      const granted = await this.requestPermission();
      if (!granted) {
        handlers.onError?.(new Error('Microphone permission not granted'));
        return;
      }
    }

    this.handlers = handlers;
    this.isListening = true;
    handlers.onStart?.();

    // Set up timeout
    this.recognitionTimeout = setTimeout(() => {
      this.stopListening();
      handlers.onError?.(new Error('Voice recognition timed out'));
    }, this.config.commandTimeout);

    // In a real implementation, this would start the native speech recognizer
    // For demo purposes, we'll simulate voice recognition
    this.simulateRecognition();
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (!this.isListening) return;

    this.isListening = false;

    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout);
      this.recognitionTimeout = null;
    }

    if (this.recognitionSimulator) {
      clearTimeout(this.recognitionSimulator);
      this.recognitionSimulator = null;
    }

    this.handlers.onStop?.();
  }

  /**
   * Check if currently listening
   */
  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  /**
   * Parse command from transcript
   */
  parseCommand(transcript: string): CommandResult {
    const lowerTranscript = transcript.toLowerCase().trim();

    for (const { pattern, command } of COMMAND_PATTERNS) {
      if (pattern.test(lowerTranscript)) {
        // Extract any parameters after the command
        const parameters = this.extractParameters(lowerTranscript, command);

        return {
          command,
          confidence: 0.85, // Simulated confidence
          transcript: lowerTranscript,
          parameters,
        };
      }
    }

    return {
      command: 'unknown',
      confidence: 0.5,
      transcript: lowerTranscript,
    };
  }

  /**
   * Extract parameters from command
   */
  private extractParameters(
    transcript: string,
    command: VoiceCommand
  ): Record<string, string> | undefined {
    const params: Record<string, string> = {};

    switch (command) {
      case 'create':
        // Extract signal type: "create deadline signal" or "create opportunity"
        const typeMatch = transcript.match(
          /create\s+(deadline|opportunity|risk|conflict|anomaly|signal)/i
        );
        if (typeMatch) {
          params.type = typeMatch[1].toLowerCase();
        }

        // Extract title: "create signal called ..." or "create ... titled ..."
        const titleMatch = transcript.match(
          /(?:called|titled|named)\s+["']?([^"']+)["']?/i
        );
        if (titleMatch) {
          params.title = titleMatch[1].trim();
        }
        break;

      case 'decide':
        // Extract decision context
        const decisionMatch = transcript.match(/decide\s+(?:about|on)?\s*(.+)/i);
        if (decisionMatch) {
          params.context = decisionMatch[1].trim();
        }
        break;

      case 'status':
        // Extract specific phase
        const phaseMatch = transcript.match(
          /status\s+(?:of\s+)?(?:the\s+)?(observe|orient|decide|act)/i
        );
        if (phaseMatch) {
          params.phase = phaseMatch[1].toLowerCase();
        }
        break;
    }

    return Object.keys(params).length > 0 ? params : undefined;
  }

  /**
   * Speak text using text-to-speech
   */
  async speak(
    text: string,
    options?: {
      language?: string;
      rate?: number;
      pitch?: number;
      onDone?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    try {
      await Speech.speak(text, {
        language: options?.language || this.config.language,
        rate: options?.rate || this.config.speakRate,
        pitch: options?.pitch || this.config.speakPitch,
        onDone: options?.onDone,
        onError: options?.onError,
      });
    } catch (error) {
      console.error('[OracleVoice] Speech error:', error);
      options?.onError?.(error as Error);
    }
  }

  /**
   * Stop speaking
   */
  async stopSpeaking(): Promise<void> {
    await Speech.stop();
  }

  /**
   * Check if currently speaking
   */
  async isSpeaking(): Promise<boolean> {
    return Speech.isSpeakingAsync();
  }

  /**
   * Get command help text
   */
  getCommandHelp(): string {
    return `Available voice commands:
    - "Scan" or "Radar": Start a radar scan for signals
    - "Decide" or "Options": View current decisions
    - "Plan" or "Execute": View execution plans
    - "Status" or "Dashboard": Get current ORACLE status
    - "Create signal": Create a new signal
    - "Help": List available commands
    - "Stop" or "Cancel": Cancel current operation`;
  }

  /**
   * Speak command response
   */
  async speakCommandResponse(result: CommandResult): Promise<void> {
    if (!this.config.autoSpeakResults) return;

    let response: string;

    switch (result.command) {
      case 'scan':
        response = 'Starting radar scan. Analyzing environment for signals.';
        break;
      case 'decide':
        response = result.parameters?.context
          ? `Opening decision analysis for ${result.parameters.context}.`
          : 'Opening decision engine. Showing pending decisions.';
        break;
      case 'plan':
        response = 'Opening execution copilot. Showing active plans.';
        break;
      case 'status':
        response = result.parameters?.phase
          ? `Getting status of ${result.parameters.phase} phase.`
          : 'Getting ORACLE status. Opening dashboard.';
        break;
      case 'help':
        response = 'I can help you scan for signals, analyze decisions, view plans, or check status. What would you like to do?';
        break;
      case 'create':
        const type = result.parameters?.type || 'signal';
        response = `Creating new ${type}. Please provide details.`;
        break;
      case 'stop':
        response = 'Cancelled.';
        break;
      case 'unknown':
        response = "I didn't understand that command. Say 'help' for available commands.";
        break;
    }

    await this.speak(response);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  /**
   * Simulate speech recognition (for demo/testing)
   * In production, this would be replaced with actual speech recognition
   */
  private simulateRecognition(): void {
    // Simulate partial results
    const partials = ['scan...', 'scanning...', 'scan for signals'];
    let index = 0;

    const sendPartial = () => {
      if (!this.isListening || index >= partials.length) {
        // Send final result
        this.sendSimulatedResult();
        return;
      }

      this.handlers.onPartialResult?.(partials[index]);
      index++;

      this.recognitionSimulator = setTimeout(sendPartial, 500);
    };

    // Simulate volume changes
    const simulateVolume = () => {
      if (!this.isListening) return;
      const volume = Math.random() * 0.5 + 0.3; // 0.3 to 0.8
      this.handlers.onVolumeChange?.(volume);
    };

    const volumeInterval = setInterval(() => {
      if (!this.isListening) {
        clearInterval(volumeInterval);
        return;
      }
      simulateVolume();
    }, 100);

    // Start sending partials
    this.recognitionSimulator = setTimeout(sendPartial, 300);
  }

  /**
   * Send simulated final result
   */
  private sendSimulatedResult(): void {
    if (!this.isListening) return;

    // Simulate a recognized command
    const simulatedCommands = [
      'scan for signals',
      'show status',
      'open decisions',
      'help me',
    ];
    const transcript = simulatedCommands[Math.floor(Math.random() * simulatedCommands.length)];

    const result = this.parseCommand(transcript);
    this.handlers.onResult?.(result);

    this.stopListening();
  }
}

// Export singleton instance
export const oracleVoiceService = new OracleVoiceService();

// Export hook for voice commands
export function useVoiceCommand() {
  return {
    startListening: oracleVoiceService.startListening.bind(oracleVoiceService),
    stopListening: oracleVoiceService.stopListening.bind(oracleVoiceService),
    isListening: oracleVoiceService.isCurrentlyListening.bind(oracleVoiceService),
    speak: oracleVoiceService.speak.bind(oracleVoiceService),
    stopSpeaking: oracleVoiceService.stopSpeaking.bind(oracleVoiceService),
    parseCommand: oracleVoiceService.parseCommand.bind(oracleVoiceService),
    getCommandHelp: oracleVoiceService.getCommandHelp.bind(oracleVoiceService),
    requestPermission: oracleVoiceService.requestPermission.bind(oracleVoiceService),
    hasPermission: oracleVoiceService.getPermissionStatus.bind(oracleVoiceService),
    updateConfig: oracleVoiceService.updateConfig.bind(oracleVoiceService),
    speakResponse: oracleVoiceService.speakCommandResponse.bind(oracleVoiceService),
  };
}
