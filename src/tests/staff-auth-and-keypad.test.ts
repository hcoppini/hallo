import { describe, it, expect, beforeEach } from 'vitest';
import {
  isStaffAuthenticated,
  setStaffAuthenticated,
  authenticateStaff,
  logoutStaff,
  getStaffActiveDrinkType,
  setStaffActiveDrinkType,
} from '@/lib/auth';
import { parseTagId, findGuestByTag } from '@/lib/tag-utils';
import { generateWristbandBatch, checkInGuest, processDrinkRequest } from '@/lib/party-engine';
import { PartySettings } from '@/lib/types';

describe('Staff Auth & Speed Keypad Mechanics', () => {
  beforeEach(() => {
    logoutStaff();
  });

  it('manages staff authentication session correctly', () => {
    expect(isStaffAuthenticated()).toBe(false);

    setStaffAuthenticated(true);
    expect(isStaffAuthenticated()).toBe(true);

    logoutStaff();
    expect(isStaffAuthenticated()).toBe(false);

    const validPin = '2113';
    expect(authenticateStaff('9999', validPin)).toBe(false);
    expect(isStaffAuthenticated()).toBe(false);

    expect(authenticateStaff('2113', validPin)).toBe(true);
    expect(isStaffAuthenticated()).toBe(true);
  });

  it('persists preferred staff drink type across stations', () => {
    setStaffActiveDrinkType('beer');
    expect(getStaffActiveDrinkType()).toBe('beer');

    setStaffActiveDrinkType('shot');
    expect(getStaffActiveDrinkType()).toBe('shot');
  });

  it('resolves keypad digits to canonical wristband tags and processes drinks instantly', () => {
    const guests = generateWristbandBatch(100);
    const settings: PartySettings = {
      id: 'p1',
      party_name: 'Halloween 2026',
      default_drink_limit: 5,
      is_party_active: true,
      admin_pin: '2113',
    };

    // Check in guest #42
    const guest42 = checkInGuest(guests, {
      tag_id: 'TAG-042',
      name: 'Kasia Kowalska',
      category: 'standard',
    });

    // Bartender enters "42" on speed keypad
    const keypadInput = '42';
    const tagFromKeypad = `TAG-${parseInt(keypadInput, 10).toString().padStart(3, '0')}`;
    expect(tagFromKeypad).toBe('TAG-042');

    const matched = findGuestByTag([guest42], tagFromKeypad);
    expect(matched).not.toBeNull();
    expect(matched?.name).toBe('Kasia Kowalska');

    // Bartender logs drink in 1 tap
    const res = processDrinkRequest(matched!, settings, 'cocktail');
    expect(res.success).toBe(true);
    expect(res.drinks_consumed).toBe(1);
    expect(res.remaining).toBe(4);
  });
});
