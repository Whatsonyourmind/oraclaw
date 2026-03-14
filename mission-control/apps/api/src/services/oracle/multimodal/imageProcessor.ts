/**
 * ORACLE Image Processor
 * Handles image analysis, OCR, scene detection, chart extraction
 *
 * Features:
 * - OCR text extraction (Tesseract.js patterns)
 * - Scene/object detection descriptions
 * - Chart/graph data extraction
 * - Screenshot analysis for UI bugs
 * - Whiteboard/diagram parsing
 * - Image-to-signal conversion
 *
 * @module services/oracle/multimodal/imageProcessor
 */

import { oracleCacheService, hashObject } from '../cache';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Image input for processing
 */
export interface ImageInput {
  data?: Buffer | ArrayBuffer | Uint8Array;
  base64?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
}

/**
 * OCR result
 */
export interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
  language?: string;
}

/**
 * OCR text block
 */
export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  lines: OCRLine[];
}

/**
 * OCR text line
 */
export interface OCRLine {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words: OCRWord[];
}

/**
 * OCR word
 */
export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

/**
 * Bounding box coordinates
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Detected object in image
 */
export interface DetectedObject {
  label: string;
  confidence: number;
  bbox?: BoundingBox;
  attributes?: Record<string, string>;
}

/**
 * Scene analysis result
 */
export interface SceneAnalysis {
  description: string;
  tags: string[];
  objects: DetectedObject[];
  colors: ColorInfo[];
  isScreenshot: boolean;
  isChart: boolean;
  isDiagram: boolean;
  isWhiteboard: boolean;
  isDocument: boolean;
}

/**
 * Color information
 */
export interface ColorInfo {
  hex: string;
  percentage: number;
  name?: string;
}

/**
 * Chart analysis result
 */
export interface ChartAnalysis {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'unknown';
  title?: string;
  labels?: string[];
  dataPoints?: DataPoint[];
  axes?: {
    x?: { label?: string; values?: string[] };
    y?: { label?: string; range?: [number, number] };
  };
  summary: string;
}

/**
 * Chart data point
 */
export interface DataPoint {
  label?: string;
  value: number;
  x?: number;
  y?: number;
}

/**
 * Screenshot analysis result (UI bugs)
 */
export interface ScreenshotAnalysis {
  appType: 'web' | 'mobile' | 'desktop' | 'unknown';
  uiElements: UIElement[];
  potentialIssues: UIIssue[];
  accessibility: AccessibilityCheck[];
  layout: LayoutAnalysis;
}

/**
 * UI element detected in screenshot
 */
export interface UIElement {
  type: 'button' | 'input' | 'text' | 'image' | 'icon' | 'menu' | 'card' | 'list' | 'form' | 'header' | 'footer' | 'navigation' | 'unknown';
  text?: string;
  bbox: BoundingBox;
  confidence: number;
}

/**
 * Potential UI issue
 */
export interface UIIssue {
  type: 'overlap' | 'truncation' | 'alignment' | 'contrast' | 'spacing' | 'missing_element' | 'broken_layout' | 'responsive';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: BoundingBox;
  suggestion?: string;
}

/**
 * Accessibility check result
 */
export interface AccessibilityCheck {
  rule: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  element?: UIElement;
}

/**
 * Layout analysis
 */
export interface LayoutAnalysis {
  columns: number;
  rows: number;
  gridDetected: boolean;
  symmetry: number; // 0-1
  density: number; // 0-1
}

/**
 * Whiteboard/diagram analysis
 */
export interface DiagramAnalysis {
  type: 'flowchart' | 'mindmap' | 'wireframe' | 'architecture' | 'sequence' | 'class' | 'handwritten' | 'unknown';
  shapes: DiagramShape[];
  connections: DiagramConnection[];
  text: string[];
  summary: string;
}

/**
 * Diagram shape
 */
export interface DiagramShape {
  type: 'rectangle' | 'circle' | 'diamond' | 'arrow' | 'line' | 'cloud' | 'text' | 'unknown';
  text?: string;
  bbox: BoundingBox;
}

/**
 * Diagram connection
 */
export interface DiagramConnection {
  from: number; // Shape index
  to: number;
  type: 'arrow' | 'line' | 'dashed';
  label?: string;
}

/**
 * Image processing result
 */
