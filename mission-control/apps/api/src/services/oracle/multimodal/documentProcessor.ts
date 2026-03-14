/**
 * ORACLE Document Processor
 * Handles document parsing, text extraction, and analysis
 *
 * Features:
 * - PDF text extraction
 * - Word/Excel parsing
 * - Markdown/HTML processing
 * - Table data extraction
 * - Document summarization
 * - Key points extraction
 * - Action item detection from documents
 *
 * @module services/oracle/multimodal/documentProcessor
 */

import { oracleCacheService, hashObject } from '../cache';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Document input for processing
 */
export interface DocumentInput {
  data?: Buffer | ArrayBuffer | Uint8Array;
  base64?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
  text?: string;
}

/**
 * Document type
 */
export type DocumentType = 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls' | 'pptx' | 'ppt' | 'txt' | 'md' | 'html' | 'csv' | 'json' | 'xml' | 'rtf' | 'unknown';

/**
 * Extracted table data
 */
export interface ExtractedTable {
  id: string;
  headers: string[];
  rows: string[][];
  rowCount: number;
  columnCount: number;
  summary?: string;
}

/**
 * Document section
 */
export interface DocumentSection {
  type: 'heading' | 'paragraph' | 'list' | 'table' | 'code' | 'quote' | 'image';
  level?: number; // For headings
  content: string;
  items?: string[]; // For lists
  table?: ExtractedTable;
}

/**
 * Document structure
 */
export interface DocumentStructure {
  title?: string;
  author?: string;
  date?: string;
  pageCount?: number;
  wordCount: number;
  sections: DocumentSection[];
  tableOfContents?: string[];
}

/**
 * Extracted action item from document
 */
export interface DocumentActionItem {
  id: string;
  text: string;
  type: 'task' | 'decision' | 'follow_up' | 'review' | 'meeting' | 'deadline';
  priority: 'high' | 'medium' | 'low';
  owner?: string;
  deadline?: {
    text: string;
    date: Date | null;
  };
  context: string;
  confidence: number;
}

/**
 * Extracted entity from document
 */
export interface DocumentEntity {
  type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'percentage' | 'email' | 'phone' | 'url';
  value: string;
  confidence: number;
  occurrences: number;
}

/**
 * Document summary
 */
export interface DocumentSummary {
  brief: string; // 1-2 sentences
  detailed: string; // Full summary
  keyPoints: string[];
  topics: string[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
}

/**
 * Document processing result
 */
export interface DocumentProcessingResult {
  processingId: string;
  filename?: string;
  url?: string;
  documentType: DocumentType;
  text: string;
  structure: DocumentStructure;
  tables: ExtractedTable[];
  summary?: DocumentSummary;
  keyPoints?: string[];
  actionItems: DocumentActionItem[];
  entities: DocumentEntity[];
  metadata: Record<string, any>;
}

/**
 * Processing options
 */
export interface DocumentProcessingOptions {
  extractText?: boolean;
  extractTables?: boolean;
  extractStructure?: boolean;
  generateSummary?: boolean;
  extractKeyPoints?: boolean;
  extractActionItems?: boolean;
  extractEntities?: boolean;
  maxPages?: number;
  onProgress?: (progress: number) => void;
}

// ============================================================================
// Document Processor Class
// ============================================================================

/**
 * DocumentProcessor - Handles document parsing and analysis
 *
 * Supports various document formats and extracts structured
 * information, summaries, and action items.
 */
export class DocumentProcessor {
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
   * Process a document through the analysis pipeline
   */
  async process(
    input: DocumentInput,
    options: DocumentProcessingOptions = {}
  ): Promise<DocumentProcessingResult> {
    const processingId = this.generateProcessingId();

    // Default options
    const opts: DocumentProcessingOptions = {
      extractText: true,
      extractTables: true,
      extractStructure: true,
      generateSummary: true,
      extractKeyPoints: true,
      extractActionItems: true,
      extractEntities: true,
      maxPages: 100,
      ...options,
    };

    // Check cache
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(input);
      const cached = oracleCacheService.get<DocumentProcessingResult>(cacheKey);
      if (cached) {
        opts.onProgress?.(100);
        return { ...cached, processingId };
      }
    }

    // Detect document type
    const documentType = this.detectDocumentType(input);
    opts.onProgress?.(5);

