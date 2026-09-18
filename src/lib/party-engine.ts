import { Guest, PartySettings, DrinkType, ServeDrinkResult, DoorCheckInInput, DrinkLog } from './types';

/**
 * Calculates the effective drink limit for a guest.
 * Hierarchy:
 * 1. VIP -> 999 (Unlimited)
 * 2. Driver / Minor -> 0
 * 3. Custom Guest Override -> guest.custom_drink_limit
 * 4. Party Global Default -> settings.default_drink_limit
 */
export function calculateEffectiveLimit(guest: Guest, settings: PartySettings): number {
  if (guest.category === 'vip') {
    return 999;
  }
  if (guest.category === 'driver_minor') {
    return 0;
  }
  if (guest.custom_drink_limit !== null && guest.custom_drink_limit !== undefined) {
    return guest.custom_drink_limit;
  }
  return settings.default_drink_limit;
}

/**
 * Evaluates whether a drink can be served to a guest and produces the new state.
 */
export function processDrinkRequest(
  guest: Guest,
  settings: PartySettings,
  drinkType: DrinkType = 'cocktail'
): ServeDrinkResult {
  // Check if party bar is active
  if (!settings.is_party_active) {
    return {
      success: false,
      error: 'PARTY_PAUSED',
      message: 'The party bar service is currently paused by organizers.',
      guest,
      drinks_consumed: guest.drinks_consumed,
    };
  }

  // Check if guest is blocked/banned
  if (guest.is_blocked) {
    return {
      success: false,
      error: 'GUEST_BLOCKED',
      message: 'This wristband has been disabled by organizers.',
      guest,
      drinks_consumed: guest.drinks_consumed,
    };
  }

  const effectiveLimit = calculateEffectiveLimit(guest, settings);

  // Soft drinks do not count against the alcoholic limit
  if (drinkType === 'soft') {
    return {
      success: true,
      guest,
      guest_id: guest.id,
      name: guest.name || `Guest ${guest.id}`,
      drink_type: 'soft',
      drinks_consumed: guest.drinks_consumed,
      effective_limit: effectiveLimit,
      remaining: Math.max(0, effectiveLimit - guest.drinks_consumed),
      is_final_drink: false,
      is_limit_reached: guest.category !== 'vip' && guest.drinks_consumed >= effectiveLimit,
      log_id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  // Check limit for alcoholic drinks
  if (guest.category !== 'vip' && guest.drinks_consumed >= effectiveLimit) {
    return {
      success: false,
      error: 'LIMIT_REACHED',
      message: `Drink limit reached (${guest.drinks_consumed}/${effectiveLimit}). Do not serve alcohol!`,
      guest,
      guest_id: guest.id,
      name: guest.name || `Guest ${guest.id}`,
      drink_type: drinkType,
      drinks_consumed: guest.drinks_consumed,
      effective_limit: effectiveLimit,
      remaining: 0,
      is_limit_reached: true,
    };
  }

  const newCount = guest.drinks_consumed + 1;
  const isFinalDrink = guest.category !== 'vip' && newCount === effectiveLimit;
  const isLimitReached = guest.category !== 'vip' && newCount >= effectiveLimit;
  const remaining = Math.max(0, effectiveLimit - newCount);

  const updatedGuest: Guest = {
    ...guest,
    drinks_consumed: newCount,
    updated_at: new Date().toISOString(),
  };

  return {
    success: true,
    guest: updatedGuest,
    guest_id: guest.id,
    name: guest.name || `Guest ${guest.id}`,
    drink_type: drinkType,
    drinks_consumed: newCount,
    effective_limit: effectiveLimit,
    remaining,
    is_final_drink: isFinalDrink,
    is_limit_reached: isLimitReached,
    log_id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  };
}

/**
 * Reverts a served drink (undo operation).
 */
export function revertDrinkRequest(
  guest: Guest,
  lastDrink: DrinkLog
): { updatedGuest: Guest; revertedLog: DrinkLog } {
  const isAlcoholic = lastDrink.drink_type !== 'soft';
  const newCount = isAlcoholic ? Math.max(0, guest.drinks_consumed - 1) : guest.drinks_consumed;

  const updatedGuest: Guest = {
    ...guest,
    drinks_consumed: newCount,
    updated_at: new Date().toISOString(),
  };

  const revertedLog: DrinkLog = {
    ...lastDrink,
    is_reverted: true,
    reverted_at: new Date().toISOString(),
  };

  return { updatedGuest, revertedLog };
}

/**
 * Check-in a guest at the door, linking their wristband.
 */
export function checkInGuest(
  existingGuests: Guest[],
  input: DoorCheckInInput
): Guest {
  const trimmedName = input.name?.trim();
  if (!trimmedName) {
    throw new Error('Guest name cannot be empty');
  }

  const now = new Date().toISOString();
  const existingIndex = existingGuests.findIndex(
    g => g.tag_id.toLowerCase() === input.tag_id.toLowerCase()
  );

  if (existingIndex >= 0) {
    const existing = existingGuests[existingIndex];
    return {
      ...existing,
      name: trimmedName,
      category: input.category || existing.category || 'standard',
      custom_drink_limit: input.custom_drink_limit !== undefined ? input.custom_drink_limit : existing.custom_drink_limit,
      is_entered: true,
      entered_at: existing.entered_at || now,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      updated_at: now,
    };
  }

  // Create new guest slot if tag was not pre-seeded
  const newGuestId = `GUEST-${(existingGuests.length + 1).toString().padStart(3, '0')}`;
  return {
    id: newGuestId,
    tag_id: input.tag_id,
    name: trimmedName,
    category: input.category || 'standard',
    custom_drink_limit: input.custom_drink_limit ?? null,
    drinks_consumed: 0,
    is_entered: true,
    entered_at: now,
    is_blocked: false,
    notes: input.notes || null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Security: Validates the 4-digit admin/parent PIN.
 */
export function validateAdminPin(enteredPin: string, correctPin: string = '1031'): boolean {
  if (!enteredPin) return false;
  return enteredPin.trim() === correctPin.trim();
}

/**
 * Generates a batch of pre-numbered wristbands (default 100).
 */
export function generateWristbandBatch(count: number = 100): Guest[] {
  const list: Guest[] = [];
  const now = new Date().toISOString();
  for (let i = 1; i <= count; i++) {
    const num = i.toString().padStart(3, '0');
    list.push({
      id: `GUEST-${num}`,
      tag_id: `TAG-${num}`,
      name: null,
      category: 'standard',
      custom_drink_limit: null,
      drinks_consumed: 0,
      is_entered: false,
      entered_at: null,
      is_blocked: false,
      notes: null,
      created_at: now,
      updated_at: now,
    });
  }
  return list;
}
