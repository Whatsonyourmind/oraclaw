/**
 * ORACLE Multimodal Information Ingestion System
 * Main orchestrator for unified multimodal content processing
 *
 * Features:
 * - Unified ingestion pipeline for all content types
 * - Automatic content type detection
 * - Routing to specialized processors
 * - Signal generation from extracted content
 * - Async processing with progress tracking
 *
 * @module services/oracle/multimodal
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';
import { ImageProcessor, ImageProcessingResult } from './imageProcessor';
import { DocumentProcessor, DocumentProcessingResult } from './documentProcessor';
import { AudioProcessor, AudioProcessingResult } from './audioProcessor';
import { VideoProcessor, VideoProcessingResult } from './videoProcessor';
import { URLProcessor, URLProcessingResult } from './urlProcessor';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported content types for multimodal processing
 */
export type ContentType = 'image' | 'document' | 'audio' | 'video' | 'url' | 'unknown';

/**
 * File MIME type mappings to content types
 */
const MIME_TYPE_MAP: Record<string, ContentType> = {
  // Images
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/bmp': 'image',
  'image/tiff': 'image',
  'image/svg+xml': 'image',
  'image/heic': 'image',
  'image/heif': 'image',

  // Documents
  'application/pdf': 'document',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'text/plain': 'document',
  'text/markdown': 'document',
  'text/html': 'document',
  'text/csv': 'document',
  'application/json': 'document',
  'application/xml': 'document',
  'text/xml': 'document',
  'application/rtf': 'document',

  // Audio
  'audio/mpeg': 'audio',
  'audio/mp3': 'audio',
  'audio/wav': 'audio',
  'audio/wave': 'audio',
  'audio/x-wav': 'audio',
  'audio/ogg': 'audio',
  'audio/webm': 'audio',
  'audio/aac': 'audio',
  'audio/m4a': 'audio',
  'audio/x-m4a': 'audio',
  'audio/flac': 'audio',

  // Video
  'video/mp4': 'video',
  'video/mpeg': 'video',
  'video/webm': 'video',
  'video/ogg': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'video/x-ms-wmv': 'video',
  'video/x-flv': 'video',
  'video/3gpp': 'video',
  'video/3gpp2': 'video',
};

/**
 * File extension mappings
 */
const EXTENSION_MAP: Record<string, ContentType> = {
  // Images
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.bmp': 'image',
  '.tiff': 'image',
  '.svg': 'image',
  '.heic': 'image',
  '.heif': 'image',

  // Documents
  '.pdf': 'document',
  '.doc': 'document',
  '.docx': 'document',
  '.xls': 'document',
  '.xlsx': 'document',
  '.ppt': 'document',
  '.pptx': 'document',
  '.txt': 'document',
  '.md': 'document',
  '.markdown': 'document',
  '.html': 'document',
  '.htm': 'document',
  '.csv': 'document',
  '.json': 'document',
  '.xml': 'document',
  '.rtf': 'document',

  // Audio
  '.mp3': 'audio',
  '.wav': 'audio',
  '.ogg': 'audio',
  '.m4a': 'audio',
  '.aac': 'audio',
  '.flac': 'audio',
  '.wma': 'audio',
  '.opus': 'audio',

  // Video
  '.mp4': 'video',
  '.mpeg': 'video',
  '.mpg': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.avi': 'video',
  '.wmv': 'video',
  '.flv': 'video',
  '.3gp': 'video',
  '.mkv': 'video',
};

/**
 * Input content for processing
 */
export interface MultimodalInput {
  type?: ContentType;
  mimeType?: string;
  filename?: string;
  url?: string;
  data?: Buffer | ArrayBuffer | Uint8Array;
  base64?: string;
  text?: string;
  metadata?: Record<string, any>;
}

/**
 * ORACLE Signal generated from multimodal content
 */
export interface OracleSignal {
  id: string;
  type: 'action_item' | 'deadline' | 'opportunity' | 'risk' | 'information' | 'meeting' | 'decision';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  confidence: number;
  source: {
    type: ContentType;
    filename?: string;
    url?: string;
    processingId: string;
  };
  entities: ExtractedEntity[];
  dates: ExtractedDate[];
  actionItems: ExtractedActionItem[];
  metadata: Record<string, any>;
  createdAt: string;
}

/**
 * Extracted entity from content
 */
export interface ExtractedEntity {
  type: 'person' | 'organization' | 'location' | 'product' | 'event' | 'money' | 'percentage' | 'date' | 'email' | 'phone' | 'url';
  value: string;
  confidence: number;
  context?: string;
}

/**
 * Extracted date from content
 */
export interface ExtractedDate {
  text: string;
  date: Date | null;
  type: 'deadline' | 'meeting' | 'event' | 'reference' | 'relative';
  confidence: number;
}