    // Extract text based on document type
    let text = '';
    let tables: ExtractedTable[] = [];
    let structure: DocumentStructure;

    if (input.text) {
      text = input.text;
    } else {
      const extracted = await this.extractContent(input, documentType, opts);
      text = extracted.text;
      tables = extracted.tables;
    }
    opts.onProgress?.(30);

    // Extract structure
    if (opts.extractStructure) {
      structure = this.extractStructure(text, documentType);
    } else {
      structure = {
        wordCount: text.split(/\s+/).length,
        sections: [],
      };
    }
    opts.onProgress?.(40);

    // Extract additional tables from text if needed
    if (opts.extractTables && tables.length === 0) {
      tables = this.extractTablesFromText(text);
    }
    opts.onProgress?.(50);

    // Initialize result
    const result: DocumentProcessingResult = {
      processingId,
      filename: input.filename,
      url: input.url,
      documentType,
      text,
      structure,
      tables,
      actionItems: [],
      entities: [],
      metadata: {},
    };

    // Generate summary
    if (opts.generateSummary) {
      result.summary = this.generateSummary(text, structure);
      opts.onProgress?.(60);
    }

    // Extract key points
    if (opts.extractKeyPoints) {
      result.keyPoints = this.extractKeyPoints(text, structure);
      opts.onProgress?.(70);
    }

    // Extract action items
    if (opts.extractActionItems) {
      result.actionItems = this.extractActionItems(text, processingId);
      opts.onProgress?.(80);
    }

    // Extract entities
    if (opts.extractEntities) {
      result.entities = this.extractEntities(text);
      opts.onProgress?.(90);
    }

    // Compile metadata
    result.metadata = {
      documentType,
      wordCount: structure.wordCount,
      pageCount: structure.pageCount,
      tableCount: tables.length,
      actionItemCount: result.actionItems.length,
      entityCount: result.entities.length,
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
  // Document Type Detection
  // ==========================================================================

  /**
   * Detect document type from input
   */
  private detectDocumentType(input: DocumentInput): DocumentType {
    // Check MIME type
    if (input.mimeType) {
      const mimeMap: Record<string, DocumentType> = {
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'text/plain': 'txt',
        'text/markdown': 'md',
        'text/html': 'html',
        'text/csv': 'csv',
        'application/json': 'json',
        'application/xml': 'xml',
        'text/xml': 'xml',
        'application/rtf': 'rtf',
      };

      const type = mimeMap[input.mimeType.toLowerCase()];
      if (type) return type;
    }

    // Check filename extension
    if (input.filename) {
      const ext = input.filename.split('.').pop()?.toLowerCase();
      if (ext) {
        const extMap: Record<string, DocumentType> = {
          pdf: 'pdf',
          doc: 'doc',
          docx: 'docx',
          xls: 'xls',
          xlsx: 'xlsx',
          ppt: 'ppt',
          pptx: 'pptx',
          txt: 'txt',
          md: 'md',
          markdown: 'md',
          html: 'html',
          htm: 'html',
          csv: 'csv',
          json: 'json',
          xml: 'xml',
          rtf: 'rtf',
        };
        if (ext in extMap) return extMap[ext];
      }
    }

    // Check magic bytes if data available
    if (input.data || input.base64) {
      const bytes = this.getFirstBytes(input);
      if (bytes) {
        // PDF: %PDF
        if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
          return 'pdf';
        }
        // ZIP-based (docx, xlsx, pptx)
        if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
          // Would need to check internal structure to differentiate
          return 'docx'; // Default to docx
        }
        // RTF
        if (bytes[0] === 0x7B && bytes[1] === 0x5C && bytes[2] === 0x72 && bytes[3] === 0x74 && bytes[4] === 0x66) {
          return 'rtf';
        }
      }
    }

    // Check if it's plain text
    if (input.text) {
      // Try to detect format from content
      if (input.text.startsWith('{') || input.text.startsWith('[')) {
        return 'json';
      }
      if (input.text.startsWith('<?xml') || input.text.startsWith('<')) {
        return input.text.includes('<html') ? 'html' : 'xml';
      }
      if (input.text.includes('# ') || input.text.includes('## ')) {
        return 'md';
      }
      return 'txt';
    }

    return 'unknown';
  }

