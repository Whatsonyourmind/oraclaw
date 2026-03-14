/**
 * ORACLE URL Processor
 * Handles web content ingestion and analysis
 *
 * Features:
 * - URL metadata extraction
 * - Article content parsing
 * - Social media post analysis
 * - Link preview generation
 * - Bookmark intelligence
 *
 * @module services/oracle/multimodal/urlProcessor
 */

import { oracleCacheService, hashObject } from '../cache';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * URL input for processing
 */
export interface URLInput {
  url?: string;
  html?: string;
  mimeType?: string;
  metadata?: Record<string, any>;
}

/**
 * URL metadata (Open Graph, meta tags, etc.)
 */
export interface URLMetadata {
  url: string;
  canonicalUrl?: string;
  title?: string;
  description?: string;
  author?: string;
  publishedDate?: string;
  modifiedDate?: string;
  siteName?: string;
  favicon?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  type?: string;
  locale?: string;
  keywords?: string[];
  twitter?: TwitterCard;
  openGraph?: OpenGraphData;
}

/**
 * Twitter card data
 */
export interface TwitterCard {
  card?: string;
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  image?: string;
}

/**
 * Open Graph data
 */
export interface OpenGraphData {
  title?: string;
  type?: string;
  url?: string;
  image?: string;
  description?: string;
  siteName?: string;
  locale?: string;
  article?: {
    author?: string;
    publishedTime?: string;
    modifiedTime?: string;
    section?: string;
    tags?: string[];
  };
}

/**
 * Extracted article content
 */
export interface ArticleContent {
  title: string;
  content: string;
  plainText: string;
  author?: string;
  publishedDate?: string;
  readingTime: number; // minutes
  wordCount: number;
  images: ArticleImage[];
  links: ExtractedLink[];
  sections: ArticleSection[];
}

/**
 * Article image
 */
export interface ArticleImage {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

/**
 * Extracted link
 */
export interface ExtractedLink {
  url: string;
  text: string;
  isExternal: boolean;
  domain?: string;
}

/**
 * Article section
 */
export interface ArticleSection {
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'code' | 'image';
  content: string;
  level?: number;
}

/**
 * Social media post analysis
 */
export interface SocialMediaPost {
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'reddit' | 'youtube' | 'unknown';
  postType: 'post' | 'thread' | 'article' | 'video' | 'image' | 'poll' | 'story';
  author: {
    name?: string;
    handle?: string;
    profileUrl?: string;
    verified?: boolean;
  };
  content: string;
  timestamp?: string;
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
  media?: {
    type: 'image' | 'video' | 'gif';
    url: string;
  }[];
  hashtags: string[];
  mentions: string[];
  links: string[];
}

/**
 * Link preview data
 */
export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  type: 'article' | 'website' | 'video' | 'image' | 'social' | 'document' | 'unknown';
  domain: string;
}

/**
 * Bookmark intelligence
 */
export interface BookmarkIntelligence {
  url: string;
  title: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  relevanceScore: number;
  contentType: string;
  actionItems: ExtractedURLAction[];
  relatedTopics: string[];
  suggestedTags: string[];
}

/**
 * Action extracted from URL content
 */
export interface ExtractedURLAction {
  id: string;
  text: string;
  type: 'read' | 'watch' | 'listen' | 'buy' | 'sign_up' | 'download' | 'follow_up' | 'share';
  priority: 'high' | 'medium' | 'low';
  deadline?: string;
}

/**
 * URL processing result
 */
export interface URLProcessingResult {
  processingId: string;
  url: string;
  domain: string;
  metadata: URLMetadata;
  content?: string;
  article?: ArticleContent;
  socialPost?: SocialMediaPost;
  preview: LinkPreview;
  bookmark?: BookmarkIntelligence;
  summary?: string;
  keyPoints?: string[];
  entities: ExtractedURLEntity[];
  actionItems: ExtractedURLAction[];
  rawHtml?: string;
}

/**
 * Entity extracted from URL content
 */
export interface ExtractedURLEntity {
  type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'product' | 'event';
  value: string;
  confidence: number;
}

/**
 * Processing options
 */
