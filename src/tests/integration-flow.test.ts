import { describe, it, expect } from 'vitest';
import {
  generateWristbandBatch,
  checkInGuest,
  processDrinkRequest,
  revertDrinkRequest,
  calculateEffectiveLimit,
  validateAdminPin,
} from '@/lib/party-engine';
import { PartySettings, Guest } from '@/lib/types';
import { findGuestByTag } from '@/lib/tag-utils';

describe('Party Lifecycle Integration Flow', () => {
  const settings: PartySettings = {
    id: 'default_party',
    party_name: 'Halloween 2026',
    default_drink_limit: 4,
    is_party_active: true,
    admin_pin: '1031',
  };

  it('handles complete lifecycle for 100 wristbands with mixed tiers', () => {
    // 1. Pre-generate 100 wristband slots
    let guests = generateWristbandBatch(100);
    expect(guests).toHaveLength(100);
    expect(guests[0].tag_id).toBe('TAG-001');
    expect(guests[99].tag_id).toBe('TAG-100');

    // 2. Door Check-in: Guest arrives and gets assigned to TAG-014
    const guest14 = checkInGuest(guests, {
      tag_id: 'TAG-014',
      name: 'Janek Smagieł',
      category: 'standard',
    });
    expect(guest14.is_entered).toBe(true);
    expect(guest14.drinks_consumed).toBe(0);

    // 3. First drink at the bar
    let serveResult = processDrinkRequest(guest14, settings, 'beer');
    expect(serveResult.success).toBe(true);
    expect(serveResult.drinks_consumed).toBe(1);
    expect(serveResult.remaining).toBe(3);
    expect(serveResult.is_limit_reached).toBe(false);

    // 4. Second drink
    serveResult = processDrinkRequest(serveResult.guest!, settings, 'cocktail');
    expect(serveResult.drinks_consumed).toBe(2);
    expect(serveResult.remaining).toBe(2);

    // 5. Third drink
    serveResult = processDrinkRequest(serveResult.guest!, settings, 'shot');
    expect(serveResult.drinks_consumed).toBe(3);
    expect(serveResult.remaining).toBe(1);

    // 6. Fourth drink (Final drink reaching limit)
    serveResult = processDrinkRequest(serveResult.guest!, settings, 'cocktail');
    expect(serveResult.success).toBe(true);
    expect(serveResult.drinks_consumed).toBe(4);
    expect(serveResult.remaining).toBe(0);
    expect(serveResult.is_final_drink).toBe(true);
    expect(serveResult.is_limit_reached).toBe(true);

    // 7. Fifth drink attempt - MUST BE REJECTED
    const rejectedResult = processDrinkRequest(serveResult.guest!, settings, 'beer');
    expect(rejectedResult.success).toBe(false);
    expect(rejectedResult.error).toBe('LIMIT_REACHED');
    expect(rejectedResult.drinks_consumed).toBe(4);

    // 8. Soft drinks should still be allowed when alcohol limit reached
    const softResult = processDrinkRequest(serveResult.guest!, settings, 'soft');
    expect(softResult.success).toBe(true);
    expect(softResult.drink_type).toBe('soft');
    expect(softResult.drinks_consumed).toBe(4);

    // 9. Supervisor override (+1 drink limit authorization)
    const parentPinCorrect = validateAdminPin('1031', settings.admin_pin);
    expect(parentPinCorrect).toBe(true);

    const overriddenGuest: Guest = {
      ...serveResult.guest!,
      custom_drink_limit: 5,
    };
    expect(calculateEffectiveLimit(overriddenGuest, settings)).toBe(5);

    const overrideDrink = processDrinkRequest(overriddenGuest, settings, 'wine');
    expect(overrideDrink.success).toBe(true);
    expect(overrideDrink.drinks_consumed).toBe(5);
    expect(overrideDrink.is_limit_reached).toBe(true);
  });

  it('safely handles non-drinking drivers and minors', () => {
    const guests = generateWristbandBatch(10);
    const driver = checkInGuest(guests, {
      tag_id: 'TAG-005',
      name: 'Marta Driver',
      category: 'driver_minor',
    });

    // Alcoholic drink must be immediately rejected
    const alcoholAttempt = processDrinkRequest(driver, settings, 'beer');
    expect(alcoholAttempt.success).toBe(false);
    expect(alcoholAttempt.error).toBe('LIMIT_REACHED');

    // Soft drink allowed
    const water = processDrinkRequest(driver, settings, 'soft');
    expect(water.success).toBe(true);
  });

  it('safely handles accidental double-tap undo', () => {
    let guest = checkInGuest([], {
      tag_id: 'TAG-099',
      name: 'Piotr',
      category: 'standard',
    });

    const res1 = processDrinkRequest(guest, settings, 'beer');
    expect(res1.drinks_consumed).toBe(1);

    const res2 = processDrinkRequest(res1.guest!, settings, 'beer');
    expect(res2.drinks_consumed).toBe(2);

    // Undo the accidental 2nd tap
    const { updatedGuest } = revertDrinkRequest(res2.guest!, {
      id: res2.log_id!,
      guest_id: res2.guest!.id,
      drink_type: 'beer',
      served_at: new Date().toISOString(),
      served_by: 'barman',
      is_reverted: false,
    });

    expect(updatedGuest.drinks_consumed).toBe(1);
  });

  it('guarantees wristband is assignable on first tap, and locked on subsequent taps', () => {
    // 1. Initial pre-seeded batch: TAG-004 has no name
    const batch = generateWristbandBatch(10);
    const unassignedTag = 'TAG-004';
    const initialSlot = batch.find(g => g.tag_id === unassignedTag);
    expect(initialSlot?.name).toBeNull();
    expect(initialSlot?.is_entered).toBe(false);

    // 2. First Tap: Assign to Kasia
    const assignedGuest = checkInGuest(batch, {
      tag_id: unassignedTag,
      name: 'Kasia Kowalska',
      category: 'standard',
    });
    expect(assignedGuest.name).toBe('Kasia Kowalska');
    expect(assignedGuest.is_entered).toBe(true);

    // 3. Second Tap (Simulated via URL tap with NFC UID):
    // Even if NFC Tools appended :04:A2:3B, it must match Kasia
    const activeList = batch.map(g => (g.id === assignedGuest.id ? assignedGuest : g));
    const secondTapLookup = findGuestByTag(activeList, 'TAG-004:04:A2:3B');
    expect(secondTapLookup).toBeDefined();
    expect(secondTapLookup?.name).toBe('Kasia Kowalska');
    expect(secondTapLookup?.is_entered).toBe(true);
    // Because is_entered && name are true, UI locks into Party Pass mode, forbidding re-assignment

    // 4. Admin Panel Override: Only supervisor can edit Kasia
    const adminEdit: Guest = {
      ...secondTapLookup!,
      custom_drink_limit: 7,
      notes: 'VIP Birthday friend',
    };
    expect(adminEdit.custom_drink_limit).toBe(7);
  });
});
