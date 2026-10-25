/**
 * Projector Feed Utilities
 * Handles guest arrival sorting, attendance metrics, and clean wall-clock / relative time formatting.
 */

import { Guest } from './types';
import { parseTagId } from './tag-utils';

export interface ProjectorVenueStats {
  totalEntered: number;
  totalCapacity: number;
  fillPercentage: number;
  recentEntriesCount: number;
}

/**
 * Returns entered guests sorted chronologically (most recently admitted first).
 */
export function getEnteredGuestsSorted(guests: Guest[]): Guest[] {
  return guests
    .filter(g => g.is_entered)
    .sort((a, b) => {
      const timeA = a.entered_at ? new Date(a.entered_at).getTime() : 0;
      const timeB = b.entered_at ? new Date(b.entered_at).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      // Secondary sort: numeric tag descending
      const tagA = parseTagId(a.tag_id).tagNumber || 0;
      const tagB = parseTagId(b.tag_id).tagNumber || 0;
      return tagB - tagA;
    });
}

/**
 * Calculates genuine venue attendance stats without placeholder pills.
 */
export function calculateProjectorStats(guests: Guest[], recentMinutesWindow = 30): ProjectorVenueStats {
  const entered = guests.filter(g => g.is_entered);
  const totalEntered = entered.length;
  const totalCapacity = guests.length || 100;
  const fillPercentage = Math.min(100, Math.round((totalEntered / totalCapacity) * 100));

  const now = Date.now();
  const windowMs = recentMinutesWindow * 60 * 1000;
  const recentEntriesCount = entered.filter(g => {
    if (!g.entered_at) return false;
    const diff = now - new Date(g.entered_at).getTime();
    return diff >= 0 && diff <= windowMs;
  }).length;

  return {
    totalEntered,
    totalCapacity,
    fillPercentage,
    recentEntriesCount,
  };
}

/**
 * Formats arrival time into a clean wall-clock timestamp (e.g. "21:45" or "10:15 PM").
 */
export function formatWallClockTime(isoString: string | null): string {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return 'Recently';
  }
}

/**
 * Formats relative arrival time (e.g. "Just now", "2m ago", "1h ago").
 */
export function formatRelativeTime(isoString: string | null, referenceNow: number = Date.now()): string {
  if (!isoString) return 'Just now';
  try {
    const time = new Date(isoString).getTime();
    if (isNaN(time)) return 'Just now';
    const diffSeconds = Math.floor((referenceNow - time) / 1000);

    if (diffSeconds < 45) return 'Just now';
    if (diffSeconds < 90) return '1m ago';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 7200) return '1h ago';
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  } catch {
    return 'Recently';
  }
}

/**
 * Cleanly maps guest categories to dignified labels without placeholder pill styling.
 */
export function formatCategoryLabel(category: Guest['category']): string {
  switch (category) {
    case 'vip':
      return 'VIP Guest';
    case 'driver_minor':
      return 'Designated Driver';
    default:
      return 'Party Guest';
  }
}
