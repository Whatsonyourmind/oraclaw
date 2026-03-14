/**
 * ORACLE Briefing Templates Service
 * Customizable templates for mission briefings
 *
 * Features:
 * - Template definitions
 * - Section configurations
 * - Tone/verbosity settings
 * - Output format options (text, audio script, slides)
 */

// ============================================================================
// Types
// ============================================================================

export type BriefingType = 'morning' | 'evening' | 'weekly' | 'emergency' | 'executive' | 'sitrep';
export type BriefingTone = 'formal' | 'casual' | 'urgent' | 'motivational' | 'analytical';
export type BriefingVerbosity = 'concise' | 'standard' | 'detailed' | 'comprehensive';
export type BriefingFormat = 'text' | 'audio_script' | 'slides' | 'markdown' | 'html';
export type BriefingSectionType =
  | 'priorities'
  | 'meetings'
  | 'deadlines'
  | 'risks'
  | 'accomplishments'
  | 'pending'
  | 'metrics'
  | 'weather'
  | 'traffic'
  | 'recommendations'
  | 'goals'
  | 'trends'
  | 'health_scores'
  | 'critical_issues'
  | 'resources'
  | 'escalations'
  | 'kpis'
  | 'decisions'
  | 'stakeholders'
  | 'custom';

export interface BriefingSectionConfig {
  type: BriefingSectionType;
  title: string;
  enabled: boolean;
  order: number;
  max_items?: number;
  include_details?: boolean;
  custom_query?: string;
  style?: {
    icon?: string;
    color?: string;
    highlight?: boolean;
  };
}

