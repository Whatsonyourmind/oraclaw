/**
 * ORACLE Smart Meeting Scheduler Service
 * Story smart-3 - AI-powered optimal meeting scheduling
 *
 * Implements:
 * - Multi-calendar availability analysis
 * - Time zone handling with Luxon
 * - Meeting fatigue detection (back-to-back count, daily hours)
 * - Preference learning (preferred times, duration patterns)
 * - Optimal slot scoring algorithm
 * - One-click booking integration
 *
 * Time Complexity:
 * - Multi-calendar availability: O(c * e) where c=calendars, e=events
 * - Fatigue detection: O(e) where e=events in day
 * - Slot scoring: O(s * f) where s=slots, f=scoring factors
 * - Preference learning: O(h) where h=historical meetings
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';

// ============================================================================
// Types
// ============================================================================

/**
 * Time zone representation
 */
export interface TimeZoneInfo {
  zone: string;
  offset: number; // Minutes from UTC
  abbreviation: string;
  displayName: string;
}

/**
 * Participant in a meeting
 */
export interface MeetingParticipant {
  id: string;
  email: string;
  name: string;
  timeZone: string;
  calendarId?: string;
  isOptional?: boolean;
  role: 'organizer' | 'required' | 'optional';
  workingHours?: {
    start: number; // Hour (0-23)
    end: number;
  };
}

/**
 * Calendar busy slot
 */
export interface BusySlot {
  start: Date;
  end: Date;
  calendarId: string;
  participantId: string;
  eventTitle?: string;
  isTentative?: boolean;
}

/**
 * Meeting fatigue metrics
 */
export interface FatigueMetrics {
  backToBackCount: number;
  totalMeetingMinutesToday: number;
  totalMeetingsToday: number;
  longestMeetingStreak: number; // Minutes without break
  averageMeetingGap: number; // Minutes between meetings
  fatigueScore: number; // 0-1, higher = more fatigued
  fatigueLevel: 'low' | 'moderate' | 'high' | 'severe';
  recommendations: string[];
}

/**
 * User meeting preferences
 */
export interface MeetingPreferences {
  userId: string;
  preferredTimes: Array<{
    dayOfWeek: number; // 0=Sunday
    startHour: number;
    endHour: number;
    weight: number; // Preference strength 0-1
  }>;
  preferredDurations: Array<{
    minutes: number;
    frequency: number;
  }>;
  avoidTimes: Array<{
    dayOfWeek: number;
    startHour: number;
    endHour: number;
    reason: string;
  }>;
  maxMeetingsPerDay: number;
  maxConsecutiveMeetingMinutes: number;
  preferredBufferMinutes: number;
  focusTimeBlocks: Array<{
    dayOfWeek: number;
    startHour: number;
    endHour: number;
  }>;
  updatedAt: Date;
}

/**
 * Meeting slot with scoring
 */
export interface ScoredMeetingSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
  score: number;
  participantScores: Record<string, number>;
  timeZoneDetails: Record<string, {
    localStart: string;
    localEnd: string;
    isWorkingHours: boolean;
  }>;
  fatigueImpact: number;
  preferenceMatch: number;
  availabilityScore: number;
  reasons: string[];
}

/**
 * Meeting request
 */
export interface MeetingRequest {
  title: string;
  description?: string;
  durationMinutes: number;
  participants: MeetingParticipant[];
  earliestStart: Date;
  latestEnd: Date;
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening';
  requireAllAttendees: boolean;
  minimumNoticeMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    count?: number;
    endDate?: Date;
  };
}

/**
 * Meeting scheduling result
 */
export interface SchedulingResult {
  recommendedSlot: ScoredMeetingSlot;
  alternativeSlots: ScoredMeetingSlot[];
  unavailableParticipants: Array<{
    participant: MeetingParticipant;
    conflicts: BusySlot[];
  }>;
  fatigueWarnings: Array<{
    participantId: string;
    warning: string;
    fatigueMetrics: FatigueMetrics;
  }>;
  schedulingNotes: string[];
  bookingReady: boolean;
}

/**
 * Booking confirmation
 */
export interface BookingConfirmation {
  eventId: string;
  calendarEventIds: Record<string, string>;
  confirmedSlot: ScoredMeetingSlot;
  notificationsSent: string[];
  conflictsOverridden: BusySlot[];
}

