import { Guest, PartySettings, DrinkLog, DrinkType, BAR_DRINKS } from './types';
import { calculateEffectiveLimit } from './party-engine';
import { parseTagId } from './tag-utils';

export type AdminGuestFilter =
  | 'active'
  | 'entered'
  | 'at_limit'
  | 'vip'
  | 'driver'
  | 'blocked'
  | 'unassigned'
  | 'all';

export type AdminGuestSort = 'tag_asc' | 'drinks_desc' | 'recent_entry' | 'name_asc';

export type DrinkCategory = 'cocktail' | 'beer' | 'shot' | 'wine' | 'soft';

export interface AdminKpiSummary {
  totalSlots: number;
  enteredCount: number;
  enteredPercent: number;
  activeCount: number;
  unassignedCount: number;
  atLimitCount: number;
  nearLimitCount: number;
  vipCount: number;
  driverCount: number;
  blockedCount: number;
  totalAlcoholServed: number;
  totalSoftServed: number;
  totalActiveLogs: number;
  revertedLogsCount: number;
  drinkBreakdown: Record<DrinkCategory, number>;
}

/**
 * Maps any specific or general DrinkType to its high-level DrinkCategory
 */
export function getDrinkCategory(drinkType: DrinkType | string): DrinkCategory {
  const normalized = (drinkType || '').trim().toLowerCase();
  if (normalized === 'soft') return 'soft';
  const barOption = BAR_DRINKS.find(d => d.type === normalized);
  if (barOption) return barOption.category;
  if (normalized === 'beer') return 'beer';
  if (normalized === 'shot') return 'shot';
  if (normalized === 'wine') return 'wine';
  return 'cocktail';
}

/**
 * Determines whether a wristband slot is assigned or active in the party
 */
export function isGuestActiveOrAssigned(guest: Guest): boolean {
  const hasName = Boolean(guest.name && guest.name.trim().length > 0);
  return Boolean(guest.is_entered || hasName || guest.drinks_consumed > 0 || guest.is_blocked);
}

/**
 * Extracts any embedded [UID:...] token from guest.notes
 */
export function extractEmbeddedUid(notes: string | null | undefined, hardwareUid?: string | null): string | null {
  if (hardwareUid && hardwareUid.trim()) {
    return hardwareUid.trim().toUpperCase();
  }
  if (!notes) return null;
  const match = notes.match(/\[UID:([^\]]+)\]/i);
  return match ? match[1].trim().toUpperCase() : null;
}

/**
 * Returns human-readable notes with any internal [UID:...] token stripped
 */
export function extractCleanNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  return notes.replace(/\[UID:[^\]]+\]/gi, '').trim();
}

/**
 * Re-combines human-readable notes with any previously embedded [UID:...] token
 */
export function mergeNotesWithUid(
  cleanNotes: string,
  originalNotes: string | null | undefined
): string | null {
  const trimmedClean = cleanNotes.replace(/\[UID:[^\]]+\]/gi, '').trim();
  const existingUid = extractEmbeddedUid(originalNotes);

  if (existingUid) {
    return trimmedClean ? `[UID:${existingUid}] ${trimmedClean}` : `[UID:${existingUid}]`;
  }

  return trimmedClean || null;
}

/**
 * Computes live telemetry and KPI counts for the Admin Panel
 */