export interface BriefingTemplate {
  id: string;
  user_id: string;
  name: string;
  briefing_type: BriefingType;
  description?: string;
  sections: BriefingSectionConfig[];
  tone: BriefingTone;
  verbosity: BriefingVerbosity;
  output_formats: BriefingFormat[];
  default_format: BriefingFormat;
  schedule?: {
    enabled: boolean;
    time: string; // HH:mm format
    days: number[]; // 0-6 (Sunday-Saturday)
    timezone: string;
  };
  personalization: {
    include_greeting: boolean;
    greeting_style: 'name' | 'time_of_day' | 'motivational';
    include_sign_off: boolean;
    sign_off_style: 'standard' | 'motivational' | 'action_oriented';
    include_quotes: boolean;
    quote_category?: string;
  };
  audio_settings?: {
    voice: string;
    speed: number;
    include_pauses: boolean;
    music_intro: boolean;
  };
  slide_settings?: {
    theme: string;
    max_slides: number;
    include_charts: boolean;
    include_images: boolean;
  };
  metadata?: Record<string, any>;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateSection {
  type: BriefingSectionType;
  content: string | string[];
  data?: any;
  metadata?: {
    count?: number;
    priority?: string;
    timestamp?: string;
    type?: string;
    total?: number;
  };
}

export interface RenderedBriefing {
  template_id: string;
  briefing_type: BriefingType;
  format: BriefingFormat;
  title: string;
  greeting?: string;
  sections: TemplateSection[];
  sign_off?: string;
  quote?: string;
  generated_at: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Default Templates
// ============================================================================

const DEFAULT_MORNING_SECTIONS: BriefingSectionConfig[] = [
  { type: 'priorities', title: 'Today\'s Priorities', enabled: true, order: 1, max_items: 5 },
  { type: 'meetings', title: 'Scheduled Meetings', enabled: true, order: 2, max_items: 10 },
  { type: 'deadlines', title: 'Approaching Deadlines', enabled: true, order: 3, max_items: 5 },
  { type: 'risks', title: 'Risks to Monitor', enabled: true, order: 4, max_items: 3 },
  { type: 'weather', title: 'Weather & Commute', enabled: true, order: 5 },
  { type: 'recommendations', title: 'ORACLE Recommendations', enabled: true, order: 6, max_items: 3 },
];

const DEFAULT_EVENING_SECTIONS: BriefingSectionConfig[] = [
  { type: 'accomplishments', title: 'Today\'s Accomplishments', enabled: true, order: 1, max_items: 10 },
  { type: 'pending', title: 'Pending Items', enabled: true, order: 2, max_items: 5 },
  { type: 'metrics', title: 'Daily Metrics', enabled: true, order: 3 },
  { type: 'priorities', title: 'Tomorrow\'s Preview', enabled: true, order: 4, max_items: 5 },
  { type: 'recommendations', title: 'Preparation Notes', enabled: true, order: 5, max_items: 3 },
];

const DEFAULT_WEEKLY_SECTIONS: BriefingSectionConfig[] = [
  { type: 'accomplishments', title: 'Week in Review', enabled: true, order: 1, max_items: 15 },
  { type: 'goals', title: 'Goal Progress', enabled: true, order: 2 },
  { type: 'trends', title: 'Trend Analysis', enabled: true, order: 3 },
  { type: 'health_scores', title: 'Project Health', enabled: true, order: 4 },
  { type: 'priorities', title: 'Next Week Preview', enabled: true, order: 5, max_items: 10 },
  { type: 'recommendations', title: 'Strategic Recommendations', enabled: true, order: 6, max_items: 5 },
];

const DEFAULT_SITREP_SECTIONS: BriefingSectionConfig[] = [
  { type: 'critical_issues', title: 'Critical Issues', enabled: true, order: 1, max_items: 10 },
  { type: 'resources', title: 'Resource Status', enabled: true, order: 2 },
  { type: 'risks', title: 'Risk Matrix', enabled: true, order: 3 },
  { type: 'recommendations', title: 'Recommended Actions', enabled: true, order: 4, max_items: 10 },
  { type: 'escalations', title: 'Escalation Requirements', enabled: true, order: 5 },
];

const DEFAULT_EXECUTIVE_SECTIONS: BriefingSectionConfig[] = [
  { type: 'kpis', title: 'Key Performance Indicators', enabled: true, order: 1 },
  { type: 'goals', title: 'Strategic Alignment', enabled: true, order: 2 },
  { type: 'decisions', title: 'Decision Points', enabled: true, order: 3, max_items: 5 },
  { type: 'stakeholders', title: 'Stakeholder Updates', enabled: true, order: 4 },
  { type: 'risks', title: 'Risk Summary', enabled: true, order: 5, max_items: 5 },
];

// ============================================================================
// Greeting Templates
// ============================================================================

const GREETINGS = {
  name: (name: string, timeOfDay: string) => `Good ${timeOfDay}, ${name}.`,
  time_of_day: (name: string, timeOfDay: string) => {
    const greetings: Record<string, string[]> = {
      morning: ['Rise and shine!', 'Good morning!', 'Ready to conquer the day?'],
      afternoon: ['Good afternoon!', 'Hope your day is going well!', 'Halfway there!'],
      evening: ['Good evening!', 'Wrapping up the day!', 'Time to reflect!'],
    };
    const options = greetings[timeOfDay] || greetings.morning;
    return options[Math.floor(Math.random() * options.length)];
  },
  motivational: (name: string, timeOfDay: string) => {
    const quotes = [
      'Today is full of possibilities.',
      'Focus on progress, not perfection.',
      'Every task completed is a step forward.',
      'Your goals are within reach.',
      'Make today count.',
    ];
    return `${name}, ${quotes[Math.floor(Math.random() * quotes.length)]}`;
  },
};

const SIGN_OFFS = {
  standard: ['Stay focused.', 'Best regards, ORACLE', 'End of briefing.'],
  motivational: ['You\'ve got this!', 'Go make it happen!', 'Success awaits!', 'Onwards and upwards!'],
  action_oriented: ['Execute with precision.', 'Time to deliver.', 'Let\'s get it done.', 'Action time.'],
};

const QUOTES = {
  productivity: [
    '"The key is not to prioritize what\'s on your schedule, but to schedule your priorities." - Stephen Covey',
    '"Focus on being productive instead of busy." - Tim Ferriss',
    '"It\'s not that I\'m so smart, it\'s just that I stay with problems longer." - Albert Einstein',
  ],
  leadership: [
    '"The greatest leader is not necessarily one who does the greatest things, but one who gets people to do the greatest things." - Ronald Reagan',
    '"Before you are a leader, success is all about growing yourself. When you become a leader, success is all about growing others." - Jack Welch',
  ],
  success: [
    '"Success is not final, failure is not fatal: it is the courage to continue that counts." - Winston Churchill',
    '"The only way to do great work is to love what you do." - Steve Jobs',
  ],
};

// ============================================================================
// Briefing Templates Service
// ============================================================================

export class BriefingTemplatesService {
  private templates: Map<string, BriefingTemplate> = new Map();
  private userDefaults: Map<string, Record<BriefingType, string>> = new Map();