/**
 * Extracted action item
 */
export interface ExtractedActionItem {
  id: string;
  text: string;
  type: 'task' | 'decision' | 'follow_up' | 'review' | 'respond' | 'schedule';
  priority: 'high' | 'medium' | 'low';
  owner?: string;
  deadline?: ExtractedDate;
  confidence: number;
}

/**
 * Processing progress event
 */
export interface ProcessingProgress {
  processingId: string;
  status: 'queued' | 'processing' | 'extracting' | 'analyzing' | 'generating_signals' | 'completed' | 'failed';
  progress: number; // 0-100
  stage: string;
  message?: string;
  error?: string;
}

/**
 * Processing result
 */
export interface MultimodalProcessingResult {
  processingId: string;
  contentType: ContentType;
  filename?: string;
  url?: string;
  status: 'success' | 'partial' | 'failed';
  processingTimeMs: number;
  signals: OracleSignal[];
  extractedText?: string;
  summary?: string;
  keyPoints?: string[];
  entities: ExtractedEntity[];
  dates: ExtractedDate[];
  actionItems: ExtractedActionItem[];
  metadata: Record<string, any>;
  rawResult: ImageProcessingResult | DocumentProcessingResult | AudioProcessingResult | VideoProcessingResult | URLProcessingResult | null;
}

/**
 * Processing options
 */
export interface ProcessingOptions {
  extractText?: boolean;
  extractEntities?: boolean;
  extractDates?: boolean;
  extractActionItems?: boolean;
  generateSignals?: boolean;
  generateSummary?: boolean;
  extractKeyPoints?: boolean;
  cacheResults?: boolean;
  cacheTTL?: number;
  onProgress?: (progress: ProcessingProgress) => void;
}

// ============================================================================
// Multimodal Service Class
// ============================================================================

/**
 * MultimodalService - Unified content processing orchestrator
 *
 * Handles all multimodal content ingestion, routing to appropriate
 * processors, and converting extracted information to ORACLE signals.
 */
export class MultimodalService {
  private imageProcessor: ImageProcessor;
  private documentProcessor: DocumentProcessor;
  private audioProcessor: AudioProcessor;
  private videoProcessor: VideoProcessor;
  private urlProcessor: URLProcessor;
  private processingQueue: Map<string, ProcessingProgress> = new Map();

  constructor() {
    this.imageProcessor = new ImageProcessor();
    this.documentProcessor = new DocumentProcessor();
    this.audioProcessor = new AudioProcessor();
    this.videoProcessor = new VideoProcessor();
    this.urlProcessor = new URLProcessor();
  }

  // ==========================================================================
  // Content Type Detection
  // ==========================================================================

  /**
   * Detect content type from input
   */
  detectContentType(input: MultimodalInput): ContentType {
    // Explicit type override
    if (input.type && input.type !== 'unknown') {
      return input.type;
    }

    // Check MIME type
    if (input.mimeType) {
      const type = MIME_TYPE_MAP[input.mimeType.toLowerCase()];
      if (type) return type;
    }

    // Check URL
    if (input.url) {
      // Check if it's a web URL
      if (this.isWebUrl(input.url)) {
        // Check for media URLs
        const ext = this.getExtensionFromUrl(input.url);
        if (ext) {
          const type = EXTENSION_MAP[ext.toLowerCase()];
          if (type) return type;
        }
        return 'url';
      }
    }

    // Check filename extension
    if (input.filename) {
      const ext = this.getExtension(input.filename);
      if (ext) {
        const type = EXTENSION_MAP[ext.toLowerCase()];
        if (type) return type;
      }
    }

    // Try to detect from content
    if (input.data || input.base64) {
      return this.detectFromContent(input);
    }

    // Plain text defaults to document
    if (input.text) {
      return 'document';
    }

    return 'unknown';
  }