export interface ImageProcessingResult {
  processingId: string;
  filename?: string;
  url?: string;
  dimensions: { width: number; height: number };
  mimeType?: string;
  ocrText?: string;
  ocrResult?: OCRResult;
  description?: string;
  scene?: SceneAnalysis;
  chart?: ChartAnalysis;
  screenshot?: ScreenshotAnalysis;
  diagram?: DiagramAnalysis;
  entities: ExtractedImageEntity[];
  metadata: Record<string, any>;
}

/**
 * Entity extracted from image
 */
export interface ExtractedImageEntity {
  type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'url' | 'person' | 'organization' | 'location';
  value: string;
  confidence: number;
  source: 'ocr' | 'scene' | 'chart';
}

/**
 * Processing options
 */
export interface ImageProcessingOptions {
  extractOCR?: boolean;
  detectObjects?: boolean;
  analyzeChart?: boolean;
  analyzeScreenshot?: boolean;
  analyzeDiagram?: boolean;
  language?: string;
  onProgress?: (progress: number) => void;
}

// ============================================================================
// Image Processor Class
// ============================================================================

/**
 * ImageProcessor - Handles image analysis and text extraction
 *
 * Uses pattern-based analysis for various image types including
 * screenshots, charts, diagrams, and document scans.
 */
export class ImageProcessor {
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
   * Process an image through the analysis pipeline
   */
  async process(
    input: ImageInput,
    options: ImageProcessingOptions = {}
  ): Promise<ImageProcessingResult> {
    const processingId = this.generateProcessingId();
    const startProgress = 0;

    // Default options
    const opts: ImageProcessingOptions = {
      extractOCR: true,
      detectObjects: true,
      analyzeChart: true,
      analyzeScreenshot: true,
      analyzeDiagram: true,
      language: 'eng',
      ...options,
    };

    // Check cache
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(input);
      const cached = oracleCacheService.get<ImageProcessingResult>(cacheKey);
      if (cached) {
        opts.onProgress?.(100);
        return { ...cached, processingId };
      }
    }

    // Get image data
    const imageData = await this.getImageData(input);
    opts.onProgress?.(10);

    // Analyze image metadata
    const dimensions = await this.getImageDimensions(imageData);
    opts.onProgress?.(15);

    // Initialize result
    const result: ImageProcessingResult = {
      processingId,
      filename: input.filename,
      url: input.url,
      dimensions,
      mimeType: input.mimeType,
      entities: [],
      metadata: {},
    };

    // Perform OCR if enabled
    if (opts.extractOCR) {
      opts.onProgress?.(20);
      result.ocrResult = await this.performOCR(imageData, opts.language);
      result.ocrText = result.ocrResult.text;
      opts.onProgress?.(40);

      // Extract entities from OCR text
      const ocrEntities = this.extractEntitiesFromText(result.ocrText);
      result.entities.push(...ocrEntities);
    }

    // Perform scene analysis
    if (opts.detectObjects) {
      opts.onProgress?.(50);
      result.scene = await this.analyzeScene(imageData);
      result.description = result.scene.description;
      opts.onProgress?.(60);
    }

    // Analyze chart if detected
    if (opts.analyzeChart && result.scene?.isChart) {
      opts.onProgress?.(70);
      result.chart = await this.analyzeChart(imageData, result.ocrResult);

      // Extract data points as entities
      if (result.chart.dataPoints) {
        for (const dp of result.chart.dataPoints) {
          result.entities.push({
            type: 'number',
            value: dp.value.toString(),
            confidence: 0.7,
            source: 'chart',
          });
        }
      }
    }

    // Analyze screenshot if detected
    if (opts.analyzeScreenshot && result.scene?.isScreenshot) {
      opts.onProgress?.(75);
      result.screenshot = await this.analyzeScreenshot(imageData, result.ocrResult);
    }

    // Analyze diagram/whiteboard if detected
    if (opts.analyzeDiagram && (result.scene?.isDiagram || result.scene?.isWhiteboard)) {
      opts.onProgress?.(80);
      result.diagram = await this.analyzeDiagram(imageData, result.ocrResult);
    }

    opts.onProgress?.(90);

