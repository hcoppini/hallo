/**
 * Poker & Party Hub Utilities
 * Configured for hcoppini/piker hosted on Vercel
 */

export interface PokerSettings {
  tableName: string;
  qrUrl: string;
  blinds: string;
  buyIn: string;
  blindInterval: string;
  status: 'active' | 'upcoming' | 'paused';
  notes?: string;
}

export const DEFAULT_POKER_SETTINGS: PokerSettings = {
  tableName: 'Piker High-Stakes Tournament',
  qrUrl: 'https://piker-toicupinis-projects.vercel.app',
  blinds: '1 / 2 (Doubles every 7 min)',
  buyIn: 'Rapid 11-Level Heats',
  blindInterval: '7 min levels (30–40m game)',
  status: 'active',
  notes: 'Scan to join table & view live synced poker clock & leaderboard from hcoppini/piker',
};

export const POKER_STORAGE_KEY = 'halloween_party_poker_v1';

export function loadPokerSettings(): PokerSettings {
  if (typeof window === 'undefined') return DEFAULT_POKER_SETTINGS;
  try {
    const raw = localStorage.getItem(POKER_STORAGE_KEY);
    if (!raw) return DEFAULT_POKER_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_POKER_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_POKER_SETTINGS;
  }
}

export function savePokerSettings(settings: PokerSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POKER_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save poker settings:', err);
  }
}

export interface PartyCustomQr {
  id: string;
  title: string;
  url: string;
  icon: 'poker' | 'music' | 'camera' | 'wifi';
  subtitle: string;
}

export const DEFAULT_PARTY_QRS: PartyCustomQr[] = [
  {
    id: 'poker-main',
    title: 'Piker Tournament Clock',
    url: 'https://piker-toicupinis-projects.vercel.app',
    icon: 'poker',
    subtitle: 'Scan for live blinds, chip counts & seating (hcoppini/piker)',
  },
  {
    id: 'song-requests',
    title: 'Song Request Queue',
    url: 'https://youtube.com',
    icon: 'music',
    subtitle: 'Request a track for the projector queue',
  },
  {
    id: 'photo-shared',
    title: 'Party Photo Drop',
    url: 'https://photos.google.com',
    icon: 'camera',
    subtitle: 'Upload party photos to the shared album',
  },
];

export const PARTY_QRS_STORAGE_KEY = 'halloween_party_custom_qrs_v1';

export function loadPartyQrs(): PartyCustomQr[] {
  if (typeof window === 'undefined') return DEFAULT_PARTY_QRS;
  try {
    const raw = localStorage.getItem(PARTY_QRS_STORAGE_KEY);
    if (!raw) return DEFAULT_PARTY_QRS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return DEFAULT_PARTY_QRS;
}

export function savePartyQrs(qrs: PartyCustomQr[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PARTY_QRS_STORAGE_KEY, JSON.stringify(qrs));
  } catch (err) {
    console.warn('Failed to save custom party QRs:', err);
  }
}
