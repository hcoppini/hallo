import { Guest } from './types';

export interface TagParseResult {
  raw: string;
  decoded: string;
  canonicalTag: string; // e.g. "TAG-004"
  tagNumber: number | null; // e.g. 4
  cleanAlphanumeric: string; // e.g. "TAG004"
}

/**
 * Normalizes any tag input (from NFC scan, URL param, or manual input).
 * Examples:
 * - "TAG-004" -> canonicalTag: "TAG-004", tagNumber: 4
 * - "tag-4" -> canonicalTag: "TAG-004", tagNumber: 4
 * - "4" -> canonicalTag: "TAG-004", tagNumber: 4
 * - "TAG-004:04:A2:3B" -> canonicalTag: "TAG-004", tagNumber: 4
 * - "TAG-004%3A53%3A90" -> canonicalTag: "TAG-004", tagNumber: 4
 * - "GUEST-004" -> canonicalTag: "TAG-004", tagNumber: 4
 * - "04:A2:3B:5F" -> canonicalTag: "04:A2:3B:5F", tagNumber: null
 */
export function parseTagId(rawTag: string): TagParseResult {
  const decoded = decodeURIComponent(rawTag || '').trim();
  const upper = decoded.toUpperCase();

  // 1. Try to extract tag number from standard formats: TAG-004, TAG4, GUEST-004, #4, or just 4
  const tagNumMatch = upper.match(/(?:TAG|GUEST)?[-_#\s]*0*([1-9]\d{0,2})(?:[:\-_%\s]|$)/);
  let tagNumber: number | null = null;
  let canonicalTag = upper;

  if (tagNumMatch && tagNumMatch[1]) {
    const num = parseInt(tagNumMatch[1], 10);
    if (num >= 1 && num <= 999) {
      tagNumber = num;
      canonicalTag = `TAG-${num.toString().padStart(3, '0')}`;
    }
  }

  const cleanAlphanumeric = upper.replace(/[^A-Z0-9]/g, '');

  return {
    raw: rawTag,
    decoded,
    canonicalTag,
    tagNumber,
    cleanAlphanumeric,
  };
}

/**
 * Robustly matches a tag string against a guest record.
 */
export function isTagMatch(guest: Guest, searchTag: string): boolean {
  if (!searchTag || !guest) return false;

  const parsedSearch = parseTagId(searchTag);
  const parsedGuestTag = parseTagId(guest.tag_id);
  const parsedGuestId = parseTagId(guest.id);

  // 1. Exact string match on tag_id or id (case-insensitive)
  const searchUpper = parsedSearch.decoded.toUpperCase();
  if (guest.tag_id.toUpperCase() === searchUpper || guest.id.toUpperCase() === searchUpper) {
    return true;
  }

  // 2. Canonical tag match (e.g. TAG-004 matches tag-4 or 4)
  if (parsedSearch.canonicalTag && parsedGuestTag.canonicalTag) {
    if (parsedSearch.canonicalTag === parsedGuestTag.canonicalTag) {
      return true;
    }
  }

  // 3. Tag number match (e.g. #4 matches TAG-004 or GUEST-004)
  if (parsedSearch.tagNumber !== null) {
    if (parsedGuestTag.tagNumber === parsedSearch.tagNumber || parsedGuestId.tagNumber === parsedSearch.tagNumber) {
      return true;
    }
  }

  // 4. Clean alphanumeric match (ignoring colons, dashes, etc.)
  if (parsedSearch.cleanAlphanumeric && parsedGuestTag.cleanAlphanumeric) {
    if (parsedSearch.cleanAlphanumeric === parsedGuestTag.cleanAlphanumeric) {
      return true;
    }
    // Prefix match if NFC Tools appended hardware UID
    if (parsedSearch.cleanAlphanumeric.startsWith(parsedGuestTag.cleanAlphanumeric)) {
      return true;
    }
  }

  // 5. Prefix match for NFC Tools variables (e.g. "TAG-004:04:A2..." starts with "TAG-004")
  if (searchUpper.startsWith(guest.tag_id.toUpperCase())) {
    return true;
  }

  return false;
}

/**
 * Searches a list of guests for a match using fuzzy tag parsing.
 */
export function findGuestByTag(guests: Guest[], searchTag: string): Guest | undefined {
  if (!searchTag || !guests || guests.length === 0) return undefined;
  return guests.find(g => isTagMatch(g, searchTag));
}