  /**
   * Get first bytes of content
   */
  private getFirstBytes(input: DocumentInput): Uint8Array | null {
    if (input.data) {
      if (input.data instanceof Uint8Array) {
        return input.data.slice(0, 10);
      }
      return new Uint8Array(input.data).slice(0, 10);
    }
    if (input.base64) {
      const binary = Buffer.from(input.base64.substring(0, 20), 'base64');
      return new Uint8Array(binary);
    }
    return null;
  }

  // ==========================================================================
  // Content Extraction
  // ==========================================================================

  /**
   * Extract text content from document
   */
  private async extractContent(
    input: DocumentInput,
    documentType: DocumentType,
    options: DocumentProcessingOptions
  ): Promise<{ text: string; tables: ExtractedTable[] }> {
    switch (documentType) {
      case 'pdf':
        return this.extractPdfContent(input, options);
      case 'docx':
      case 'doc':
        return this.extractWordContent(input, options);
      case 'xlsx':
      case 'xls':
        return this.extractExcelContent(input, options);
      case 'pptx':
      case 'ppt':
        return this.extractPowerPointContent(input, options);
      case 'html':
        return this.extractHtmlContent(input);
      case 'md':
        return this.extractMarkdownContent(input);
      case 'csv':
        return this.extractCsvContent(input);
      case 'json':
        return this.extractJsonContent(input);
      case 'xml':
        return this.extractXmlContent(input);
      case 'txt':
      case 'rtf':
      default:
        return this.extractPlainTextContent(input);
    }
  }

  /**
   * Extract PDF content
   * Note: In production, use pdf-parse or similar library
   */
  private async extractPdfContent(
    input: DocumentInput,
    options: DocumentProcessingOptions
  ): Promise<{ text: string; tables: ExtractedTable[] }> {
    // In production:
    // const pdfParse = require('pdf-parse');
    // const dataBuffer = this.getBuffer(input);
    // const data = await pdfParse(dataBuffer, { max: options.maxPages });
    // return { text: data.text, tables: [] };

    // Placeholder - would be populated by actual PDF parser
    return {
      text: '',
      tables: [],
    };
  }

  /**
   * Extract Word document content
   * Note: In production, use mammoth or similar library
   */
  private async extractWordContent(
    input: DocumentInput,
    options: DocumentProcessingOptions
  ): Promise<{ text: string; tables: ExtractedTable[] }> {
    // In production:
    // const mammoth = require('mammoth');
    // const buffer = this.getBuffer(input);
    // const result = await mammoth.extractRawText({ buffer });
    // return { text: result.value, tables: [] };

    return {
      text: '',
      tables: [],
    };
  }

  /**
   * Extract Excel content
   * Note: In production, use xlsx or similar library
   */
  private async extractExcelContent(
    input: DocumentInput,
    options: DocumentProcessingOptions
  ): Promise<{ text: string; tables: ExtractedTable[] }> {
    // In production:
    // const XLSX = require('xlsx');
    // const buffer = this.getBuffer(input);
    // const workbook = XLSX.read(buffer, { type: 'buffer' });
    // ... process sheets

    return {
      text: '',
      tables: [],
    };
  }

  /**
   * Extract PowerPoint content
   */
  private async extractPowerPointContent(
    input: DocumentInput,
    options: DocumentProcessingOptions
  ): Promise<{ text: string; tables: ExtractedTable[] }> {
    // Would use a library like pptx or officegen
    return {
      text: '',
      tables: [],
    };
  }

  /**
   * Extract HTML content
   */
  private async extractHtmlContent(input: DocumentInput): Promise<{ text: string; tables: ExtractedTable[] }> {
    const html = await this.getTextContent(input);
    const text = this.stripHtml(html);
    const tables = this.extractTablesFromHtml(html);

    return { text, tables };
  }