    // Compile metadata
    result.metadata = {
      dimensions,
      hasText: (result.ocrText?.length ?? 0) > 0,
      textConfidence: result.ocrResult?.confidence,
      sceneType: result.scene?.isScreenshot ? 'screenshot' :
                 result.scene?.isChart ? 'chart' :
                 result.scene?.isDiagram ? 'diagram' :
                 result.scene?.isWhiteboard ? 'whiteboard' :
                 result.scene?.isDocument ? 'document' : 'photo',
      objectCount: result.scene?.objects?.length ?? 0,
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
  // OCR Processing
  // ==========================================================================

  /**
   * Perform OCR on image
   *
   * Note: In production, this would use Tesseract.js or a cloud OCR service.
   * This implementation provides the interface and mock data for development.
   */
  async performOCR(imageData: Uint8Array, language?: string): Promise<OCRResult> {
    // In production, this would use Tesseract.js:
    // const worker = await createWorker(language || 'eng');
    // const { data } = await worker.recognize(imageData);
    // await worker.terminate();

    // For now, we'll analyze the image data to detect if it contains text
    // and provide a structured result

    // Detect if image likely contains text by analyzing pixel patterns
    const hasTextPatterns = this.detectTextPatterns(imageData);

    if (!hasTextPatterns) {
      return {
        text: '',
        confidence: 0,
        blocks: [],
        language,
      };
    }

    // Mock OCR result structure - in production this would be real OCR
    return {
      text: '', // Would be populated by actual OCR
      confidence: 0.85,
      blocks: [],
      language,
    };
  }

  /**
   * Detect if image likely contains text patterns
   */
  private detectTextPatterns(imageData: Uint8Array): boolean {
    // Analyze image for high contrast regions and line patterns
    // that typically indicate text presence

    if (imageData.length < 1000) return false;

    // Sample pixels to check for contrast patterns
    let highContrastCount = 0;
    const sampleSize = Math.min(1000, imageData.length / 4);

    for (let i = 0; i < sampleSize; i++) {
      const idx = Math.floor((i / sampleSize) * (imageData.length - 4));
      if (idx + 4 < imageData.length) {
        // Check for high local contrast (typical of text)
        const r = imageData[idx];
        const g = imageData[idx + 1];
        const b = imageData[idx + 2];

        const r2 = imageData[idx + 4] || r;
        const g2 = imageData[idx + 5] || g;
        const b2 = imageData[idx + 6] || b;

        const contrast = Math.abs(r - r2) + Math.abs(g - g2) + Math.abs(b - b2);
        if (contrast > 200) {
          highContrastCount++;
        }
      }
    }

    return highContrastCount > sampleSize * 0.1;
  }

  // ==========================================================================
  // Scene Analysis
  // ==========================================================================

  /**
   * Analyze scene/objects in image
   */
  async analyzeScene(imageData: Uint8Array): Promise<SceneAnalysis> {
    // Analyze image characteristics to classify the scene type
    const colors = this.extractDominantColors(imageData);
    const isScreenshot = this.detectScreenshot(imageData, colors);
    const isChart = this.detectChart(imageData, colors);
    const isDiagram = this.detectDiagram(imageData, colors);
    const isWhiteboard = this.detectWhiteboard(imageData, colors);
    const isDocument = this.detectDocument(imageData, colors);

    // Generate scene description
    let description = 'Image';
    const tags: string[] = [];

    if (isScreenshot) {
      description = 'Screenshot of an application interface';
      tags.push('screenshot', 'ui', 'interface');
    } else if (isChart) {
      description = 'Chart or graph visualization';
      tags.push('chart', 'data', 'visualization');
    } else if (isDiagram) {
      description = 'Diagram or flowchart';
      tags.push('diagram', 'flowchart', 'technical');
    } else if (isWhiteboard) {
      description = 'Whiteboard or handwritten content';
      tags.push('whiteboard', 'handwritten', 'notes');
    } else if (isDocument) {
      description = 'Scanned document or text-heavy image';
      tags.push('document', 'text', 'scan');
    }

    // Detect common objects
    const objects = await this.detectObjects(imageData);

    return {
      description,
      tags,
      objects,
      colors,
      isScreenshot,
      isChart,
      isDiagram,
      isWhiteboard,
      isDocument,
    };
  }

  /**
   * Extract dominant colors from image
   */
  private extractDominantColors(imageData: Uint8Array): ColorInfo[] {
    const colorCounts = new Map<string, number>();
    const totalPixels = imageData.length / 4;

    // Sample pixels
    const sampleRate = Math.max(1, Math.floor(totalPixels / 10000));

    for (let i = 0; i < imageData.length; i += 4 * sampleRate) {
      const r = Math.round(imageData[i] / 32) * 32;
      const g = Math.round(imageData[i + 1] / 32) * 32;
      const b = Math.round(imageData[i + 2] / 32) * 32;

      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }

    // Sort by frequency
    const sorted = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const sampledPixels = Math.floor(totalPixels / sampleRate);

    return sorted.map(([hex, count]) => ({
      hex,
      percentage: count / sampledPixels,
      name: this.getColorName(hex),
    }));
  }

  /**
   * Get color name from hex
   */
  private getColorName(hex: string): string {
    const colors: Record<string, string> = {
      '#000000': 'black',
      '#ffffff': 'white',
      '#ff0000': 'red',
      '#00ff00': 'green',
      '#0000ff': 'blue',
      '#ffff00': 'yellow',
      '#ff00ff': 'magenta',
      '#00ffff': 'cyan',
      '#808080': 'gray',
    };

    // Find closest color
    let closestColor = 'unknown';
    let minDistance = Infinity;

    const r1 = parseInt(hex.slice(1, 3), 16);
    const g1 = parseInt(hex.slice(3, 5), 16);
    const b1 = parseInt(hex.slice(5, 7), 16);

    for (const [colorHex, name] of Object.entries(colors)) {
      const r2 = parseInt(colorHex.slice(1, 3), 16);
      const g2 = parseInt(colorHex.slice(3, 5), 16);
      const b2 = parseInt(colorHex.slice(5, 7), 16);

      const distance = Math.sqrt(
        Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestColor = name;
      }
    }

    return closestColor;
  }

  /**
   * Detect if image is a screenshot
   */
  private detectScreenshot(imageData: Uint8Array, colors: ColorInfo[]): boolean {
    // Screenshots typically have:
    // - Rectangular UI elements
    // - Limited color palette
    // - Sharp edges
    // - Common UI colors (white, gray, blue accents)

    const hasLimitedColors = colors.length <= 5 && colors[0].percentage > 0.3;
    const hasUIColors = colors.some(c =>
      c.name === 'white' || c.name === 'gray' || c.hex.startsWith('#f')
    );

    return hasLimitedColors && hasUIColors;
  }

  /**
   * Detect if image is a chart
   */
  private detectChart(imageData: Uint8Array, colors: ColorInfo[]): boolean {
    // Charts typically have:
    // - White or light background
    // - Distinct colored data regions
    // - Grid lines or axes

    const hasLightBackground = colors[0]?.name === 'white' || colors[0]?.hex.startsWith('#f');
    const hasDistinctColors = colors.length >= 3;

    return hasLightBackground && hasDistinctColors;
  }

  /**
   * Detect if image is a diagram
   */
  private detectDiagram(imageData: Uint8Array, colors: ColorInfo[]): boolean {
    // Diagrams typically have:
    // - White background
    // - Black lines/shapes
    // - Few colors

    const hasWhiteBackground = colors[0]?.name === 'white' || colors[0]?.percentage > 0.5;
    const hasBlackLines = colors.some(c => c.name === 'black');

    return hasWhiteBackground && hasBlackLines;
  }

  /**
   * Detect if image is a whiteboard
   */
  private detectWhiteboard(imageData: Uint8Array, colors: ColorInfo[]): boolean {
    // Whiteboards typically have:
    // - Off-white or light gray background
    // - Marker colors (black, blue, red, green)
    // - Lower contrast than digital diagrams

    const hasLightBackground = colors[0]?.hex.startsWith('#f') || colors[0]?.hex.startsWith('#e');
    const hasMarkerColors = colors.some(c =>
      c.name === 'black' || c.name === 'blue' || c.name === 'red' || c.name === 'green'
    );

    return hasLightBackground && hasMarkerColors;
  }

  /**
   * Detect if image is a document scan
   */
  private detectDocument(imageData: Uint8Array, colors: ColorInfo[]): boolean {
    // Documents typically have:
    // - White or off-white background
    // - High percentage of black (text)
    // - Two dominant colors

    const hasWhiteBackground = colors[0]?.name === 'white' || colors[0]?.percentage > 0.7;
    const hasBlackText = colors.some(c => c.name === 'black' && c.percentage > 0.05);
    const simplePalette = colors.slice(0, 2).reduce((sum, c) => sum + c.percentage, 0) > 0.9;

    return hasWhiteBackground && hasBlackText && simplePalette;
  }

  /**
   * Detect objects in image
   */
  private async detectObjects(imageData: Uint8Array): Promise<DetectedObject[]> {
    // In production, this would use a machine learning model (e.g., TensorFlow.js)
    // For now, return empty array - detection would be based on model inference
    return [];
  }

  // ==========================================================================
  // Chart Analysis
  // ==========================================================================

  /**
   * Analyze chart content
   */
  async analyzeChart(imageData: Uint8Array, ocrResult?: OCRResult): Promise<ChartAnalysis> {
    // Detect chart type based on visual patterns
    const chartType = this.detectChartType(imageData);

    // Extract labels and data from OCR if available
    const labels: string[] = [];
    const dataPoints: DataPoint[] = [];

    if (ocrResult?.text) {
      // Extract numbers
      const numbers = ocrResult.text.match(/\d+(?:\.\d+)?/g) || [];
      for (const num of numbers) {
        dataPoints.push({ value: parseFloat(num) });
      }

      // Extract potential labels (non-numeric text)
      const words = ocrResult.text.split(/\s+/).filter(w =>
        w.length > 1 && !/^\d+(?:\.\d+)?$/.test(w)
      );
      labels.push(...words.slice(0, 10));
    }

    return {
      type: chartType,
      labels: labels.length > 0 ? labels : undefined,
      dataPoints: dataPoints.length > 0 ? dataPoints : undefined,
      summary: `${chartType} chart with ${dataPoints.length} data points`,
    };
  }

  /**
   * Detect chart type
   */
  private detectChartType(imageData: Uint8Array): ChartAnalysis['type'] {
    // Would analyze visual patterns to determine chart type
    // For now, return unknown
    return 'unknown';
  }

  // ==========================================================================
  // Screenshot Analysis
  // ==========================================================================

  /**
   * Analyze screenshot for UI elements and issues
   */
  async analyzeScreenshot(imageData: Uint8Array, ocrResult?: OCRResult): Promise<ScreenshotAnalysis> {
    // Detect UI elements
    const uiElements = await this.detectUIElements(imageData, ocrResult);

    // Check for potential issues
    const potentialIssues = this.checkUIIssues(uiElements);

    // Run accessibility checks
    const accessibility = this.checkAccessibility(uiElements);

    // Analyze layout
    const layout = this.analyzeLayout(uiElements);

    // Detect app type
    const appType = this.detectAppType(uiElements);

    return {
      appType,
      uiElements,
      potentialIssues,
      accessibility,
      layout,
    };
  }

  /**
   * Detect UI elements in screenshot
   */
  private async detectUIElements(imageData: Uint8Array, ocrResult?: OCRResult): Promise<UIElement[]> {
    const elements: UIElement[] = [];

    // In production, this would use ML-based detection
    // For now, extract basic elements from OCR blocks

    if (ocrResult?.blocks) {
      for (const block of ocrResult.blocks) {
        // Classify block based on text content and position
        let type: UIElement['type'] = 'text';

        const text = block.text.toLowerCase();
        if (text.includes('button') || text.length < 20) {
          type = 'button';
        } else if (text.includes('input') || text.includes('enter')) {
          type = 'input';
        }

        elements.push({
          type,
          text: block.text,
          bbox: block.bbox,
          confidence: block.confidence,
        });
      }
    }

    return elements;
  }

  /**
   * Check for UI issues
   */
  private checkUIIssues(elements: UIElement[]): UIIssue[] {
    const issues: UIIssue[] = [];

    // Check for overlapping elements
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        if (this.boxesOverlap(elements[i].bbox, elements[j].bbox)) {
          issues.push({
            type: 'overlap',
            severity: 'medium',
            description: `UI elements at positions ${i} and ${j} appear to overlap`,
            location: elements[i].bbox,
            suggestion: 'Review element positioning to prevent overlap',
          });
        }
      }
    }