export interface URLProcessingOptions {
  extractContent?: boolean;
  extractMetadata?: boolean;
  generatePreview?: boolean;
  analyzeLinks?: boolean;
  generateBookmark?: boolean;
  includedRawHtml?: boolean;
  timeout?: number;
  onProgress?: (progress: number) => void;
}

// ============================================================================
// URL Processor Class
// ============================================================================

/**
 * URLProcessor - Handles web content extraction and analysis
 *
 * Extracts structured content from URLs including articles,
 * social media posts, and generates intelligent bookmarks.
 */
export class URLProcessor {
  private cacheEnabled: boolean = true;
  private cacheTTL: number = 30 * 60 * 1000; // 30 minutes

  constructor(options: { cacheEnabled?: boolean; cacheTTL?: number } = {}) {
    this.cacheEnabled = options.cacheEnabled ?? true;
    this.cacheTTL = options.cacheTTL ?? 30 * 60 * 1000;
  }

  // ==========================================================================
  // Main Processing
  // ==========================================================================

  /**
   * Process URL through the analysis pipeline
   */
  async process(
    input: URLInput,
    options: URLProcessingOptions = {}
  ): Promise<URLProcessingResult> {
    const processingId = this.generateProcessingId();

    // Default options
    const opts: URLProcessingOptions = {
      extractContent: true,
      extractMetadata: true,
      generatePreview: true,
      analyzeLinks: true,
      generateBookmark: true,
      includedRawHtml: false,
      timeout: 10000,
      ...options,
    };

    if (!input.url && !input.html) {
      throw new Error('URL or HTML content required');
    }

    const url = input.url || '';
    const domain = this.extractDomain(url);

    // Check cache
    if (this.cacheEnabled && url) {
      const cacheKey = this.generateCacheKey(input);
      const cached = oracleCacheService.get<URLProcessingResult>(cacheKey);
      if (cached) {
        opts.onProgress?.(100);
        return { ...cached, processingId };
      }
    }

    // Fetch HTML if needed
    let html = input.html || '';
    if (!html && url) {
      opts.onProgress?.(10);
      html = await this.fetchHTML(url, opts.timeout);
      opts.onProgress?.(25);
    }

    // Initialize result
    const result: URLProcessingResult = {
      processingId,
      url,
      domain,
      metadata: { url },
      preview: {
        url,
        title: '',
        description: '',
        type: 'unknown',
        domain,
      },
      entities: [],
      actionItems: [],
    };

    if (opts.includedRawHtml) {
      result.rawHtml = html;
    }

    // Extract metadata
    if (opts.extractMetadata && html) {
      opts.onProgress?.(30);
      result.metadata = this.extractMetadata(url, html);
      opts.onProgress?.(40);
    }

    // Extract content
    if (opts.extractContent && html) {
      opts.onProgress?.(45);

      // Check if it's a social media post
      if (this.isSocialMediaUrl(url)) {
        result.socialPost = this.extractSocialMediaPost(url, html, result.metadata);
        result.content = result.socialPost.content;
      } else {
        // Extract article content
        result.article = this.extractArticleContent(html, result.metadata);
        result.content = result.article.plainText;
      }
      opts.onProgress?.(60);
    }

    // Generate preview
    if (opts.generatePreview) {
      opts.onProgress?.(65);
      result.preview = this.generatePreview(url, result.metadata, result.article, result.socialPost);
    }

    // Extract entities from content
    if (result.content) {
      opts.onProgress?.(70);
      result.entities = this.extractEntities(result.content);
    }

    // Extract action items
    if (result.content) {
      opts.onProgress?.(75);
      result.actionItems = this.extractActionItems(result.content, result.preview.type, processingId);
    }

    // Generate bookmark intelligence
    if (opts.generateBookmark && result.content) {
      opts.onProgress?.(80);
      result.bookmark = this.generateBookmarkIntelligence(result);
      result.summary = result.bookmark.summary;
      result.keyPoints = result.bookmark.keyPoints;
    } else if (result.content) {
      // Generate basic summary
      result.summary = this.generateSummary(result.content);
      result.keyPoints = this.extractKeyPoints(result.content);
    }

    // Cache result
    if (this.cacheEnabled && url) {
      const cacheKey = this.generateCacheKey(input);
      oracleCacheService.set(cacheKey, result, this.cacheTTL);
    }

    opts.onProgress?.(100);
    return result;
  }

