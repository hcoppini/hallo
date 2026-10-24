import { describe, it, expect } from 'vitest';
import {
  parseTagId,
  isTagMatch,
  findGuestByTag,
  isUniversalOnboardingTag,
  getNextFreeGuestSlot,
  getNextFreeTagId,
  stripUidFromNotes,
} from '../lib/tag-utils';
import { Guest } from '../lib/types';

describe('Tag Utils Parsing & Matching', () => {
  it('normalizes standard tag format and ID-00X alias', () => {
    const res = parseTagId('TAG-004');
    expect(res.canonicalTag).toBe('TAG-004');
    expect(res.tagNumber).toBe(4);
    expect(res.isUniversal).toBe(false);

    const idRes = parseTagId('ID-004');
    expect(idRes.canonicalTag).toBe('TAG-004');
    expect(idRes.tagNumber).toBe(4);
  });

  it('normalizes lowercase or short tag format', () => {
    expect(parseTagId('tag-4').canonicalTag).toBe('TAG-004');
    expect(parseTagId('tag4').canonicalTag).toBe('TAG-004');
    expect(parseTagId('id-4').canonicalTag).toBe('TAG-004');
    expect(parseTagId('4').canonicalTag).toBe('TAG-004');
  });

  it('normalizes NFC Tools URL appended UID', () => {
    expect(parseTagId('TAG-004:04:A2:3B').canonicalTag).toBe('TAG-004');
    expect(parseTagId('TAG-004%3A53%3A90').canonicalTag).toBe('TAG-004');
    expect(parseTagId('TAG-004:04:A2:3B').tagNumber).toBe(4);
  });

  it('handles raw hardware UID when not numbered without colliding on TAG-004', () => {
    const res = parseTagId('04:A2:3B:5F');
    expect(res.decoded).toBe('04:A2:3B:5F');
    expect(res.tagNumber).toBeNull();
    expect(res.canonicalTag).toBe('04A23B5F');
    expect(res.isUniversal).toBe(false);

    const res2 = parseTagId('04:53:90:1A:2B:3C:80');
    expect(res2.tagNumber).toBeNull();
    expect(res2.canonicalTag).toBe('0453901A2B3C80');
  });

  it('recognizes universal onboarding links (/t/{UID}) and never matches them to existing guests', () => {
    expect(isUniversalOnboardingTag('{UID}')).toBe(true);
    expect(isUniversalOnboardingTag('%7BUID%7D')).toBe(true);
    expect(isUniversalOnboardingTag('https://hallo-zkqp.vercel.app/t/{UID}')).toBe(true);
    expect(isUniversalOnboardingTag('https://hallo-zkqp.vercel.app/t/%7BUID%7D')).toBe(true);
    expect(isUniversalOnboardingTag('uid')).toBe(true);
    expect(isUniversalOnboardingTag('new')).toBe(true);
    expect(isUniversalOnboardingTag('onboard')).toBe(true);
    expect(isUniversalOnboardingTag('TAG-004')).toBe(false);
    expect(isUniversalOnboardingTag('04:A2:3B:5F')).toBe(false);

    const parsedUniversal = parseTagId('https://hallo-zkqp.vercel.app/t/{UID}');
    expect(parsedUniversal.isUniversal).toBe(true);
    expect(parsedUniversal.canonicalTag).toBe('UNIVERSAL');
    expect(parsedUniversal.tagNumber).toBeNull();

    // Even if a legacy guest ("Janek Smagiel") was accidentally saved with [UID:UID] or hardware_uid: "UID"
    const janekLegacy: Guest = {
      id: 'GUEST-001',
      tag_id: 'TAG-001',
      hardware_uid: 'UID',
      name: 'Janek Smagiel',
      category: 'standard',
      custom_drink_limit: null,
      drinks_consumed: 0,
      is_entered: true,
      entered_at: '2026-10-24T00:00:00Z',
      is_blocked: false,
      notes: '[UID:UID]',
    };

    expect(isTagMatch(janekLegacy, '{UID}')).toBe(false);
    expect(isTagMatch(janekLegacy, '%7BUID%7D')).toBe(false);
    expect(isTagMatch(janekLegacy, 'UID')).toBe(false);
    expect(isTagMatch(janekLegacy, 'https://hallo-zkqp.vercel.app/t/{UID}')).toBe(false);
    expect(findGuestByTag([janekLegacy], '{UID}')).toBeUndefined();
    expect(findGuestByTag([janekLegacy], 'https://hallo-zkqp.vercel.app/t/{UID}')).toBeUndefined();

    // Still matches Janek on his real canonical slot TAG-001
    expect(isTagMatch(janekLegacy, 'TAG-001')).toBe(true);
    expect(isTagMatch(janekLegacy, 'ID-001')).toBe(true);
  });

  it('finds next free guest slot accurately', () => {
    const slots: Guest[] = [
      {
        id: 'GUEST-001',
        tag_id: 'TAG-001',
        name: 'Janek Smagiel',
        category: 'standard',
        custom_drink_limit: null,
        drinks_consumed: 0,
        is_entered: true,
        entered_at: '2026-10-24T00:00:00Z',
        is_blocked: false,
        notes: null,
      },
      {
        id: 'GUEST-002',
        tag_id: 'TAG-002',
        name: null,
        category: 'standard',
        custom_drink_limit: null,
        drinks_consumed: 0,
        is_entered: false,
        entered_at: null,
        is_blocked: false,
        notes: null,
      },
    ];

    expect(getNextFreeGuestSlot(slots)?.tag_id).toBe('TAG-002');
    expect(getNextFreeTagId(slots)).toBe('TAG-002');
    expect(stripUidFromNotes('[UID:04A23B5F] Birthday friend')).toBe('Birthday friend');
  });

  it('matches guest with different tag representations', () => {
    const mockGuest: Guest = {
      id: 'GUEST-004',
      tag_id: 'TAG-004',
      name: 'Kasia Kowalska',
      category: 'standard',
      custom_drink_limit: null,
      drinks_consumed: 1,
      is_entered: true,
      entered_at: '2026-10-02T18:00:00Z',
      is_blocked: false,
      notes: null,
      created_at: '2026-10-02T18:00:00Z',
      updated_at: '2026-10-02T18:00:00Z',
    };

    expect(isTagMatch(mockGuest, 'TAG-004')).toBe(true);
    expect(isTagMatch(mockGuest, 'ID-004')).toBe(true);
    expect(isTagMatch(mockGuest, 'tag-004')).toBe(true);
    expect(isTagMatch(mockGuest, 'TAG-4')).toBe(true);
    expect(isTagMatch(mockGuest, 'tag-4')).toBe(true);
    expect(isTagMatch(mockGuest, '4')).toBe(true);
    expect(isTagMatch(mockGuest, 'GUEST-004')).toBe(true);
    expect(isTagMatch(mockGuest, 'TAG-004:04:A2:3B')).toBe(true);
    expect(isTagMatch(mockGuest, 'TAG-004%3A04%3AA2')).toBe(true);
    expect(isTagMatch(mockGuest, 'TAG-005')).toBe(false);

    const list = [mockGuest];
    expect(findGuestByTag(list, 'TAG-004:04:A2:3B')?.name).toBe('Kasia Kowalska');
    expect(findGuestByTag(list, 'tag-4')?.name).toBe('Kasia Kowalska');
    expect(findGuestByTag(list, 'TAG-999')).toBeUndefined();
  });

  it('matches guest by hardware_uid even when tag_id differs', () => {
    const mockGuestWithUid: Guest = {
      id: 'GUEST-012',
      tag_id: 'TAG-012',
      hardware_uid: '04:A2:3B:5F:81:70:80',
      name: 'Piotr Zieliński',
      category: 'standard',
      custom_drink_limit: null,
      drinks_consumed: 0,
      is_entered: true,
      entered_at: '2026-10-02T18:00:00Z',
      is_blocked: false,
      notes: null,
    };

    expect(isTagMatch(mockGuestWithUid, '04:A2:3B:5F:81:70:80')).toBe(true);
    expect(isTagMatch(mockGuestWithUid, '04A23B5F817080')).toBe(true);
    expect(isTagMatch(mockGuestWithUid, '04:a2:3b:5f:81:70:80')).toBe(true);
    expect(isTagMatch(mockGuestWithUid, 'TAG-012')).toBe(true);
    expect(isTagMatch(mockGuestWithUid, '04A23B00000000')).toBe(false);

    const list = [mockGuestWithUid];
    expect(findGuestByTag(list, '04A23B5F817080')?.name).toBe('Piotr Zieliński');
  });

  it('matches guest by hardware_uid encoded in notes', () => {
    const mockGuestWithNotesUid: Guest = {
      id: 'GUEST-015',
      tag_id: 'TAG-015',
      name: 'Marek Nowak',
      category: 'standard',
      custom_drink_limit: null,
      drinks_consumed: 0,
      is_entered: true,
      entered_at: '2026-10-02T18:00:00Z',
      is_blocked: false,
      notes: '[UID:04B56C7D8E9F] Table 4',
    };

    expect(isTagMatch(mockGuestWithNotesUid, '04:B5:6C:7D:8E:9F')).toBe(true);
    expect(isTagMatch(mockGuestWithNotesUid, '04B56C7D8E9F')).toBe(true);
    expect(isTagMatch(mockGuestWithNotesUid, 'TAG-015')).toBe(true);
    expect(isTagMatch(mockGuestWithNotesUid, '04A23B5F817080')).toBe(false);
  });

  it('formats human-readable guest display names correctly', async () => {
    const { getGuestDisplayName } = await import('../lib/tag-utils');

    const guest1: Guest = {
      id: 'GUEST-001',
      tag_id: 'TAG-001',
      name: 'Kasia Kowalska',
      category: 'standard',
      custom_drink_limit: null,
      drinks_consumed: 2,
      is_entered: true,
      entered_at: '2026-10-02T18:00:00Z',
      is_blocked: false,
      notes: null,
    };

    const guest2: Guest = {
      id: 'GUEST-002',
      tag_id: 'TAG-002',
      name: null,
      category: 'standard',
      custom_drink_limit: null,
      drinks_consumed: 0,
      is_entered: false,
      entered_at: null,
      is_blocked: false,
      notes: null,
    };

    expect(getGuestDisplayName(guest1)).toBe('Kasia Kowalska (Tag #1)');
    expect(getGuestDisplayName(guest2)).toBe('Tag #2 (Unassigned)');
  });
});