    // Check for potential truncation (text at edge of element)
    for (const element of elements) {
      if (element.text && element.text.endsWith('...')) {
        issues.push({
          type: 'truncation',
          severity: 'low',
          description: `Text appears truncated: "${element.text}"`,
          location: element.bbox,
          suggestion: 'Consider expanding container or using ellipsis properly',
        });
      }
    }

    return issues;
  }

  /**
   * Check if two boxes overlap
   */
  private boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }

  /**
   * Run accessibility checks
   */
  private checkAccessibility(elements: UIElement[]): AccessibilityCheck[] {
    const checks: AccessibilityCheck[] = [];

    // Check for elements without text (potential missing labels)
    const elementsWithoutText = elements.filter(e =>
      (e.type === 'button' || e.type === 'input') && !e.text
    );

    for (const element of elementsWithoutText) {
      checks.push({
        rule: 'missing-label',
        passed: false,
        severity: 'high',
        description: `${element.type} element appears to have no accessible label`,
        element,
      });
    }

    // Check for small touch targets (< 44px)
    for (const element of elements) {
      if ((element.type === 'button' || element.type === 'input') &&
          (element.bbox.width < 44 || element.bbox.height < 44)) {
        checks.push({
          rule: 'small-touch-target',
          passed: false,
          severity: 'medium',
          description: `${element.type} touch target is smaller than recommended 44x44px`,
          element,
        });
      }
    }

    return checks;
  }

  /**
   * Analyze layout structure
   */
  private analyzeLayout(elements: UIElement[]): LayoutAnalysis {
    if (elements.length === 0) {
      return {
        columns: 0,
        rows: 0,
        gridDetected: false,
        symmetry: 0,
        density: 0,
      };
    }

    // Analyze column structure by x positions
    const xPositions = elements.map(e => e.bbox.x).sort((a, b) => a - b);
    const uniqueX = [...new Set(xPositions.map(x => Math.round(x / 50) * 50))];

    // Analyze row structure by y positions
    const yPositions = elements.map(e => e.bbox.y).sort((a, b) => a - b);
    const uniqueY = [...new Set(yPositions.map(y => Math.round(y / 50) * 50))];

    return {
      columns: uniqueX.length,
      rows: uniqueY.length,
      gridDetected: uniqueX.length > 1 && uniqueY.length > 1,
      symmetry: 0.5, // Would calculate actual symmetry
      density: elements.length / (uniqueX.length * uniqueY.length),
    };
  }

  /**
   * Detect app type from UI patterns
   */
  private detectAppType(elements: UIElement[]): ScreenshotAnalysis['appType'] {
    // Analyze element patterns to determine app type
    const hasNavBar = elements.some(e => e.type === 'navigation' || e.type === 'header');
    const hasCards = elements.filter(e => e.type === 'card').length > 1;

    // Would use more sophisticated detection in production
    return 'unknown';
  }

  // ==========================================================================
  // Diagram Analysis
  // ==========================================================================

  /**
   * Analyze diagram/whiteboard content
   */
  async analyzeDiagram(imageData: Uint8Array, ocrResult?: OCRResult): Promise<DiagramAnalysis> {
    // Detect shapes
    const shapes = await this.detectShapes(imageData);

    // Detect connections between shapes
    const connections = this.detectConnections(shapes);

    // Extract text from OCR
    const textContent = ocrResult?.blocks?.map(b => b.text) || [];

    // Determine diagram type
    const type = this.classifyDiagramType(shapes, connections);

    return {
      type,
      shapes,
      connections,
      text: textContent,
      summary: `${type} diagram with ${shapes.length} shapes and ${connections.length} connections`,
    };
  }

  /**
   * Detect shapes in diagram
   */
  private async detectShapes(imageData: Uint8Array): Promise<DiagramShape[]> {
    // In production, this would use edge detection and shape recognition
    return [];
  }

  /**
   * Detect connections between shapes
   */
  private detectConnections(shapes: DiagramShape[]): DiagramConnection[] {
    // In production, this would analyze lines between shapes
    return [];
  }

  /**
   * Classify diagram type
   */
  private classifyDiagramType(shapes: DiagramShape[], connections: DiagramConnection[]): DiagramAnalysis['type'] {
    // Analyze shape and connection patterns to determine diagram type
    if (connections.length > shapes.length * 0.8) {
      return 'flowchart';
    }
    return 'unknown';
  }

  // ==========================================================================
  // Entity Extraction
  // ==========================================================================

  /**
   * Extract entities from OCR text
   */
  private extractEntitiesFromText(text: string): ExtractedImageEntity[] {
    const entities: ExtractedImageEntity[] = [];

    // Extract emails
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailPattern.exec(text)) !== null) {
      entities.push({
        type: 'email',
        value: match[0],
        confidence: 0.9,
        source: 'ocr',
      });
    }

    // Extract phone numbers
    const phonePattern = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    while ((match = phonePattern.exec(text)) !== null) {
      entities.push({
        type: 'phone',
        value: match[0],
        confidence: 0.85,
        source: 'ocr',
      });
    }

    // Extract URLs
    const urlPattern = /https?:\/\/[^\s<>"]+/gi;
    while ((match = urlPattern.exec(text)) !== null) {
      entities.push({
        type: 'url',
        value: match[0],
        confidence: 0.9,
        source: 'ocr',
      });
    }

    // Extract dates
    const datePattern = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
    while ((match = datePattern.exec(text)) !== null) {
      entities.push({
        type: 'date',
        value: match[0],
        confidence: 0.8,
        source: 'ocr',
      });
    }

    // Extract numbers (potential monetary values, percentages, etc.)
    const numberPattern = /\$[\d,]+(?:\.\d{2})?|\d+(?:\.\d+)?%|\d{3,}/g;
    while ((match = numberPattern.exec(text)) !== null) {
      entities.push({
        type: 'number',
        value: match[0],
        confidence: 0.75,
        source: 'ocr',
      });
    }

    return entities;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get image data as Uint8Array
   */
  private async getImageData(input: ImageInput): Promise<Uint8Array> {
    if (input.data) {
      if (input.data instanceof Uint8Array) {
        return input.data;
      }
      if (input.data instanceof ArrayBuffer) {
        return new Uint8Array(input.data);
      }
      return new Uint8Array(input.data);
    }

    if (input.base64) {
      const binary = Buffer.from(input.base64, 'base64');
      return new Uint8Array(binary);
    }

    if (input.url) {
      const response = await fetch(input.url);
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    }

    throw new Error('No image data provided');
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(imageData: Uint8Array): Promise<{ width: number; height: number }> {
    // Parse image header to get dimensions

    // PNG
    if (imageData[0] === 0x89 && imageData[1] === 0x50 && imageData[2] === 0x4E && imageData[3] === 0x47) {
      const width = (imageData[16] << 24) | (imageData[17] << 16) | (imageData[18] << 8) | imageData[19];
      const height = (imageData[20] << 24) | (imageData[21] << 16) | (imageData[22] << 8) | imageData[23];
      return { width, height };
    }

    // JPEG - more complex, need to find SOF marker
    if (imageData[0] === 0xFF && imageData[1] === 0xD8) {
      let i = 2;
      while (i < imageData.length - 8) {
        if (imageData[i] === 0xFF) {
          const marker = imageData[i + 1];
          // SOF0 or SOF2 marker
          if (marker === 0xC0 || marker === 0xC2) {
            const height = (imageData[i + 5] << 8) | imageData[i + 6];
            const width = (imageData[i + 7] << 8) | imageData[i + 8];
            return { width, height };
          }
          // Skip to next marker
          const length = (imageData[i + 2] << 8) | imageData[i + 3];
          i += 2 + length;
        } else {
          i++;
        }
      }
    }

    // Default/fallback
    return { width: 0, height: 0 };
  }

  /**
   * Generate processing ID
   */
  private generateProcessingId(): string {
    return `img-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(input: ImageInput): string {
    const parts: any = {};

    if (input.url) {
      parts.url = input.url;
    }
    if (input.filename) {
      parts.filename = input.filename;
    }
    if (input.base64) {
      // Use hash of first 500 chars for uniqueness
      parts.hash = this.hashString(input.base64.substring(0, 500));
    }

    return `image:${hashObject(parts)}`;
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
 * Create an ImageProcessor instance
 */
export function createImageProcessor(options?: {
  cacheEnabled?: boolean;
  cacheTTL?: number;
}): ImageProcessor {
  return new ImageProcessor(options);
}

export default ImageProcessor;
