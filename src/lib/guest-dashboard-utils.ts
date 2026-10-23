import { Guest, PartySettings, DrinkLog, formatDrinkHistoryLabel } from './types';
import { calculateEffectiveLimit } from './party-engine';
import { DrinkCategory, getDrinkCategory } from './admin-utils';
import { parseTagId } from './tag-utils';

export interface CooldownGuestItem {
  guest: Guest;
  displayName: string;
  tagLabel: string;
  drinksConsumed: number;
  effectiveLimit: number;
  lastDrinkAt: string | null;
}

export interface LastOrderInfo {
  log: DrinkLog;
  drinkLabel: string;
  drinkCategory: DrinkCategory;
  guestName: string;
  tagLabel: string;
  servedAt: string;
}

export interface TopDrinkInfo {
  drinkType: string;
  drinkLabel: string;
  drinkCategory: DrinkCategory;
  count: number;
  sharePercent: number;
}

export interface GuestDashboardStats {
  personalLogs: DrinkLog[];
  effectiveLimit: number;
  remainingDrinks: number;
  isGuestOnCooldown: boolean;
  progressPercent: number;
  cooldownGuests: CooldownGuestItem[];
  lastOrder: LastOrderInfo | null;
  topDrink: TopDrinkInfo | null;
  partyPulse: {
    guestsCheckedIn: number;
    totalDrinksPoured: number;
    cooldownCount: number;
  };
}

export function formatShortTagLabel(tagId: string): string {
  const parsed = parseTagId(tagId);
  if (parsed.tagNumber !== null) {
    return `#${parsed.tagNumber}`;
  }
  return parsed.canonicalTag || tagId;
}

export function computeGuestDashboardStats(
  guests: Guest[],
  logs: DrinkLog[],
  settings: PartySettings,
  activeGuest: Guest | null
): GuestDashboardStats {
  const activeLogs = logs
    .filter(l => !l.is_reverted)
    .sort((a, b) => new Date(b.served_at).getTime() - new Date(a.served_at).getTime());

  const guestMap = new Map<string, Guest>();
  for (const g of guests) {
    guestMap.set(g.id, g);
  }

  // 1. Personal History & Limit
  const personalLogs = activeGuest
    ? activeLogs.filter(l => l.guest_id === activeGuest.id)
    : [];

  const effectiveLimit = activeGuest
    ? calculateEffectiveLimit(activeGuest, settings)
    : settings.default_drink_limit;

  const isVip = activeGuest?.category === 'vip';
  const drinksConsumed = activeGuest?.drinks_consumed ?? 0;
  const remainingDrinks = isVip ? 999 : Math.max(0, effectiveLimit - drinksConsumed);

  const isGuestOnCooldown = Boolean(
    activeGuest &&
      ((!isVip &&
        activeGuest.category !== 'driver_minor' &&
        effectiveLimit > 0 &&
        drinksConsumed >= effectiveLimit) ||
        activeGuest.is_blocked)
  );

  let progressPercent = 0;
  if (activeGuest) {
    if (isVip) {
      const vipRef = Math.max(10, settings.default_drink_limit * 2);
      progressPercent = Math.min(100, (drinksConsumed / vipRef) * 100);
    } else if (effectiveLimit <= 0) {
      progressPercent = 100;
    } else {
      progressPercent = Math.min(100, (drinksConsumed / effectiveLimit) * 100);
    }
  }

  // 2. Who's Already on Cooldown (Reached max limit or blocked among entered/active guests)
  const latestLogTimeByGuest = new Map<string, string>();
  for (const log of activeLogs) {
    if (!latestLogTimeByGuest.has(log.guest_id)) {
      latestLogTimeByGuest.set(log.guest_id, log.served_at);
    }
  }

  const cooldownGuests: CooldownGuestItem[] = [];
  let guestsCheckedIn = 0;

  for (const g of guests) {
    if (g.is_entered) {
      guestsCheckedIn++;
    }

    const hasEnteredOrNamed = Boolean(g.is_entered || (g.name && g.name.trim().length > 0));
    if (!hasEnteredOrNamed) continue;

    const limit = calculateEffectiveLimit(g, settings);
    const hitDrinkLimit =
      g.category !== 'vip' &&
      g.category !== 'driver_minor' &&
      limit > 0 &&
      g.drinks_consumed >= limit;

    if (hitDrinkLimit || g.is_blocked) {
      cooldownGuests.push({
        guest: g,
        displayName: g.name?.trim() || g.tag_id,
        tagLabel: formatShortTagLabel(g.tag_id),
        drinksConsumed: g.drinks_consumed,
        effectiveLimit: limit,
        lastDrinkAt: latestLogTimeByGuest.get(g.id) || g.updated_at || null,
      });
    }
  }

  cooldownGuests.sort((a, b) => {
    const timeA = a.lastDrinkAt ? new Date(a.lastDrinkAt).getTime() : 0;
    const timeB = b.lastDrinkAt ? new Date(b.lastDrinkAt).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return b.drinksConsumed - a.drinksConsumed;
  });

  // 3. Last Order at the Bar
  let lastOrder: LastOrderInfo | null = null;
  if (activeLogs.length > 0) {
    const latest = activeLogs[0];
    const orderGuest = guestMap.get(latest.guest_id);
    lastOrder = {
      log: latest,
      drinkLabel: formatDrinkHistoryLabel(latest.drink_type),
      drinkCategory: getDrinkCategory(latest.drink_type),
      guestName: orderGuest?.name?.trim() || orderGuest?.tag_id || 'Party Guest',
      tagLabel: orderGuest ? formatShortTagLabel(orderGuest.tag_id) : '',
      servedAt: latest.served_at,
    };
  }

  // 4. Most Popular Drink of the Night & Total Drinks
  const drinkCounts = new Map<string, number>();
  let totalDrinksPoured = 0;

  for (const log of activeLogs) {
    if (log.drink_type !== 'soft') {
      totalDrinksPoured++;
    }
    const key = log.drink_type.trim().toLowerCase();
    drinkCounts.set(key, (drinkCounts.get(key) || 0) + 1);
  }

  let topDrink: TopDrinkInfo | null = null;
  if (drinkCounts.size > 0) {
    let bestType = '';
    let bestCount = 0;
    for (const [type, count] of drinkCounts.entries()) {
      if (count > bestCount) {
        bestType = type;
        bestCount = count;
      }
    }
    if (bestType) {
      topDrink = {
        drinkType: bestType,
        drinkLabel: formatDrinkHistoryLabel(bestType),
        drinkCategory: getDrinkCategory(bestType),
        count: bestCount,
        sharePercent: Math.round((bestCount / activeLogs.length) * 100),
      };
    }
  }

  return {
    personalLogs,
    effectiveLimit,
    remainingDrinks,
    isGuestOnCooldown,
    progressPercent,
    cooldownGuests,
    lastOrder,
    topDrink,
    partyPulse: {
      guestsCheckedIn,
      totalDrinksPoured,
      cooldownCount: cooldownGuests.length,
    },
  };
}
