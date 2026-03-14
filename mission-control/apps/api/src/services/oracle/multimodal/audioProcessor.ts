/**
 * ORACLE Audio Processor
 * Handles audio/voice processing, transcription, and analysis
 *
 * Features:
 * - Speech-to-text transcription interface
 * - Meeting recording analysis
 * - Voice memo processing
 * - Sentiment from tone
 * - Speaker diarization interface
 * - Key moments extraction
 *
 * @module services/oracle/multimodal/audioProcessor
 */

import { oracleCacheService, hashObject } from '../cache';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Audio input for processing
 */
export interface AudioInput {
  data?: Buffer | ArrayBuffer | Uint8Array;
  base64?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
}

/**
 * Transcription result
 */
export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  duration: number; // seconds
  segments: TranscriptSegment[];
  speakers?: Speaker[];
}

/**
 * Transcript segment with timing
 */
export interface TranscriptSegment {
  id: string;
  text: string;
  startTime: number; // seconds
  endTime: number;
  confidence: number;
  speakerId?: string;
  words?: TranscriptWord[];
}

/**
 * Word-level timing
 */
export interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

/**
 * Speaker information
 */
export interface Speaker {
  id: string;
  name?: string;
  totalSpeakingTime: number;
  segments: number[];
  sentiment?: ToneSentiment;
}

/**
 * Sentiment derived from tone/voice
 */
export interface ToneSentiment {
  overall: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;
  emotions: EmotionScore[];
  energyLevel: 'high' | 'medium' | 'low';
}

/**
 * Emotion score
 */
export interface EmotionScore {
  emotion: 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised' | 'neutral' | 'frustrated' | 'excited' | 'confident';
  score: number; // 0-1
}

/**
 * Key moment in audio
 */
export interface KeyMoment {
  id: string;
  type: 'action_item' | 'decision' | 'question' | 'highlight' | 'concern' | 'agreement' | 'disagreement';
  text: string;
  startTime: number;
  endTime: number;
  speakerId?: string;
  confidence: number;
  context?: string;
}

/**
 * Meeting analysis result
 */
export interface MeetingAnalysis {
  title?: string;
  date?: Date;
  duration: number;
  participants: MeetingParticipant[];
  agenda?: string[];
  summary: string;
  decisions: string[];
  actionItems: MeetingActionItem[];
  keyTopics: string[];
  nextSteps: string[];
  sentiment: ToneSentiment;
}

/**
 * Meeting participant
 */
export interface MeetingParticipant {
  speakerId: string;
  name?: string;
  role?: string;
  speakingTime: number;
  speakingPercentage: number;
  topicContributions: string[];
}

/**
 * Action item from meeting
 */
export interface MeetingActionItem {
  id: string;
  description: string;
  owner?: string;
  deadline?: string;
  priority: 'high' | 'medium' | 'low';
  context: string;
  timestamp: number;
}

/**
 * Voice memo analysis
 */
export interface VoiceMemoAnalysis {
  transcription: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  sentiment: ToneSentiment;
  duration: number;
  timestamp: string;
}

/**
 * Audio processing result
 */
export interface AudioProcessingResult {
  processingId: string;
  filename?: string;
  url?: string;
  duration: number;
  format?: string;
  sampleRate?: number;
  channels?: number;
  transcript?: string;
  transcription?: TranscriptionResult;
  meeting?: MeetingAnalysis;
  voiceMemo?: VoiceMemoAnalysis;
  keyMoments: KeyMoment[];
  sentiment?: ToneSentiment;
  summary?: string;
  metadata: Record<string, any>;
}

/**
 * Processing options
 */
export interface AudioProcessingOptions {
  transcribe?: boolean;
  detectSpeakers?: boolean;
  analyzeSentiment?: boolean;
  analyzeMeeting?: boolean;
  extractKeyMoments?: boolean;
  language?: string;
  maxDuration?: number; // seconds
  onProgress?: (progress: number) => void;
}

// ============================================================================
// Audio Processor Class
// ============================================================================

/**
 * AudioProcessor - Handles audio transcription and analysis
 *
 * Provides interfaces for speech-to-text, speaker diarization,
 * meeting analysis, and sentiment detection from audio.
 */
