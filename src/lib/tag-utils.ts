import { Guest } from './types';

export interface TagParseResult {
  raw: string;
  decoded: string;
  canonicalTag: string; // e.g. "TAG-004" or "UNIVERSAL"
  tagNumber: number | null; // e.g. 4
  cleanAlphanumeric: string; // e.g. "TAG004"
  isUniversal: boolean; // true when input is {UID}, UID, NEW, ONBOARD, etc.
}

const UNIVERSAL_TAG_TOKENS = new Set([
  'UID',
  '{UID}',
  'ID',
  '{ID}',
  'NEW',
  'ONBOARD',
  'ONBOARDING',
  'UNIVERSAL',
  'BLANK',
  'UNASSIGNED',
  'NEXT',
  'AUTO',
]);

/**
 * Detects whether a raw tag slug or URL is a Universal Onboarding placeholder
 * such as `/t/{UID}`, `/t/%7BUID%7D`, `/t/uid`, `/t/new`, or `/t/onboard`.
 */
export function isUniversalOnboardingTag(rawTag: string | null | undefined): boolean {
  if (!rawTag) return false;
  let decoded = rawTag.trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {
    // ignore malformed URI encoding
  }

  const urlPathMatch = decoded.match(/\/t\/([^/?#]+)/i);
  if (urlPathMatch && urlPathMatch[1]) {
    decoded = urlPathMatch[1].trim();
  } else {
    const urlQueryMatch = decoded.match(/[?&](?:tag|id)=([^&]+)/i);
    if (urlQueryMatch && urlQueryMatch[1]) {
      decoded = urlQueryMatch[1].trim();
    }
  }

  const upper = decoded.toUpperCase();
  if (UNIVERSAL_TAG_TOKENS.has(upper)) {
    return true;
  }

  // Strip curly braces, brackets, dollar signs, percent-encoded braces (e.g. "{UID}", "${UID}", "%7BUID%7D")
  const stripped = upper
    .replace(/%7B/g, '')
    .replace(/%7D/g, '')
    .replace(/[^A-Z0-9]/g, '');

  return UNIVERSAL_TAG_TOKENS.has(stripped);
}

/**
 * Normalizes any tag input (from NFC scan, URL param, or manual input).
 * Examples:
 * - "{UID}" or "%7BUID%7D" or "new" -> isUniversal: true, canonicalTag: "UNIVERSAL", tagNumber: null
 * - "TAG-004" or "ID-004" -> canonicalTag: "TAG-004", tagNumber: 4
 * - "tag-4" -> canonicalTag: "TAG-004", tagNumber: 4
 * - "4" -> canonicalTag: "TAG-004", tagNumber: 4
 * - "TAG-004:04:A2:3B" -> canonicalTag: "TAG-004", tagNumber: 4
 * - "GUEST-004" -> canonicalTag: "TAG-004", tagNumber: 4
 * - "04:A2:3B:5F" -> canonicalTag: "04A23B5F", tagNumber: null
 */
export function parseTagId(rawTag: string): TagParseResult {
  let decoded = (rawTag || '').trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {
    // fallback to raw trimmed string
  }

  // If input is a URL (e.g. https://domain.com/t/TAG-004 or https://domain.com/t/{UID}), extract the slug or query
  const urlPathMatch = decoded.match(/\/t\/([^/?#]+)/i);
  if (urlPathMatch && urlPathMatch[1]) {
    decoded = urlPathMatch[1].trim();
  } else {
    const urlQueryMatch = decoded.match(/[?&](?:tag|id)=([^&]+)/i);
    if (urlQueryMatch && urlQueryMatch[1]) {
      decoded = urlQueryMatch[1].trim();
    }
  }

  if (isUniversalOnboardingTag(decoded)) {
    return {
      raw: rawTag,
      decoded,
      canonicalTag: 'UNIVERSAL',
      tagNumber: null,
      cleanAlphanumeric: '',
      isUniversal: true,
    };
  }

  const upper = decoded.toUpperCase();
  const cleanAlphanumeric = upper.replace(/[^A-Z0-9]/g, '');

  // 1. Try to extract tag number from explicit TAG/GUEST/ID prefixes (e.g. TAG-004, ID-004, GUEST-004)
  //    OR when the entire input is purely a 1-3 digit number (e.g. "4", "004", "#4").
  //    Never match colon-separated hex hardware UIDs like "04:A2:3B:5F" or "04:53:90:1A".
  const explicitPrefixMatch = upper.match(/^(?:TAG|GUEST|ID)[-_#\s]*0*([1-9]\d{0,2})(?:[:\-_%\s]|$)/);
  const pureNumberMatch = upper.match(/^#?0*([1-9]\d{0,2})$/);

  const matchedNumStr = explicitPrefixMatch?.[1] || pureNumberMatch?.[1] || null;
  let tagNumber: number | null = null;
  let canonicalTag = cleanAlphanumeric || upper;

  if (matchedNumStr) {
    const num = parseInt(matchedNumStr, 10);
    if (num >= 1 && num <= 999) {
      tagNumber = num;
      canonicalTag = `TAG-${num.toString().padStart(3, '0')}`;
    }
  }

  return {
    raw: rawTag,
    decoded,
    canonicalTag,
    tagNumber,
    cleanAlphanumeric,
    isUniversal: false,
  };
}

/**
 * Robustly matches a tag string against a guest record.
 * Supports canonical tag (TAG-001, ID-001), hardware UID (04:A2:3B... / 04A23B...), or tag number.
 * NEVER matches universal onboarding placeholders ({UID}, UID, NEW, etc.).
 */
export function isTagMatch(guest: Guest, searchTag: string): boolean {
  if (!searchTag || !guest) return false;
  if (isUniversalOnboardingTag(searchTag)) return false;

  const parsedSearch = parseTagId(searchTag);
  if (parsedSearch.isUniversal) return false;

  const parsedGuestTag = parseTagId(guest.tag_id);
  const parsedGuestId = parseTagId(guest.id);

  // 1. Exact string match on tag_id or id (case-insensitive)
  const searchUpper = parsedSearch.decoded.toUpperCase();
  if (
    !isUniversalOnboardingTag(guest.tag_id) &&
    (guest.tag_id.toUpperCase() === searchUpper || guest.id.toUpperCase() === searchUpper)
  ) {
    return true;
  }

  // 2. Hardware UID match (comparing stripped alphanumerics, ignoring legacy [UID:UID])
  let effectiveHardwareUid = guest.hardware_uid;
  if (!effectiveHardwareUid && guest.notes) {
    const uidMatch = guest.notes.match(/\[UID:([^\]]+)\]/i);
    if (uidMatch && uidMatch[1]) {
      effectiveHardwareUid = uidMatch[1].trim();
    }
  }

  if (
    effectiveHardwareUid &&
    !isUniversalOnboardingTag(effectiveHardwareUid) &&
    parsedSearch.cleanAlphanumeric &&
    parsedSearch.cleanAlphanumeric.length >= 4
  ) {
    const guestUidClean = effectiveHardwareUid.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (guestUidClean.length >= 4 && guestUidClean === parsedSearch.cleanAlphanumeric) {
      return true;
    }
  }

  // Also check if notes contains the clean alphanumeric UID directly
  if (
    guest.notes &&
    parsedSearch.cleanAlphanumeric &&
    parsedSearch.cleanAlphanumeric.length >= 6 &&
    !isUniversalOnboardingTag(parsedSearch.cleanAlphanumeric)
  ) {
    const notesClean = guest.notes.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (notesClean.includes(parsedSearch.cleanAlphanumeric)) {
      return true;
    }
  }

  // Also check if guest.tag_id itself is a hardware UID
  if (
    !parsedGuestTag.isUniversal &&
    parsedGuestTag.cleanAlphanumeric &&
    parsedSearch.cleanAlphanumeric &&
    parsedGuestTag.cleanAlphanumeric === parsedSearch.cleanAlphanumeric
  ) {
    return true;
  }

  // 3. Canonical tag match (e.g. TAG-004 matches tag-4, ID-004, or 4)
  if (
    !parsedGuestTag.isUniversal &&
    parsedSearch.canonicalTag &&
    parsedGuestTag.canonicalTag &&
    parsedSearch.canonicalTag === parsedGuestTag.canonicalTag
  ) {
    return true;
  }

  // 4. Tag number match (e.g. #4 matches TAG-004 or GUEST-004)
  if (parsedSearch.tagNumber !== null) {
    if (
      parsedGuestTag.tagNumber === parsedSearch.tagNumber ||
      parsedGuestId.tagNumber === parsedSearch.tagNumber
    ) {
      return true;
    }
  }

  // 5. Clean alphanumeric match (ignoring colons, dashes, etc.)
  if (
    !parsedGuestTag.isUniversal &&
    parsedSearch.cleanAlphanumeric &&
    parsedGuestTag.cleanAlphanumeric
  ) {
    if (parsedSearch.cleanAlphanumeric === parsedGuestTag.cleanAlphanumeric) {
      return true;
    }
    // Prefix match if NFC Tools appended hardware UID to URL
    if (parsedSearch.cleanAlphanumeric.startsWith(parsedGuestTag.cleanAlphanumeric)) {
      return true;
    }
  }

  // 6. Prefix match for NFC Tools variables (e.g. "TAG-004:04:A2..." starts with "TAG-004")
  if (!isUniversalOnboardingTag(guest.tag_id) && searchUpper.startsWith(guest.tag_id.toUpperCase())) {
    return true;
  }

  return false;
}

/**
 * Searches a list of guests for a match using fuzzy tag parsing and UID lookup.
 * Returns undefined immediately for universal onboarding links like `/t/{UID}`.
 */
export function findGuestByTag(guests: Guest[], searchTag: string): Guest | undefined {
  if (!searchTag || !guests || guests.length === 0) return undefined;
  if (isUniversalOnboardingTag(searchTag)) return undefined;
  return guests.find(g => isTagMatch(g, searchTag));
}

/**
 * Finds the next unassigned guest slot in ascending tag order (TAG-001 .. TAG-100).
 */
export function getNextFreeGuestSlot(guests: Guest[]): Guest | null {
  if (!guests || guests.length === 0) return null;
  const unassigned = guests.filter(
    g => !g.is_entered && (!g.name || g.name.trim().length === 0)
  );
  if (unassigned.length === 0) return null;

  unassigned.sort((a, b) => {
    const numA = parseTagId(a.tag_id).tagNumber ?? parseTagId(a.id).tagNumber ?? 9999;
    const numB = parseTagId(b.tag_id).tagNumber ?? parseTagId(b.id).tagNumber ?? 9999;
    return numA - numB;
  });

  return unassigned[0];
}

/**
 * Returns the canonical TAG-00X string for the next free wristband slot.
 */
export function getNextFreeTagId(guests: Guest[]): string {
  const slot = getNextFreeGuestSlot(guests);
  if (slot) return slot.tag_id;

  const maxNum = guests.reduce((max, g) => {
    const num = parseTagId(g.tag_id).tagNumber ?? parseTagId(g.id).tagNumber ?? 0;
    return num > max ? num : max;
  }, 0);

  return `TAG-${(maxNum + 1).toString().padStart(3, '0')}`;
}

/**
 * Strips internal `[UID:...]` metadata from guest notes for clean display in UI forms.
 */
export function stripUidFromNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  return notes.replace(/\[UID:[^\]]+\]/gi, '').trim();
}

/**
 * Formats a clean, human-readable display title for any guest.
 * Avoids displaying raw hex hardware UIDs to bartenders or users.
 */
export function getGuestDisplayName(guest: Guest): string {
  const parsed = parseTagId(guest.tag_id);
  const idParsed = parseTagId(guest.id);
  const effectiveNum = parsed.tagNumber ?? idParsed.tagNumber;
  const tagLabel = effectiveNum !== null ? `Tag #${effectiveNum}` : guest.tag_id;

  if (guest.name && guest.name.trim().length > 0) {
    return effectiveNum !== null ? `${guest.name.trim()} (${tagLabel})` : guest.name.trim();
  }

  return `${tagLabel} (Unassigned)`;
}
