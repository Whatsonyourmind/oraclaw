/**
 * ORACLE Video Processor
 * Handles video analysis, frame extraction, and content understanding
 *
 * Features:
 * - Frame extraction at intervals
 * - Scene change detection
 * - Transcript generation
 * - Visual summary generation
 * - Action/event detection timestamps
 *
 * @module services/oracle/multimodal/videoProcessor
 */

import { oracleCacheService, hashObject } from '../cache';
import { AudioProcessor, TranscriptionResult, KeyMoment } from './audioProcessor';
import { ImageProcessor, SceneAnalysis } from './imageProcessor';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Video input for processing
 */
export interface VideoInput {
  data?: Buffer | ArrayBuffer | Uint8Array;
  base64?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
}

/**
 * Extracted frame
 */
export interface ExtractedFrame {
  id: string;
  timestamp: number; // seconds
  frameNumber: number;
  imageData?: Uint8Array;
  base64?: string;
  analysis?: FrameAnalysis;
}

/**
 * Frame analysis result
 */
export interface FrameAnalysis {
  description: string;
  objects: DetectedVideoObject[];
  text?: string;
  scene?: SceneAnalysis;
  isKeyFrame: boolean;
  quality: 'high' | 'medium' | 'low' | 'blurry';
}

/**
 * Detected object in video
 */
export interface DetectedVideoObject {
  label: string;
  confidence: number;
  bbox?: { x: number; y: number; width: number; height: number };
  trackId?: string; // For tracking across frames
  firstSeen?: number; // Timestamp
  lastSeen?: number;
}

/**
 * Scene in video
 */
export interface VideoScene {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  description: string;
  keyFrame?: ExtractedFrame;
  objects: DetectedVideoObject[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  activity?: string;
}

/**
 * Video event/action
 */
export interface VideoEvent {
  id: string;
  type: 'action' | 'transition' | 'highlight' | 'anomaly' | 'speech' | 'gesture';
  description: string;
  startTime: number;
  endTime: number;
  confidence: number;
  participants?: string[];
  metadata?: Record<string, any>;
}

/**
 * Video chapter/segment
 */
export interface VideoChapter {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  summary: string;
  keyPoints: string[];
  thumbnailFrame?: ExtractedFrame;
}

/**
 * Video metadata
 */
export interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
  fps: number;
  codec?: string;
  bitrate?: number;
  format?: string;
  hasAudio: boolean;
  audioCodec?: string;
  fileSize?: number;
}

/**
 * Video summary
 */
export interface VideoSummary {
  brief: string;
  detailed: string;
  keyMoments: string[];
  topics: string[];
  participants?: string[];
}

/**
 * Video processing result
 */
export interface VideoProcessingResult {
  processingId: string;
  filename?: string;
  url?: string;
  metadata: VideoMetadata;
  transcript?: string;
  transcription?: TranscriptionResult;
  frames: ExtractedFrame[];
  scenes: VideoScene[];
  events: VideoEvent[];
  chapters?: VideoChapter[];
  summary?: string;
  sceneDescriptions?: string[];
  keyMoments: KeyMoment[];
  visualSummary?: VideoSummary;
}

/**
 * Processing options
 */
export interface VideoProcessingOptions {
  extractFrames?: boolean;
  frameInterval?: number; // seconds between frames
  maxFrames?: number;
  generateTranscript?: boolean;
  detectScenes?: boolean;
  detectEvents?: boolean;
  generateChapters?: boolean;
  analyzeFrames?: boolean;
  onProgress?: (progress: number) => void;
}

// ============================================================================
// Video Processor Class
// ============================================================================

/**
 * VideoProcessor - Handles video analysis and content extraction
 *
 * Provides frame extraction, scene detection, transcription,
 * and event detection for video content.
 */
export class VideoProcessor {
  private cacheEnabled: boolean = true;
  private cacheTTL: number = 2 * 60 * 60 * 1000; // 2 hours
  private audioProcessor: AudioProcessor;
  private imageProcessor: ImageProcessor;

  constructor(options: { cacheEnabled?: boolean; cacheTTL?: number } = {}) {
    this.cacheEnabled = options.cacheEnabled ?? true;
    this.cacheTTL = options.cacheTTL ?? 2 * 60 * 60 * 1000;
    this.audioProcessor = new AudioProcessor();
    this.imageProcessor = new ImageProcessor();
  }

  // ==========================================================================
  // Main Processing
  // ==========================================================================

