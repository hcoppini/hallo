import { describe, it, expect } from 'vitest';
import {
  parseGuestCsv,
  cleanGuestName,
  normalizeCategory,
  searchGuestRoster,
  exportGuestRosterCsv,
} from '@/lib/guest-import-utils';
import { Guest, ImportedGuest } from '@/lib/types';

describe('Guest Import & CSV Parsing', () => {
  it('parses comma-spaced names with brackets like [Janek Smagiel, Ania Beta, ]', () => {
    const input = '[Janek Smagiel, Ania Beta, ]';
    const result = parseGuestCsv(input);

    expect(result.guests).toHaveLength(2);
    expect(result.guests[0].name).toBe('Janek Smagiel');
    expect(result.guests[0].category).toBe('standard');
    expect(result.guests[1].name).toBe('Ania Beta');
    expect(result.guests[1].category).toBe('standard');
    expect(result.guests[0].is_checked_in).toBe(false);
  });

  it('parses unbracketed comma-separated names with trailing spaces', () => {
    const input = 'Janek Smagiel, Ania Beta, Kasia Kowalska, ';
    const result = parseGuestCsv(input);

    expect(result.guests).toHaveLength(3);
    expect(result.guests[0].name).toBe('Janek Smagiel');
    expect(result.guests[1].name).toBe('Ania Beta');
    expect(result.guests[2].name).toBe('Kasia Kowalska');
  });

  it('parses multi-line list with bullet points and numbers', () => {
    const input = `
      1. Janek Smagiel
      2. Ania Beta
      - Bartek K
      * Zosia Nowa
    `;
    const result = parseGuestCsv(input);

    expect(result.guests).toHaveLength(4);
    expect(result.guests[0].name).toBe('Janek Smagiel');
    expect(result.guests[1].name).toBe('Ania Beta');
    expect(result.guests[2].name).toBe('Bartek K');
    expect(result.guests[3].name).toBe('Zosia Nowa');
  });

  it('parses standard CSV with headers (Name, Category, Notes)', () => {
    const input = `
Name,Category,Notes
Janek Smagiel,vip,VIP guest
Ania Beta,driver,Designated driver
Tomek Standard,standard,Friend
    `;
    const result = parseGuestCsv(input);

    expect(result.guests).toHaveLength(3);
    expect(result.guests[0].name).toBe('Janek Smagiel');
    expect(result.guests[0].category).toBe('vip');
    expect(result.guests[0].notes).toBe('VIP guest');

    expect(result.guests[1].name).toBe('Ania Beta');
    expect(result.guests[1].category).toBe('driver_minor');
    expect(result.guests[1].notes).toBe('Designated driver');

    expect(result.guests[2].name).toBe('Tomek Standard');
    expect(result.guests[2].category).toBe('standard');
  });

  it('deduplicates identical names case-insensitively', () => {
    const input = 'Janek Smagiel, janek smagiel, JANEK SMAGIEL, Ania Beta';
    const result = parseGuestCsv(input);

    expect(result.guests).toHaveLength(2);
    expect(result.guests[0].name).toBe('Janek Smagiel');
    expect(result.guests[1].name).toBe('Ania Beta');
    expect(result.duplicatesRemoved).toBe(2);
  });

  it('matches status against already-entered wristbands in existing party', () => {
    const existingGuests: Guest[] = [
      {
        id: 'GUEST-001',
        tag_id: 'TAG-001',
        name: 'Janek Smagiel',
        category: 'standard',
        custom_drink_limit: null,
        drinks_consumed: 1,
        is_entered: true,
        entered_at: '2026-10-27T17:00:00Z',
        is_blocked: false,
        notes: null,
      },
    ];

    const input = 'Janek Smagiel, Ania Beta';
    const result = parseGuestCsv(input, existingGuests);

    expect(result.guests).toHaveLength(2);
    expect(result.guests[0].name).toBe('Janek Smagiel');
    expect(result.guests[0].is_checked_in).toBe(true);
    expect(result.guests[0].checked_in_tag_id).toBe('TAG-001');

    expect(result.guests[1].name).toBe('Ania Beta');
    expect(result.guests[1].is_checked_in).toBe(false);
    expect(result.guests[1].checked_in_tag_id).toBeNull();
  });

  it('normalizes categories accurately', () => {
    expect(normalizeCategory('vip')).toBe('vip');
    expect(normalizeCategory('VIP')).toBe('vip');
    expect(normalizeCategory('driver')).toBe('driver_minor');
    expect(normalizeCategory('kierowca')).toBe('driver_minor');
    expect(normalizeCategory('0-alc')).toBe('driver_minor');
    expect(normalizeCategory('standard')).toBe('standard');
    expect(normalizeCategory('unknown')).toBe('standard');
  });

  it('cleans guest names properly', () => {
    expect(cleanGuestName('"Janek Smagiel"')).toBe('Janek Smagiel');
    expect(cleanGuestName('1. Janek Smagiel')).toBe('Janek Smagiel');
    expect(cleanGuestName('- Janek Smagiel')).toBe('Janek Smagiel');
    expect(cleanGuestName('[Janek Smagiel]')).toBe('Janek Smagiel');
  });

  it('exports roster to CSV format correctly', () => {
    const roster: ImportedGuest[] = [
      {
        id: 'imp-1',
        name: 'Janek Smagiel',
        category: 'vip',
        notes: 'Friend',
        is_checked_in: true,
        checked_in_tag_id: 'TAG-005',
        imported_at: '2026-10-27T17:00:00Z',
      },
      {
        id: 'imp-2',
        name: 'Ania Beta',
        category: 'standard',
        notes: null,
        is_checked_in: false,
        checked_in_tag_id: null,
        imported_at: '2026-10-27T17:00:00Z',
      },
    ];

    const csv = exportGuestRosterCsv(roster);
    expect(csv).toContain('Name,Category,Status,Wristband Tag,Notes,Imported At');
    expect(csv).toContain('"Janek Smagiel",vip,Checked In,TAG-005,"Friend",2026-10-27T17:00:00Z');
    expect(csv).toContain('"Ania Beta",standard,Awaiting Arrival,,,2026-10-27T17:00:00Z');
  });

  describe('searchGuestRoster (Autofill ranking)', () => {
    const sampleRoster: ImportedGuest[] = [
      {
        id: '1',
        name: 'Janek Smagiel',
        category: 'standard',
        is_checked_in: false,
        imported_at: '',
      },
      {
        id: '2',
        name: 'Ania Beta',
        category: 'vip',
        is_checked_in: false,
        imported_at: '',
      },
      {
        id: '3',
        name: 'Jan Kowalski',
        category: 'driver_minor',
        is_checked_in: true, // Already checked in
        checked_in_tag_id: 'TAG-001',
        imported_at: '',
      },
      {
        id: '4',
        name: 'Kasia Janicka',
        category: 'standard',
        is_checked_in: false,
        imported_at: '',
      },
    ];

    it('ranks prefix matches and unchecked-in guests higher', () => {
      const matches = searchGuestRoster(sampleRoster, 'Jan');
      expect(matches.length).toBeGreaterThan(0);
      // Janek Smagiel is not checked in and starts with "Jan"
      expect(matches[0].name).toBe('Janek Smagiel');
      // Jan Kowalski is checked in so ranks lower than unchecked-in
      const names = matches.map(m => m.name);
      expect(names).toContain('Janek Smagiel');
      expect(names).toContain('Jan Kowalski');
      expect(names).toContain('Kasia Janicka');
    });

    it('finds match on word boundary (e.g. surname "Smagiel")', () => {
      const matches = searchGuestRoster(sampleRoster, 'smag');
      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe('Janek Smagiel');
    });

    it('returns empty array when no matches found', () => {
      const matches = searchGuestRoster(sampleRoster, 'Zdzisław');
      expect(matches).toHaveLength(0);
    });

    it('returns unchecked-in guests first when query is empty', () => {
      const matches = searchGuestRoster(sampleRoster, '');
      expect(matches).toHaveLength(4);
      expect(matches[0].is_checked_in).toBe(false);
      expect(matches[1].is_checked_in).toBe(false);
      expect(matches[2].is_checked_in).toBe(false);
      expect(matches[3].is_checked_in).toBe(true);
    });
  });
});
