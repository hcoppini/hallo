/**
 * Party Program Schedule Utilities
 * Handles party timeline calculations, overnight hour wrapping (e.g. 20:00 to 02:00),
 * milestone checkpoints, and progress bar calculations.
 */

export interface PartyCheckpoint {
  id: string;
  time: string; // 'HH:mm' in 24-hour format, e.g. '23:00'
  title: string; // e.g. 'Singing Happy Birthday'
  description?: string;
  icon?: 'cake' | 'glass' | 'sparkles' | 'cards' | 'music' | 'moon' | 'flame' | 'star';
}

export interface PartyProgramSchedule {
  startTime: string; // '20:00'
  endTime: string;   // '02:00'
  title?: string;
  checkpoints: PartyCheckpoint[];
}

export const DEFAULT_PARTY_SCHEDULE: PartyProgramSchedule = {
  startTime: '20:00',
  endTime: '02:00',
  title: 'Tonight\'s Party Timeline',
  checkpoints: [
    {
      id: 'cp-1',
      time: '20:00',
      title: 'Doors Open & Welcome Drinks',
      icon: 'glass',
    },
    {
      id: 'cp-2',
      time: '21:30',
      title: 'First Toasts & Icebreakers',
      icon: 'sparkles',
    },
    {
      id: 'cp-3',
      time: '23:00',
      title: 'Singing HBD & Birthday Cake',
      icon: 'cake',
    },
    {
      id: 'cp-4',
      time: '00:00',
      title: 'Midnight Toast & High Energy',
      icon: 'flame',
    },
    {
      id: 'cp-5',
      time: '01:00',
      title: 'Poker Tournament Championship',
      icon: 'cards',
    },
    {
      id: 'cp-6',
      time: '02:00',
      title: 'Late Night Afterparty & Vibes',
      icon: 'moon',
    },
  ],
};

export const PARTY_SCHEDULE_STORAGE_KEY = 'halloween_party_program_v1';

/**
 * Converts 'HH:mm' string to total minutes from 00:00 (0 to 1439).
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return Math.min(1439, Math.max(0, h * 60 + m));
}

/**
 * Converts minutes (0 to 1439) to 'HH:mm' string.
 */