  /**
   * Process video through the analysis pipeline
   */
  async process(
    input: VideoInput,
    options: VideoProcessingOptions = {}
  ): Promise<VideoProcessingResult> {
    const processingId = this.generateProcessingId();

    // Default options
    const opts: VideoProcessingOptions = {
      extractFrames: true,
      frameInterval: 5, // 5 seconds
      maxFrames: 50,
      generateTranscript: true,
      detectScenes: true,
      detectEvents: true,
      generateChapters: false,
      analyzeFrames: true,
      ...options,
    };

    // Check cache
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(input);
      const cached = oracleCacheService.get<VideoProcessingResult>(cacheKey);
      if (cached) {
        opts.onProgress?.(100);
        return { ...cached, processingId };
      }
    }

    // Get video metadata
    opts.onProgress?.(5);
    const metadata = await this.getVideoMetadata(input);
    opts.onProgress?.(10);

    // Initialize result
    const result: VideoProcessingResult = {
      processingId,
      filename: input.filename,
      url: input.url,
      metadata,
      frames: [],
      scenes: [],
      events: [],
      keyMoments: [],
    };

    // Extract frames
    if (opts.extractFrames) {
      opts.onProgress?.(15);
      result.frames = await this.extractFrames(input, metadata, opts);
      opts.onProgress?.(30);
    }

    // Analyze frames
    if (opts.analyzeFrames && result.frames.length > 0) {
      opts.onProgress?.(35);
      await this.analyzeFrames(result.frames);
      opts.onProgress?.(45);
    }

    // Generate transcript from audio
    if (opts.generateTranscript && metadata.hasAudio) {
      opts.onProgress?.(50);
      const audioResult = await this.extractAndTranscribeAudio(input);
      if (audioResult) {
        result.transcription = audioResult;
        result.transcript = audioResult.text;
        result.keyMoments = this.extractKeyMomentsFromTranscript(audioResult);
      }
      opts.onProgress?.(60);
    }

    // Detect scenes
    if (opts.detectScenes) {
      opts.onProgress?.(65);
      result.scenes = this.detectScenes(result.frames, metadata);
      result.sceneDescriptions = result.scenes.map(s => s.description);
      opts.onProgress?.(75);
    }

    // Detect events
    if (opts.detectEvents) {
      opts.onProgress?.(80);
      result.events = this.detectEvents(result.frames, result.scenes, result.transcription);
    }

    // Generate chapters
    if (opts.generateChapters) {
      opts.onProgress?.(85);
      result.chapters = this.generateChapters(result.scenes, result.keyMoments);
    }

    // Generate visual summary
    opts.onProgress?.(90);
    result.visualSummary = this.generateVisualSummary(result);
    result.summary = result.visualSummary.detailed;

