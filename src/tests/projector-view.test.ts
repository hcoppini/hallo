import { describe, it, expect } from 'vitest';
import { parseYouTubeInput, buildEmbedUrl, PROJECTOR_PRESETS } from '../lib/youtube-utils';
import {
  getEnteredGuestsSorted,
  calculateProjectorStats,
  formatWallClockTime,
  formatRelativeTime,
  formatCategoryLabel,
} from '../lib/projector-utils';
import { Guest } from '../lib/types';

describe('YouTube Embed Utilities', () => {
  it('parses standard youtube watch URLs correctly', () => {
    const res = parseYouTubeInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe('dQw4w9WgXcQ');
    expect(res.embedUrl).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(res.embedUrl).toContain('autoplay=1');
  });

  it('parses shortened youtu.be URLs correctly', () => {
    const res = parseYouTubeInput('https://youtu.be/4xDzrJKXOOY');
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe('4xDzrJKXOOY');
    expect(res.embedUrl).toContain('4xDzrJKXOOY');
  });

  it('parses youtube playlist URLs correctly', () => {
    const res = parseYouTubeInput('https://www.youtube.com/playlist?list=PL1234567890abcdef');
    expect(res.isValid).toBe(true);
    expect(res.playlistId).toBe('PL1234567890abcdef');
    expect(res.embedUrl).toContain('list=PL1234567890abcdef');
  });

  it('parses youtube shorts URLs correctly', () => {
    const res = parseYouTubeInput('https://www.youtube.com/shorts/kJQP7kiw5Fk');
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe('kJQP7kiw5Fk');
  });

  it('parses raw 11-character video IDs directly', () => {
    const res = parseYouTubeInput('jfKfPfyJRdk');
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe('jfKfPfyJRdk');
  });

  it('falls back gracefully to default preset when empty string is passed', () => {
    const res = parseYouTubeInput('');
    expect(res.isValid).toBe(false);
    expect(res.videoId).toBe(PROJECTOR_PRESETS[0].videoId);
    expect(res.embedUrl).toContain(PROJECTOR_PRESETS[0].videoId);
  });

  it('respects muted option when building embed URL', () => {
    const res = parseYouTubeInput('4xDzrJKXOOY', { muted: true });
    expect(res.embedUrl).toContain('mute=1');
  });
});

describe('Projector Feed & Venue Utilities', () => {
  const mockGuests: Guest[] = [
    {
      id: 'GUEST-001',
      tag_id: 'TAG-001',
      name: 'Alice',
      category: 'vip',
      custom_drink_limit: null,
      drinks_consumed: 2,
      is_entered: true,
      entered_at: '2026-10-25T14:00:00.000Z',
      is_blocked: false,
      notes: null,
    },
    {
      id: 'GUEST-002',
      tag_id: 'TAG-002',
      name: 'Bob',
      category: 'standard',
      custom_drink_limit: null,
      drinks_consumed: 1,
      is_entered: false,
      entered_at: null,
      is_blocked: false,
      notes: null,
    },
    {
      id: 'GUEST-003',
      tag_id: 'TAG-003',
      name: 'Charlie',
      category: 'driver_minor',
      custom_drink_limit: 0,
      drinks_consumed: 0,
      is_entered: true,
      entered_at: '2026-10-25T14:30:00.000Z',
      is_blocked: false,
      notes: null,
    },
  ];

  it('sorts entered guests by entered_at descending (latest first)', () => {
    const entered = getEnteredGuestsSorted(mockGuests);
    expect(entered).toHaveLength(2);
    expect(entered[0].name).toBe('Charlie'); // entered at 14:30
    expect(entered[1].name).toBe('Alice');   // entered at 14:00
  });

  it('calculates venue attendance stats accurately', () => {
    const stats = calculateProjectorStats(mockGuests);
    expect(stats.totalEntered).toBe(2);
    expect(stats.totalCapacity).toBe(3);
    expect(stats.fillPercentage).toBe(67);
  });

  it('formats category labels cleanly without fake pill keywords', () => {
    expect(formatCategoryLabel('vip')).toBe('VIP Guest');
    expect(formatCategoryLabel('driver_minor')).toBe('Designated Driver');
    expect(formatCategoryLabel('standard')).toBe('Party Guest');
  });

  it('formats relative times correctly', () => {
    const referenceNow = new Date('2026-10-25T14:35:00.000Z').getTime();
    expect(formatRelativeTime('2026-10-25T14:34:40.000Z', referenceNow)).toBe('Just now');
    expect(formatRelativeTime('2026-10-25T14:30:00.000Z', referenceNow)).toBe('5m ago');
    expect(formatRelativeTime('2026-10-25T13:30:00.000Z', referenceNow)).toBe('1h ago');
  });
});