// Cache TTLs
const CACHE_TTL = {
  availability: 5 * 60 * 1000, // 5 minutes
  preferences: 30 * 60 * 1000, // 30 minutes
  scheduling: 10 * 60 * 1000, // 10 minutes
};

// Fatigue thresholds
const FATIGUE_THRESHOLDS = {
  backToBackWarning: 3,
  backToBackSevere: 5,
  dailyMinutesWarning: 240, // 4 hours
  dailyMinutesSevere: 360, // 6 hours
  streakWarning: 120, // 2 hours without break
  streakSevere: 180, // 3 hours without break
};

// ============================================================================
// Luxon-like Time Zone Utilities (Lightweight Implementation)
// ============================================================================

/**
 * Get time zone offset in minutes for a given zone and date
 * O(1) - uses Intl API
 */
function getTimeZoneOffset(timeZone: string, date: Date): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    });

    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');

    if (offsetPart && offsetPart.value) {
      const match = offsetPart.value.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
      if (match) {
        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2], 10);
        const minutes = parseInt(match[3] || '0', 10);
        return sign * (hours * 60 + minutes);
      }
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Convert date to local time string for a time zone
 * O(1)
 */
function toLocalTimeString(date: Date, timeZone: string): string {
  return date.toLocaleString('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get hour in a specific time zone
 * O(1)
 */
function getHourInTimeZone(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(formatter.format(date), 10);
}

/**
 * Get day of week in a specific time zone
 * O(1)
 */
function getDayOfWeekInTimeZone(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  });
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return weekdayMap[formatter.format(date)] || 0;
}

/**
 * Get time zone info
 * O(1)
 */
function getTimeZoneInfo(timeZone: string, date: Date = new Date()): TimeZoneInfo {
  const offset = getTimeZoneOffset(timeZone, date);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  });
  const parts = formatter.formatToParts(date);
  const abbr = parts.find(p => p.type === 'timeZoneName')?.value || timeZone;

  return {
    zone: timeZone,
    offset,
    abbreviation: abbr,
    displayName: `${timeZone} (${abbr})`,
  };
}

// ============================================================================
// Smart Meeting Scheduler Service
// ============================================================================

export class SmartMeetingSchedulerService {
  private preferences: Map<string, MeetingPreferences> = new Map();
  private historicalMeetings: Map<string, Array<{
    startHour: number;
    dayOfWeek: number;
    durationMinutes: number;
    wasAccepted: boolean;
    wasRescheduled: boolean;
  }>> = new Map();
  private calendarProvider: CalendarProvider | null = null;

  /**
   * Set calendar provider for integration
   */
  setCalendarProvider(provider: CalendarProvider): void {
    this.calendarProvider = provider;
  }

  // ============================================================================
  // Main Scheduling API
  // ============================================================================

  /**
   * Find optimal meeting slots for all participants
   * O(c * e + s * p * f) where c=calendars, e=events, s=slots, p=participants, f=factors
   */
  async findOptimalSlots(
    request: MeetingRequest,
    options: {
      maxResults?: number;
      includeFatigueAnalysis?: boolean;
      usePreferences?: boolean;
    } = {}
  ): Promise<SchedulingResult> {
    const cacheKeyStr = cacheKey('scheduling', hashObject(request), hashObject(options));
    const cached = oracleCacheService.get<SchedulingResult>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    // 1. Get availability for all participants
    const availability = await this.getMultiCalendarAvailability(
      request.participants,
      request.earliestStart,
      request.latestEnd
    );

    // 2. Find common free slots
    const commonSlots = this.findCommonFreeSlots(
      availability,
      request.durationMinutes,
      request.requireAllAttendees,
      request.participants.length
    );

    // 3. Apply minimum notice filter
    const filteredSlots = commonSlots.filter(slot => {
      const noticeMinutes = (slot.start.getTime() - Date.now()) / (60 * 1000);
      return noticeMinutes >= (request.minimumNoticeMinutes || 0);
    });

    // 4. Score each slot
    const scoredSlots = await this.scoreSlots(
      filteredSlots,
      request,
      options.usePreferences !== false,
      options.includeFatigueAnalysis !== false
    );

    // 5. Sort by score
    scoredSlots.sort((a, b) => b.score - a.score);

    // 6. Analyze fatigue warnings
    const fatigueWarnings = options.includeFatigueAnalysis !== false
      ? await this.analyzeFatigueWarnings(scoredSlots[0], request.participants)
      : [];

    // 7. Identify unavailable participants
    const unavailableParticipants = this.identifyUnavailableParticipants(
      availability,
      request.participants,
      scoredSlots[0]
    );

    // 8. Generate scheduling notes
    const schedulingNotes = this.generateSchedulingNotes(
      scoredSlots,
      request,
      fatigueWarnings,
      unavailableParticipants
    );

    const result: SchedulingResult = {
      recommendedSlot: scoredSlots[0],
      alternativeSlots: scoredSlots.slice(1, options.maxResults || 5),
      unavailableParticipants,
      fatigueWarnings,
      schedulingNotes,
      bookingReady: scoredSlots.length > 0 && unavailableParticipants.length === 0,
    };

    oracleCacheService.set(cacheKeyStr, result, CACHE_TTL.scheduling);
    return result;
  }