  /**
   * Initialize with default templates for a user
   */
  async initializeUserTemplates(userId: string): Promise<BriefingTemplate[]> {
    const templates: BriefingTemplate[] = [
      this.createDefaultTemplate(userId, 'morning'),
      this.createDefaultTemplate(userId, 'evening'),
      this.createDefaultTemplate(userId, 'weekly'),
      this.createDefaultTemplate(userId, 'sitrep'),
      this.createDefaultTemplate(userId, 'executive'),
    ];

    for (const template of templates) {
      this.templates.set(template.id, template);
    }

    // Set defaults
    const defaults: Record<BriefingType, string> = {} as any;
    for (const template of templates) {
      defaults[template.briefing_type] = template.id;
    }
    this.userDefaults.set(userId, defaults);

    return templates;
  }

  /**
   * Create a default template for a briefing type
   */
  private createDefaultTemplate(userId: string, type: BriefingType): BriefingTemplate {
    const now = new Date().toISOString();

    const sectionMap: Record<BriefingType, BriefingSectionConfig[]> = {
      morning: DEFAULT_MORNING_SECTIONS,
      evening: DEFAULT_EVENING_SECTIONS,
      weekly: DEFAULT_WEEKLY_SECTIONS,
      sitrep: DEFAULT_SITREP_SECTIONS,
      executive: DEFAULT_EXECUTIVE_SECTIONS,
      emergency: DEFAULT_SITREP_SECTIONS,
    };

    const toneMap: Record<BriefingType, BriefingTone> = {
      morning: 'motivational',
      evening: 'casual',
      weekly: 'analytical',
      sitrep: 'formal',
      executive: 'formal',
      emergency: 'urgent',
    };

    const scheduleMap: Partial<Record<BriefingType, BriefingTemplate['schedule']>> = {
      morning: { enabled: true, time: '07:00', days: [1, 2, 3, 4, 5], timezone: 'America/New_York' },
      evening: { enabled: true, time: '18:00', days: [1, 2, 3, 4, 5], timezone: 'America/New_York' },
      weekly: { enabled: true, time: '09:00', days: [1], timezone: 'America/New_York' },
    };

    return {
      id: crypto.randomUUID(),
      user_id: userId,
      name: `Default ${type.charAt(0).toUpperCase() + type.slice(1)} Briefing`,
      briefing_type: type,
      description: `Standard ${type} briefing template`,
      sections: sectionMap[type],
      tone: toneMap[type],
      verbosity: 'standard',
      output_formats: ['text', 'audio_script', 'markdown'],
      default_format: 'text',
      schedule: scheduleMap[type],
      personalization: {
        include_greeting: true,
        greeting_style: type === 'morning' ? 'motivational' : 'name',
        include_sign_off: true,
        sign_off_style: type === 'morning' ? 'motivational' : 'standard',
        include_quotes: type === 'morning' || type === 'weekly',
        quote_category: 'productivity',
      },
      audio_settings: {
        voice: 'default',
        speed: 1.0,
        include_pauses: true,
        music_intro: false,
      },
      slide_settings: {
        theme: 'dark',
        max_slides: 10,
        include_charts: true,
        include_images: false,
      },
      is_default: true,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Get a template by ID
   */
  async getTemplate(templateId: string, userId: string): Promise<BriefingTemplate | null> {
    const template = this.templates.get(templateId);
    if (!template || template.user_id !== userId) {
      return null;
    }
    return template;
  }

  /**
   * Get the default template for a briefing type
   */
  async getDefaultTemplate(userId: string, type: BriefingType): Promise<BriefingTemplate | null> {
    const defaults = this.userDefaults.get(userId);
    if (!defaults || !defaults[type]) {
      // Initialize templates if not exists
      await this.initializeUserTemplates(userId);
      const newDefaults = this.userDefaults.get(userId);
      if (!newDefaults || !newDefaults[type]) return null;
      return this.templates.get(newDefaults[type]) || null;
    }
    return this.templates.get(defaults[type]) || null;
  }

  /**
   * List all templates for a user
   */
  async listTemplates(userId: string): Promise<BriefingTemplate[]> {
    return Array.from(this.templates.values()).filter((t) => t.user_id === userId);
  }

  /**
   * Create a custom template
   */
  async createTemplate(
    userId: string,
    params: {
      name: string;
      briefing_type: BriefingType;
      sections: BriefingSectionConfig[];
      tone?: BriefingTone;
      verbosity?: BriefingVerbosity;
      output_formats?: BriefingFormat[];
      personalization?: Partial<BriefingTemplate['personalization']>;
      schedule?: BriefingTemplate['schedule'];
    }
  ): Promise<BriefingTemplate> {
    const now = new Date().toISOString();

    const template: BriefingTemplate = {
      id: crypto.randomUUID(),
      user_id: userId,
      name: params.name,
      briefing_type: params.briefing_type,
      sections: params.sections,
      tone: params.tone || 'formal',
      verbosity: params.verbosity || 'standard',
      output_formats: params.output_formats || ['text'],
      default_format: 'text',
      schedule: params.schedule,
      personalization: {
        include_greeting: true,
        greeting_style: 'name',
        include_sign_off: true,
        sign_off_style: 'standard',
        include_quotes: false,
        ...params.personalization,
      },
      is_default: false,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    this.templates.set(template.id, template);
    return template;
  }

  /**
   * Update a template
   */
  async updateTemplate(
    templateId: string,
    userId: string,
    updates: Partial<Omit<BriefingTemplate, 'id' | 'user_id' | 'created_at'>>
  ): Promise<BriefingTemplate | null> {
    const template = this.templates.get(templateId);
    if (!template || template.user_id !== userId) {
      return null;
    }

    const updatedTemplate: BriefingTemplate = {
      ...template,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.templates.set(templateId, updatedTemplate);
    return updatedTemplate;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string, userId: string): Promise<boolean> {
    const template = this.templates.get(templateId);
    if (!template || template.user_id !== userId || template.is_default) {
      return false;
    }

    this.templates.delete(templateId);
    return true;
  }

  /**
   * Set a template as the default for its type
   */
  async setAsDefault(templateId: string, userId: string): Promise<boolean> {
    const template = this.templates.get(templateId);
    if (!template || template.user_id !== userId) {
      return false;
    }

    let defaults = this.userDefaults.get(userId);
    if (!defaults) {
      defaults = {} as Record<BriefingType, string>;
    }

    defaults[template.briefing_type] = templateId;
    this.userDefaults.set(userId, defaults);

    return true;
  }

  /**
   * Generate a greeting based on template settings
   */
  generateGreeting(template: BriefingTemplate, userName: string): string {
    if (!template.personalization.include_greeting) {
      return '';
    }

    const hour = new Date().getHours();
    let timeOfDay: string;
    if (hour < 12) {
      timeOfDay = 'morning';
    } else if (hour < 17) {
      timeOfDay = 'afternoon';
    } else {
      timeOfDay = 'evening';
    }

    const greetingFunc = GREETINGS[template.personalization.greeting_style];
    return greetingFunc(userName, timeOfDay);
  }

  /**
   * Generate a sign-off based on template settings
   */
  generateSignOff(template: BriefingTemplate): string {
    if (!template.personalization.include_sign_off) {
      return '';
    }

    const signOffs = SIGN_OFFS[template.personalization.sign_off_style];
    return signOffs[Math.floor(Math.random() * signOffs.length)];
  }

  /**
   * Generate a quote based on template settings
   */
  generateQuote(template: BriefingTemplate): string {
    if (!template.personalization.include_quotes) {
      return '';
    }

    const category = template.personalization.quote_category || 'productivity';
    const quotes = QUOTES[category as keyof typeof QUOTES] || QUOTES.productivity;
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  /**
   * Get enabled sections sorted by order
   */
  getEnabledSections(template: BriefingTemplate): BriefingSectionConfig[] {
    return template.sections.filter((s) => s.enabled).sort((a, b) => a.order - b.order);
  }

  /**
   * Format content based on verbosity setting
   */
  formatContent(content: string, verbosity: BriefingVerbosity): string {
    switch (verbosity) {
      case 'concise':
        // Truncate to first sentence or 100 chars
        const firstSentence = content.split('.')[0];
        return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence + '.';
      case 'detailed':
        return content;
      case 'comprehensive':
        return content; // In practice, would add more context
      case 'standard':
      default:
        // Truncate to 200 chars
        return content.length > 200 ? content.substring(0, 200) + '...' : content;
    }
  }

  /**
   * Format for audio script (adds pauses, pronunciation hints)
   */
  formatForAudio(content: string, settings?: BriefingTemplate['audio_settings']): string {
    let audioContent = content;

    // Add pauses after periods
    if (settings?.include_pauses) {
      audioContent = audioContent.replace(/\. /g, '. <pause> ');
      audioContent = audioContent.replace(/\n/g, ' <long-pause> ');
    }

    // Numbers - spell out for clarity
    audioContent = audioContent.replace(/(\d+)/g, (match) => {
      const num = parseInt(match, 10);
      if (num < 10) {
        const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
        return words[num];
      }
      return match;
    });

    return audioContent;
  }

  /**
   * Format for slides (create slide-friendly chunks)
   */
  formatForSlides(
    sections: TemplateSection[],
    settings?: BriefingTemplate['slide_settings']
  ): Array<{ title: string; bullets: string[]; hasChart?: boolean }> {
    const maxSlides = settings?.max_slides || 10;
    const slides: Array<{ title: string; bullets: string[] }> = [];

    for (const section of sections) {
      if (slides.length >= maxSlides) break;

      const bullets: string[] = [];
      if (Array.isArray(section.content)) {
        bullets.push(...section.content.slice(0, 5));
      } else {
        bullets.push(section.content);
      }

      slides.push({
        title: section.type.replace(/_/g, ' ').toUpperCase(),
        bullets,
      });
    }

    return slides;
  }

  /**
   * Clone a template
   */
  async cloneTemplate(templateId: string, userId: string, newName: string): Promise<BriefingTemplate | null> {
    const original = this.templates.get(templateId);
    if (!original || original.user_id !== userId) {
      return null;
    }

    const now = new Date().toISOString();
    const cloned: BriefingTemplate = {
      ...original,
      id: crypto.randomUUID(),
      name: newName,
      is_default: false,
      created_at: now,
      updated_at: now,
    };

    this.templates.set(cloned.id, cloned);
    return cloned;
  }
}

// Singleton export
export const briefingTemplatesService = new BriefingTemplatesService();