export class AudioProcessor {
  private cacheEnabled: boolean = true;
  private cacheTTL: number = 60 * 60 * 1000; // 1 hour

  constructor(options: { cacheEnabled?: boolean; cacheTTL?: number } = {}) {
    this.cacheEnabled = options.cacheEnabled ?? true;
    this.cacheTTL = options.cacheTTL ?? 60 * 60 * 1000;
  }

  // ==========================================================================
  // Main Processing
  // ==========================================================================

  /**
   * Process audio through the analysis pipeline
   */
  async process(
    input: AudioInput,
    options: AudioProcessingOptions = {}
  ): Promise<AudioProcessingResult> {
    const processingId = this.generateProcessingId();

    // Default options
    const opts: AudioProcessingOptions = {
      transcribe: true,
      detectSpeakers: true,
      analyzeSentiment: true,
      analyzeMeeting: false,
      extractKeyMoments: true,
      language: 'en',
      maxDuration: 3600, // 1 hour
      ...options,
    };

    // Check cache
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(input);
      const cached = oracleCacheService.get<AudioProcessingResult>(cacheKey);
      if (cached) {
        opts.onProgress?.(100);
        return { ...cached, processingId };
      }
    }

    // Get audio metadata
    const metadata = await this.getAudioMetadata(input);
    opts.onProgress?.(10);

    // Initialize result
    const result: AudioProcessingResult = {
      processingId,
      filename: input.filename,
      url: input.url,
      duration: metadata.duration,
      format: metadata.format,
      sampleRate: metadata.sampleRate,
      channels: metadata.channels,
      keyMoments: [],
      metadata: {},
    };

    // Perform transcription
    if (opts.transcribe) {
      opts.onProgress?.(20);
      result.transcription = await this.transcribe(input, opts);
      result.transcript = result.transcription.text;
      opts.onProgress?.(50);
    }

    // Perform speaker diarization
    if (opts.detectSpeakers && result.transcription) {
      opts.onProgress?.(55);
      result.transcription.speakers = await this.diarizeSpeakers(result.transcription);
      opts.onProgress?.(65);
    }

    // Analyze sentiment from tone
    if (opts.analyzeSentiment) {
      opts.onProgress?.(70);
      result.sentiment = await this.analyzeToneSentiment(input, result.transcription);
    }

    // Extract key moments
    if (opts.extractKeyMoments && result.transcription) {
      opts.onProgress?.(75);
      result.keyMoments = this.extractKeyMoments(result.transcription);
    }

    // Analyze as meeting if requested
    if (opts.analyzeMeeting && result.transcription) {
      opts.onProgress?.(80);
      result.meeting = this.analyzeMeeting(result.transcription, result.keyMoments);
    }

    // Generate summary
    if (result.transcript) {
      opts.onProgress?.(90);
      result.summary = this.generateSummary(result.transcript, result.keyMoments);
    }

    // Detect if this is a voice memo
    if (result.transcription && result.duration < 300 && !result.meeting) {
      result.voiceMemo = this.analyzeVoiceMemo(result);
    }

    // Compile metadata
    result.metadata = {
      duration: result.duration,
      format: result.format,
      language: result.transcription?.language,
      speakerCount: result.transcription?.speakers?.length || 0,
      keyMomentCount: result.keyMoments.length,
      wordCount: result.transcript?.split(/\s+/).length || 0,
    };