  // ============================================================================
  // Multi-Calendar Availability
  // ============================================================================

  /**
   * Get availability across multiple calendars
   * O(c * e) where c=calendars, e=events per calendar
   */
  async getMultiCalendarAvailability(
    participants: MeetingParticipant[],
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, BusySlot[]>> {
    const availability = new Map<string, BusySlot[]>();

    for (const participant of participants) {
      const busySlots = await this.getParticipantBusySlots(
        participant,
        startDate,
        endDate
      );
      availability.set(participant.id, busySlots);
    }

    return availability;
  }

  /**
   * Get busy slots for a single participant
   */
  private async getParticipantBusySlots(
    participant: MeetingParticipant,
    startDate: Date,
    endDate: Date
  ): Promise<BusySlot[]> {
    if (this.calendarProvider) {
      return this.calendarProvider.getBusySlots(
        participant.calendarId || participant.email,
        startDate,
        endDate
      );
    }

    // Mock data for testing
    return this.generateMockBusySlots(participant.id, startDate, endDate);
  }

  /**
   * Find common free slots across all participants
   * O(s * p) where s=potential slots, p=participants
   */
  private findCommonFreeSlots(
    availability: Map<string, BusySlot[]>,
    durationMinutes: number,
    requireAll: boolean,
    totalParticipants: number
  ): Array<{ start: Date; end: Date }> {
    // Merge all busy slots into a sorted list
    const allBusy: Array<{ start: Date; end: Date; participantId: string }> = [];

    availability.forEach((slots, participantId) => {
      for (const slot of slots) {
        allBusy.push({
          start: slot.start,
          end: slot.end,
          participantId,
        });
      }
    });

    allBusy.sort((a, b) => a.start.getTime() - b.start.getTime());

    // Find gaps in busy periods
    const freeSlots: Array<{ start: Date; end: Date }> = [];

    // Get the overall time range
    const startTimes = Array.from(availability.values())
      .flatMap(slots => slots.map(s => s.start.getTime()));
    const endTimes = Array.from(availability.values())
      .flatMap(slots => slots.map(s => s.end.getTime()));

    if (startTimes.length === 0) {
      // No busy slots - all time is free
      // Generate slots during working hours
      return this.generateWorkingHourSlots(
        new Date(),
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        durationMinutes
      );
    }

    const rangeStart = new Date(Math.min(...startTimes));
    const rangeEnd = new Date(Math.max(...endTimes));

    // Sweep line algorithm to find common free time
    const events: Array<{ time: Date; type: 'start' | 'end'; participantId: string }> = [];

    allBusy.forEach(busy => {
      events.push({ time: busy.start, type: 'start', participantId: busy.participantId });
      events.push({ time: busy.end, type: 'end', participantId: busy.participantId });
    });

    events.sort((a, b) => {
      const timeDiff = a.time.getTime() - b.time.getTime();
      if (timeDiff !== 0) return timeDiff;
      // 'end' events should come before 'start' events at the same time
      return a.type === 'end' ? -1 : 1;
    });

    // Track busy participants at each point
    const busyParticipants = new Set<string>();
    let lastFreeStart: Date | null = rangeStart;

    for (const event of events) {
      const wasAllFree = busyParticipants.size === 0 ||
        (!requireAll && busyParticipants.size < totalParticipants);

      if (event.type === 'start') {
        busyParticipants.add(event.participantId);
      } else {
        busyParticipants.delete(event.participantId);
      }

      const isAllFree = busyParticipants.size === 0 ||
        (!requireAll && busyParticipants.size < totalParticipants);

      // Transition from free to busy
      if (wasAllFree && !isAllFree && lastFreeStart) {
        const duration = event.time.getTime() - lastFreeStart.getTime();
        if (duration >= durationMinutes * 60 * 1000) {
          freeSlots.push({
            start: lastFreeStart,
            end: new Date(lastFreeStart.getTime() + durationMinutes * 60 * 1000),
          });
        }
        lastFreeStart = null;
      }

      // Transition from busy to free
      if (!wasAllFree && isAllFree) {
        lastFreeStart = event.time;
      }
    }

    // Handle trailing free time
    if (lastFreeStart && lastFreeStart < rangeEnd) {
      const duration = rangeEnd.getTime() - lastFreeStart.getTime();
      if (duration >= durationMinutes * 60 * 1000) {
        freeSlots.push({
          start: lastFreeStart,
          end: new Date(lastFreeStart.getTime() + durationMinutes * 60 * 1000),
        });
      }
    }

    // Filter to working hours only
    return freeSlots.filter(slot => {
      const hour = slot.start.getHours();
      const day = slot.start.getDay();
      return hour >= 8 && hour < 18 && day >= 1 && day <= 5;
    });
  }

  /**
   * Generate working hour slots for a time range
   */
  private generateWorkingHourSlots(
    startDate: Date,
    endDate: Date,
    durationMinutes: number
  ): Array<{ start: Date; end: Date }> {
    const slots: Array<{ start: Date; end: Date }> = [];
    const current = new Date(startDate);
    current.setHours(9, 0, 0, 0);

    while (current < endDate && slots.length < 100) {
      const day = current.getDay();
      const hour = current.getHours();

      if (day >= 1 && day <= 5 && hour >= 9 && hour < 17) {
        slots.push({
          start: new Date(current),
          end: new Date(current.getTime() + durationMinutes * 60 * 1000),
        });
      }

      current.setMinutes(current.getMinutes() + 30);

      if (current.getHours() >= 17) {
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
      }
    }

    return slots;
  }

  // ============================================================================
  // Slot Scoring
  // ============================================================================

  /**
   * Score meeting slots based on multiple factors
   * O(s * p * f) where s=slots, p=participants, f=scoring factors
   */
  private async scoreSlots(
    slots: Array<{ start: Date; end: Date }>,
    request: MeetingRequest,
    usePreferences: boolean,
    analyzeFatigue: boolean
  ): Promise<ScoredMeetingSlot[]> {
    const scoredSlots: ScoredMeetingSlot[] = [];

    for (const slot of slots) {
      const participantScores: Record<string, number> = {};
      const timeZoneDetails: Record<string, {
        localStart: string;
        localEnd: string;
        isWorkingHours: boolean;
      }> = {};

      let totalScore = 0;
      let availabilityScore = 1;
      let preferenceMatch = 0;
      let fatigueImpact = 0;
      const reasons: string[] = [];

      // Score for each participant
      for (const participant of request.participants) {
        const tz = participant.timeZone || 'UTC';
        const localHour = getHourInTimeZone(slot.start, tz);
        const localDay = getDayOfWeekInTimeZone(slot.start, tz);

        // Time zone details
        timeZoneDetails[participant.id] = {
          localStart: toLocalTimeString(slot.start, tz),
          localEnd: toLocalTimeString(slot.end, tz),
          isWorkingHours: localHour >= 9 && localHour < 17 && localDay >= 1 && localDay <= 5,
        };

        // Working hours score (0-40 points)
        let participantScore = 0;
        const workStart = participant.workingHours?.start ?? 9;
        const workEnd = participant.workingHours?.end ?? 17;

        if (localHour >= workStart && localHour < workEnd) {
          participantScore += 40;
        } else if (localHour >= workStart - 1 || localHour <= workEnd + 1) {
          participantScore += 20;
          reasons.push(`${participant.name}: Slightly outside preferred hours`);
        } else {
          reasons.push(`${participant.name}: Outside working hours`);
        }

        // Preference score (0-30 points)
        if (usePreferences) {
          const prefs = this.preferences.get(participant.id);
          if (prefs) {
            const prefScore = this.calculatePreferenceScore(slot.start, prefs, tz);
            participantScore += prefScore * 30;
            preferenceMatch += prefScore;
          } else {
            participantScore += 15; // Neutral if no preferences
          }
        }

        // Fatigue score (0-30 points, subtract for high fatigue)
        if (analyzeFatigue) {
          const fatigue = await this.detectMeetingFatigue(participant.id, slot.start);
          const fatigueDeduction = fatigue.fatigueScore * 30;
          participantScore -= fatigueDeduction;
          fatigueImpact += fatigue.fatigueScore;

          if (fatigue.fatigueLevel === 'severe') {
            reasons.push(`${participant.name}: High meeting fatigue warning`);
          }
        }

        participantScores[participant.id] = participantScore;
        totalScore += participantScore;
      }

      // Normalize scores
      const participantCount = request.participants.length;
      const normalizedScore = totalScore / (participantCount * 100);
      preferenceMatch = preferenceMatch / participantCount;
      fatigueImpact = fatigueImpact / participantCount;

      // Time of day preference bonus
      const hour = slot.start.getHours();
      if (request.preferredTimeOfDay === 'morning' && hour >= 9 && hour < 12) {
        totalScore += 10;
        reasons.push('Matches morning preference');
      } else if (request.preferredTimeOfDay === 'afternoon' && hour >= 13 && hour < 17) {
        totalScore += 10;
        reasons.push('Matches afternoon preference');
      }

      scoredSlots.push({
        start: slot.start,
        end: slot.end,
        durationMinutes: request.durationMinutes,
        score: normalizedScore,
        participantScores,
        timeZoneDetails,
        fatigueImpact,
        preferenceMatch,
        availabilityScore,
        reasons,
      });
    }

    return scoredSlots;
  }

  /**
   * Calculate preference score for a time slot
   */
  private calculatePreferenceScore(
    slotStart: Date,
    prefs: MeetingPreferences,
    timeZone: string
  ): number {
    const hour = getHourInTimeZone(slotStart, timeZone);
    const dayOfWeek = getDayOfWeekInTimeZone(slotStart, timeZone);

    let score = 0.5; // Neutral baseline

    // Check preferred times
    for (const pref of prefs.preferredTimes) {
      if (pref.dayOfWeek === dayOfWeek && hour >= pref.startHour && hour < pref.endHour) {
        score += pref.weight * 0.3;
      }
    }

    // Check avoid times
    for (const avoid of prefs.avoidTimes) {
      if (avoid.dayOfWeek === dayOfWeek && hour >= avoid.startHour && hour < avoid.endHour) {
        score -= 0.4;
      }
    }

    // Check focus time blocks
    for (const focus of prefs.focusTimeBlocks) {
      if (focus.dayOfWeek === dayOfWeek && hour >= focus.startHour && hour < focus.endHour) {
        score -= 0.3;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  // ============================================================================
  // Meeting Fatigue Detection
  // ============================================================================

  /**
   * Detect meeting fatigue for a participant on a given day
   * O(e) where e=events in the day
   */
  async detectMeetingFatigue(
    participantId: string,
    targetDate: Date
  ): Promise<FatigueMetrics> {
    const cacheKeyStr = cacheKey('fatigue', participantId, targetDate.toDateString());
    const cached = oracleCacheService.get<FatigueMetrics>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    // Get meetings for the day
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const busySlots = await this.getParticipantBusySlots(
      { id: participantId, email: '', name: '', timeZone: 'UTC', role: 'required' },
      dayStart,
      dayEnd
    );

    // Sort by start time
    const sortedMeetings = busySlots.sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );

    // Calculate metrics
    let backToBackCount = 0;
    let totalMeetingMinutes = 0;
    let longestStreak = 0;
    let currentStreak = 0;
    const gaps: number[] = [];

    for (let i = 0; i < sortedMeetings.length; i++) {
      const meeting = sortedMeetings[i];
      const duration = (meeting.end.getTime() - meeting.start.getTime()) / (60 * 1000);
      totalMeetingMinutes += duration;
      currentStreak += duration;

      if (i < sortedMeetings.length - 1) {
        const nextMeeting = sortedMeetings[i + 1];
        const gap = (nextMeeting.start.getTime() - meeting.end.getTime()) / (60 * 1000);
        gaps.push(gap);

        if (gap < 15) {
          backToBackCount++;
          currentStreak += gap;
        } else {
          if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
          }
          currentStreak = 0;
        }
      }
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    const averageGap = gaps.length > 0
      ? gaps.reduce((a, b) => a + b, 0) / gaps.length
      : 60;

    // Calculate fatigue score (0-1)
    let fatigueScore = 0;

    // Back-to-back contribution
    if (backToBackCount >= FATIGUE_THRESHOLDS.backToBackSevere) {
      fatigueScore += 0.4;
    } else if (backToBackCount >= FATIGUE_THRESHOLDS.backToBackWarning) {
      fatigueScore += 0.2;
    }

    // Total meeting minutes contribution
    if (totalMeetingMinutes >= FATIGUE_THRESHOLDS.dailyMinutesSevere) {
      fatigueScore += 0.4;
    } else if (totalMeetingMinutes >= FATIGUE_THRESHOLDS.dailyMinutesWarning) {
      fatigueScore += 0.2;
    }

    // Longest streak contribution
    if (longestStreak >= FATIGUE_THRESHOLDS.streakSevere) {
      fatigueScore += 0.2;
    } else if (longestStreak >= FATIGUE_THRESHOLDS.streakWarning) {
      fatigueScore += 0.1;
    }

    fatigueScore = Math.min(1, fatigueScore);

    // Determine fatigue level
    let fatigueLevel: 'low' | 'moderate' | 'high' | 'severe';
    if (fatigueScore >= 0.8) {
      fatigueLevel = 'severe';
    } else if (fatigueScore >= 0.5) {
      fatigueLevel = 'high';
    } else if (fatigueScore >= 0.25) {
      fatigueLevel = 'moderate';
    } else {
      fatigueLevel = 'low';
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (backToBackCount >= 3) {
      recommendations.push('Consider adding buffer time between meetings');
    }
    if (totalMeetingMinutes >= 300) {
      recommendations.push('Meeting load is high - consider declining non-essential meetings');
    }
    if (longestStreak >= 120) {
      recommendations.push('Schedule breaks during long meeting streaks');
    }
    if (averageGap < 10) {
      recommendations.push('Increase gaps between meetings for mental recovery');
    }

    const metrics: FatigueMetrics = {
      backToBackCount,
      totalMeetingMinutesToday: totalMeetingMinutes,
      totalMeetingsToday: sortedMeetings.length,
      longestMeetingStreak: longestStreak,
      averageMeetingGap: averageGap,
      fatigueScore,
      fatigueLevel,
      recommendations,
    };

    oracleCacheService.set(cacheKeyStr, metrics, CACHE_TTL.availability);
    return metrics;
  }

  // ============================================================================
  // Preference Learning
  // ============================================================================

  /**
   * Learn meeting preferences from historical data
   * O(h) where h=historical meetings
   */
  async learnPreferences(
    userId: string,
    historicalMeetings: Array<{
      startTime: Date;
      endTime: Date;
      wasAccepted: boolean;
      wasRescheduled: boolean;
      wasDeclined: boolean;
    }>
  ): Promise<MeetingPreferences> {
    const timePreferences = new Map<string, { total: number; accepted: number }>();
    const durationCounts = new Map<number, number>();
    const avoidPatterns = new Map<string, number>();

    for (const meeting of historicalMeetings) {
      const hour = meeting.startTime.getHours();
      const day = meeting.startTime.getDay();
      const duration = (meeting.endTime.getTime() - meeting.startTime.getTime()) / (60 * 1000);
      const key = `${day}-${hour}`;

      // Track time preferences
      const existing = timePreferences.get(key) || { total: 0, accepted: 0 };
      existing.total++;
      if (meeting.wasAccepted && !meeting.wasRescheduled) {
        existing.accepted++;
      }
      timePreferences.set(key, existing);

      // Track duration preferences
      const roundedDuration = Math.round(duration / 15) * 15;
      durationCounts.set(roundedDuration, (durationCounts.get(roundedDuration) || 0) + 1);

      // Track avoid patterns (declined or rescheduled)
      if (meeting.wasDeclined || meeting.wasRescheduled) {
        avoidPatterns.set(key, (avoidPatterns.get(key) || 0) + 1);
      }
    }

    // Build preferred times
    const preferredTimes: MeetingPreferences['preferredTimes'] = [];
    timePreferences.forEach((stats, key) => {
      const [day, hour] = key.split('-').map(Number);
      const acceptanceRate = stats.accepted / stats.total;

      if (acceptanceRate >= 0.7 && stats.total >= 3) {
        preferredTimes.push({
          dayOfWeek: day,
          startHour: hour,
          endHour: hour + 1,
          weight: acceptanceRate,
        });
      }
    });

    // Build preferred durations
    const preferredDurations: MeetingPreferences['preferredDurations'] = [];
    durationCounts.forEach((count, duration) => {
      preferredDurations.push({ minutes: duration, frequency: count });
    });
    preferredDurations.sort((a, b) => b.frequency - a.frequency);

    // Build avoid times
    const avoidTimes: MeetingPreferences['avoidTimes'] = [];
    avoidPatterns.forEach((count, key) => {
      const [day, hour] = key.split('-').map(Number);
      if (count >= 3) {
        avoidTimes.push({
          dayOfWeek: day,
          startHour: hour,
          endHour: hour + 1,
          reason: 'Frequently declined or rescheduled',
        });
      }
    });

    const preferences: MeetingPreferences = {
      userId,
      preferredTimes,
      preferredDurations,
      avoidTimes,
      maxMeetingsPerDay: 8,
      maxConsecutiveMeetingMinutes: 180,
      preferredBufferMinutes: 15,
      focusTimeBlocks: [],
      updatedAt: new Date(),
    };

    this.preferences.set(userId, preferences);
    oracleCacheService.set(
      cacheKey('preferences', userId),
      preferences,
      CACHE_TTL.preferences
    );

    return preferences;
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<MeetingPreferences | null> {
    const cached = oracleCacheService.get<MeetingPreferences>(
      cacheKey('preferences', userId)
    );
    if (cached) return cached;

    return this.preferences.get(userId) || null;
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<MeetingPreferences>
  ): Promise<MeetingPreferences> {
    const existing = await this.getPreferences(userId) || {
      userId,
      preferredTimes: [],
      preferredDurations: [],
      avoidTimes: [],
      maxMeetingsPerDay: 8,
      maxConsecutiveMeetingMinutes: 180,
      preferredBufferMinutes: 15,
      focusTimeBlocks: [],
      updatedAt: new Date(),
    };

    const updated: MeetingPreferences = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.preferences.set(userId, updated);
    oracleCacheService.set(
      cacheKey('preferences', userId),
      updated,
      CACHE_TTL.preferences
    );

    return updated;
  }

  // ============================================================================
  // One-Click Booking
  // ============================================================================

  /**
   * Book a meeting slot with one click
   * Creates calendar events for all participants
   */
  async bookMeeting(
    slot: ScoredMeetingSlot,
    request: MeetingRequest
  ): Promise<BookingConfirmation> {
    if (!this.calendarProvider) {
      throw new Error('Calendar provider not configured');
    }

    const eventId = `oracle-meeting-${Date.now()}`;
    const calendarEventIds: Record<string, string> = {};
    const notificationsSent: string[] = [];
    const conflictsOverridden: BusySlot[] = [];

    // Create event for each participant
    for (const participant of request.participants) {
      try {
        const calendarEventId = await this.calendarProvider.createEvent(
          participant.calendarId || participant.email,
          {
            title: request.title,
            description: request.description,
            start: slot.start,
            end: slot.end,
            attendees: request.participants.map(p => ({
              email: p.email,
              name: p.name,
              role: p.role,
            })),
          }
        );

        calendarEventIds[participant.id] = calendarEventId;
        notificationsSent.push(participant.email);
      } catch (error) {
        console.error(`Failed to create event for ${participant.email}:`, error);
      }
    }

    return {
      eventId,
      calendarEventIds,
      confirmedSlot: slot,
      notificationsSent,
      conflictsOverridden,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Identify participants who are unavailable
   */
  private identifyUnavailableParticipants(
    availability: Map<string, BusySlot[]>,
    participants: MeetingParticipant[],
    recommendedSlot: ScoredMeetingSlot
  ): Array<{ participant: MeetingParticipant; conflicts: BusySlot[] }> {
    if (!recommendedSlot) return [];

    const unavailable: Array<{ participant: MeetingParticipant; conflicts: BusySlot[] }> = [];

    for (const participant of participants) {
      const busySlots = availability.get(participant.id) || [];
      const conflicts = busySlots.filter(slot =>
        slot.start < recommendedSlot.end && slot.end > recommendedSlot.start
      );

      if (conflicts.length > 0 && !participant.isOptional) {
        unavailable.push({ participant, conflicts });
      }
    }

    return unavailable;
  }

  /**
   * Analyze fatigue warnings for a slot
   */
  private async analyzeFatigueWarnings(
    slot: ScoredMeetingSlot,
    participants: MeetingParticipant[]
  ): Promise<Array<{ participantId: string; warning: string; fatigueMetrics: FatigueMetrics }>> {
    if (!slot) return [];

    const warnings: Array<{
      participantId: string;
      warning: string;
      fatigueMetrics: FatigueMetrics;
    }> = [];

    for (const participant of participants) {
      const fatigue = await this.detectMeetingFatigue(participant.id, slot.start);

      if (fatigue.fatigueLevel === 'high' || fatigue.fatigueLevel === 'severe') {
        warnings.push({
          participantId: participant.id,
          warning: `${participant.name} has ${fatigue.fatigueLevel} meeting fatigue: ${fatigue.recommendations[0] || 'Consider rescheduling'}`,
          fatigueMetrics: fatigue,
        });
      }
    }

    return warnings;
  }

  /**
   * Generate scheduling notes
   */
  private generateSchedulingNotes(
    slots: ScoredMeetingSlot[],
    request: MeetingRequest,
    fatigueWarnings: Array<{ participantId: string; warning: string }>,
    unavailable: Array<{ participant: MeetingParticipant; conflicts: BusySlot[] }>
  ): string[] {
    const notes: string[] = [];

    if (slots.length === 0) {
      notes.push('No available slots found in the requested time range.');
      notes.push('Consider expanding the date range or making some attendees optional.');
      return notes;
    }

    const best = slots[0];

    if (best.score < 0.5) {
      notes.push('Best available slot has limited suitability. Consider alternative times.');
    }

    if (fatigueWarnings.length > 0) {
      notes.push(`${fatigueWarnings.length} participant(s) have elevated meeting fatigue.`);
    }

    if (unavailable.length > 0) {
      notes.push(`${unavailable.length} required participant(s) have conflicts.`);
    }

    // Time zone considerations
    const tzCount = new Set(request.participants.map(p => p.timeZone)).size;
    if (tzCount > 1) {
      notes.push(`Meeting spans ${tzCount} time zones. Check local times for all participants.`);
    }

    // Preference match
    if (best.preferenceMatch < 0.3) {
      notes.push('Recommended slot does not strongly match participant preferences.');
    }

    return notes;
  }

  /**
   * Generate mock busy slots for testing
   */
  private generateMockBusySlots(
    participantId: string,
    startDate: Date,
    endDate: Date
  ): BusySlot[] {
    const slots: BusySlot[] = [];
    const current = new Date(startDate);

    while (current < endDate) {
      if (current.getDay() >= 1 && current.getDay() <= 5) {
        // Add some random meetings
        if (Math.random() > 0.5) {
          const meetingStart = new Date(current);
          meetingStart.setHours(10 + Math.floor(Math.random() * 6), 0, 0, 0);
          const meetingEnd = new Date(meetingStart.getTime() + (30 + Math.random() * 60) * 60 * 1000);

          slots.push({
            start: meetingStart,
            end: meetingEnd,
            calendarId: 'primary',
            participantId,
            eventTitle: 'Existing Meeting',
          });
        }
      }
      current.setDate(current.getDate() + 1);
    }

    return slots;
  }
}

// ============================================================================
// Calendar Provider Interface
// ============================================================================

export interface CalendarProvider {
  getBusySlots(calendarId: string, start: Date, end: Date): Promise<BusySlot[]>;
  createEvent(calendarId: string, event: {
    title: string;
    description?: string;
    start: Date;
    end: Date;
    attendees: Array<{ email: string; name: string; role: string }>;
  }): Promise<string>;
}

// Singleton instance
export const smartMeetingSchedulerService = new SmartMeetingSchedulerService();
