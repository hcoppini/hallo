import { GuestCategory, ImportedGuest, Guest } from './types';

/**
 * Normalizes category strings from user input or CSV columns.
 */
export function normalizeCategory(input?: string | null): GuestCategory {
  if (!input) return 'standard';
  const clean = input.trim().toLowerCase();
  if (clean === 'vip') return 'vip';
  if (
    clean === 'driver' ||
    clean === 'driver_minor' ||
    clean === 'kierowca' ||
    clean === '0-alc' ||
    clean === '0 alc' ||
    clean === '0alc' ||
    clean === 'minor' ||
    clean === 'soft' ||
    clean === 'non-drinker'
  ) {
    return 'driver_minor';
  }
  return 'standard';
}

export function isKnownCategory(val: string): boolean {
  const clean = val.trim().toLowerCase();
  return (
    clean === 'vip' ||
    clean === 'standard' ||
    clean === 'driver' ||
    clean === 'driver_minor' ||
    clean === 'kierowca' ||
    clean === '0-alc' ||
    clean === '0 alc' ||
    clean === 'minor' ||
    clean === 'soft'
  );
}

/**
 * Generates a unique ID for an imported guest.
 */
function createImportId(index: number, name: string): string {
  const cleanSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 15);
  const rnd = Math.random().toString(36).substring(2, 6);
  return `imp_${Date.now()}_${index}_${cleanSlug || rnd}`;
}

export interface ParseResult {
  guests: ImportedGuest[];
  totalParsed: number;
  duplicatesRemoved: number;
  errors: string[];
}

/**
 * Cleans individual name strings by stripping quotes, list numbers (1., 2.), bullet points (-), brackets.
 */