  /**
   * Check if URL is a web URL
   */
  private isWebUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Get extension from URL
   */
  private getExtensionFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const lastDot = pathname.lastIndexOf('.');
      if (lastDot !== -1) {
        return pathname.substring(lastDot);
      }
    } catch {}
    return null;
  }

  /**
   * Get file extension
   */
  private getExtension(filename: string): string | null {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot !== -1) {
      return filename.substring(lastDot);
    }
    return null;
  }

  /**
   * Detect content type from binary data
   */
  private detectFromContent(input: MultimodalInput): ContentType {
    let bytes: Uint8Array;

    if (input.data) {
      if (input.data instanceof Uint8Array) {
        bytes = input.data;
      } else if (input.data instanceof ArrayBuffer) {
        bytes = new Uint8Array(input.data);
      } else {
        bytes = new Uint8Array(input.data);
      }
    } else if (input.base64) {
      const binary = Buffer.from(input.base64, 'base64');
      bytes = new Uint8Array(binary);
    } else {
      return 'unknown';
    }

    // Check magic bytes
    if (bytes.length < 4) return 'unknown';

    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'image';
    }

    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'image';
    }

    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'image';
    }

    // WebP: 52 49 46 46 ... 57 45 42 50
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes.length > 11 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image';
    }

    // PDF: 25 50 44 46 (%PDF)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'document';
    }

    // ZIP-based formats (docx, xlsx, pptx, etc.): 50 4B 03 04
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return 'document';
    }

    // MP3: FF FB or ID3
    if ((bytes[0] === 0xFF && bytes[1] === 0xFB) ||
        (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) {
      return 'audio';
    }

    // WAV: 52 49 46 46 ... 57 41 56 45
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes.length > 11 && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
      return 'audio';
    }

    // OGG: 4F 67 67 53
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return 'audio'; // Could also be video, but audio is more common
    }

    // MP4/MOV: ... ftyp
    if (bytes.length > 11 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return 'video';
    }

    // WebM/MKV: 1A 45 DF A3
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      return 'video';
    }

    // AVI: 52 49 46 46 ... 41 56 49 20
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes.length > 11 && bytes[8] === 0x41 && bytes[9] === 0x56 && bytes[10] === 0x49 && bytes[11] === 0x20) {
      return 'video';
    }

    return 'unknown';
  }

  // ==========================================================================
  // Main Processing Pipeline
  // ==========================================================================

  /**
   * Process multimodal content
   */
  async process(
    input: MultimodalInput,
    options: ProcessingOptions = {}
  ): Promise<MultimodalProcessingResult> {
    const processingId = this.generateProcessingId();
    const startTime = Date.now();

    // Default options
    const opts: ProcessingOptions = {
      extractText: true,
      extractEntities: true,
      extractDates: true,
      extractActionItems: true,
      generateSignals: true,
      generateSummary: true,
      extractKeyPoints: true,
      cacheResults: true,
      cacheTTL: 30 * 60 * 1000, // 30 minutes
      ...options,
    };

    // Initialize progress
    this.updateProgress(processingId, {
      processingId,
      status: 'processing',
      progress: 0,
      stage: 'detecting_content_type',
    });
    opts.onProgress?.(this.processingQueue.get(processingId)!);

    // Check cache
    if (opts.cacheResults) {
      const cacheKeyStr = this.generateCacheKey(input);
      const cached = oracleCacheService.get<MultimodalProcessingResult>(cacheKeyStr);
      if (cached) {
        this.updateProgress(processingId, {
          processingId,
          status: 'completed',
          progress: 100,
          stage: 'from_cache',
          message: 'Result retrieved from cache',
        });
        opts.onProgress?.(this.processingQueue.get(processingId)!);
        return { ...cached, processingId };
      }
    }

    try {
      // Detect content type
      const contentType = this.detectContentType(input);

      this.updateProgress(processingId, {
        processingId,
        status: 'processing',
        progress: 10,
        stage: 'routing_to_processor',
        message: `Detected content type: ${contentType}`,
      });
      opts.onProgress?.(this.processingQueue.get(processingId)!);

      // Route to appropriate processor
      let rawResult: any = null;
      let extractedText = '';
      let summary = '';
      let keyPoints: string[] = [];

      switch (contentType) {
        case 'image':
          this.updateProgress(processingId, {
            processingId,
            status: 'processing',
            progress: 20,
            stage: 'processing_image',
          });
          opts.onProgress?.(this.processingQueue.get(processingId)!);

          rawResult = await this.imageProcessor.process(input, {
            extractOCR: opts.extractText,
            detectObjects: true,
            analyzeChart: true,
            analyzeScreenshot: true,
            onProgress: (p) => {
              this.updateProgress(processingId, {
                processingId,
                status: 'processing',
                progress: 20 + p * 0.4,
                stage: 'processing_image',
              });
              opts.onProgress?.(this.processingQueue.get(processingId)!);
            },
          });
          extractedText = rawResult.ocrText || '';
          summary = rawResult.description || '';
          break;

        case 'document':
          this.updateProgress(processingId, {
            processingId,
            status: 'processing',
            progress: 20,
            stage: 'processing_document',
          });
          opts.onProgress?.(this.processingQueue.get(processingId)!);

          rawResult = await this.documentProcessor.process(input, {
            extractText: opts.extractText,
            generateSummary: opts.generateSummary,
            extractKeyPoints: opts.extractKeyPoints,
            extractTables: true,
            onProgress: (p) => {
              this.updateProgress(processingId, {
                processingId,
                status: 'processing',
                progress: 20 + p * 0.4,
                stage: 'processing_document',
              });
              opts.onProgress?.(this.processingQueue.get(processingId)!);
            },
          });
          extractedText = rawResult.text || '';
          summary = rawResult.summary || '';
          keyPoints = rawResult.keyPoints || [];
          break;

        case 'audio':
          this.updateProgress(processingId, {
            processingId,
            status: 'processing',
            progress: 20,
            stage: 'processing_audio',
          });
          opts.onProgress?.(this.processingQueue.get(processingId)!);

          rawResult = await this.audioProcessor.process(input, {
            transcribe: opts.extractText,
            analyzeSentiment: true,
            detectSpeakers: true,
            extractKeyMoments: true,
            onProgress: (p) => {
              this.updateProgress(processingId, {
                processingId,
                status: 'processing',
                progress: 20 + p * 0.4,
                stage: 'processing_audio',
              });
              opts.onProgress?.(this.processingQueue.get(processingId)!);
            },
          });
          extractedText = rawResult.transcript || '';
          summary = rawResult.summary || '';
          keyPoints = rawResult.keyMoments?.map((m: any) => m.text) || [];
          break;

        case 'video':
          this.updateProgress(processingId, {
            processingId,
            status: 'processing',
            progress: 20,
            stage: 'processing_video',
          });
          opts.onProgress?.(this.processingQueue.get(processingId)!);

          rawResult = await this.videoProcessor.process(input, {
            extractFrames: true,
            generateTranscript: opts.extractText,
            detectScenes: true,
            detectEvents: true,
            onProgress: (p) => {
              this.updateProgress(processingId, {
                processingId,
                status: 'processing',
                progress: 20 + p * 0.4,
                stage: 'processing_video',
              });
              opts.onProgress?.(this.processingQueue.get(processingId)!);
            },
          });
          extractedText = rawResult.transcript || '';
          summary = rawResult.summary || '';
          keyPoints = rawResult.sceneDescriptions || [];
          break;

        case 'url':
          this.updateProgress(processingId, {
            processingId,
            status: 'processing',
            progress: 20,
            stage: 'processing_url',
          });
          opts.onProgress?.(this.processingQueue.get(processingId)!);

          rawResult = await this.urlProcessor.process(input, {
            extractContent: opts.extractText,
            extractMetadata: true,
            generatePreview: true,
            analyzeLinks: true,
            onProgress: (p) => {
              this.updateProgress(processingId, {
                processingId,
                status: 'processing',
                progress: 20 + p * 0.4,
                stage: 'processing_url',
              });
              opts.onProgress?.(this.processingQueue.get(processingId)!);
            },
          });
          extractedText = rawResult.content || '';
          summary = rawResult.summary || '';
          keyPoints = rawResult.keyPoints || [];
          break;

        default:
          throw new Error(`Unsupported content type: ${contentType}`);
      }

      // Extract entities
      this.updateProgress(processingId, {
        processingId,
        status: 'extracting',
        progress: 60,
        stage: 'extracting_entities',
      });
      opts.onProgress?.(this.processingQueue.get(processingId)!);

      let entities: ExtractedEntity[] = [];
      if (opts.extractEntities && extractedText) {
        entities = this.extractEntities(extractedText);
      }

      // Extract dates
      this.updateProgress(processingId, {
        processingId,
        status: 'extracting',
        progress: 70,
        stage: 'extracting_dates',
      });
      opts.onProgress?.(this.processingQueue.get(processingId)!);

      let dates: ExtractedDate[] = [];
      if (opts.extractDates && extractedText) {
        dates = this.extractDates(extractedText);
      }

      // Extract action items
      this.updateProgress(processingId, {
        processingId,
        status: 'extracting',
        progress: 80,
        stage: 'extracting_action_items',
      });
      opts.onProgress?.(this.processingQueue.get(processingId)!);

      let actionItems: ExtractedActionItem[] = [];
      if (opts.extractActionItems && extractedText) {
        actionItems = this.extractActionItems(extractedText, processingId);
      }

      // Generate signals
      this.updateProgress(processingId, {
        processingId,
        status: 'generating_signals',
        progress: 90,
        stage: 'generating_signals',
      });
      opts.onProgress?.(this.processingQueue.get(processingId)!);

      let signals: OracleSignal[] = [];
      if (opts.generateSignals) {
        signals = this.generateSignals({
          processingId,
          contentType,
          filename: input.filename,
          url: input.url,
          extractedText,
          summary,
          entities,
          dates,
          actionItems,
          rawResult,
        });
      }

      // Build result
      const result: MultimodalProcessingResult = {
        processingId,
        contentType,
        filename: input.filename,
        url: input.url,
        status: 'success',
        processingTimeMs: Date.now() - startTime,
        signals,
        extractedText: opts.extractText ? extractedText : undefined,
        summary: opts.generateSummary ? summary : undefined,
        keyPoints: opts.extractKeyPoints ? keyPoints : undefined,
        entities,
        dates,
        actionItems,
        metadata: {
          mimeType: input.mimeType,
          ...input.metadata,
          ...rawResult?.metadata,
        },
        rawResult,
      };

      // Cache result
      if (opts.cacheResults) {
        const cacheKeyStr = this.generateCacheKey(input);
        oracleCacheService.set(cacheKeyStr, result, opts.cacheTTL);
      }

      // Mark complete
      this.updateProgress(processingId, {
        processingId,
        status: 'completed',
        progress: 100,
        stage: 'completed',
        message: `Successfully processed ${contentType} content`,
      });
      opts.onProgress?.(this.processingQueue.get(processingId)!);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.updateProgress(processingId, {
        processingId,
        status: 'failed',
        progress: 0,
        stage: 'error',
        error: errorMessage,
      });
      opts.onProgress?.(this.processingQueue.get(processingId)!);

      return {
        processingId,
        contentType: 'unknown',
        filename: input.filename,
        url: input.url,
        status: 'failed',
        processingTimeMs: Date.now() - startTime,
        signals: [],
        entities: [],
        dates: [],
        actionItems: [],
        metadata: {
          error: errorMessage,
        },
        rawResult: null,
      };
    }
  }

  /**
   * Process multiple inputs in batch
   */
  async processBatch(
    inputs: MultimodalInput[],
    options: ProcessingOptions = {}
  ): Promise<MultimodalProcessingResult[]> {
    const results = await Promise.all(
      inputs.map((input) => this.process(input, options))
    );
    return results;
  }

  // ==========================================================================
  // Entity Extraction
  // ==========================================================================

  /**
   * Extract entities from text
   */
  private extractEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Email pattern
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailPattern.exec(text)) !== null) {
      entities.push({
        type: 'email',
        value: match[0],
        confidence: 0.95,
      });
    }

    // Phone pattern (various formats)
    const phonePattern = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    while ((match = phonePattern.exec(text)) !== null) {
      entities.push({
        type: 'phone',
        value: match[0],
        confidence: 0.85,
      });
    }

    // URL pattern
    const urlPattern = /https?:\/\/[^\s<>"\[\]{}|\\^`]+/gi;
    while ((match = urlPattern.exec(text)) !== null) {
      entities.push({
        type: 'url',
        value: match[0],
        confidence: 0.95,
      });
    }

    // Money pattern
    const moneyPattern = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:million|billion|k|m|b))?|\d+(?:\.\d{2})?\s*(?:dollars?|USD|EUR|GBP)/gi;
    while ((match = moneyPattern.exec(text)) !== null) {
      entities.push({
        type: 'money',
        value: match[0],
        confidence: 0.9,
      });
    }

    // Percentage pattern
    const percentPattern = /\d+(?:\.\d+)?%/g;
    while ((match = percentPattern.exec(text)) !== null) {
      entities.push({
        type: 'percentage',
        value: match[0],
        confidence: 0.95,
      });
    }

    // Person names (basic pattern - Capitalized FirstName LastName)
    const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    while ((match = namePattern.exec(text)) !== null) {
      // Filter out common false positives
      const name = match[1];
      const commonPhrases = ['The', 'This', 'That', 'These', 'Those', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      if (!commonPhrases.some(p => name.startsWith(p))) {
        entities.push({
          type: 'person',
          value: name,
          confidence: 0.6,
        });
      }
    }

    return entities;
  }

  // ==========================================================================
  // Date Extraction
  // ==========================================================================

  /**
   * Extract dates from text
   */
  private extractDates(text: string): ExtractedDate[] {
    const dates: ExtractedDate[] = [];

    // Relative dates
    const relativePatterns: Array<{ pattern: RegExp; type: ExtractedDate['type'] }> = [
      { pattern: /\b(today|tonight)\b/gi, type: 'reference' },
      { pattern: /\b(tomorrow)\b/gi, type: 'reference' },
      { pattern: /\b(yesterday)\b/gi, type: 'reference' },
      { pattern: /\b(this|next|last)\s+(week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, type: 'reference' },
      { pattern: /\b(in\s+\d+\s+(?:days?|weeks?|months?|hours?))\b/gi, type: 'deadline' },
      { pattern: /\b(by|before|until)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|end of (?:day|week|month))\b/gi, type: 'deadline' },
      { pattern: /\b(asap|immediately|urgent(?:ly)?)\b/gi, type: 'deadline' },
    ];

    for (const { pattern, type } of relativePatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        dates.push({
          text: match[0],
          date: this.parseRelativeDate(match[0]),
          type,
          confidence: 0.8,
        });
      }
    }

    // Absolute dates (MM/DD/YYYY, DD-MM-YYYY, Month DD, YYYY, etc.)
    const absolutePatterns: Array<{ pattern: RegExp; parser: (m: RegExpMatchArray) => Date | null }> = [
      {
        pattern: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,
        parser: (m) => {
          const month = parseInt(m[1], 10) - 1;
          const day = parseInt(m[2], 10);
          const year = parseInt(m[3], 10) < 100 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
          return new Date(year, month, day);
        },
      },
      {
        pattern: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/gi,
        parser: (m) => {
          const monthMap: Record<string, number> = {
            january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
            july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
          };
          const month = monthMap[m[1].toLowerCase()];
          const day = parseInt(m[2], 10);
          const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
          return new Date(year, month, day);
        },
      },
      {
        pattern: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s*,?\s*(\d{4}))?\b/gi,
        parser: (m) => {
          const monthMap: Record<string, number> = {
            january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
            july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
          };
          const day = parseInt(m[1], 10);
          const month = monthMap[m[2].toLowerCase()];
          const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
          return new Date(year, month, day);
        },
      },
    ];

    for (const { pattern, parser } of absolutePatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const date = parser(match);
        dates.push({
          text: match[0],
          date,
          type: 'reference',
          confidence: 0.9,
        });
      }
    }

    // Meeting/event context detection
    const meetingPattern = /\b(meeting|call|sync|appointment|interview|presentation|demo|webinar|conference)\s+(?:on|at|scheduled for)?\s+([^.!?\n]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = meetingPattern.exec(text)) !== null) {
      const currentMatch = match;
      const contextDates = dates.filter(d =>
        currentMatch[2].toLowerCase().includes(d.text.toLowerCase())
      );
      for (const d of contextDates) {
        d.type = 'meeting';
      }
    }

    // Deadline context detection
    const deadlinePattern = /\b(deadline|due|due date|submit(?:ted)? by|deliver(?:ed)? by|complete(?:d)? by)\s*:?\s*([^.!?\n]+)/gi;
    while ((match = deadlinePattern.exec(text)) !== null) {
      const currentMatch = match;
      const contextDates = dates.filter(d =>
        currentMatch[2].toLowerCase().includes(d.text.toLowerCase())
      );
      for (const d of contextDates) {
        d.type = 'deadline';
      }
    }

    return dates;
  }

  /**
   * Parse relative date to Date object
   */
  private parseRelativeDate(text: string): Date | null {
    const now = new Date();
    const lowered = text.toLowerCase();

    if (lowered.includes('today') || lowered.includes('tonight')) {
      return now;
    }

    if (lowered.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    if (lowered.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    // "in X days/weeks/months"
    const inMatch = lowered.match(/in\s+(\d+)\s+(days?|weeks?|months?|hours?)/);
    if (inMatch) {
      const num = parseInt(inMatch[1], 10);
      const unit = inMatch[2];
      const date = new Date(now);

      if (unit.startsWith('day')) {
        date.setDate(date.getDate() + num);
      } else if (unit.startsWith('week')) {
        date.setDate(date.getDate() + num * 7);
      } else if (unit.startsWith('month')) {
        date.setMonth(date.getMonth() + num);
      } else if (unit.startsWith('hour')) {
        date.setHours(date.getHours() + num);
      }

      return date;
    }

    // "next/this/last Monday/week/month"
    const dayMap: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };

    for (const [day, dayNum] of Object.entries(dayMap)) {
      if (lowered.includes(day)) {
        const date = new Date(now);
        const currentDay = date.getDay();
        let daysUntil = dayNum - currentDay;

        if (lowered.includes('next')) {
          if (daysUntil <= 0) daysUntil += 7;
          daysUntil += 7;
        } else if (lowered.includes('last')) {
          if (daysUntil >= 0) daysUntil -= 7;
        } else { // this
          if (daysUntil < 0) daysUntil += 7;
        }

        date.setDate(date.getDate() + daysUntil);
        return date;
      }
    }

    if (lowered.includes('asap') || lowered.includes('immediately') || lowered.includes('urgent')) {
      return now;
    }

    return null;
  }

  // ==========================================================================
  // Action Item Extraction
  // ==========================================================================

  /**
   * Extract action items from text
   */
  private extractActionItems(text: string, processingId: string): ExtractedActionItem[] {
    const actionItems: ExtractedActionItem[] = [];
    let itemId = 0;

    const patterns: Array<{
      pattern: RegExp;
      type: ExtractedActionItem['type'];
      priority: ExtractedActionItem['priority'];
    }> = [
      // Direct requests
      { pattern: /please\s+(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'medium' },
      { pattern: /(?:can|could|would) you\s+(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'medium' },
      { pattern: /(?:need|needs) to\s+(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'high' },
      { pattern: /make sure (?:to\s+)?(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'high' },
      { pattern: /don't forget (?:to\s+)?(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'high' },

      // Review requests
      { pattern: /(?:please )?review\s+(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'review', priority: 'medium' },
      { pattern: /take a look at\s+(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'review', priority: 'low' },

      // Decision requests
      { pattern: /(?:need|needs)?\s*(?:a |your )?decision (?:on|about|regarding)\s+(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'decision', priority: 'high' },
      { pattern: /approve\s+(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'decision', priority: 'high' },

      // Response requests
      { pattern: /(?:let me|us) know\s+(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'respond', priority: 'medium' },
      { pattern: /respond (?:to|with)\s+(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'respond', priority: 'medium' },
      { pattern: /reply (?:to |with )?(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'respond', priority: 'medium' },

      // Follow-up
      { pattern: /follow[- ]?up (?:on|with|about)\s+(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'follow_up', priority: 'medium' },

      // Scheduling
      { pattern: /schedule\s+(.{10,100}?)(?:[.!?\n]|$)/gi, type: 'schedule', priority: 'medium' },
      { pattern: /set up (?:a |the )?(meeting|call|sync)\s*(.{0,100}?)(?:[.!?\n]|$)/gi, type: 'schedule', priority: 'medium' },
    ];

    for (const { pattern, type, priority } of patterns) {
      let match;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(text)) !== null) {
        const actionText = (match[1] || match[0]).trim();

        // Skip duplicates
        if (actionItems.some(item => item.text.toLowerCase() === actionText.toLowerCase())) {
          continue;
        }

        // Skip very short items
        if (actionText.length < 10) continue;

        actionItems.push({
          id: `action-${processingId}-${itemId++}`,
          text: actionText,
          type,
          priority,
          confidence: 0.7,
        });
      }
    }

    // Detect deadline associations
    const extractedDates = this.extractDates(text);
    for (const item of actionItems) {
      // Find dates near the action item text
      const itemIndex = text.toLowerCase().indexOf(item.text.toLowerCase());
      if (itemIndex !== -1) {
        const contextStart = Math.max(0, itemIndex - 50);
        const contextEnd = Math.min(text.length, itemIndex + item.text.length + 100);
        const context = text.substring(contextStart, contextEnd);

        for (const date of extractedDates) {
          if (context.toLowerCase().includes(date.text.toLowerCase())) {
            item.deadline = date;
            if (date.type === 'deadline' && date.date) {
              const now = new Date();
              const daysUntil = Math.ceil((date.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              if (daysUntil <= 1) {
                item.priority = 'high';
              } else if (daysUntil <= 7) {
                item.priority = item.priority === 'low' ? 'medium' : item.priority;
              }
            }
            break;
          }
        }
      }
    }

    return actionItems;
  }

  // ==========================================================================
  // Signal Generation
  // ==========================================================================

  /**
   * Generate ORACLE signals from extracted data
   */
  private generateSignals(data: {
    processingId: string;
    contentType: ContentType;
    filename?: string;
    url?: string;
    extractedText: string;
    summary: string;
    entities: ExtractedEntity[];
    dates: ExtractedDate[];
    actionItems: ExtractedActionItem[];
    rawResult: any;
  }): OracleSignal[] {
    const signals: OracleSignal[] = [];
    const now = new Date();

    // Generate signals from action items
    for (const item of data.actionItems) {
      const urgency = this.calculateUrgency(item.priority, item.deadline);
      const impact = item.type === 'decision' ? 'high' : item.priority === 'high' ? 'high' : 'medium';

      signals.push({
        id: item.id,
        type: item.type === 'decision' ? 'decision' : item.type === 'schedule' ? 'meeting' : 'action_item',
        urgency,
        impact,
        title: item.text.substring(0, 100),
        description: item.text,
        confidence: item.confidence,
        source: {
          type: data.contentType,
          filename: data.filename,
          url: data.url,
          processingId: data.processingId,
        },
        entities: data.entities.filter(e => item.text.toLowerCase().includes(e.value.toLowerCase())),
        dates: item.deadline ? [item.deadline] : [],
        actionItems: [item],
        metadata: {
          actionType: item.type,
          owner: item.owner,
        },
        createdAt: now.toISOString(),
      });
    }

    // Generate signals from urgent deadlines
    const urgentDeadlines = data.dates.filter(d => {
      if (d.type !== 'deadline' || !d.date) return false;
      const daysUntil = Math.ceil((d.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 7;
    });

    for (const deadline of urgentDeadlines) {
      // Check if already covered by an action item
      const alreadyCovered = signals.some(s =>
        s.dates.some(d => d.text === deadline.text)
      );

      if (!alreadyCovered) {
        const daysUntil = deadline.date ?
          Math.ceil((deadline.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) :
          999;

        signals.push({
          id: `deadline-${data.processingId}-${signals.length}`,
          type: 'deadline',
          urgency: daysUntil <= 1 ? 'critical' : daysUntil <= 3 ? 'high' : 'medium',
          impact: 'high',
          title: `Deadline: ${deadline.text}`,
          description: `Upcoming deadline detected: ${deadline.text}`,
          confidence: deadline.confidence,
          source: {
            type: data.contentType,
            filename: data.filename,
            url: data.url,
            processingId: data.processingId,
          },
          entities: [],
          dates: [deadline],
          actionItems: [],
          metadata: {
            daysUntil,
          },
          createdAt: now.toISOString(),
        });
      }
    }

    // Generate signals from meetings
    const meetings = data.dates.filter(d => d.type === 'meeting');
    for (const meeting of meetings) {
      signals.push({
        id: `meeting-${data.processingId}-${signals.length}`,
        type: 'meeting',
        urgency: 'medium',
        impact: 'medium',
        title: `Meeting: ${meeting.text}`,
        description: `Scheduled meeting or event: ${meeting.text}`,
        confidence: meeting.confidence,
        source: {
          type: data.contentType,
          filename: data.filename,
          url: data.url,
          processingId: data.processingId,
        },
        entities: [],
        dates: [meeting],
        actionItems: [],
        metadata: {},
        createdAt: now.toISOString(),
      });
    }

    // Generate summary signal if no specific signals but has content
    if (signals.length === 0 && data.summary) {
      signals.push({
        id: `info-${data.processingId}`,
        type: 'information',
        urgency: 'low',
        impact: 'low',
        title: data.filename || data.url || 'Processed content',
        description: data.summary.substring(0, 500),
        confidence: 0.8,
        source: {
          type: data.contentType,
          filename: data.filename,
          url: data.url,
          processingId: data.processingId,
        },
        entities: data.entities,
        dates: data.dates,
        actionItems: [],
        metadata: {},
        createdAt: now.toISOString(),
      });
    }

    return signals;
  }

  /**
   * Calculate urgency based on priority and deadline
   */
  private calculateUrgency(
    priority: 'high' | 'medium' | 'low',
    deadline?: ExtractedDate
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (deadline?.date) {
      const now = new Date();
      const daysUntil = Math.ceil((deadline.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil <= 0) return 'critical';
      if (daysUntil <= 1) return priority === 'low' ? 'high' : 'critical';
      if (daysUntil <= 3) return priority === 'low' ? 'medium' : 'high';
    }

    if (priority === 'high') return 'high';
    if (priority === 'medium') return 'medium';
    return 'low';
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Generate unique processing ID
   */
  private generateProcessingId(): string {
    return `proc-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate cache key for input
   */
  private generateCacheKey(input: MultimodalInput): string {
    const keyParts: any = {};

    if (input.url) {
      keyParts.url = input.url;
    }
    if (input.filename) {
      keyParts.filename = input.filename;
    }
    if (input.base64) {
      // Hash the base64 content for consistent key
      keyParts.contentHash = this.hashString(input.base64.substring(0, 1000));
    }
    if (input.text) {
      keyParts.textHash = this.hashString(input.text.substring(0, 1000));
    }

    return `multimodal:${hashObject(keyParts)}`;
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

  /**
   * Update processing progress
   */
  private updateProgress(processingId: string, progress: ProcessingProgress): void {
    this.processingQueue.set(processingId, progress);
  }

  /**
   * Get processing progress
   */
  getProgress(processingId: string): ProcessingProgress | null {
    return this.processingQueue.get(processingId) || null;
  }

  /**
   * Clear completed processing from queue
   */
  clearCompleted(): void {
    for (const [id, progress] of this.processingQueue.entries()) {
      if (progress.status === 'completed' || progress.status === 'failed') {
        this.processingQueue.delete(id);
      }
    }
  }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

/**
 * Create a new MultimodalService instance
 */
export function createMultimodalService(): MultimodalService {
  return new MultimodalService();
}

/**
 * Singleton instance
 */
export const multimodalService = new MultimodalService();

// Re-export processor types
export { ImageProcessor, ImageProcessingResult } from './imageProcessor';
export { DocumentProcessor, DocumentProcessingResult } from './documentProcessor';
export { AudioProcessor, AudioProcessingResult } from './audioProcessor';
export { VideoProcessor, VideoProcessingResult } from './videoProcessor';
export { URLProcessor, URLProcessingResult } from './urlProcessor';

export default MultimodalService;
