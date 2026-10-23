import { describe, it, expect } from 'vitest';
import { computeGuestDashboardStats, formatShortTagLabel } from '@/lib/guest-dashboard-utils';
import { generateWristbandBatch } from '@/lib/party-engine';
import { Guest, PartySettings, DrinkLog } from '@/lib/types';

const mockSettings: PartySettings = {
  id: 'default_party',
  party_name: 'Halloween 2026',
  default_drink_limit: 4,
  is_party_active: true,
  admin_pin: '2113',
};

describe('Guest Dashboard Stats Computation', () => {
  const baseBatch = generateWristbandBatch(10);

  const guests: Guest[] = baseBatch.map((g, idx) => {
    if (idx === 0) {
      // TAG-001: Active standard guest, 2/4 drinks
      return {
        ...g,
        name: 'Kasia Kowalska',
        category: 'standard',
        is_entered: true,
        entered_at: '2026-10-29T20:00:00Z',
        drinks_consumed: 2,
      };
    }
    if (idx === 1) {
      // TAG-002: Standard guest on cooldown (4/4 drinks)
      return {
        ...g,
        name: 'Marek Maxed',
        category: 'standard',
        is_entered: true,
        entered_at: '2026-10-29T20:15:00Z',
        drinks_consumed: 4,
      };
    }
    if (idx === 2) {
      // TAG-003: VIP guest with 6 drinks (never on cooldown)
      return {
        ...g,
        name: 'Zofia VIP',
        category: 'vip',
        is_entered: true,
        entered_at: '2026-10-29T20:30:00Z',
        drinks_consumed: 6,
      };
    }
    if (idx === 3) {
      // TAG-004: Driver with 0 alc limit (not counted on alcohol cooldown wall)
      return {
        ...g,
        name: 'Tomek Driver',
        category: 'driver_minor',
        is_entered: true,
        entered_at: '2026-10-29T20:45:00Z',
        drinks_consumed: 0,
      };
    }
    return g;
  });

  const logs: DrinkLog[] = [
    {
      id: 'log-1',
      guest_id: guests[0].id,
      drink_type: 'mojito',
      served_at: '2026-10-29T21:00:00Z',
      served_by: 'barman',
      is_reverted: false,
    },
    {
      id: 'log-2',
      guest_id: guests[1].id,
      drink_type: 'jagerbomba',
      served_at: '2026-10-29T21:10:00Z',
      served_by: 'barman',
      is_reverted: false,
    },
    {
      id: 'log-3',
      guest_id: guests[0].id,
      drink_type: 'mojito',
      served_at: '2026-10-29T21:20:00Z',
      served_by: 'barman',
      is_reverted: false,
    },
    {
      id: 'log-4',
      guest_id: guests[2].id,
      drink_type: 'whiskey sour',
      served_at: '2026-10-29T21:30:00Z',
      served_by: 'barman',
      is_reverted: false,
    },
    {
      id: 'log-5',
      guest_id: guests[1].id,
      drink_type: 'beer',
      served_at: '2026-10-29T21:40:00Z',
      served_by: 'barman',
      is_reverted: true, // Reverted log should be ignored!
    },
  ];

  it('formats short wristband tag labels cleanly', () => {
    expect(formatShortTagLabel('TAG-007')).toBe('#7');
    expect(formatShortTagLabel('TAG-042')).toBe('#42');
  });

  it('computes personal history, last order, cooldown wall, top drink, and party pulse accurately', () => {
    const activeGuest = guests[0]; // Kasia
    const stats = computeGuestDashboardStats(guests, logs, mockSettings, activeGuest);

    // 1. Personal History for Kasia
    expect(stats.personalLogs).toHaveLength(2);
    expect(stats.personalLogs[0].id).toBe('log-3'); // Newest first
    expect(stats.personalLogs[1].id).toBe('log-1');
    expect(stats.effectiveLimit).toBe(4);
    expect(stats.remainingDrinks).toBe(2);
    expect(stats.isGuestOnCooldown).toBe(false);
    expect(stats.progressPercent).toBe(50);

    // 2. Who's on Cooldown (only Marek at 4/4; Zofia is VIP, Tomek is Driver)
    expect(stats.cooldownGuests).toHaveLength(1);
    expect(stats.cooldownGuests[0].displayName).toBe('Marek Maxed');
    expect(stats.cooldownGuests[0].tagLabel).toBe('#2');
    expect(stats.cooldownGuests[0].drinksConsumed).toBe(4);
    expect(stats.cooldownGuests[0].effectiveLimit).toBe(4);

    // 3. Last Order at the Bar (log-4 by Zofia, since log-5 was reverted)
    expect(stats.lastOrder).not.toBeNull();
    expect(stats.lastOrder?.log.id).toBe('log-4');
    expect(stats.lastOrder?.guestName).toBe('Zofia VIP');
    expect(stats.lastOrder?.drinkLabel).toBe('Cocktail - Whiskey Sour');
    expect(stats.lastOrder?.tagLabel).toBe('#3');

    // 4. Top Drink of the Night (mojito with 2 orders out of 4 active orders = 50%)
    expect(stats.topDrink).not.toBeNull();
    expect(stats.topDrink?.drinkType).toBe('mojito');
    expect(stats.topDrink?.count).toBe(2);
    expect(stats.topDrink?.sharePercent).toBe(50);

    // 5. Party Pulse
    expect(stats.partyPulse.guestsCheckedIn).toBe(4);
    expect(stats.partyPulse.totalDrinksPoured).toBe(4);
    expect(stats.partyPulse.cooldownCount).toBe(1);
  });

  it('flags activeGuest as on cooldown when they reach their drink limit', () => {
    const maxedGuest = guests[1]; // Marek (4/4)
    const stats = computeGuestDashboardStats(guests, logs, mockSettings, maxedGuest);

    expect(stats.isGuestOnCooldown).toBe(true);
    expect(stats.remainingDrinks).toBe(0);
    expect(stats.progressPercent).toBe(100);
  });
});