export function cleanGuestName(raw: string): string {
  let name = raw.trim();
  // Strip surrounding quotes
  name = name.replace(/^["'`]+|["'`]+$/g, '').trim();
  // Strip leading list numbers/bullets e.g. "1. ", "1) ", "- ", "* "
  name = name.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, '').trim();
  // Strip stray outer brackets
  name = name.replace(/^[\[\(]+|[\]\)]+$/g, '').trim();
  // Strip any remaining wrapping quotes after bullet stripping
  name = name.replace(/^["'`]+|["'`]+$/g, '').trim();
  return name;
}

/**
 * Parses raw text or CSV content into a structured list of ImportedGuest items.
 *
 * Handles:
 * - Comma separated lists: [Janek Smagiel, Ania Beta, ] or Janek Smagiel, Ania Beta
 * - Multi-line lists
 * - Semicolon separated lists
 * - Standard CSV files with or without headers (Name, Category, Notes)
 * - Removes duplicates (case-insensitive)
 */
export function parseGuestCsv(rawContent: string, existingGuests: Guest[] = []): ParseResult {
  const errors: string[] = [];
  if (!rawContent || !rawContent.trim()) {
    return { guests: [], totalParsed: 0, duplicatesRemoved: 0, errors: [] };
  }

  let text = rawContent.trim();

  // Strip wrapping outer brackets if entire string is formatted like [Janek Smagiel, Ania Beta, ]
  if (text.startsWith('[') && text.endsWith(']')) {
    text = text.slice(1, -1).trim();
  }

  // Pre-index existing party check-ins to automatically match status
  const checkedInByName = new Map<string, string>();
  for (const g of existingGuests) {
    if (g.is_entered && g.name) {
      checkedInByName.set(g.name.trim().toLowerCase(), g.tag_id);
    }
  }

  const parsedItems: Array<{
    name: string;
    category?: GuestCategory;
    notes?: string;
  }> = [];

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Check if first line looks like a CSV header
  let hasHeader = false;
  let nameColIdx = 0;
  let categoryColIdx = -1;
  let notesColIdx = -1;

  if (lines.length > 0) {
    const firstLineLower = lines[0].toLowerCase();
    if (
      firstLineLower.includes('name') ||
      firstLineLower.includes('guest') ||
      firstLineLower.includes('imię') ||
      firstLineLower.includes('imie')
    ) {
      // Split header by comma, semicolon or tab
      const headerDelimiter = firstLineLower.includes(';') ? ';' : firstLineLower.includes('\t') ? '\t' : ',';
      const cols = lines[0].split(headerDelimiter).map(c => cleanGuestName(c).toLowerCase());
      
      const foundNameIdx = cols.findIndex(c => c.includes('name') || c.includes('guest') || c.includes('imi'));
      if (foundNameIdx >= 0) {
        hasHeader = true;
        nameColIdx = foundNameIdx;
        categoryColIdx = cols.findIndex(c => c.includes('cat') || c.includes('type') || c.includes('kategor'));
        notesColIdx = cols.findIndex(c => c.includes('note') || c.includes('uwag') || c.includes('desc'));
      }
    }
  }

  const linesToProcess = hasHeader ? lines.slice(1) : lines;

  for (const line of linesToProcess) {
    if (!line) continue;

    // Detect delimiter for this line if multiple fields present
    const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';

    // If there is only one line and it has commas (e.g. user pasted "Janek Smagiel, Ania Beta, "):
    if (linesToProcess.length === 1 && delimiter === ',' && !hasHeader) {
      const parts = line.split(',');
      for (const p of parts) {
        const cleanName = cleanGuestName(p);
        if (cleanName.length > 0) {
          parsedItems.push({ name: cleanName, category: 'standard' });
        }
      }
      continue;
    }

    const cols = line.split(delimiter).map(c => cleanGuestName(c));

    if (hasHeader) {
      const name = cols[nameColIdx] || '';
      if (!name) continue;
      const catRaw = categoryColIdx >= 0 ? cols[categoryColIdx] : undefined;
      const notes = notesColIdx >= 0 ? cols[notesColIdx] : undefined;
      parsedItems.push({
        name,
        category: normalizeCategory(catRaw),
        notes: notes || undefined,
      });
    } else {
      // Line without explicit headers
      // If line has multiple columns (e.g. "Janek Smagiel, vip" or "Janek Smagiel, Ania Beta")
      if (cols.length > 1) {
        // If second column is a known category:
        if (isKnownCategory(cols[1])) {
          parsedItems.push({
            name: cols[0],
            category: normalizeCategory(cols[1]),
            notes: cols.slice(2).join(', ').trim() || undefined,
          });
        } else {
          // If neither is a recognized category keyword, each non-empty column is treated as a guest name!
          // (Handles comma-separated names per line: e.g. "Janek Smagiel, Ania Beta, Kasia")
          for (const col of cols) {
            if (col.length > 0) {
              parsedItems.push({ name: col, category: 'standard' });
            }
          }
        }
      } else {
        // Single column per line (e.g. a plain list of names)
        const singleName = cols[0];
        if (singleName.length > 0) {
          parsedItems.push({ name: singleName, category: 'standard' });
        }
      }
    }
  }

  // Deduplicate names (case-insensitive)
  const seen = new Set<string>();
  const finalGuests: ImportedGuest[] = [];
  let duplicatesRemoved = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < parsedItems.length; i++) {
    const item = parsedItems[i];
    const key = item.name.toLowerCase();
    if (seen.has(key)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(key);

    const matchedTag = checkedInByName.get(key) || null;

    finalGuests.push({
      id: createImportId(i, item.name),
      name: item.name,
      category: item.category || 'standard',
      notes: item.notes || null,
      is_checked_in: Boolean(matchedTag),
      checked_in_tag_id: matchedTag,
      imported_at: now,
    });
  }

  return {
    guests: finalGuests,
    totalParsed: parsedItems.length,
    duplicatesRemoved,
    errors,
  };
}

/**
 * Searches and ranks guests from the imported list for high-speed onboarding autocomplete.
 *
 * Ranking criteria:
 * 1. Matches that are not yet checked in are prioritized.
 * 2. Exact start of name match ranks higher than substring match.
 * 3. Exact word boundary match ranks higher than mid-word match.
 */
export function searchGuestRoster(
  roster: ImportedGuest[],
  query: string,
  limit: number = 8
): ImportedGuest[] {
  const q = query.trim().toLowerCase();

  if (!q) {
    // If no query, return unchecked-in guests first
    return roster
      .slice()
      .sort((a, b) => {
        if (a.is_checked_in === b.is_checked_in) {
          return a.name.localeCompare(b.name);
        }
        return a.is_checked_in ? 1 : -1;
      })
      .slice(0, limit);
  }

  const matching = roster.filter(g => g.name.toLowerCase().includes(q));

  // Score each match
  return matching
    .map(guest => {
      const lower = guest.name.toLowerCase();
      let score = 0;

      // Unchecked-in guests get highest priority bonus
      if (!guest.is_checked_in) score += 100;

      // Exact full match
      if (lower === q) score += 50;
      // Starts with query
      else if (lower.startsWith(q)) score += 30;
      // Word starts with query (e.g. "Smagiel" in "Janek Smagiel")
      else if (lower.includes(` ${q}`)) score += 20;
      else score += 10;

      return { guest, score };
    })
    .sort((a, b) => b.score - a.score || a.guest.name.localeCompare(b.guest.name))
    .slice(0, limit)
    .map(item => item.guest);
}

/**
 * Exports current imported roster to a standard downloadable CSV format.
 */
export function exportGuestRosterCsv(roster: ImportedGuest[]): string {
  const headers = ['Name', 'Category', 'Status', 'Wristband Tag', 'Notes', 'Imported At'];
  const rows = roster.map(g => [
    `"${(g.name || '').replace(/"/g, '""')}"`,
    g.category || 'standard',
    g.is_checked_in ? 'Checked In' : 'Awaiting Arrival',
    g.checked_in_tag_id || '',
    g.notes ? `"${g.notes.replace(/"/g, '""')}"` : '',
    g.imported_at || '',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