  /**
   * Strip HTML tags
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract tables from HTML
   */
  private extractTablesFromHtml(html: string): ExtractedTable[] {
    const tables: ExtractedTable[] = [];
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let tableMatch;
    let tableId = 0;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const tableHtml = tableMatch[1];
      const rows: string[][] = [];
      let headers: string[] = [];

      // Extract headers
      const headerMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
      if (headerMatch) {
        const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
        let thMatch;
        while ((thMatch = thRegex.exec(headerMatch[1])) !== null) {
          headers.push(this.stripHtml(thMatch[1]).trim());
        }
      }

      // Extract rows
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const cells: string[] = [];
        const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
          cells.push(this.stripHtml(cellMatch[1]).trim());
        }
        if (cells.length > 0) {
          if (headers.length === 0) {
            headers = cells;
          } else {
            rows.push(cells);
          }
        }
      }

      if (headers.length > 0 || rows.length > 0) {
        tables.push({
          id: `table-${tableId++}`,
          headers,
          rows,
          rowCount: rows.length,
          columnCount: Math.max(headers.length, rows[0]?.length || 0),
        });
      }
    }

    return tables;
  }

  /**
   * Extract Markdown content
   */
  private async extractMarkdownContent(input: DocumentInput): Promise<{ text: string; tables: ExtractedTable[] }> {
    const markdown = await this.getTextContent(input);

    // Convert markdown to plain text (remove formatting)
    const text = markdown
      .replace(/^#+\s*/gm, '') // Remove headings
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/`(.+?)`/g, '$1') // Remove inline code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Convert links to text
      .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\s*\d+\.\s+/gm, ''); // Remove numbered list markers

    const tables = this.extractTablesFromMarkdown(markdown);

    return { text, tables };
  }

  /**
   * Extract tables from Markdown
   */
  private extractTablesFromMarkdown(markdown: string): ExtractedTable[] {
    const tables: ExtractedTable[] = [];
    const lines = markdown.split('\n');
    let tableId = 0;
    let currentTable: { headers: string[]; rows: string[][] } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check if line is a table row
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map(c => c.trim());

        // Skip separator rows
        if (cells.every(c => /^[-:]+$/.test(c))) {
          continue;
        }

        if (!currentTable) {
          currentTable = { headers: cells, rows: [] };
        } else {
          currentTable.rows.push(cells);
        }
      } else if (currentTable) {
        // End of table
        tables.push({
          id: `table-${tableId++}`,
          headers: currentTable.headers,
          rows: currentTable.rows,
          rowCount: currentTable.rows.length,
          columnCount: currentTable.headers.length,
        });
        currentTable = null;
      }
    }

    // Don't forget last table
    if (currentTable) {
      tables.push({
        id: `table-${tableId++}`,
        headers: currentTable.headers,
        rows: currentTable.rows,
        rowCount: currentTable.rows.length,
        columnCount: currentTable.headers.length,
      });
    }

    return tables;
  }

  /**
   * Extract CSV content
   */
  private async extractCsvContent(input: DocumentInput): Promise<{ text: string; tables: ExtractedTable[] }> {
    const csv = await this.getTextContent(input);
    const lines = csv.split('\n').filter(l => l.trim());

    if (lines.length === 0) {
      return { text: '', tables: [] };
    }

    // Parse CSV
    const parseRow = (row: string): string[] => {
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    };

    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);

    const table: ExtractedTable = {
      id: 'table-0',
      headers,
      rows,
      rowCount: rows.length,
      columnCount: headers.length,
    };

    // Convert to text
    const text = lines.join('\n');

    return { text, tables: [table] };
  }

  /**
   * Extract JSON content
   */
  private async extractJsonContent(input: DocumentInput): Promise<{ text: string; tables: ExtractedTable[] }> {
    const jsonStr = await this.getTextContent(input);

    try {
      const data = JSON.parse(jsonStr);
      const text = this.jsonToText(data);

      // If array of objects, treat as table
      const tables: ExtractedTable[] = [];
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        const headers = Object.keys(data[0]);
        const rows = data.map(item =>
          headers.map(h => String(item[h] ?? ''))
        );

        tables.push({
          id: 'table-0',
          headers,
          rows,
          rowCount: rows.length,
          columnCount: headers.length,
        });
      }

      return { text, tables };
    } catch {
      return { text: jsonStr, tables: [] };
    }
  }

  /**
   * Convert JSON to readable text
   */
  private jsonToText(data: any, indent: number = 0): string {
    const prefix = '  '.repeat(indent);

    if (data === null || data === undefined) {
      return 'null';
    }

    if (typeof data !== 'object') {
      return String(data);
    }

    if (Array.isArray(data)) {
      return data.map((item, i) => `${prefix}[${i}]: ${this.jsonToText(item, indent + 1)}`).join('\n');
    }

    return Object.entries(data)
      .map(([key, value]) => `${prefix}${key}: ${this.jsonToText(value, indent + 1)}`)
      .join('\n');
  }

  /**
   * Extract XML content
   */
  private async extractXmlContent(input: DocumentInput): Promise<{ text: string; tables: ExtractedTable[] }> {
    const xml = await this.getTextContent(input);

    // Strip XML tags to get text
    const text = xml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { text, tables: [] };
  }

  /**
   * Extract plain text content
   */
  private async extractPlainTextContent(input: DocumentInput): Promise<{ text: string; tables: ExtractedTable[] }> {
    const text = await this.getTextContent(input);
    return { text, tables: [] };
  }

  /**
   * Get text content from input
   */
  private async getTextContent(input: DocumentInput): Promise<string> {
    if (input.text) {
      return input.text;
    }

    if (input.data) {
      if (input.data instanceof Uint8Array) {
        return new TextDecoder().decode(input.data);
      }
      if (input.data instanceof ArrayBuffer) {
        return new TextDecoder().decode(new Uint8Array(input.data));
      }
      return (input.data as Buffer).toString('utf-8');
    }

    if (input.base64) {
      const binary = Buffer.from(input.base64, 'base64');
      return binary.toString('utf-8');
    }

    if (input.url) {
      const response = await fetch(input.url);
      return response.text();
    }

    return '';
  }

  // ==========================================================================
  // Structure Extraction
  // ==========================================================================

  /**
   * Extract document structure
   */
  private extractStructure(text: string, documentType: DocumentType): DocumentStructure {
    const sections: DocumentSection[] = [];
    const lines = text.split('\n');

    let currentSection: DocumentSection | null = null;
    let tocItems: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect headings
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/) ||
                           (documentType === 'txt' && trimmed.match(/^([A-Z][^a-z]*):?\s*$/));

      if (headingMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }

        const level = headingMatch[1].startsWith('#') ? headingMatch[1].length : 1;
        const content = headingMatch[2] || headingMatch[0];

        currentSection = {
          type: 'heading',
          level,
          content,
        };

        tocItems.push(content);
        continue;
      }

      // Detect lists
      const listMatch = trimmed.match(/^[-*+]\s+(.+)/) || trimmed.match(/^\d+\.\s+(.+)/);
      if (listMatch) {
        if (!currentSection || currentSection.type !== 'list') {
          if (currentSection) {
            sections.push(currentSection);
          }
          currentSection = {
            type: 'list',
            content: '',
            items: [],
          };
        }
        currentSection.items!.push(listMatch[1]);
        continue;
      }

      // Detect code blocks
      if (trimmed.startsWith('```') || trimmed.startsWith('    ')) {
        if (currentSection && currentSection.type !== 'code') {
          sections.push(currentSection);
        }
        currentSection = {
          type: 'code',
          content: trimmed.replace(/^```\w*/, '').replace(/```$/, ''),
        };
        continue;
      }

      // Detect quotes
      if (trimmed.startsWith('>')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          type: 'quote',
          content: trimmed.replace(/^>\s*/, ''),
        };
        continue;
      }

      // Regular paragraph
      if (!currentSection || currentSection.type !== 'paragraph') {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          type: 'paragraph',
          content: trimmed,
        };
      } else {
        currentSection.content += ' ' + trimmed;
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    // Extract title from first heading or first line
    const title = sections.find(s => s.type === 'heading')?.content ||
                  lines[0]?.trim().substring(0, 100);

    return {
      title,
      wordCount: text.split(/\s+/).length,
      sections,
      tableOfContents: tocItems.length > 0 ? tocItems : undefined,
    };
  }

  /**
   * Extract tables from text (tab/space delimited)
   */
  private extractTablesFromText(text: string): ExtractedTable[] {
    const tables: ExtractedTable[] = [];
    const lines = text.split('\n');
    let tableId = 0;

    let potentialTable: string[][] = [];
    let consistentColumns = -1;

    for (const line of lines) {
      // Check for tab-delimited or consistent spacing
      const cells = line.split(/\t|  +/).map(c => c.trim()).filter(c => c);

      if (cells.length >= 2) {
        if (consistentColumns === -1) {
          consistentColumns = cells.length;
          potentialTable.push(cells);
        } else if (cells.length === consistentColumns || Math.abs(cells.length - consistentColumns) <= 1) {
          potentialTable.push(cells);
        } else {
          // End of table
          if (potentialTable.length >= 2) {
            tables.push({
              id: `table-${tableId++}`,
              headers: potentialTable[0],
              rows: potentialTable.slice(1),
              rowCount: potentialTable.length - 1,
              columnCount: potentialTable[0].length,
            });
          }
          potentialTable = [cells];
          consistentColumns = cells.length;
        }
      } else {
        // End of potential table
        if (potentialTable.length >= 2) {
          tables.push({
            id: `table-${tableId++}`,
            headers: potentialTable[0],
            rows: potentialTable.slice(1),
            rowCount: potentialTable.length - 1,
            columnCount: potentialTable[0].length,
          });
        }
        potentialTable = [];
        consistentColumns = -1;
      }
    }

    // Don't forget last table
    if (potentialTable.length >= 2) {
      tables.push({
        id: `table-${tableId++}`,
        headers: potentialTable[0],
        rows: potentialTable.slice(1),
        rowCount: potentialTable.length - 1,
        columnCount: potentialTable[0].length,
      });
    }

    return tables;
  }

  // ==========================================================================
  // Summary Generation
  // ==========================================================================

  /**
   * Generate document summary
   */
  private generateSummary(text: string, structure: DocumentStructure): DocumentSummary {
    // Extract sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const cleanSentences = sentences.map(s => s.trim()).filter(s => s.length > 20);

    // Brief summary: first 1-2 meaningful sentences
    const brief = cleanSentences.slice(0, 2).join(' ').substring(0, 300);

    // Detailed summary: extract key sentences from each section
    const sectionSentences: string[] = [];
    for (const section of structure.sections) {
      if (section.type === 'paragraph' || section.type === 'heading') {
        const sectionSents = section.content.match(/[^.!?]+[.!?]+/g) || [];
        if (sectionSents.length > 0) {
          sectionSentences.push(sectionSents[0]!.trim());
        }
      }
    }
    const detailed = sectionSentences.slice(0, 5).join(' ').substring(0, 1000) || brief;

    // Extract topics from headings
    const topics = structure.sections
      .filter(s => s.type === 'heading')
      .map(s => s.content)
      .slice(0, 10);

    // Simple sentiment analysis
    const sentiment = this.analyzeSentiment(text);

    // Key points
    const keyPoints = this.extractKeyPoints(text, structure);

    return {
      brief,
      detailed,
      keyPoints,
      topics,
      sentiment,
    };
  }

  /**
   * Simple sentiment analysis
   */
  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' | 'mixed' {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'positive', 'success', 'improve', 'benefit', 'advantage', 'happy', 'pleased'];
    const negativeWords = ['bad', 'poor', 'terrible', 'awful', 'negative', 'fail', 'problem', 'issue', 'concern', 'risk', 'difficult', 'challenge', 'unfortunately'];

    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      if (positiveWords.some(p => word.includes(p))) {
        positiveCount++;
      }
      if (negativeWords.some(n => word.includes(n))) {
        negativeCount++;
      }
    }

    const total = positiveCount + negativeCount;
    if (total === 0) return 'neutral';

    const ratio = positiveCount / total;
    if (ratio > 0.6) return 'positive';
    if (ratio < 0.4) return 'negative';
    if (positiveCount > 0 && negativeCount > 0) return 'mixed';
    return 'neutral';
  }

  // ==========================================================================
  // Key Points Extraction
  // ==========================================================================

  /**
   * Extract key points from document
   */
  private extractKeyPoints(text: string, structure: DocumentStructure): string[] {
    const keyPoints: string[] = [];

    // Extract from headings
    for (const section of structure.sections) {
      if (section.type === 'heading' && section.level && section.level <= 2) {
        keyPoints.push(section.content);
      }
    }

    // Extract from list items
    for (const section of structure.sections) {
      if (section.type === 'list' && section.items) {
        for (const item of section.items.slice(0, 5)) {
          if (item.length > 10 && item.length < 200) {
            keyPoints.push(item);
          }
        }
      }
    }

    // Extract sentences with key indicators
    const keyIndicators = [
      /\bimportant\b/i,
      /\bkey\b/i,
      /\bmain\b/i,
      /\bcrucial\b/i,
      /\bessential\b/i,
      /\bcritical\b/i,
      /\bin summary\b/i,
      /\bconclusion\b/i,
      /\bto summarize\b/i,
      /\bnote that\b/i,
    ];

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    for (const sentence of sentences) {
      if (keyIndicators.some(p => p.test(sentence)) && sentence.length < 300) {
        const trimmed = sentence.trim();
        if (!keyPoints.includes(trimmed)) {
          keyPoints.push(trimmed);
        }
      }
    }

    return keyPoints.slice(0, 15);
  }

  // ==========================================================================
  // Action Item Extraction
  // ==========================================================================

  /**
   * Extract action items from document
   */
  private extractActionItems(text: string, processingId: string): DocumentActionItem[] {
    const actionItems: DocumentActionItem[] = [];
    let itemId = 0;

    const patterns: Array<{
      pattern: RegExp;
      type: DocumentActionItem['type'];
      priority: DocumentActionItem['priority'];
    }> = [
      // Direct action items
      { pattern: /\baction item[s]?:\s*(.{10,200})/gi, type: 'task', priority: 'high' },
      { pattern: /\btodo[s]?:\s*(.{10,200})/gi, type: 'task', priority: 'medium' },
      { pattern: /\btask[s]?:\s*(.{10,200})/gi, type: 'task', priority: 'medium' },

      // Requests
      { pattern: /please\s+(.{10,150}?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'medium' },
      { pattern: /(?:need|needs) to\s+(.{10,150}?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'high' },
      { pattern: /(?:must|should|shall)\s+(.{10,150}?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'high' },

      // Decisions
      { pattern: /\bdecision[s]? (?:needed|required):\s*(.{10,200})/gi, type: 'decision', priority: 'high' },
      { pattern: /\bneed[s]? (?:a |to )?decision?\s+(.{10,150}?)(?:[.!?\n]|$)/gi, type: 'decision', priority: 'high' },

      // Follow-ups
      { pattern: /\bfollow[- ]?up[s]?:\s*(.{10,200})/gi, type: 'follow_up', priority: 'medium' },
      { pattern: /\bfollow[- ]?up (?:on|with|about)\s+(.{10,150}?)(?:[.!?\n]|$)/gi, type: 'follow_up', priority: 'medium' },

      // Reviews
      { pattern: /\breview[s]? (?:needed|required):\s*(.{10,200})/gi, type: 'review', priority: 'medium' },
      { pattern: /please review\s+(.{10,150}?)(?:[.!?\n]|$)/gi, type: 'review', priority: 'medium' },

      // Meetings
      { pattern: /\bschedule[d]? (?:a |the )?meeting\s*(.{0,150}?)(?:[.!?\n]|$)/gi, type: 'meeting', priority: 'medium' },
      { pattern: /\bmeeting[s]? (?:needed|required|to be scheduled)\s*(.{0,150}?)(?:[.!?\n]|$)/gi, type: 'meeting', priority: 'medium' },

      // Deadlines
      { pattern: /\bdeadline[s]?:\s*(.{10,200})/gi, type: 'deadline', priority: 'high' },
      { pattern: /\bdue (?:date|by)[s]?:\s*(.{10,200})/gi, type: 'deadline', priority: 'high' },
    ];

    for (const { pattern, type, priority } of patterns) {
      let match;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(text)) !== null) {
        const actionText = match[1].trim();

        // Skip duplicates
        if (actionItems.some(item => item.text.toLowerCase() === actionText.toLowerCase())) {
          continue;
        }

        // Skip too short
        if (actionText.length < 10) continue;

        // Get context
        const contextStart = Math.max(0, match.index - 100);
        const contextEnd = Math.min(text.length, match.index + match[0].length + 100);
        const context = text.substring(contextStart, contextEnd);

        // Detect owner
        const owner = this.detectOwner(context);

        // Detect deadline
        const deadline = this.detectDeadline(context);

        // Adjust priority based on deadline
        let adjustedPriority = priority;
        if (deadline?.date) {
          const daysUntil = Math.ceil((deadline.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 1) adjustedPriority = 'high';
        }

        actionItems.push({
          id: `doc-action-${processingId}-${itemId++}`,
          text: actionText,
          type,
          priority: adjustedPriority,
          owner,
          deadline,
          context: context.trim(),
          confidence: 0.75,
        });
      }
    }

    return actionItems;
  }

  /**
   * Detect owner from context
   */
  private detectOwner(context: string): string | undefined {
    // Look for @mentions
    const mentionMatch = context.match(/@(\w+)/);
    if (mentionMatch) {
      return mentionMatch[1];
    }

    // Look for "assigned to" patterns
    const assignedMatch = context.match(/(?:assigned to|owner|responsible):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (assignedMatch) {
      return assignedMatch[1];
    }

    return undefined;
  }

  /**
   * Detect deadline from context
   */
  private detectDeadline(context: string): { text: string; date: Date | null } | undefined {
    // Look for date patterns
    const datePatterns = [
      { pattern: /by\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i, parse: (m: RegExpMatchArray) => new Date(parseInt(m[3], 10) < 100 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10), parseInt(m[1], 10) - 1, parseInt(m[2], 10)) },
      { pattern: /by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, parse: (m: RegExpMatchArray) => this.getNextWeekday(m[1].toLowerCase()) },
      { pattern: /by\s+(tomorrow|today|end of (?:day|week|month))/i, parse: (m: RegExpMatchArray) => this.parseRelativeDate(m[1]) },
      { pattern: /(?:due|deadline):\s*(.+?)(?:[.!?\n]|$)/i, parse: (m: RegExpMatchArray) => this.parseRelativeDate(m[1]) },
    ];

    for (const { pattern, parse } of datePatterns) {
      const match = context.match(pattern);
      if (match) {
        return {
          text: match[0],
          date: parse(match),
        };
      }
    }

    return undefined;
  }

  /**
   * Get next occurrence of a weekday
   */
  private getNextWeekday(day: string): Date {
    const days: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };

    const targetDay = days[day];
    const date = new Date();
    const currentDay = date.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;

    date.setDate(date.getDate() + daysUntil);
    return date;
  }

  /**
   * Parse relative date string
   */
  private parseRelativeDate(text: string): Date | null {
    const lowered = text.toLowerCase();
    const now = new Date();

    if (lowered.includes('today')) {
      return now;
    }

    if (lowered.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    if (lowered.includes('end of day') || lowered.includes('eod')) {
      const eod = new Date(now);
      eod.setHours(17, 0, 0, 0);
      return eod;
    }

    if (lowered.includes('end of week') || lowered.includes('eow')) {
      const friday = new Date(now);
      const currentDay = friday.getDay();
      const daysUntilFriday = (5 - currentDay + 7) % 7 || 7;
      friday.setDate(friday.getDate() + daysUntilFriday);
      return friday;
    }

    if (lowered.includes('end of month') || lowered.includes('eom')) {
      const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return eom;
    }

    return null;
  }

  // ==========================================================================
  // Entity Extraction
  // ==========================================================================

  /**
   * Extract entities from document text
   */
  private extractEntities(text: string): DocumentEntity[] {
    const entities = new Map<string, DocumentEntity>();

    const patterns: Array<{ type: DocumentEntity['type']; pattern: RegExp }> = [
      { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
      { type: 'phone', pattern: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
      { type: 'url', pattern: /https?:\/\/[^\s<>"]+/gi },
      { type: 'money', pattern: /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s*(?:million|billion|k|m|b))?/gi },
      { type: 'percentage', pattern: /\d+(?:\.\d+)?%/g },
      { type: 'date', pattern: /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g },
      { type: 'person', pattern: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g },
    ];

    for (const { type, pattern } of patterns) {
      let match;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(text)) !== null) {
        const value = match[0];
        const key = `${type}:${value.toLowerCase()}`;

        if (entities.has(key)) {
          entities.get(key)!.occurrences++;
        } else {
          entities.set(key, {
            type,
            value,
            confidence: 0.85,
            occurrences: 1,
          });
        }
      }
    }

    return Array.from(entities.values())
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Generate processing ID
   */
  private generateProcessingId(): string {
    return `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(input: DocumentInput): string {
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
    if (input.text) {
      parts.textHash = this.hashString(input.text.substring(0, 500));
    }

    return `doc:${hashObject(parts)}`;
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
 * Create a DocumentProcessor instance
 */
export function createDocumentProcessor(options?: {
  cacheEnabled?: boolean;
  cacheTTL?: number;
}): DocumentProcessor {
  return new DocumentProcessor(options);
}

export default DocumentProcessor;
