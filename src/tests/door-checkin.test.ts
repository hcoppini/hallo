import { describe, it, expect } from 'vitest';
import {
  parseTagId,
  getNextFreeTagId,
  findRegisteredGuestByTag,
  findGuestByTag,
  isUniversalOnboardingTag,
  stripUidFromNotes,
} from '@/lib/tag-utils';
import { generateWristbandBatch, checkInGuest } from '@/lib/party-engine';
import { Guest, ImportedGuest, PartySettings } from '@/lib/types';

describe('Door Check-In Desk Functionality', () => {
  const dummySettings: PartySettings = {
    id: 'party_1',
    party_name: 'Halloween 2026',
    default_drink_limit: 4,
    is_party_active: true,
    admin_pin: '2113',
  };

  it('correctly resolves next free wristband tag for check-in', () => {
    let guests = generateWristbandBatch(100);
    // At start, TAG-001 is the next free slot
    expect(getNextFreeTagId(guests)).toBe('TAG-001');

    // Register guest 1 to TAG-001
    guests[0] = checkInGuest(guests, {
      tag_id: 'TAG-001',
      name: 'Janek Smagieł',
      category: 'standard',
    });

    // Next free slot should now be TAG-002
    expect(getNextFreeTagId(guests)).toBe('TAG-002');
  });

  it('correctly parses wristband slot numbers for minimal display', () => {
    expect(parseTagId('TAG-001')).toMatchObject({
      tagNumber: 1,
      canonicalTag: 'TAG-001',
    });
    expect(parseTagId('TAG-042')).toMatchObject({
      tagNumber: 42,
      canonicalTag: 'TAG-042',
    });
    expect(parseTagId('CUSTOM-TAG')).toMatchObject({
      tagNumber: null,
      canonicalTag: 'CUSTOMTAG',
    });
  });

  it('filters admitted vs expected guests accurately', () => {
    let guests = generateWristbandBatch(10);
    guests[0] = checkInGuest(guests, {
      tag_id: 'TAG-001',
      name: 'Alice VIP',
      category: 'vip',
    });
    guests[1] = checkInGuest(guests, {
      tag_id: 'TAG-002',
      name: 'Bob Driver',
      category: 'driver_minor',
    });
    guests[2] = checkInGuest(guests, {
      tag_id: 'TAG-003',
      name: 'Charlie Standard',
      category: 'standard',
    });

    const admitted = guests.filter(g => g.is_entered && g.name);
    expect(admitted).toHaveLength(3);

    // Category breakdown
    const vips = admitted.filter(g => g.category === 'vip');
    const drivers = admitted.filter(g => g.category === 'driver_minor');
    const standards = admitted.filter(g => !g.category || g.category === 'standard');

    expect(vips).toHaveLength(1);
    expect(drivers).toHaveLength(1);
    expect(standards).toHaveLength(1);

    // Capacity calculations
    const capacityPercent = Math.round((admitted.length / guests.length) * 100);
    expect(capacityPercent).toBe(30);
    const availableSlots = guests.length - admitted.length;
    expect(availableSlots).toBe(7);
  });

  it('filters roster search and category matching properly', () => {
    const imported: ImportedGuest[] = [
      { id: '1', name: 'Janek Smagieł', category: 'vip', is_checked_in: false, imported_at: '2026-10-31T20:00:00Z' },
      { id: '2', name: 'Ania Driver', category: 'driver_minor', is_checked_in: false, imported_at: '2026-10-31T20:00:00Z' },
      { id: '3', name: 'Krzysztof Standard', category: 'standard', is_checked_in: true, checked_in_tag_id: 'TAG-001', imported_at: '2026-10-31T20:00:00Z' },
    ];

    const pending = imported.filter(g => !g.is_checked_in);
    expect(pending).toHaveLength(2);

    // Search query filter
    const query = 'janek';
    const searched = pending.filter(g => g.name.toLowerCase().includes(query));
    expect(searched).toHaveLength(1);
    expect(searched[0].name).toBe('Janek Smagieł');

    // Category filter
    const vipOnly = pending.filter(g => g.category === 'vip');
    expect(vipOnly).toHaveLength(1);
  });

  it('strips UID prefixes cleanly from notes', () => {
    expect(stripUidFromNotes('[UID:04A1B2C3] Guest arrived with VIP friend')).toBe('Guest arrived with VIP friend');
    expect(stripUidFromNotes('Regular guest note')).toBe('Regular guest note');
    expect(stripUidFromNotes(undefined)).toBe('');
  });

  it('distinguishes registered vs unregistered wristbands for tap relay handling', () => {
    const guests = generateWristbandBatch(10);
    guests[0] = checkInGuest(guests, {
      tag_id: 'TAG-001',
      name: 'Kasztan',
      category: 'standard',
    });

    // Registered wristband
    const regGuest = findRegisteredGuestByTag(guests, 'TAG-001');
    expect(regGuest).toBeDefined();
    expect(regGuest?.name).toBe('Kasztan');

    // Unregistered wristband: should return undefined so door desk selects it without popups
    const unregGuest = findRegisteredGuestByTag(guests, 'TAG-002');
    expect(unregGuest).toBeUndefined();
  });
});