    // Cache result
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(input);
      oracleCacheService.set(cacheKey, result, this.cacheTTL);
    }

    opts.onProgress?.(100);
    return result;
  }

  // ==========================================================================
  // Metadata Extraction
  // ==========================================================================

  /**
   * Get video metadata
   *
   * Note: In production, use ffprobe or similar tool
   */
  async getVideoMetadata(input: VideoInput): Promise<VideoMetadata> {
    // In production:
    // const ffprobe = require('ffprobe');
    // const metadata = await ffprobe(videoPath);

    // Parse basic info from file if available
    const format = input.mimeType?.split('/')[1] || 'unknown';

    // Placeholder - would be populated by actual video analysis
    return {
      duration: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      format,
      hasAudio: true,
    };
  }

  // ==========================================================================
  // Frame Extraction
  // ==========================================================================

  /**
   * Extract frames at intervals
   *
   * Note: In production, use ffmpeg or similar tool
   */
  async extractFrames(
    input: VideoInput,
    metadata: VideoMetadata,
    options: VideoProcessingOptions
  ): Promise<ExtractedFrame[]> {
    const frames: ExtractedFrame[] = [];
    const interval = options.frameInterval || 5;
    const maxFrames = options.maxFrames || 50;

    // Calculate number of frames to extract
    const numFrames = Math.min(
      Math.ceil(metadata.duration / interval),
      maxFrames
    );

    // In production, would use ffmpeg:
    // ffmpeg -i input.mp4 -vf "fps=1/5" frame_%04d.jpg

    for (let i = 0; i < numFrames; i++) {
      const timestamp = i * interval;

      frames.push({
        id: `frame-${i}`,
        timestamp,
        frameNumber: Math.floor(timestamp * metadata.fps),
        // imageData and base64 would be populated by actual extraction
      });
    }

    return frames;
  }

  /**
   * Analyze extracted frames
   */
  async analyzeFrames(frames: ExtractedFrame[]): Promise<void> {
    for (const frame of frames) {
      if (frame.imageData || frame.base64) {
        // Use image processor to analyze frame
        const imageInput = frame.imageData
          ? { data: frame.imageData }
          : { base64: frame.base64 };

        const imageResult = await this.imageProcessor.process(imageInput, {
          extractOCR: true,
          detectObjects: true,
        });

        frame.analysis = {
          description: imageResult.description || `Frame at ${frame.timestamp}s`,
          objects: imageResult.scene?.objects?.map(o => ({
            label: o.label,
            confidence: o.confidence,
            bbox: o.bbox,
          })) || [],
          text: imageResult.ocrText,
          scene: imageResult.scene,
          isKeyFrame: false,
          quality: this.assessFrameQuality(frame),
        };
      } else {
        // Placeholder analysis for frames without data
        frame.analysis = {
          description: `Frame at ${frame.timestamp}s`,
          objects: [],
          isKeyFrame: false,
          quality: 'medium',
        };
      }
    }
  }

  /**
   * Assess frame quality
   */
  private assessFrameQuality(frame: ExtractedFrame): FrameAnalysis['quality'] {
    // Would analyze frame for blur, exposure, etc.
    return 'medium';
  }

  // ==========================================================================
  // Audio Transcription
  // ==========================================================================

  /**
   * Extract and transcribe audio from video
   */
  async extractAndTranscribeAudio(input: VideoInput): Promise<TranscriptionResult | null> {
    // In production:
    // 1. Extract audio using ffmpeg
    // 2. Transcribe using audio processor

    // ffmpeg -i input.mp4 -vn -acodec pcm_s16le output.wav

    try {
      // Would pass extracted audio to audio processor
      const audioResult = await this.audioProcessor.process(
        { url: input.url }, // Would use extracted audio
        { transcribe: true }
      );

      return audioResult.transcription || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract key moments from transcript
   */
  private extractKeyMomentsFromTranscript(transcription: TranscriptionResult): KeyMoment[] {
    const moments: KeyMoment[] = [];
    let momentId = 0;

    for (const segment of transcription.segments) {
      const text = segment.text.toLowerCase();

      // Detect important moments
      if (this.isImportantMoment(text)) {
        moments.push({
          id: `video-moment-${momentId++}`,
          type: this.classifyMomentType(text),
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          confidence: 0.7,
        });
      }
    }

    return moments;
  }

  /**
   * Check if text indicates important moment
   */
  private isImportantMoment(text: string): boolean {
    const indicators = [
      /\bimportant\b/,
      /\bkey\b/,
      /\bnote\b/,
      /\bremember\b/,
      /\baction\b/,
      /\bdecision\b/,
      /\bconclu/,
      /\bsummar/,
      /\bto\s+do\b/,
      /\bnext\s+step/,
    ];
    return indicators.some(p => p.test(text));
  }

  /**
   * Classify moment type
   */
  private classifyMomentType(text: string): KeyMoment['type'] {
    if (/\baction\b|\bto\s+do\b|\bneed\s+to\b/.test(text)) return 'action_item';
    if (/\bdecis/.test(text)) return 'decision';
    if (/\?/.test(text)) return 'question';
    if (/\bconcern\b|\bworr/.test(text)) return 'concern';
    if (/\bagree/.test(text)) return 'agreement';
    return 'highlight';
  }

  // ==========================================================================
  // Scene Detection
  // ==========================================================================

  /**
   * Detect scenes from frames
   */
  detectScenes(frames: ExtractedFrame[], metadata: VideoMetadata): VideoScene[] {
    const scenes: VideoScene[] = [];

    if (frames.length === 0) return scenes;

    let currentScene: VideoScene | null = null;
    let sceneId = 0;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const prevFrame = i > 0 ? frames[i - 1] : null;

      // Check if this is a new scene
      const isNewScene = !currentScene || this.isSceneChange(prevFrame, frame);

      if (isNewScene) {
        // Close previous scene
        if (currentScene) {
          currentScene.endTime = prevFrame?.timestamp || frame.timestamp;
          currentScene.duration = currentScene.endTime - currentScene.startTime;
          scenes.push(currentScene);
        }

        // Start new scene
        currentScene = {
          id: `scene-${sceneId++}`,
          startTime: frame.timestamp,
          endTime: frame.timestamp,
          duration: 0,
          description: frame.analysis?.description || `Scene starting at ${frame.timestamp}s`,
          keyFrame: frame,
          objects: frame.analysis?.objects || [],
        };

        // Mark as key frame
        if (frame.analysis) {
          frame.analysis.isKeyFrame = true;
        }
      } else if (currentScene) {
        // Update current scene with objects
        const frameObjects = frame.analysis?.objects || [];
        for (const obj of frameObjects) {
          if (!currentScene.objects.find(o => o.label === obj.label)) {
            currentScene.objects.push(obj);
          }
        }
      }
    }

    // Close last scene
    if (currentScene) {
      const lastFrame = frames[frames.length - 1];
      currentScene.endTime = lastFrame.timestamp;
      currentScene.duration = currentScene.endTime - currentScene.startTime;
      scenes.push(currentScene);
    }

    // Generate descriptions for scenes
    for (const scene of scenes) {
      scene.description = this.generateSceneDescription(scene);
    }

    return scenes;
  }

  /**
   * Detect if there's a scene change between frames
   */
  private isSceneChange(prevFrame: ExtractedFrame | null, currentFrame: ExtractedFrame): boolean {
    if (!prevFrame) return true;

    // Compare frame analyses
    const prevObjects = prevFrame.analysis?.objects?.map(o => o.label) || [];
    const currentObjects = currentFrame.analysis?.objects?.map(o => o.label) || [];

    // Calculate object overlap
    const commonObjects = prevObjects.filter(o => currentObjects.includes(o));
    const unionSize = new Set([...prevObjects, ...currentObjects]).size;

    if (unionSize === 0) return false;

    const overlapRatio = commonObjects.length / unionSize;

    // Scene change if less than 30% overlap
    return overlapRatio < 0.3;
  }

  /**
   * Generate scene description
   */
  private generateSceneDescription(scene: VideoScene): string {
    const objects = scene.objects.slice(0, 5).map(o => o.label).join(', ');
    const duration = Math.round(scene.duration);

    if (objects) {
      return `${duration}s scene featuring ${objects}`;
    }

    return `${duration}s scene starting at ${Math.round(scene.startTime)}s`;
  }

  // ==========================================================================
  // Event Detection
  // ==========================================================================

  /**
   * Detect events in video
   */
  detectEvents(
    frames: ExtractedFrame[],
    scenes: VideoScene[],
    transcription?: TranscriptionResult
  ): VideoEvent[] {
    const events: VideoEvent[] = [];
    let eventId = 0;

    // Detect visual events from frame analysis
    for (const scene of scenes) {
      // Scene transitions
      events.push({
        id: `event-${eventId++}`,
        type: 'transition',
        description: `Scene transition at ${Math.round(scene.startTime)}s`,
        startTime: scene.startTime,
        endTime: scene.startTime + 1,
        confidence: 0.8,
      });

      // Detect activities from objects
      const activity = this.detectActivity(scene.objects);
      if (activity) {
        events.push({
          id: `event-${eventId++}`,
          type: 'action',
          description: activity,
          startTime: scene.startTime,
          endTime: scene.endTime,
          confidence: 0.6,
        });
      }
    }

    // Detect speech events from transcription
    if (transcription) {
      for (const segment of transcription.segments) {
        if (segment.text.length > 50) {
          events.push({
            id: `event-${eventId++}`,
            type: 'speech',
            description: segment.text.substring(0, 100),
            startTime: segment.startTime,
            endTime: segment.endTime,
            confidence: segment.confidence,
          });
        }
      }
    }

    // Sort by start time
    events.sort((a, b) => a.startTime - b.startTime);

    return events;
  }

  /**
   * Detect activity from objects
   */
  private detectActivity(objects: DetectedVideoObject[]): string | null {
    const labels = objects.map(o => o.label.toLowerCase());

    // Simple activity detection rules
    if (labels.includes('person') && labels.includes('keyboard')) {
      return 'Person typing on keyboard';
    }
    if (labels.includes('person') && labels.includes('phone')) {
      return 'Person using phone';
    }
    if (labels.includes('person') && labels.includes('car')) {
      return 'Person near vehicle';
    }
    if (labels.includes('person') && (labels.includes('presentation') || labels.includes('screen'))) {
      return 'Person giving presentation';
    }

    return null;
  }

  // ==========================================================================
  // Chapter Generation
  // ==========================================================================

  /**
   * Generate video chapters
   */
  generateChapters(scenes: VideoScene[], keyMoments: KeyMoment[]): VideoChapter[] {
    const chapters: VideoChapter[] = [];
    let chapterId = 0;

    // Group scenes into chapters (roughly 5-10 minutes each)
    const chapterDuration = 5 * 60; // 5 minutes
    let currentChapter: VideoChapter | null = null;
    let chapterScenes: VideoScene[] = [];

    for (const scene of scenes) {
      if (!currentChapter || scene.startTime - currentChapter.startTime >= chapterDuration) {
        // Finish previous chapter
        if (currentChapter) {
          this.finalizeChapter(currentChapter, chapterScenes, keyMoments);
          chapters.push(currentChapter);
        }

        // Start new chapter
        currentChapter = {
          id: `chapter-${chapterId++}`,
          title: `Chapter ${chapterId}`,
          startTime: scene.startTime,
          endTime: scene.endTime,
          summary: '',
          keyPoints: [],
          thumbnailFrame: scene.keyFrame,
        };
        chapterScenes = [scene];
      } else {
        chapterScenes.push(scene);
        currentChapter.endTime = scene.endTime;
      }
    }

    // Finish last chapter
    if (currentChapter) {
      this.finalizeChapter(currentChapter, chapterScenes, keyMoments);
      chapters.push(currentChapter);
    }

    return chapters;
  }

  /**
   * Finalize chapter with summary and key points
   */
  private finalizeChapter(
    chapter: VideoChapter,
    scenes: VideoScene[],
    keyMoments: KeyMoment[]
  ): void {
    // Generate title from scene descriptions
    const mainObjects = new Set<string>();
    for (const scene of scenes) {
      for (const obj of scene.objects.slice(0, 3)) {
        mainObjects.add(obj.label);
      }
    }
    if (mainObjects.size > 0) {
      chapter.title = `${Array.from(mainObjects).slice(0, 3).join(', ')}`;
    }

    // Generate summary
    chapter.summary = scenes.map(s => s.description).slice(0, 3).join('. ');

    // Extract key points from moments in this chapter
    const chapterMoments = keyMoments.filter(m =>
      m.startTime >= chapter.startTime && m.endTime <= chapter.endTime
    );
    chapter.keyPoints = chapterMoments.map(m => m.text).slice(0, 5);
  }

  // ==========================================================================
  // Summary Generation
  // ==========================================================================

  /**
   * Generate visual summary
   */
  generateVisualSummary(result: VideoProcessingResult): VideoSummary {
    const duration = Math.round(result.metadata.duration / 60);
    const sceneCount = result.scenes.length;
    const eventCount = result.events.length;

    // Brief summary
    let brief = `Video ${duration > 0 ? `(${duration} minutes)` : ''} `;
    if (sceneCount > 0) {
      brief += `with ${sceneCount} distinct scenes`;
    }

    // Detailed summary
    let detailed = brief + '.';

    // Add scene descriptions
    if (result.scenes.length > 0) {
      const sceneDescs = result.scenes.slice(0, 3).map(s => s.description);
      detailed += ' Scenes include: ' + sceneDescs.join('; ') + '.';
    }

    // Add key moments
    if (result.keyMoments.length > 0) {
      detailed += ` ${result.keyMoments.length} key moments identified.`;
    }

    // Extract key moments as strings
    const keyMoments = result.keyMoments.map(m =>
      `[${Math.round(m.startTime)}s] ${m.text}`
    );

    // Extract topics from scenes and events
    const topics: string[] = [];
    for (const scene of result.scenes) {
      for (const obj of scene.objects.slice(0, 2)) {
        if (!topics.includes(obj.label)) {
          topics.push(obj.label);
        }
      }
    }

    return {
      brief,
      detailed,
      keyMoments,
      topics: topics.slice(0, 10),
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Generate processing ID
   */
  private generateProcessingId(): string {
    return `video-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(input: VideoInput): string {
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

    return `video:${hashObject(parts)}`;
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
 * Create a VideoProcessor instance
 */
export function createVideoProcessor(options?: {
  cacheEnabled?: boolean;
  cacheTTL?: number;
}): VideoProcessor {
  return new VideoProcessor(options);
}

export default VideoProcessor;
