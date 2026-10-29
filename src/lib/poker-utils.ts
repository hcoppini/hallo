/**
 * Poker & Party Hub Utilities
 * Configured for hcoppini/piker hosted on Vercel
 */

import {
  PartyProgramSchedule,
  loadPartySchedule,
  getCheckpointStatus,
} from './party-schedule-utils';

export interface PokerSettings {
  tableName: string;
  qrUrl: string;
  blinds: string;
  buyIn: string;
  blindInterval: string;
  status: 'active' | 'upcoming' | 'paused';
  notes?: string;
}

export const DEFAULT_POKER_SETTINGS: PokerSettings = {
  tableName: 'Piker High-Stakes Tournament',
  qrUrl: 'https://piker-toicupinis-projects.vercel.app',
  blinds: '1 / 2 (Doubles every 7 min)',
  buyIn: 'Rapid 11-Level Heats',
  blindInterval: '7 min levels (30–40m game)',
  status: 'upcoming',
  notes: 'Scan to join table & view live synced poker clock & leaderboard from hcoppini/piker',
};

export const POKER_STORAGE_KEY = 'halloween_party_poker_v1';

export function loadPokerSettings(): PokerSettings {
  if (typeof window === 'undefined') return DEFAULT_POKER_SETTINGS;
  try {
    const raw = localStorage.getItem(POKER_STORAGE_KEY);
    if (!raw) return DEFAULT_POKER_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_POKER_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_POKER_SETTINGS;
  }
}

export function savePokerSettings(settings: PokerSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POKER_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save poker settings:', err);
  }
}

export interface PartyCustomQr {
  id: string;
  title: string;
  url: string;
  icon: 'poker' | 'music' | 'camera' | 'wifi';
  subtitle: string;
}

export const DEFAULT_PARTY_QRS: PartyCustomQr[] = [
  {
    id: 'poker-main',
    title: 'Piker Tournament Clock',
    url: 'https://piker-toicupinis-projects.vercel.app',
    icon: 'poker',
    subtitle: 'Scan for live blinds, chip counts & seating (hcoppini/piker)',
  },
  {
    id: 'song-requests',
    title: 'Song Request Queue',
    url: 'https://youtube.com',
    icon: 'music',
    subtitle: 'Request a track for the projector queue',
  },
  {
    id: 'photo-shared',
    title: 'Party Photo Drop',
    url: 'https://photos.google.com',
    icon: 'camera',
    subtitle: 'Upload party photos to the shared album',
  },
];

export const PARTY_QRS_STORAGE_KEY = 'halloween_party_custom_qrs_v1';

export function loadPartyQrs(): PartyCustomQr[] {
  if (typeof window === 'undefined') return DEFAULT_PARTY_QRS;
  try {
    const pokerSettings = loadPokerSettings();
    const raw = localStorage.getItem(PARTY_QRS_STORAGE_KEY);
    let items = DEFAULT_PARTY_QRS;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) items = parsed;
    }
    return items.map(q => {
      if (q.id === 'poker-main' && pokerSettings.qrUrl) {
        return {
          ...q,
          url: pokerSettings.qrUrl,
          title: pokerSettings.tableName || q.title,
        };
      }
      return q;
    });
  } catch {}
  return DEFAULT_PARTY_QRS;
}

export function savePartyQrs(qrs: PartyCustomQr[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PARTY_QRS_STORAGE_KEY, JSON.stringify(qrs));
  } catch (err) {
    console.warn('Failed to save custom party QRs:', err);
  }
}

/**
 * Extracts level duration in minutes from blind interval string.
 * e.g. "7 min levels" -> 7
 */
export function extractLevelMinutes(blindInterval?: string, defaultMins = 7): number {
  if (!blindInterval) return defaultMins;
  const match = blindInterval.match(/(\d+)\s*min/i);
  return match ? parseInt(match[1], 10) : defaultMins;
}

/**
 * Formats seconds into MM:SS format.
 */
export function formatTimer(totalSec: number): string {
  const safeSec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safeSec / 60);
  const s = safeSec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Checks if the poker tournament checkpoint is currently scheduled/active right now
 * according to the party timeline schedule.
 */
export function isPokerScheduledNow(
  schedule?: PartyProgramSchedule,
  currentTime?: string
): boolean {
  const activeSchedule = schedule || (typeof window !== 'undefined' ? loadPartySchedule() : undefined);
  if (!activeSchedule || !Array.isArray(activeSchedule.checkpoints)) return false;

  const now = currentTime || new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return activeSchedule.checkpoints.some(cp => {
    const isPokerCp = cp.icon === 'cards' || cp.title.toLowerCase().includes('poker');
    if (!isPokerCp) return false;
    const status = getCheckpointStatus(activeSchedule.startTime, activeSchedule.endTime, now, cp.time);
    return status === 'current';
  });
}

/**
 * Determines whether the poker round timer should actually be running.
 * The timer works ONLY when the game is actually active:
 * - When manually activated (status === 'active')
 * - OR when reached on the party schedule (status === 'upcoming' && isScheduledNow === true)
 * If paused or upcoming (and not scheduled now), the timer does NOT run.
 */
export function isPokerGameActive(
  status: PokerSettings['status'],
  isScheduledNow = false
): boolean {
  if (status === 'paused') return false;
  if (status === 'active') return true;
  if (status === 'upcoming' && isScheduledNow) return true;
  return false;
}