  // ==========================================================================
  // HTML Fetching
  // ==========================================================================

  /**
   * Fetch HTML from URL
   */
  private async fetchHTML(url: string, timeout?: number): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout || 10000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ORACLE-Bot/1.0 (Content Analysis)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ==========================================================================
  // Metadata Extraction
  // ==========================================================================

  /**
   * Extract metadata from HTML
   */
  private extractMetadata(url: string, html: string): URLMetadata {
    const metadata: URLMetadata = { url };

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      metadata.title = this.decodeHtmlEntities(titleMatch[1].trim());
    }

    // Extract meta tags
    const metaRegex = /<meta\s+([^>]+)>/gi;
    let match;

    while ((match = metaRegex.exec(html)) !== null) {
      const attrs = this.parseAttributes(match[1]);

      const name = attrs.name || attrs.property || attrs['http-equiv'];
      const content = attrs.content;

      if (!content) continue;

      switch (name?.toLowerCase()) {
        case 'description':
          metadata.description = content;
          break;
        case 'author':
          metadata.author = content;
          break;
        case 'keywords':
          metadata.keywords = content.split(',').map(k => k.trim());
          break;

        // Open Graph
        case 'og:title':
          metadata.openGraph = metadata.openGraph || {};
          metadata.openGraph.title = content;
          break;
        case 'og:description':
          metadata.openGraph = metadata.openGraph || {};
          metadata.openGraph.description = content;
          break;
        case 'og:image':
          metadata.openGraph = metadata.openGraph || {};
          metadata.openGraph.image = content;
          metadata.image = metadata.image || content;
          break;
        case 'og:url':
          metadata.openGraph = metadata.openGraph || {};
          metadata.openGraph.url = content;
          metadata.canonicalUrl = metadata.canonicalUrl || content;
          break;
        case 'og:type':
          metadata.openGraph = metadata.openGraph || {};
          metadata.openGraph.type = content;
          metadata.type = content;
          break;
        case 'og:site_name':
          metadata.openGraph = metadata.openGraph || {};
          metadata.openGraph.siteName = content;
          metadata.siteName = content;
          break;
        case 'og:locale':
          metadata.openGraph = metadata.openGraph || {};
          metadata.openGraph.locale = content;
          metadata.locale = content;
          break;
        case 'article:author':
          metadata.openGraph = metadata.openGraph || {};
          metadata.openGraph.article = metadata.openGraph.article || {};
          metadata.openGraph.article.author = content;
          metadata.author = metadata.author || content;
          break;
        case 'article:published_time':
          metadata.openGraph = metadata.openGraph || {};
          metadata.openGraph.article = metadata.openGraph.article || {};
          metadata.openGraph.article.publishedTime = content;
          metadata.publishedDate = content;
          break;
        case 'article:modified_time':
          metadata.openGraph = metadata.openGraph || {};
          metadata.openGraph.article = metadata.openGraph.article || {};
          metadata.openGraph.article.modifiedTime = content;
          metadata.modifiedDate = content;
          break;
        case 'article:tag':
          metadata.openGraph = metadata.openGraph || {};
          metadata.openGraph.article = metadata.openGraph.article || {};
          metadata.openGraph.article.tags = metadata.openGraph.article.tags || [];
          metadata.openGraph.article.tags.push(content);
          break;

        // Twitter
        case 'twitter:card':
          metadata.twitter = metadata.twitter || {};
          metadata.twitter.card = content;
          break;
        case 'twitter:site':
          metadata.twitter = metadata.twitter || {};
          metadata.twitter.site = content;
          break;
        case 'twitter:creator':
          metadata.twitter = metadata.twitter || {};
          metadata.twitter.creator = content;
          break;
        case 'twitter:title':
          metadata.twitter = metadata.twitter || {};
          metadata.twitter.title = content;
          break;
        case 'twitter:description':
          metadata.twitter = metadata.twitter || {};
          metadata.twitter.description = content;
          break;
        case 'twitter:image':
          metadata.twitter = metadata.twitter || {};
          metadata.twitter.image = content;
          metadata.image = metadata.image || content;
          break;
      }
    }

