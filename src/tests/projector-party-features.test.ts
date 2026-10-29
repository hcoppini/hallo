import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PARTY_SCHEDULE,
  calculatePartyDurationMinutes,
  calculatePartyProgress,
  calculateCheckpointPosition,
  getCheckpointStatus,
  findActiveOrNextCheckpoint,
  PartyProgramSchedule,
} from '../lib/party-schedule-utils';
import {
  DEFAULT_POKER_SETTINGS,
  DEFAULT_PARTY_QRS,
  extractLevelMinutes,
  formatTimer,
  isPokerScheduledNow,
  isPokerGameActive,
} from '../lib/poker-utils';
import { generateQrDataUrl, generateQrSvg } from '../lib/qr-utils';
import { Guest } from '../lib/types';

describe('Party Program Progress Bar & Checkpoints', () => {
  it('handles standard 20:00 to 02:00 party schedule properly', () => {
    const schedule: PartyProgramSchedule = {
      startTime: '20:00',
      endTime: '02:00',
      checkpoints: [
        { id: '1', time: '20:00', title: 'Doors Open' },
        { id: '2', time: '23:00', title: 'Singing hbd 🎂' },
        { id: '3', time: '02:00', title: 'Party End' },
      ],
    };

    const duration = calculatePartyDurationMinutes(schedule.startTime, schedule.endTime);
    expect(duration).toBe(360); // 6 hours

    // Progress at 20:00 is 0%
    expect(calculatePartyProgress(schedule.startTime, schedule.endTime, '20:00')).toBe(0);

    // Progress at 23:00 (halfway) is 50%
    expect(calculatePartyProgress(schedule.startTime, schedule.endTime, '23:00')).toBe(50);

    // Checkpoint position for 23:00 is exactly 50%
    const hbdPos = calculateCheckpointPosition(schedule.startTime, schedule.endTime, '23:00');
    expect(hbdPos).toBe(50);

    // At 22:50, 23:00 checkpoint is 'current'
    expect(getCheckpointStatus(schedule.startTime, schedule.endTime, '22:50', '23:00')).toBe('current');

    // At 21:00, 23:00 checkpoint is 'upcoming'
    expect(getCheckpointStatus(schedule.startTime, schedule.endTime, '21:00', '23:00')).toBe('upcoming');

    // At 23:45, 23:00 checkpoint is 'past'
    expect(getCheckpointStatus(schedule.startTime, schedule.endTime, '23:45', '23:00')).toBe('past');
  });

  it('correctly tracks active or next checkpoint', () => {
    const res = findActiveOrNextCheckpoint(DEFAULT_PARTY_SCHEDULE, '22:45');
    // At 22:45, next checkpoint is 23:00 (Singing HBD & Birthday Cake) in 15m
    expect(res.next?.time).toBe('23:00');
    expect(res.minutesUntilNext).toBe(15);
  });
});

