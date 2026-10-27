import { describe, it, expect } from 'vitest';
import {
  timeStringToMinutes,
  minutesToTimeString,
  calculatePartyDurationMinutes,
  calculateElapsedPartyMinutes,
  calculatePartyProgress,
  calculateCheckpointPosition,
  getCheckpointStatus,
  findActiveOrNextCheckpoint,
  formatMinutesUntil,
  DEFAULT_PARTY_SCHEDULE,
} from '../lib/party-schedule-utils';

describe('Party Schedule Utilities', () => {
  describe('Time conversion helpers', () => {
    it('converts HH:mm to minutes', () => {
      expect(timeStringToMinutes('00:00')).toBe(0);
      expect(timeStringToMinutes('01:30')).toBe(90);
      expect(timeStringToMinutes('20:00')).toBe(1200);
      expect(timeStringToMinutes('23:59')).toBe(1439);
    });

    it('converts minutes to HH:mm string', () => {
      expect(minutesToTimeString(0)).toBe('00:00');
      expect(minutesToTimeString(90)).toBe('01:30');
      expect(minutesToTimeString(1200)).toBe('20:00');
    });
  });

  describe('Overnight duration and elapsed time (20:00 to 02:00)', () => {
    const start = '20:00';
    const end = '02:00';

    it('calculates total duration across midnight (6 hours = 360 mins)', () => {
      expect(calculatePartyDurationMinutes(start, end)).toBe(360);
    });

    it('calculates elapsed time at party start (20:00)', () => {
      expect(calculateElapsedPartyMinutes(start, end, '20:00')).toBe(0);
      expect(calculatePartyProgress(start, end, '20:00')).toBe(0);
    });

    it('calculates elapsed time at 23:00 (halfway = 180 mins)', () => {
      expect(calculateElapsedPartyMinutes(start, end, '23:00')).toBe(180);
      expect(calculatePartyProgress(start, end, '23:00')).toBe(50);
    });

    it('calculates elapsed time at midnight (00:00 = 240 mins)', () => {
      expect(calculateElapsedPartyMinutes(start, end, '00:00')).toBe(240);
      expect(calculatePartyProgress(start, end, '00:00')).toBeCloseTo(66.7, 1);
    });

    it('calculates elapsed time at 01:30 (330 mins)', () => {
      expect(calculateElapsedPartyMinutes(start, end, '01:30')).toBe(330);
      expect(calculatePartyProgress(start, end, '01:30')).toBeCloseTo(91.7, 1);
    });

    it('calculates elapsed time at party end (02:00)', () => {
      expect(calculateElapsedPartyMinutes(start, end, '02:00')).toBe(360);
      expect(calculatePartyProgress(start, end, '02:00')).toBe(100);
    });
  });

  describe('Same-day duration (18:00 to 23:00)', () => {
    const start = '18:00';
    const end = '23:00';

    it('calculates same-day duration (5 hours = 300 mins)', () => {
      expect(calculatePartyDurationMinutes(start, end)).toBe(300);
    });

    it('calculates progress at 20:30 (2.5 hours in = 50%)', () => {
      expect(calculatePartyProgress(start, end, '20:30')).toBe(50);
    });
  });

  describe('Checkpoint positions & statuses', () => {
    const start = '20:00';
    const end = '02:00';

    it('places checkpoints at correct percentage', () => {
      expect(calculateCheckpointPosition(start, end, '20:00')).toBe(0);
      expect(calculateCheckpointPosition(start, end, '23:00')).toBe(50);
      expect(calculateCheckpointPosition(start, end, '02:00')).toBe(100);
    });

    it('determines checkpoint status based on current time', () => {
      // Current time is 22:00
      expect(getCheckpointStatus(start, end, '22:00', '20:00')).toBe('past');
      expect(getCheckpointStatus(start, end, '22:00', '22:05')).toBe('current');
      expect(getCheckpointStatus(start, end, '22:00', '23:00')).toBe('upcoming');
    });

    it('finds active or next checkpoint', () => {
      const schedule = DEFAULT_PARTY_SCHEDULE;
      const res = findActiveOrNextCheckpoint(schedule, '22:30');
      // At 22:30, next checkpoint should be 23:00 (Singing HBD) in 30m
      expect(res.next?.time).toBe('23:00');
      expect(res.minutesUntilNext).toBe(30);
    });

    it('formats remaining minutes cleanly', () => {
      expect(formatMinutesUntil(15)).toBe('in 15m');
      expect(formatMinutesUntil(60)).toBe('in 1h');
      expect(formatMinutesUntil(75)).toBe('in 1h 15m');
      expect(formatMinutesUntil(0)).toBe('happening now');
    });
  });
});