    // Extract canonical URL
    const canonicalMatch = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (canonicalMatch) {
      metadata.canonicalUrl = canonicalMatch[1];
    }

    // Extract favicon
    const faviconMatch = html.match(/<link\s+[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
    if (faviconMatch) {
      metadata.favicon = this.resolveUrl(faviconMatch[1], url);
    }

    // Use OG data to fill in missing fields
    if (metadata.openGraph) {
      metadata.title = metadata.title || metadata.openGraph.title;
      metadata.description = metadata.description || metadata.openGraph.description;
    }

    // Use Twitter data to fill in missing fields
    if (metadata.twitter) {
      metadata.title = metadata.title || metadata.twitter.title;
      metadata.description = metadata.description || metadata.twitter.description;
    }

    return metadata;
  }

  /**
   * Parse HTML attributes
   */
  private parseAttributes(attrString: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const regex = /(\w+)=["']([^"']+)["']/g;
    let match;

    while ((match = regex.exec(attrString)) !== null) {
      attrs[match[1].toLowerCase()] = this.decodeHtmlEntities(match[2]);
    }

    return attrs;
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Resolve relative URL
   */
  private resolveUrl(url: string, base: string): string {
    try {
      return new URL(url, base).href;
    } catch {
      return url;
    }
  }

  // ==========================================================================
  // Content Extraction
  // ==========================================================================

  /**
   * Extract article content from HTML
   */
  private extractArticleContent(html: string, metadata: URLMetadata): ArticleContent {
    // Remove script, style, nav, header, footer
    let cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Try to find article content
    const articleMatch = cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const contentMatch = cleanHtml.match(/<div[^>]*class=["'][^"']*(?:content|post|article|entry)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    const contentHtml = articleMatch?.[1] || mainMatch?.[1] || contentMatch?.[1] || cleanHtml;

    // Extract plain text
    const plainText = this.extractPlainText(contentHtml);

    // Extract sections
    const sections = this.extractSections(contentHtml);

    // Extract images
    const images = this.extractImages(contentHtml, metadata.url || '');

    // Extract links
    const links = this.extractLinks(contentHtml, metadata.url || '');

    // Calculate reading time
    const wordCount = plainText.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200); // 200 wpm average

    return {
      title: metadata.title || '',
      content: contentHtml,
      plainText,
      author: metadata.author,
      publishedDate: metadata.publishedDate,
      readingTime,
      wordCount,
      images,
      links,
      sections,
    };
  }

  /**
   * Extract plain text from HTML
   */
  private extractPlainText(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract sections from HTML
   */
  private extractSections(html: string): ArticleSection[] {
    const sections: ArticleSection[] = [];

    // Extract headings
    const headingRegex = /<h([1-6])[^>]*>([^<]*)<\/h\1>/gi;
    let match;
    while ((match = headingRegex.exec(html)) !== null) {
      sections.push({
        type: 'heading',
        level: parseInt(match[1], 10),
        content: this.extractPlainText(match[2]),
      });
    }

    // Extract paragraphs
    const pRegex = /<p[^>]*>([^<]+(?:<[^\/][^>]*>[^<]*<\/[^>]+>[^<]*)*)<\/p>/gi;
    while ((match = pRegex.exec(html)) !== null) {
      const text = this.extractPlainText(match[1]);
      if (text.length > 20) {
        sections.push({
          type: 'paragraph',
          content: text,
        });
      }
    }

    // Extract blockquotes
    const quoteRegex = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;
    while ((match = quoteRegex.exec(html)) !== null) {
      sections.push({
        type: 'quote',
        content: this.extractPlainText(match[1]),
      });
    }

    return sections;
  }

  /**
   * Extract images from HTML
   */
  private extractImages(html: string, baseUrl: string): ArticleImage[] {
    const images: ArticleImage[] = [];
    const imgRegex = /<img\s+([^>]+)>/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      const attrs = this.parseAttributes(match[1]);
      if (attrs.src) {
        images.push({
          src: this.resolveUrl(attrs.src, baseUrl),
          alt: attrs.alt,
          width: attrs.width ? parseInt(attrs.width, 10) : undefined,
          height: attrs.height ? parseInt(attrs.height, 10) : undefined,
        });
      }
    }

    return images;
  }

  /**
   * Extract links from HTML
   */
  private extractLinks(html: string, baseUrl: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    const linkRegex = /<a\s+([^>]+)>([^<]*)<\/a>/gi;
    const baseDomain = this.extractDomain(baseUrl);
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const attrs = this.parseAttributes(match[1]);
      if (attrs.href && !attrs.href.startsWith('#') && !attrs.href.startsWith('javascript:')) {
        const fullUrl = this.resolveUrl(attrs.href, baseUrl);
        const domain = this.extractDomain(fullUrl);

        links.push({
          url: fullUrl,
          text: this.extractPlainText(match[2]),
          isExternal: domain !== baseDomain,
          domain,
        });
      }
    }

    return links;
  }

  // ==========================================================================
  // Social Media
  // ==========================================================================

  /**
   * Check if URL is social media
   */
  private isSocialMediaUrl(url: string): boolean {
    const socialDomains = [
      'twitter.com', 'x.com',
      'linkedin.com',
      'facebook.com', 'fb.com',
      'instagram.com',
      'reddit.com',
      'youtube.com', 'youtu.be',
      'tiktok.com',
      'threads.net',
    ];

    const domain = this.extractDomain(url);
    return socialDomains.some(d => domain.includes(d));
  }

  /**
   * Extract social media post
   */
  private extractSocialMediaPost(url: string, html: string, metadata: URLMetadata): SocialMediaPost {
    const platform = this.detectPlatform(url);

    // Basic extraction from metadata
    const post: SocialMediaPost = {
      platform,
      postType: 'post',
      author: {
        name: metadata.author || metadata.twitter?.creator,
        handle: metadata.twitter?.site,
      },
      content: metadata.description || this.extractPlainText(html).substring(0, 500),
      hashtags: [],
      mentions: [],
      links: [],
    };

    // Extract hashtags
    const hashtagMatch = post.content.match(/#\w+/g);
    if (hashtagMatch) {
      post.hashtags = hashtagMatch.map(h => h.substring(1));
    }

    // Extract mentions
    const mentionMatch = post.content.match(/@\w+/g);
    if (mentionMatch) {
      post.mentions = mentionMatch.map(m => m.substring(1));
    }

    // Detect post type from URL patterns
    if (url.includes('/video/') || url.includes('/watch')) {
      post.postType = 'video';
    } else if (url.includes('/thread/')) {
      post.postType = 'thread';
    } else if (url.includes('/article/') || url.includes('/pulse/')) {
      post.postType = 'article';
    }

    // Add media if image in metadata
    if (metadata.image) {
      post.media = [{
        type: 'image',
        url: metadata.image,
      }];
    }

    return post;
  }

  /**
   * Detect social platform from URL
   */
  private detectPlatform(url: string): SocialMediaPost['platform'] {
    const domain = this.extractDomain(url);

    if (domain.includes('twitter.com') || domain.includes('x.com')) return 'twitter';
    if (domain.includes('linkedin.com')) return 'linkedin';
    if (domain.includes('facebook.com') || domain.includes('fb.com')) return 'facebook';
    if (domain.includes('instagram.com')) return 'instagram';
    if (domain.includes('reddit.com')) return 'reddit';
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) return 'youtube';

    return 'unknown';
  }

  // ==========================================================================
  // Preview Generation
  // ==========================================================================

  /**
   * Generate link preview
   */
  private generatePreview(
    url: string,
    metadata: URLMetadata,
    article?: ArticleContent,
    socialPost?: SocialMediaPost
  ): LinkPreview {
    const domain = this.extractDomain(url);

    // Determine content type
    let type: LinkPreview['type'] = 'website';
    if (socialPost) {
      type = 'social';
    } else if (metadata.type === 'article' || article) {
      type = 'article';
    } else if (metadata.type === 'video' || url.includes('youtube') || url.includes('vimeo')) {
      type = 'video';
    } else if (url.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i)) {
      type = 'document';
    }

    return {
      url,
      title: metadata.title || domain,
      description: metadata.description || article?.plainText?.substring(0, 200) || '',
      image: metadata.image,
      favicon: metadata.favicon,
      siteName: metadata.siteName,
      type,
      domain,
    };
  }

  // ==========================================================================
  // Bookmark Intelligence
  // ==========================================================================

  /**
   * Generate bookmark intelligence
   */
  private generateBookmarkIntelligence(result: URLProcessingResult): BookmarkIntelligence {
    const content = result.content || '';

    // Generate summary
    const summary = this.generateSummary(content);

    // Extract key points
    const keyPoints = this.extractKeyPoints(content);

    // Extract topics
    const topics = this.extractTopics(content, result.metadata);

    // Calculate relevance score
    const relevanceScore = this.calculateRelevanceScore(result);

    // Generate suggested tags
    const suggestedTags = this.generateTags(result);

    // Find related topics
    const relatedTopics = this.findRelatedTopics(topics);

    return {
      url: result.url,
      title: result.metadata.title || result.domain,
      summary,
      keyPoints,
      topics,
      relevanceScore,
      contentType: result.preview.type,
      actionItems: result.actionItems,
      relatedTopics,
      suggestedTags,
    };
  }

  /**
   * Generate summary from content
   */
  private generateSummary(content: string): string {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    const cleanSentences = sentences
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 300);

    return cleanSentences.slice(0, 3).join(' ').substring(0, 500) || content.substring(0, 500);
  }