describe('Poker Table & QR Code Generation', () => {
  it('generates a valid QR code data URL for poker table URL', async () => {
    const dataUrl = await generateQrDataUrl(DEFAULT_POKER_SETTINGS.qrUrl, { width: 100 });
    expect(dataUrl).toContain('data:image/png;base64,');
  });

  it('generates a valid QR code SVG string', async () => {
    const svg = await generateQrSvg(DEFAULT_POKER_SETTINGS.qrUrl);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('provides default party QRs including Poker and Song Requests', () => {
    expect(DEFAULT_PARTY_QRS.length).toBeGreaterThanOrEqual(3);
    const pokerQr = DEFAULT_PARTY_QRS.find(q => q.icon === 'poker');
    expect(pokerQr).toBeDefined();
    expect(pokerQr?.url).toBeTruthy();
  });

  it('keeps poker tournament synced inside party QRs in the unified QR hub', () => {
    const qrs = DEFAULT_PARTY_QRS;
    const pokerItem = qrs.find(q => q.id === 'poker-main');
    expect(pokerItem).toBeDefined();
    expect(pokerItem?.url).toBe(DEFAULT_POKER_SETTINGS.qrUrl);
  });
});

describe('Party Fun Stats Calculation', () => {
  const mockGuests: Guest[] = [
    {
      id: 'g1',
      tag_id: 'TAG-001',
      name: 'Maya',
      category: 'standard',
      custom_drink_limit: null,
      drinks_consumed: 4,
      is_entered: true,
      entered_at: '2026-10-25T20:10:00.000Z',
      is_blocked: false,
      notes: null,
    },
    {
      id: 'g2',
      tag_id: 'TAG-002',
      name: 'Aleks',
      category: 'standard',
      custom_drink_limit: null,
      drinks_consumed: 6,
      is_entered: true,
      entered_at: '2026-10-25T20:15:00.000Z',
      is_blocked: false,
      notes: null,
    },
    {
      id: 'g3',
      tag_id: 'TAG-003',
      name: 'Piotr',
      category: 'driver_minor',
      custom_drink_limit: 0,
      drinks_consumed: 0,
      is_entered: true,
      entered_at: '2026-10-25T20:20:00.000Z',
      is_blocked: false,
      notes: null,
    },
  ];

  it('ranks top drinkers properly', () => {
    const top = [...mockGuests]
      .filter(g => g.drinks_consumed > 0)
      .sort((a, b) => b.drinks_consumed - a.drinks_consumed);

    expect(top[0].name).toBe('Aleks');
    expect(top[0].drinks_consumed).toBe(6);
    expect(top[1].name).toBe('Maya');
    expect(top[1].drinks_consumed).toBe(4);
  });

  it('identifies sober heroes / designated drivers', () => {
    const drivers = mockGuests.filter(g => g.category === 'driver_minor');
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('Piotr');
  });

  it('calculates total drinks consumed venue-wide', () => {
    const total = mockGuests.reduce((sum, g) => sum + g.drinks_consumed, 0);
    expect(total).toBe(10);
  });
});

describe('Poker Live Clock & Blind Level Extraction', () => {
  it('correctly extracts minutes from blind interval strings using extractLevelMinutes', () => {
    expect(extractLevelMinutes('7 min levels (30–40m game)')).toBe(7);
    expect(extractLevelMinutes('15 min levels')).toBe(15);
    expect(extractLevelMinutes('10 min')).toBe(10);
    expect(extractLevelMinutes('turbo 5mins')).toBe(5);
    expect(extractLevelMinutes(undefined, 7)).toBe(7);
  });

  it('formats level timer seconds into MM:SS correctly', () => {
    expect(formatTimer(420)).toBe('07:00');
    expect(formatTimer(385)).toBe('06:25');
    expect(formatTimer(59)).toBe('00:59');
    expect(formatTimer(5)).toBe('00:05');
    expect(formatTimer(0)).toBe('00:00');
  });

  it('evaluates whether poker game is active correctly', () => {
    // When manually active, game is active
    expect(isPokerGameActive('active')).toBe(true);
    expect(isPokerGameActive('active', false)).toBe(true);

    // When paused, game is never active even if scheduled
    expect(isPokerGameActive('paused', false)).toBe(false);
    expect(isPokerGameActive('paused', true)).toBe(false);

    // When upcoming, only active if reached on schedule
    expect(isPokerGameActive('upcoming', false)).toBe(false);
    expect(isPokerGameActive('upcoming', true)).toBe(true);
  });

  it('checks if poker tournament is scheduled right now based on party schedule', () => {
    // cp-5 in DEFAULT_PARTY_SCHEDULE is 01:00 Poker Tournament Championship
    // At 21:00: not scheduled yet
    expect(isPokerScheduledNow(DEFAULT_PARTY_SCHEDULE, '21:00')).toBe(false);

    // At 01:00: actively scheduled now!
    expect(isPokerScheduledNow(DEFAULT_PARTY_SCHEDULE, '01:00')).toBe(true);
    // Within 15m window of 01:00 (e.g. 01:05)
    expect(isPokerScheduledNow(DEFAULT_PARTY_SCHEDULE, '01:05')).toBe(true);

    // At 02:00: past
    expect(isPokerScheduledNow(DEFAULT_PARTY_SCHEDULE, '02:00')).toBe(false);
  });
});
