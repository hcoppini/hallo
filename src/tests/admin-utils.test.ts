import { describe, it, expect } from 'vitest';
import {
  isGuestActiveOrAssigned,
  extractEmbeddedUid,
  extractCleanNotes,
  mergeNotesWithUid,
  computeAdminKpis,
  filterAndSortGuests,
  getDrinkCategory,
} from '@/lib/admin-utils';
import { Guest, PartySettings, DrinkLog } from '@/lib/types';
import { generateWristbandBatch } from '@/lib/party-engine';

const mockSettings: PartySettings = {
  id: 'default_party',
  party_name: 'Halloween 2026',
  default_drink_limit: 5,
  is_party_active: true,
  admin_pin: '2113',
};

describe('Admin Utilities - Guest Activity & Note UID Preservation', () => {
  it('identifies active or assigned guests vs blank unassigned slots', () => {
    const batch = generateWristbandBatch(5);
    expect(isGuestActiveOrAssigned(batch[0])).toBe(false);

    expect(
      isGuestActiveOrAssigned({
        ...batch[0],
        name: 'Kasia Kowalska',
      })
    ).toBe(true);

    expect(
      isGuestActiveOrAssigned({
        ...batch[1],
        is_entered: true,
      })
    ).toBe(true);

    expect(
      isGuestActiveOrAssigned({
        ...batch[2],
        is_blocked: true,
      })
    ).toBe(true);
  });

  it('extracts and preserves embedded NFC hardware UID in notes when editing in Admin', () => {
    const rawNotes = '[UID:04A23B5F] Birthday girl sister';
    expect(extractEmbeddedUid(rawNotes)).toBe('04A23B5F');
    expect(extractCleanNotes(rawNotes)).toBe('Birthday girl sister');

    // Updating human note preserves the [UID:...] prefix
    const updated = mergeNotesWithUid('VIP table 2', rawNotes);
    expect(updated).toBe('[UID:04A23B5F] VIP table 2');

    // Clearing human note still preserves the [UID:...] prefix
    const clearedText = mergeNotesWithUid('   ', rawNotes);
    expect(clearedText).toBe('[UID:04A23B5F]');

    // Notes without UID behave normally
    expect(mergeNotesWithUid('Allergic to nuts', null)).toBe('Allergic to nuts');
    expect(mergeNotesWithUid('', null)).toBeNull();
  });

  it('maps specific bar drinks and general drink types to their category', () => {
    expect(getDrinkCategory('whiskey sour')).toBe('cocktail');
    expect(getDrinkCategory('mojito')).toBe('cocktail');
    expect(getDrinkCategory('cosmopolitan')).toBe('cocktail');
    expect(getDrinkCategory('jagerbomba')).toBe('shot');
    expect(getDrinkCategory('red wine')).toBe('wine');
    expect(getDrinkCategory('sparkling wine')).toBe('wine');
    expect(getDrinkCategory('beer')).toBe('beer');
    expect(getDrinkCategory('soft')).toBe('soft');
  });
});