  /**
   * Extract key points
   */
  private extractKeyPoints(content: string): string[] {
    const keyPoints: string[] = [];
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];

    // Find sentences with key indicators
    const indicators = [
      /\bimportant\b/i,
      /\bkey\b/i,
      /\bmain\b/i,
      /\bcrucial\b/i,
      /\bessential\b/i,
      /\bnote\b/i,
      /\bremember\b/i,
      /\bhighlight\b/i,
    ];

    for (const sentence of sentences) {
      if (indicators.some(p => p.test(sentence)) && sentence.length < 200) {
        keyPoints.push(sentence.trim());
      }
    }

    // If no key points found, use first few sentences
    if (keyPoints.length === 0) {
      return sentences.slice(0, 5).map(s => s.trim());
    }

    return keyPoints.slice(0, 10);
  }

  /**
   * Extract topics from content
   */
  private extractTopics(content: string, metadata: URLMetadata): string[] {
    const topics: string[] = [];

    // Add keywords from metadata
    if (metadata.keywords) {
      topics.push(...metadata.keywords);
    }

    // Add tags from Open Graph
    if (metadata.openGraph?.article?.tags) {
      topics.push(...metadata.openGraph.article.tags);
    }

    // Extract capitalized phrases as potential topics
    const capitalizedMatches = content.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g) || [];
    const commonWords = ['The', 'This', 'That', 'These', 'Those', 'What', 'When', 'Where', 'How', 'Why', 'If', 'But', 'And', 'Or'];

    for (const phrase of capitalizedMatches) {
      if (!commonWords.includes(phrase) && phrase.length > 3 && !topics.includes(phrase)) {
        topics.push(phrase);
      }
    }

    return [...new Set(topics)].slice(0, 15);
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevanceScore(result: URLProcessingResult): number {
    let score = 0.5; // Base score

    // Boost for having content
    if (result.content && result.content.length > 500) score += 0.1;

    // Boost for having images
    if (result.article?.images && result.article.images.length > 0) score += 0.05;

    // Boost for recent publication
    if (result.metadata.publishedDate) {
      const published = new Date(result.metadata.publishedDate);
      const daysSince = (Date.now() - published.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) score += 0.15;
      else if (daysSince < 30) score += 0.1;
      else if (daysSince < 90) score += 0.05;
    }

    // Boost for action items
    if (result.actionItems.length > 0) score += 0.1;

    return Math.min(1, score);
  }

  /**
   * Generate suggested tags
   */
  private generateTags(result: URLProcessingResult): string[] {
    const tags: string[] = [];

    // Add content type
    tags.push(result.preview.type);

    // Add domain
    tags.push(result.domain);

    // Add platform for social
    if (result.socialPost) {
      tags.push(result.socialPost.platform);
      tags.push(...result.socialPost.hashtags.slice(0, 5));
    }

    // Add topics
    if (result.bookmark?.topics) {
      tags.push(...result.bookmark.topics.slice(0, 5));
    }

    return [...new Set(tags.map(t => t.toLowerCase()))];
  }

  /**
   * Find related topics
   */
  private findRelatedTopics(topics: string[]): string[] {
    // In production, would use topic model or knowledge graph
    // For now, return empty
    return [];
  }

  // ==========================================================================
  // Entity & Action Extraction
  // ==========================================================================

  /**
   * Extract entities from content
   */
  private extractEntities(content: string): ExtractedURLEntity[] {
    const entities: ExtractedURLEntity[] = [];

    // Extract organizations (capitalized multi-word phrases)
    const orgPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+(?:\s+(?:Inc|LLC|Corp|Ltd|Company|Group))?)\b/g;
    let match;
    while ((match = orgPattern.exec(content)) !== null) {
      entities.push({
        type: 'organization',
        value: match[1],
        confidence: 0.6,
      });
    }

    // Extract dates
    const datePattern = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4}\b/gi;
    while ((match = datePattern.exec(content)) !== null) {
      entities.push({
        type: 'date',
        value: match[0],
        confidence: 0.85,
      });
    }

    // Extract money
    const moneyPattern = /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|k|m|b))?/gi;
    while ((match = moneyPattern.exec(content)) !== null) {
      entities.push({
        type: 'money',
        value: match[0],
        confidence: 0.9,
      });
    }

    return entities;
  }

  /**
   * Extract action items from content
   */
  private extractActionItems(content: string, contentType: string, processingId: string): ExtractedURLAction[] {
    const actions: ExtractedURLAction[] = [];
    let actionId = 0;

    // Content type based actions
    if (contentType === 'article') {
      actions.push({
        id: `url-action-${processingId}-${actionId++}`,
        text: 'Read article',
        type: 'read',
        priority: 'medium',
      });
    }

    if (contentType === 'video') {
      actions.push({
        id: `url-action-${processingId}-${actionId++}`,
        text: 'Watch video',
        type: 'watch',
        priority: 'medium',
      });
    }

    // Look for CTAs in content
    const ctaPatterns: Array<{ pattern: RegExp; type: ExtractedURLAction['type']; text: string }> = [
      { pattern: /sign\s*up/gi, type: 'sign_up', text: 'Sign up' },
      { pattern: /register/gi, type: 'sign_up', text: 'Register' },
      { pattern: /download/gi, type: 'download', text: 'Download' },
      { pattern: /buy\s*now|purchase/gi, type: 'buy', text: 'Purchase' },
      { pattern: /subscribe/gi, type: 'follow_up', text: 'Subscribe' },
      { pattern: /learn\s*more/gi, type: 'read', text: 'Learn more' },
      { pattern: /share/gi, type: 'share', text: 'Share' },
    ];

    for (const { pattern, type, text } of ctaPatterns) {
      if (pattern.test(content)) {
        actions.push({
          id: `url-action-${processingId}-${actionId++}`,
          text,
          type,
          priority: 'low',
        });
      }
    }

    return actions;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  /**
   * Generate processing ID
   */
  private generateProcessingId(): string {
    return `url-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(input: URLInput): string {
    const parts: any = {};

    if (input.url) {
      parts.url = input.url;
    }
    if (input.html) {
      parts.htmlHash = this.hashString(input.html.substring(0, 1000));
    }

    return `url:${hashObject(parts)}`;
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
 * Create a URLProcessor instance
 */
export function createURLProcessor(options?: {
  cacheEnabled?: boolean;
  cacheTTL?: number;
}): URLProcessor {
  return new URLProcessor(options);
}

export default URLProcessor;
