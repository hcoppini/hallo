import { describe, it, expect } from 'vitest';
import { parseTagId, isTagMatch, findGuestByTag } from '../lib/tag-utils';
import { Guest } from '../lib/types';

describe('Tag Utils Parsing & Matching', () => {
  it('normalizes standard tag format', () => {
    const res = parseTagId('TAG-004');
    expect(res.canonicalTag).toBe('TAG-004');
    expect(res.tagNumber).toBe(4);
  });

  it('normalizes lowercase or short tag format', () => {
    expect(parseTagId('tag-4').canonicalTag).toBe('TAG-004');
    expect(parseTagId('tag4').canonicalTag).toBe('TAG-004');
    expect(parseTagId('4').canonicalTag).toBe('TAG-004');
  });

  it('normalizes NFC Tools URL appended UID', () => {
    expect(parseTagId('TAG-004:04:A2:3B').canonicalTag).toBe('TAG-004');
    expect(parseTagId('TAG-004%3A53%3A90').canonicalTag).toBe('TAG-004');
    expect(parseTagId('TAG-004:04:A2:3B').tagNumber).toBe(4);
  });

  it('handles raw hardware UID when not numbered', () => {
    const res = parseTagId('04:A2:3B:5F');
    expect(res.decoded).toBe('04:A2:3B:5F');
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
});