    // Cache result
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(input);
      oracleCacheService.set(cacheKey, result, this.cacheTTL);
    }

    opts.onProgress?.(100);
    return result;
  }

  // ==========================================================================
  // Transcription
  // ==========================================================================

  /**
   * Transcribe audio to text
   *
   * Note: In production, this would use a service like:
   * - OpenAI Whisper API
   * - Google Speech-to-Text
   * - AWS Transcribe
   * - AssemblyAI
   */
  async transcribe(input: AudioInput, options: AudioProcessingOptions): Promise<TranscriptionResult> {
    // In production:
    // const response = await openai.audio.transcriptions.create({
    //   file: audioBuffer,
    //   model: 'whisper-1',
    //   response_format: 'verbose_json',
    //   timestamp_granularities: ['word', 'segment'],
    // });

    // Placeholder structure - would be populated by actual transcription service
    return {
      text: '',
      confidence: 0,
      language: options.language || 'en',
      duration: 0,
      segments: [],
    };
  }

  /**
   * Perform speaker diarization
   *
   * Note: In production, use services like:
   * - pyannote.audio
   * - AWS Transcribe with speaker identification
   * - AssemblyAI speaker labels
   */
  async diarizeSpeakers(transcription: TranscriptionResult): Promise<Speaker[]> {
    // Analyze segments for speaker patterns
    // This is a placeholder - actual implementation would use ML models

    const speakers: Speaker[] = [];

    // Group segments by potential speaker based on patterns
    // In production, this would use actual speaker embeddings

    return speakers;
  }

  // ==========================================================================
  // Sentiment Analysis
  // ==========================================================================

  /**
   * Analyze sentiment from audio tone
   *
   * Combines:
   * - Acoustic features (pitch, energy, rate)
   * - Text sentiment from transcript
   */
  async analyzeToneSentiment(input: AudioInput, transcription?: TranscriptionResult): Promise<ToneSentiment> {
    // Analyze acoustic features
    // In production, would extract and analyze:
    // - Pitch variations
    // - Speaking rate
    // - Energy/volume patterns
    // - Pause patterns

    // For now, analyze based on transcript text
    let emotions: EmotionScore[] = [];
    let overall: ToneSentiment['overall'] = 'neutral';
    let energyLevel: ToneSentiment['energyLevel'] = 'medium';

    if (transcription?.text) {
      const textSentiment = this.analyzeTextSentiment(transcription.text);
      overall = textSentiment.overall;
      emotions = textSentiment.emotions;
    }

    return {
      overall,
      confidence: 0.7,
      emotions,
      energyLevel,
    };
  }

  /**
   * Analyze sentiment from transcript text
   */
  private analyzeTextSentiment(text: string): { overall: ToneSentiment['overall']; emotions: EmotionScore[] } {
    const positiveWords = ['great', 'good', 'excellent', 'happy', 'love', 'excited', 'agree', 'yes', 'definitely', 'absolutely', 'perfect', 'wonderful', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'angry', 'hate', 'frustrated', 'disagree', 'no', 'problem', 'issue', 'concerned', 'worried', 'unfortunately'];
    const excitedWords = ['excited', 'amazing', 'fantastic', 'incredible', 'wow', 'awesome'];
    const concernedWords = ['concerned', 'worried', 'unsure', 'risk', 'problem', 'issue', 'challenge'];

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    let excitedCount = 0;
    let concernedCount = 0;

    for (const word of words) {
      if (positiveWords.some(p => word.includes(p))) positiveCount++;
      if (negativeWords.some(n => word.includes(n))) negativeCount++;
      if (excitedWords.some(e => word.includes(e))) excitedCount++;
      if (concernedWords.some(c => word.includes(c))) concernedCount++;
    }

    const total = positiveCount + negativeCount;
    let overall: ToneSentiment['overall'] = 'neutral';

    if (total > 0) {
      const ratio = positiveCount / total;
      if (ratio > 0.65) overall = 'positive';
      else if (ratio < 0.35) overall = 'negative';
      else if (positiveCount > 0 && negativeCount > 0) overall = 'mixed';
    }

    const emotions: EmotionScore[] = [
      { emotion: 'neutral', score: 0.5 },
    ];

    if (excitedCount > 2) {
      emotions.push({ emotion: 'excited', score: Math.min(1, excitedCount / 5) });
    }

    if (concernedCount > 2) {
      emotions.push({ emotion: 'frustrated', score: Math.min(1, concernedCount / 5) });
    }

    return { overall, emotions };
  }

  // ==========================================================================
  // Key Moments Extraction
  // ==========================================================================

  /**
   * Extract key moments from transcription
   */
  extractKeyMoments(transcription: TranscriptionResult): KeyMoment[] {
    const moments: KeyMoment[] = [];
    let momentId = 0;

    // Process each segment
    for (const segment of transcription.segments) {
      const text = segment.text.toLowerCase();

      // Detect action items
      if (this.isActionItem(text)) {
        moments.push({
          id: `moment-${momentId++}`,
          type: 'action_item',
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          speakerId: segment.speakerId,
          confidence: 0.75,
        });
      }

      // Detect decisions
      if (this.isDecision(text)) {
        moments.push({
          id: `moment-${momentId++}`,
          type: 'decision',
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          speakerId: segment.speakerId,
          confidence: 0.75,
        });
      }

      // Detect questions
      if (this.isQuestion(text)) {
        moments.push({
          id: `moment-${momentId++}`,
          type: 'question',
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          speakerId: segment.speakerId,
          confidence: 0.8,
        });
      }

      // Detect concerns
      if (this.isConcern(text)) {
        moments.push({
          id: `moment-${momentId++}`,
          type: 'concern',
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          speakerId: segment.speakerId,
          confidence: 0.7,
        });
      }

      // Detect agreement/disagreement
      if (this.isAgreement(text)) {
        moments.push({
          id: `moment-${momentId++}`,
          type: 'agreement',
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          speakerId: segment.speakerId,
          confidence: 0.7,
        });
      }

      if (this.isDisagreement(text)) {
        moments.push({
          id: `moment-${momentId++}`,
          type: 'disagreement',
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          speakerId: segment.speakerId,
          confidence: 0.7,
        });
      }
    }

    return moments;
  }

  /**
   * Check if text contains action item
   */
  private isActionItem(text: string): boolean {
    const patterns = [
      /\bi(?:'ll| will)\b/,
      /\bwe(?:'ll| will| should| need to)\b/,
      /\baction item\b/,
      /\btodo\b/,
      /\blet's\b/,
      /\bplease\b.*\b(do|send|check|review|update)\b/,
      /\bmake sure\b/,
      /\bremember to\b/,
      /\bdon't forget\b/,
    ];
    return patterns.some(p => p.test(text));
  }

  /**
   * Check if text contains decision
   */
  private isDecision(text: string): boolean {
    const patterns = [
      /\bwe(?:'ve| have) decided\b/,
      /\bdecision is\b/,
      /\bwe(?:'re| are) going (?:to|with)\b/,
      /\blet's go with\b/,
      /\bwe'll proceed\b/,
      /\bagreed to\b/,
      /\bfinal(?:ly|ized)?\b/,
    ];
    return patterns.some(p => p.test(text));
  }

  /**
   * Check if text is a question
   */
  private isQuestion(text: string): boolean {
    return text.includes('?') ||
           /\b(what|who|when|where|why|how|can|could|would|should|do|does|is|are)\b.{5,}$/i.test(text);
  }

  /**
   * Check if text expresses concern
   */
  private isConcern(text: string): boolean {
    const patterns = [
      /\bconcern(?:ed)?\b/,
      /\bworr(?:ied|y)\b/,
      /\brisk\b/,
      /\bproblem\b/,
      /\bissue\b/,
      /\bchalleng(?:e|ing)\b/,
      /\bnot sure\b/,
      /\buncertain\b/,
    ];
    return patterns.some(p => p.test(text));
  }

  /**
   * Check if text expresses agreement
   */
  private isAgreement(text: string): boolean {
    const patterns = [
      /\bi agree\b/,
      /\byes,? (?:exactly|definitely|absolutely)\b/,
      /\bthat(?:'s| is) (?:right|correct|true)\b/,
      /\bgood point\b/,
      /\bexactly\b/,
      /\babsolutely\b/,
      /\bdefinitely\b/,
    ];
    return patterns.some(p => p.test(text));
  }

  /**
   * Check if text expresses disagreement
   */
  private isDisagreement(text: string): boolean {
    const patterns = [
      /\bi disagree\b/,
      /\bi don't (?:think|agree|believe)\b/,
      /\bthat(?:'s| is)n't (?:right|correct|true)\b/,
      /\bactually,? (?:no|i think)\b/,
      /\bbut (?:i think|actually)\b/,
      /\bon the contrary\b/,
    ];
    return patterns.some(p => p.test(text));
  }

  // ==========================================================================
  // Meeting Analysis
  // ==========================================================================

  /**
   * Analyze transcription as a meeting
   */
  analyzeMeeting(transcription: TranscriptionResult, keyMoments: KeyMoment[]): MeetingAnalysis {
    // Extract participants
    const participants = this.extractParticipants(transcription);

    // Extract decisions
    const decisions = keyMoments
      .filter(m => m.type === 'decision')
      .map(m => m.text);

    // Extract action items
    const actionItems = this.extractMeetingActionItems(keyMoments, transcription);

    // Extract key topics
    const keyTopics = this.extractKeyTopics(transcription.text);

    // Generate summary
    const summary = this.generateMeetingSummary(transcription, keyMoments, participants);

    // Extract next steps
    const nextSteps = actionItems.map(a => a.description).slice(0, 5);

    // Get overall sentiment
    const sentiment = this.calculateOverallSentiment(transcription);

    return {
      duration: transcription.duration,
      participants,
      summary,
      decisions,
      actionItems,
      keyTopics,
      nextSteps,
      sentiment,
    };
  }

  /**
   * Extract meeting participants
   */
  private extractParticipants(transcription: TranscriptionResult): MeetingParticipant[] {
    const participants: MeetingParticipant[] = [];

    if (transcription.speakers) {
      for (const speaker of transcription.speakers) {
        participants.push({
          speakerId: speaker.id,
          name: speaker.name,
          speakingTime: speaker.totalSpeakingTime,
          speakingPercentage: transcription.duration > 0
            ? (speaker.totalSpeakingTime / transcription.duration) * 100
            : 0,
          topicContributions: [],
        });
      }
    }

    return participants;
  }

  /**
   * Extract action items from meeting
   */
  private extractMeetingActionItems(keyMoments: KeyMoment[], transcription: TranscriptionResult): MeetingActionItem[] {
    const actionItems: MeetingActionItem[] = [];
    let itemId = 0;

    for (const moment of keyMoments.filter(m => m.type === 'action_item')) {
      // Try to extract owner and deadline
      const owner = this.extractOwnerFromText(moment.text);
      const deadline = this.extractDeadlineFromText(moment.text);

      actionItems.push({
        id: `meeting-action-${itemId++}`,
        description: moment.text,
        owner,
        deadline,
        priority: this.determinePriority(moment.text),
        context: moment.context || '',
        timestamp: moment.startTime,
      });
    }

    return actionItems;
  }

  /**
   * Extract owner from text
   */
  private extractOwnerFromText(text: string): string | undefined {
    // Look for name patterns
    const patterns = [
      /\b([A-Z][a-z]+)\s+will\b/,
      /\b([A-Z][a-z]+)\s+(?:is going to|can|should)\b/,
      /\bassign(?:ed)? to\s+([A-Z][a-z]+)\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    // Check for "I will" indicating the speaker
    if (/\bi(?:'ll| will)\b/.test(text.toLowerCase())) {
      return 'Speaker';
    }

    return undefined;
  }

  /**
   * Extract deadline from text
   */
  private extractDeadlineFromText(text: string): string | undefined {
    const patterns = [
      /by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /by\s+(tomorrow|today|end of (?:day|week|month))/i,
      /by\s+(\d{1,2}[\/\-]\d{1,2})/,
      /(?:in|within)\s+(\d+\s+(?:days?|weeks?|hours?))/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return undefined;
  }

  /**
   * Determine priority from text
   */
  private determinePriority(text: string): 'high' | 'medium' | 'low' {
    const lowered = text.toLowerCase();

    if (/\b(urgent|asap|immediately|critical|important)\b/.test(lowered)) {
      return 'high';
    }

    if (/\b(soon|this week|next week)\b/.test(lowered)) {
      return 'medium';
    }

    return 'medium';
  }

  /**
   * Extract key topics from text
   */
  private extractKeyTopics(text: string): string[] {
    // Simple topic extraction - in production would use NLP
    const topics: string[] = [];

    // Look for capitalized phrases
    const capitalizedMatches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g) || [];
    const uniqueCapitalized = [...new Set(capitalizedMatches)];

    // Filter common words
    const commonWords = ['I', 'We', 'You', 'The', 'This', 'That', 'What', 'When', 'Where', 'How', 'Why'];
    for (const phrase of uniqueCapitalized) {
      if (!commonWords.includes(phrase) && phrase.length > 3) {
        topics.push(phrase);
      }
    }

    return topics.slice(0, 10);
  }

  /**
   * Generate meeting summary
   */
  private generateMeetingSummary(
    transcription: TranscriptionResult,
    keyMoments: KeyMoment[],
    participants: MeetingParticipant[]
  ): string {
    const duration = Math.round(transcription.duration / 60);
    const participantCount = participants.length;
    const decisionCount = keyMoments.filter(m => m.type === 'decision').length;
    const actionCount = keyMoments.filter(m => m.type === 'action_item').length;

    let summary = `Meeting lasted ${duration} minutes`;

    if (participantCount > 0) {
      summary += ` with ${participantCount} participant${participantCount > 1 ? 's' : ''}`;
    }

    summary += '.';

    if (decisionCount > 0) {
      summary += ` ${decisionCount} decision${decisionCount > 1 ? 's were' : ' was'} made.`;
    }

    if (actionCount > 0) {
      summary += ` ${actionCount} action item${actionCount > 1 ? 's were' : ' was'} identified.`;
    }

    return summary;
  }

  /**
   * Calculate overall sentiment from transcription
   */
  private calculateOverallSentiment(transcription: TranscriptionResult): ToneSentiment {
    const textSentiment = this.analyzeTextSentiment(transcription.text);

    return {
      overall: textSentiment.overall,
      confidence: 0.7,
      emotions: textSentiment.emotions,
      energyLevel: 'medium',
    };
  }

  // ==========================================================================
  // Voice Memo Analysis
  // ==========================================================================

  /**
   * Analyze as voice memo
   */
  private analyzeVoiceMemo(result: AudioProcessingResult): VoiceMemoAnalysis {
    const transcript = result.transcript || '';

    // Generate summary
    const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [];
    const summary = sentences.slice(0, 2).join(' ').trim() ||
                    transcript.substring(0, 200);

    // Extract key points
    const keyPoints = sentences
      .filter(s => s.length > 20 && s.length < 200)
      .slice(0, 5)
      .map(s => s.trim());

    // Extract action items
    const actionItems = result.keyMoments
      .filter(m => m.type === 'action_item')
      .map(m => m.text);

    return {
      transcription: transcript,
      summary,
      keyPoints,
      actionItems,
      sentiment: result.sentiment || {
        overall: 'neutral',
        confidence: 0.5,
        emotions: [],
        energyLevel: 'medium',
      },
      duration: result.duration,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Summary Generation
  // ==========================================================================

  /**
   * Generate summary from transcript
   */
  private generateSummary(transcript: string, keyMoments: KeyMoment[]): string {
    // Simple extractive summary
    const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [];

    if (sentences.length <= 3) {
      return transcript;
    }

    // Get first sentence
    const summary = [sentences[0]!.trim()];

    // Add sentences containing key moments
    for (const moment of keyMoments.slice(0, 3)) {
      const relatedSentence = sentences.find(s =>
        s.toLowerCase().includes(moment.text.substring(0, 30).toLowerCase())
      );
      if (relatedSentence && !summary.includes(relatedSentence.trim())) {
        summary.push(relatedSentence.trim());
      }
    }

    // Add last sentence
    const lastSentence = sentences[sentences.length - 1].trim();
    if (!summary.includes(lastSentence)) {
      summary.push(lastSentence);
    }

    return summary.slice(0, 4).join(' ');
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get audio metadata
   */
  private async getAudioMetadata(input: AudioInput): Promise<{
    duration: number;
    format?: string;
    sampleRate?: number;
    channels?: number;
  }> {
    // In production, would parse audio file headers
    // or use a library like music-metadata

    return {
      duration: 0,
      format: input.mimeType?.split('/')[1],
    };
  }

  /**
   * Generate processing ID
   */
  private generateProcessingId(): string {
    return `audio-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(input: AudioInput): string {
    const parts: any = {};

    if (input.url) {
      parts.url = input.url;
    }
    if (input.filename) {
      parts.filename = input.filename;
    }
    if (input.base64) {
      parts.hash = this.hashString(input.base64.substring(0, 500));
    }

    return `audio:${hashObject(parts)}`;
  }

  /**
   * Simple string hash
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an AudioProcessor instance
 */
export function createAudioProcessor(options?: {
  cacheEnabled?: boolean;
  cacheTTL?: number;
}): AudioProcessor {
  return new AudioProcessor(options);
}

export default AudioProcessor;