export function computeAdminKpis(
  guests: Guest[],
  logs: DrinkLog[],
  settings: PartySettings
): AdminKpiSummary {
  const totalSlots = guests.length;
  let enteredCount = 0;
  let activeCount = 0;
  let unassignedCount = 0;
  let atLimitCount = 0;
  let nearLimitCount = 0;
  let vipCount = 0;
  let driverCount = 0;
  let blockedCount = 0;

  for (const g of guests) {
    const isActive = isGuestActiveOrAssigned(g);
    if (isActive) {
      activeCount++;
    } else {
      unassignedCount++;
    }

    if (g.is_entered) enteredCount++;
    if (g.is_blocked) blockedCount++;
    if (g.category === 'vip') vipCount++;
    if (g.category === 'driver_minor') driverCount++;

    const limit = calculateEffectiveLimit(g, settings);
    if (g.category !== 'vip' && g.category !== 'driver_minor') {
      if (g.drinks_consumed >= limit && limit > 0) {
        atLimitCount++;
      } else if (limit > 1 && g.drinks_consumed === limit - 1) {
        nearLimitCount++;
      }
    }
  }

  const drinkBreakdown: Record<DrinkCategory, number> = {
    cocktail: 0,
    beer: 0,
    shot: 0,
    wine: 0,
    soft: 0,
  };

  let totalAlcoholServed = 0;
  let totalSoftServed = 0;
  let totalActiveLogs = 0;
  let revertedLogsCount = 0;

  for (const log of logs) {
    if (log.is_reverted) {
      revertedLogsCount++;
      continue;
    }
    totalActiveLogs++;
    const category = getDrinkCategory(log.drink_type);
    drinkBreakdown[category]++;

    if (category === 'soft') {
      totalSoftServed++;
    } else {
      totalAlcoholServed++;
    }
  }

  const enteredPercent = totalSlots > 0 ? Math.round((enteredCount / totalSlots) * 100) : 0;

  return {
    totalSlots,
    enteredCount,
    enteredPercent,
    activeCount,
    unassignedCount,
    atLimitCount,
    nearLimitCount,
    vipCount,
    driverCount,
    blockedCount,
    totalAlcoholServed,
    totalSoftServed,
    totalActiveLogs,
    revertedLogsCount,
    drinkBreakdown,
  };
}

/**
 * Filters and sorts the guest list for the Admin Guest Registry
 */
export function filterAndSortGuests(
  guests: Guest[],
  settings: PartySettings,
  options: {
    search?: string;
    filter?: AdminGuestFilter;
    sort?: AdminGuestSort;
  }
): Guest[] {
  const q = (options.search || '').trim().toLowerCase();
  const filter = options.filter || 'active';
  const sort = options.sort || 'tag_asc';

  const filtered = guests.filter(g => {
    const cleanNotes = extractCleanNotes(g.notes).toLowerCase();
    const matchesSearch =
      !q ||
      Boolean(g.name && g.name.toLowerCase().includes(q)) ||
      g.tag_id.toLowerCase().includes(q) ||
      g.id.toLowerCase().includes(q) ||
      cleanNotes.includes(q);

    if (!matchesSearch) return false;

    const isActive = isGuestActiveOrAssigned(g);
    const limit = calculateEffectiveLimit(g, settings);
    const isAtLimit =
      g.category !== 'vip' &&
      g.category !== 'driver_minor' &&
      limit > 0 &&
      g.drinks_consumed >= limit;

    switch (filter) {
      case 'active':
        return q.length > 0 ? true : isActive;
      case 'entered':
        return g.is_entered;
      case 'at_limit':
        return isAtLimit;
      case 'vip':
        return g.category === 'vip';
      case 'driver':
        return g.category === 'driver_minor';
      case 'blocked':
        return g.is_blocked;
      case 'unassigned':
        return !isActive;
      case 'all':
      default:
        return true;
    }
  });

  return [...filtered].sort((a, b) => {
    if (sort === 'drinks_desc') {
      if (b.drinks_consumed !== a.drinks_consumed) {
        return b.drinks_consumed - a.drinks_consumed;
      }
    } else if (sort === 'recent_entry') {
      const timeA = a.entered_at ? new Date(a.entered_at).getTime() : 0;
      const timeB = b.entered_at ? new Date(b.entered_at).getTime() : 0;
      if (timeB !== timeA) {
        return timeB - timeA;
      }
    } else if (sort === 'name_asc') {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      if (nameA && nameB && nameA !== nameB) {
        return nameA.localeCompare(nameB);
      }
      if (nameA && !nameB) return -1;
      if (!nameA && nameB) return 1;
    }

    const numA = parseTagId(a.tag_id).tagNumber ?? 9999;
    const numB = parseTagId(b.tag_id).tagNumber ?? 9999;
    return numA - numB;
  });
}