describe('Admin Utilities - Live KPIs & Filtering/Sorting', () => {
  const baseBatch = generateWristbandBatch(10);
  const guests: Guest[] = baseBatch.map((g, idx) => {
    if (idx === 0) {
      return {
        ...g,
        name: 'Alice Standard',
        category: 'standard',
        is_entered: true,
        entered_at: '2026-10-29T20:00:00Z',
        drinks_consumed: 5, // At limit (5)
      };
    }
    if (idx === 1) {
      return {
        ...g,
        name: 'Bob NearLimit',
        category: 'standard',
        is_entered: true,
        entered_at: '2026-10-29T21:00:00Z',
        drinks_consumed: 4, // Near limit (4/5)
      };
    }
    if (idx === 2) {
      return {
        ...g,
        name: 'Charlie VIP',
        category: 'vip',
        is_entered: true,
        entered_at: '2026-10-29T21:30:00Z',
        drinks_consumed: 8,
      };
    }
    if (idx === 3) {
      return {
        ...g,
        name: 'Diana Driver',
        category: 'driver_minor',
        is_entered: true,
        entered_at: '2026-10-29T19:30:00Z',
        drinks_consumed: 0,
      };
    }
    if (idx === 4) {
      return {
        ...g,
        name: 'Eve Blocked',
        category: 'standard',
        is_entered: true,
        is_blocked: true,
        drinks_consumed: 2,
      };
    }
    return g; // 5..9 unassigned
  });

  const logs: DrinkLog[] = [
    {
      id: 'l1',
      guest_id: guests[0].id,
      drink_type: 'whiskey sour',
      served_at: '2026-10-29T21:00:00Z',
      served_by: 'barman',
      is_reverted: false,
    },
    {
      id: 'l2',
      guest_id: guests[0].id,
      drink_type: 'beer',
      served_at: '2026-10-29T21:10:00Z',
      served_by: 'barman',
      is_reverted: false,
    },
    {
      id: 'l3',
      guest_id: guests[3].id,
      drink_type: 'soft',
      served_at: '2026-10-29T21:15:00Z',
      served_by: 'barman',
      is_reverted: false,
    },
    {
      id: 'l4',
      guest_id: guests[1].id,
      drink_type: 'jagerbomba',
      served_at: '2026-10-29T21:20:00Z',
      served_by: 'barman',
      is_reverted: true,
    },
  ];

  it('computes accurate KPI summary and drink breakdown', () => {
    const kpis = computeAdminKpis(guests, logs, mockSettings);
    expect(kpis.totalSlots).toBe(10);
    expect(kpis.enteredCount).toBe(5);
    expect(kpis.enteredPercent).toBe(50);
    expect(kpis.activeCount).toBe(5);
    expect(kpis.unassignedCount).toBe(5);
    expect(kpis.atLimitCount).toBe(1); // Alice (Charlie is VIP so not at limit)
    expect(kpis.nearLimitCount).toBe(1); // Bob
    expect(kpis.vipCount).toBe(1);
    expect(kpis.driverCount).toBe(1);
    expect(kpis.blockedCount).toBe(1);

    expect(kpis.totalAlcoholServed).toBe(2); // 1 whiskey sour + 1 beer (jagerbomba is reverted)
    expect(kpis.totalSoftServed).toBe(1);
    expect(kpis.totalActiveLogs).toBe(3);
    expect(kpis.revertedLogsCount).toBe(1);
    expect(kpis.drinkBreakdown.cocktail).toBe(1);
    expect(kpis.drinkBreakdown.beer).toBe(1);
    expect(kpis.drinkBreakdown.soft).toBe(1);
    expect(kpis.drinkBreakdown.shot).toBe(0);
  });

  it('filters guests by active, at_limit, vip, driver, blocked, unassigned, and all', () => {
    expect(filterAndSortGuests(guests, mockSettings, { filter: 'active' })).toHaveLength(5);
    expect(filterAndSortGuests(guests, mockSettings, { filter: 'unassigned' })).toHaveLength(5);
    expect(filterAndSortGuests(guests, mockSettings, { filter: 'all' })).toHaveLength(10);

    const atLimit = filterAndSortGuests(guests, mockSettings, { filter: 'at_limit' });
    expect(atLimit).toHaveLength(1);
    expect(atLimit[0].name).toBe('Alice Standard');

    const vips = filterAndSortGuests(guests, mockSettings, { filter: 'vip' });
    expect(vips).toHaveLength(1);
    expect(vips[0].name).toBe('Charlie VIP');

    const drivers = filterAndSortGuests(guests, mockSettings, { filter: 'driver' });
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('Diana Driver');

    const blocked = filterAndSortGuests(guests, mockSettings, { filter: 'blocked' });
    expect(blocked).toHaveLength(1);
    expect(blocked[0].name).toBe('Eve Blocked');
  });

  it('allows searching unassigned tags even when filter is active', () => {
    const searchUnassigned = filterAndSortGuests(guests, mockSettings, {
      filter: 'active',
      search: 'TAG-009',
    });
    expect(searchUnassigned).toHaveLength(1);
    expect(searchUnassigned[0].tag_id).toBe('TAG-009');
  });

  it('sorts guests by drinks_desc, recent_entry, and name_asc', () => {
    const byDrinks = filterAndSortGuests(guests, mockSettings, {
      filter: 'active',
      sort: 'drinks_desc',
    });
    expect(byDrinks[0].name).toBe('Charlie VIP'); // 8
    expect(byDrinks[1].name).toBe('Alice Standard'); // 5

    const byRecent = filterAndSortGuests(guests, mockSettings, {
      filter: 'active',
      sort: 'recent_entry',
    });
    expect(byRecent[0].name).toBe('Charlie VIP'); // 21:30
    expect(byRecent[1].name).toBe('Bob NearLimit'); // 21:00
  });
});