export function minutesToTimeString(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Formats 24h 'HH:mm' to a friendly display string (e.g. "20:00" or "8:00 PM").
 */
export function formatTimeDisplay(timeStr: string, use12h = false): string {
  if (!use12h) return timeStr;
  const mins = timeStringToMinutes(timeStr);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

/**
 * Calculates total party duration in minutes, correctly handling overnight wraparound.
 * e.g., 20:00 to 02:00 -> (1440 - 1200) + 120 = 360 minutes (6 hours).
 */
export function calculatePartyDurationMinutes(startTime: string, endTime: string): number {
  const startM = timeStringToMinutes(startTime);
  const endM = timeStringToMinutes(endTime);

  if (endM > startM) {
    return endM - startM;
  }
  if (endM < startM) {
    return (1440 - startM) + endM;
  }
  // If start == end, treat as full 24h party (1440 mins)
  return 1440;
}

/**
 * Calculates elapsed minutes from startTime to targetTime along the party schedule.
 * Handles overnight parties where party spans past midnight.
 */
export function calculateElapsedPartyMinutes(
  startTime: string,
  endTime: string,
  targetTime: string
): number {
  const startM = timeStringToMinutes(startTime);
  const endM = timeStringToMinutes(endTime);
  const targetM = timeStringToMinutes(targetTime);
  const totalDuration = calculatePartyDurationMinutes(startTime, endTime);

  if (endM > startM) {
    // Same day party (e.g. 14:00 to 22:00)
    if (targetM <= startM) return 0;
    if (targetM >= endM) return totalDuration;
    return targetM - startM;
  }

  // Overnight party (e.g. 20:00 to 02:00)
  // Window 1: from startM (20:00) to 23:59 (1439)
  if (targetM >= startM) {
    return targetM - startM;
  }
  // Window 2: from 00:00 to endM (02:00)
  if (targetM <= endM) {
    return (1440 - startM) + targetM;
  }

  // Outside the active party window (e.g. 15:00 afternoon):
  // Check which boundary it is closer to
  const distToStart = (startM - targetM + 1440) % 1440;
  const distFromEnd = (targetM - endM + 1440) % 1440;

  if (distToStart < distFromEnd) {
    return 0; // closer to start -> not started yet
  }
  return totalDuration; // closer to end -> party already finished
}

/**
 * Calculates current party progress percentage (0 to 100).
 */
export function calculatePartyProgress(
  startTime: string,
  endTime: string,
  currentTime: string
): number {
  const total = calculatePartyDurationMinutes(startTime, endTime);
  if (total <= 0) return 0;
  const elapsed = calculateElapsedPartyMinutes(startTime, endTime, currentTime);
  const pct = (elapsed / total) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}

/**
 * Calculates horizontal percentage position (0 to 100) of a checkpoint on the progress bar.
 */
export function calculateCheckpointPosition(
  startTime: string,
  endTime: string,
  checkpointTime: string
): number {
  const total = calculatePartyDurationMinutes(startTime, endTime);
  if (total <= 0) return 0;
  const elapsed = calculateElapsedPartyMinutes(startTime, endTime, checkpointTime);
  const pct = (elapsed / total) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}

/**
 * Gets checkpoint status relative to current time.
 * If within 15 minutes window of checkpoint, it's considered 'current'.
 */
export function getCheckpointStatus(
  startTime: string,
  endTime: string,
  currentTime: string,
  checkpointTime: string,
  windowMinutes = 15
): 'past' | 'current' | 'upcoming' {
  const currentElapsed = calculateElapsedPartyMinutes(startTime, endTime, currentTime);
  const cpElapsed = calculateElapsedPartyMinutes(startTime, endTime, checkpointTime);
  const diff = currentElapsed - cpElapsed;

  if (Math.abs(diff) <= windowMinutes) {
    return 'current';
  }
  if (diff > windowMinutes) {
    return 'past';
  }
  return 'upcoming';
}

/**
 * Gets the current active milestone and upcoming milestone.
 */
export function findActiveOrNextCheckpoint(
  schedule: PartyProgramSchedule,
  currentTime: string
): {
  active: PartyCheckpoint | null;
  next: PartyCheckpoint | null;
  minutesUntilNext: number | null;
} {
  const { startTime, endTime, checkpoints } = schedule;
  const currentElapsed = calculateElapsedPartyMinutes(startTime, endTime, currentTime);

  // Sort checkpoints chronologically along the party timeline
  const sorted = [...checkpoints].sort((a, b) => {
    const elA = calculateElapsedPartyMinutes(startTime, endTime, a.time);
    const elB = calculateElapsedPartyMinutes(startTime, endTime, b.time);
    return elA - elB;
  });

  let active: PartyCheckpoint | null = null;
  let next: PartyCheckpoint | null = null;
  let minutesUntilNext: number | null = null;

  for (const cp of sorted) {
    const cpElapsed = calculateElapsedPartyMinutes(startTime, endTime, cp.time);
    const diff = currentElapsed - cpElapsed;

    if (diff >= 0 && diff <= 30) {
      active = cp;
    } else if (cpElapsed > currentElapsed && !next) {
      next = cp;
      minutesUntilNext = cpElapsed - currentElapsed;
    }
  }

  return { active, next, minutesUntilNext };
}

/**
 * Formats remaining minutes into readable text (e.g. "in 25m" or "in 1h 15m").
 */
export function formatMinutesUntil(minutes: number | null): string {
  if (minutes === null) return '';
  if (minutes <= 0) return 'happening now';
  if (minutes < 60) return `in ${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `in ${h}h`;
  return `in ${h}h ${m}m`;
}

/**
 * Gets current wall-clock time in 'HH:mm' 24h format.
 */
export function getCurrentWallClockTime(): string {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Safely loads the party schedule from localStorage, falling back to DEFAULT_PARTY_SCHEDULE.
 */
export function loadPartySchedule(): PartyProgramSchedule {
  if (typeof window === 'undefined') return DEFAULT_PARTY_SCHEDULE;
  try {
    const raw = localStorage.getItem(PARTY_SCHEDULE_STORAGE_KEY);
    if (!raw) return DEFAULT_PARTY_SCHEDULE;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.startTime === 'string' && typeof parsed.endTime === 'string' && Array.isArray(parsed.checkpoints)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse stored party schedule:', err);
  }
  return DEFAULT_PARTY_SCHEDULE;
}

/**
 * Saves party schedule to localStorage.
 */
export function savePartySchedule(schedule: PartyProgramSchedule): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PARTY_SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
  } catch (err) {
    console.warn('Failed to save party schedule:', err);
  }
}
