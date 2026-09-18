import { describe, it, expect } from 'vitest';
import {
  calculateEffectiveLimit,
  processDrinkRequest,
  revertDrinkRequest,
  checkInGuest,
  validateAdminPin,
  generateWristbandBatch,
} from '@/lib/party-engine';
import { Guest, PartySettings, DrinkLog } from '@/lib/types';

const defaultSettings: PartySettings = {
  id: 'default_party',
  party_name: 'Halloween Birthday Party 2026',
  default_drink_limit: 5,
  is_party_active: true,
  admin_pin: '1031',
};

const createMockGuest = (overrides: Partial<Guest> = {}): Guest => ({
  id: 'GUEST-001',
  tag_id: 'TAG-001',
  name: 'Marta',
  category: 'standard',
  custom_drink_limit: null,
  drinks_consumed: 0,
  is_entered: true,
  entered_at: '2026-10-29T20:00:00Z',
  is_blocked: false,
  notes: null,
  ...overrides,
});

describe('Party Engine - Effective Limit Calculation', () => {
  it('should use default limit for standard guest with no custom limit', () => {
    const guest = createMockGuest({ category: 'standard', custom_drink_limit: null });
    expect(calculateEffectiveLimit(guest, defaultSettings)).toBe(5);
  });

  it('should prioritize custom drink limit over default limit', () => {
    const guest = createMockGuest({ category: 'standard', custom_drink_limit: 8 });
    expect(calculateEffectiveLimit(guest, defaultSettings)).toBe(8);
  });

  it('should return 0 for driver/minor category regardless of custom limit', () => {
    const guest = createMockGuest({ category: 'driver_minor', custom_drink_limit: 5 });
    expect(calculateEffectiveLimit(guest, defaultSettings)).toBe(0);
  });

  it('should return 999 for VIP guests', () => {
    const guest = createMockGuest({ category: 'vip' });
    expect(calculateEffectiveLimit(guest, defaultSettings)).toBe(999);
  });
});

describe('Party Engine - Drink Serving Logic', () => {
  it('should allow serving a drink when below limit and increment count', () => {
    const guest = createMockGuest({ drinks_consumed: 2 });
    const result = processDrinkRequest(guest, defaultSettings, 'beer');

    expect(result.success).toBe(true);
    expect(result.drinks_consumed).toBe(3);
    expect(result.remaining).toBe(2);
    expect(result.is_final_drink).toBe(false);
    expect(result.is_limit_reached).toBe(false);
  });

  it('should flag is_final_drink and is_limit_reached when reaching exact limit', () => {
    const guest = createMockGuest({ drinks_consumed: 4 });
    const result = processDrinkRequest(guest, defaultSettings, 'cocktail');

    expect(result.success).toBe(true);
    expect(result.drinks_consumed).toBe(5);
    expect(result.remaining).toBe(0);
    expect(result.is_final_drink).toBe(true);
    expect(result.is_limit_reached).toBe(true);
  });

  it('should REJECT drink when guest is already at limit', () => {
    const guest = createMockGuest({ drinks_consumed: 5 });
    const result = processDrinkRequest(guest, defaultSettings, 'shot');

    expect(result.success).toBe(false);
    expect(result.error).toBe('LIMIT_REACHED');
    expect(result.drinks_consumed).toBe(5);
    expect(result.remaining).toBe(0);
    expect(result.message).toContain('Drink limit reached');
  });

  it('should reject alcoholic drinks immediately for driver/minor (limit 0)', () => {
    const guest = createMockGuest({ category: 'driver_minor', drinks_consumed: 0 });
    const result = processDrinkRequest(guest, defaultSettings, 'wine');

    expect(result.success).toBe(false);
    expect(result.error).toBe('LIMIT_REACHED');
  });

  it('should always allow soft drinks without incrementing alcohol count', () => {
    const guest = createMockGuest({ drinks_consumed: 5 });
    const result = processDrinkRequest(guest, defaultSettings, 'soft');

    expect(result.success).toBe(true);
    expect(result.drinks_consumed).toBe(5);
    expect(result.drink_type).toBe('soft');
  });

  it('should reject if party is paused', () => {
    const pausedSettings: PartySettings = { ...defaultSettings, is_party_active: false };
    const guest = createMockGuest({ drinks_consumed: 1 });
    const result = processDrinkRequest(guest, pausedSettings, 'beer');

    expect(result.success).toBe(false);
    expect(result.error).toBe('PARTY_PAUSED');
  });

  it('should reject if guest is blocked by parents/bouncers', () => {
    const guest = createMockGuest({ is_blocked: true, drinks_consumed: 1 });
    const result = processDrinkRequest(guest, defaultSettings, 'beer');

    expect(result.success).toBe(false);
    expect(result.error).toBe('GUEST_BLOCKED');
  });

  it('should allow unlimited drinks for VIPs', () => {
    const guest = createMockGuest({ category: 'vip', drinks_consumed: 12 });
    const result = processDrinkRequest(guest, defaultSettings, 'cocktail');

    expect(result.success).toBe(true);
    expect(result.drinks_consumed).toBe(13);
    expect(result.is_limit_reached).toBe(false);
  });
});

describe('Party Engine - Undo & Revert Drink', () => {
  it('should decrement drinks_consumed when reverting an alcoholic drink', () => {
    const guest = createMockGuest({ drinks_consumed: 4 });
    const log: DrinkLog = {
      id: 'log-123',
      guest_id: guest.id,
      drink_type: 'beer',
      served_at: new Date().toISOString(),
      served_by: 'barman',
      is_reverted: false,
    };

    const { updatedGuest, revertedLog } = revertDrinkRequest(guest, log);
    expect(updatedGuest.drinks_consumed).toBe(3);
    expect(revertedLog.is_reverted).toBe(true);
  });

  it('should NOT decrement drinks_consumed when reverting a soft drink', () => {
    const guest = createMockGuest({ drinks_consumed: 3 });
    const log: DrinkLog = {
      id: 'log-124',
      guest_id: guest.id,
      drink_type: 'soft',
      served_at: new Date().toISOString(),
      served_by: 'barman',
      is_reverted: false,
    };

    const { updatedGuest, revertedLog } = revertDrinkRequest(guest, log);
    expect(updatedGuest.drinks_consumed).toBe(3);
    expect(revertedLog.is_reverted).toBe(true);
  });
});

describe('Party Engine - Door Check-In & Wristband Batching', () => {
  it('should successfully check in a new or pre-registered guest', () => {
    const pregeneratedGuests = generateWristbandBatch(10);
    expect(pregeneratedGuests).toHaveLength(10);

    const checkedIn = checkInGuest(pregeneratedGuests, {
      tag_id: 'TAG-003',
      name: 'Janek Smagieł',
      category: 'standard',
    });

    expect(checkedIn.is_entered).toBe(true);
    expect(checkedIn.name).toBe('Janek Smagieł');
    expect(checkedIn.entered_at).not.toBeNull();
  });

  it('should throw or return error if guest name is missing', () => {
    const pregeneratedGuests = generateWristbandBatch(10);
    expect(() => {
      checkInGuest(pregeneratedGuests, {
        tag_id: 'TAG-001',
        name: '   ',
      });
    }).toThrow('Guest name cannot be empty');
  });
});

describe('Party Engine - Security Admin PIN', () => {
  it('should validate matching PIN', () => {
    expect(validateAdminPin('1031', '1031')).toBe(true);
  });

  it('should reject wrong PIN', () => {
    expect(validateAdminPin('0000', '1031')).toBe(false);
    expect(validateAdminPin('', '1031')).toBe(false);
  });
});
