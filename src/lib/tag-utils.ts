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
  let decoded = decodeURIComponent(rawTag || '').trim();

  // If input is a URL (e.g. https://domain.com/t/TAG-004 or http://localhost:3000/t/4), extract the slug or query
  const urlPathMatch = decoded.match(/\/t\/([^/?#]+)/i);
  if (urlPathMatch && urlPathMatch[1]) {
    decoded = urlPathMatch[1];
  } else {
    const urlQueryMatch = decoded.match(/[?&](?:tag|id)=([^&]+)/i);
    if (urlQueryMatch && urlQueryMatch[1]) {
      decoded = urlQueryMatch[1];
    }
  }

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
 * Supports canonical tag (TAG-001), hardware UID (04:A2:3B... / 04A23B...), or tag number.
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

  // 2. Hardware UID match (comparing stripped alphanumerics)
  let effectiveHardwareUid = guest.hardware_uid;
  if (!effectiveHardwareUid && guest.notes) {
    const uidMatch = guest.notes.match(/\[UID:([A-Za-z0-9:]+)\]/i);
    if (uidMatch && uidMatch[1]) {
      effectiveHardwareUid = uidMatch[1];
    }
  }

  if (effectiveHardwareUid && parsedSearch.cleanAlphanumeric) {
    const guestUidClean = effectiveHardwareUid.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (guestUidClean === parsedSearch.cleanAlphanumeric) {
      return true;
    }
  }

  // Also check if guest.tag_id itself is a hardware UID
  if (parsedGuestTag.cleanAlphanumeric && parsedSearch.cleanAlphanumeric) {
    if (parsedGuestTag.cleanAlphanumeric === parsedSearch.cleanAlphanumeric) {
      return true;
    }
  }

  // 3. Canonical tag match (e.g. TAG-004 matches tag-4 or 4)
  if (parsedSearch.canonicalTag && parsedGuestTag.canonicalTag) {
    if (parsedSearch.canonicalTag === parsedGuestTag.canonicalTag) {
      return true;
    }
  }

  // 4. Tag number match (e.g. #4 matches TAG-004 or GUEST-004)
  if (parsedSearch.tagNumber !== null) {
    if (parsedGuestTag.tagNumber === parsedSearch.tagNumber || parsedGuestId.tagNumber === parsedSearch.tagNumber) {
      return true;
    }
  }

  // 5. Clean alphanumeric match (ignoring colons, dashes, etc.)
  if (parsedSearch.cleanAlphanumeric && parsedGuestTag.cleanAlphanumeric) {
    if (parsedSearch.cleanAlphanumeric === parsedGuestTag.cleanAlphanumeric) {
      return true;
    }
    // Prefix match if NFC Tools appended hardware UID to URL
    if (parsedSearch.cleanAlphanumeric.startsWith(parsedGuestTag.cleanAlphanumeric)) {
      return true;
    }
  }

  // 6. Prefix match for NFC Tools variables (e.g. "TAG-004:04:A2..." starts with "TAG-004")
  if (searchUpper.startsWith(guest.tag_id.toUpperCase())) {
    return true;
  }

  return false;
}

/**
 * Searches a list of guests for a match using fuzzy tag parsing and UID lookup.
 */
export function findGuestByTag(guests: Guest[], searchTag: string): Guest | undefined {
  if (!searchTag || !guests || guests.length === 0) return undefined;
  return guests.find(g => isTagMatch(g, searchTag));
}

/**
 * Formats a clean, human-readable display title for any guest.
 * Avoids displaying raw hex hardware UIDs to bartenders or users.
 */
export function getGuestDisplayName(guest: Guest): string {
  const parsed = parseTagId(guest.tag_id);
  const tagLabel = parsed.tagNumber !== null ? `Tag #${parsed.tagNumber}` : guest.tag_id;

  if (guest.name && guest.name.trim().length > 0) {
    return parsed.tagNumber !== null ? `${guest.name.trim()} (${tagLabel})` : guest.name.trim();
  }

  return `${tagLabel} (Unassigned)`;
}

