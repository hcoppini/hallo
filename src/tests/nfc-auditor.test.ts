import { describe, it, expect } from 'vitest';
import { parseTagId } from '@/lib/tag-utils';

function auditTagBatch(scannedInputs: string[]) {
  const map: Record<string, { id: string; num: number | null; count: number }> = {};
  const duplicateEvents: { id: string; num: number | null; count: number }[] = [];

  scannedInputs.forEach(input => {
    const parsed = parseTagId(input);
    const canonical = parsed.canonicalTag || input.toUpperCase();
    const num = parsed.tagNumber;

    if (!map[canonical]) {
      map[canonical] = { id: canonical, num, count: 1 };
    } else {
      map[canonical].count += 1;
      duplicateEvents.push({ id: canonical, num, count: map[canonical].count });
    }
  });

  const allTags = Object.values(map);
  const numericTags = allTags.filter(t => t.num !== null && !isNaN(t.num));
  const numbersSet = new Set(numericTags.map(t => t.num as number));
  const numbers = numericTags.map(t => t.num as number);

  const minNum = numbers.length > 0 ? Math.min(...numbers) : null;
  const maxNum = numbers.length > 0 ? Math.max(...numbers) : null;

  const missingNumbers: number[] = [];
  if (minNum !== null && maxNum !== null && minNum < maxNum) {
    for (let n = minNum; n <= maxNum; n++) {
      if (!numbersSet.has(n)) {
        missingNumbers.push(n);
      }
    }
  }

  return {
    uniqueCount: allTags.length,
    totalTaps: scannedInputs.length,
    duplicates: allTags.filter(t => t.count > 1),
    duplicateEvents,
    minNum,
    maxNum,
    missingNumbers,
    isCompleteSequence: numbers.length > 0 && missingNumbers.length === 0,
  };
}

describe('NFC Tag Auditor & Range Verifier', () => {
  it('correctly tracks sequential scans and detects duplicates when a tag repeats', () => {
    const input = ['TAG-001', 'TAG-002', 'TAG-003', 'TAG-002'];
    const result = auditTagBatch(input);

    expect(result.uniqueCount).toBe(3);
    expect(result.totalTaps).toBe(4);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].id).toBe('TAG-002');
    expect(result.duplicates[0].count).toBe(2);
    expect(result.duplicateEvents[0].id).toBe('TAG-002');
  });

  it('correctly computes min, max, and identifies missing numbers in between', () => {
    // Range from 1 to 7 with 3 and 6 missing
    const input = [
      'https://hallo-zkqp.vercel.app/t/1',
      'https://hallo-zkqp.vercel.app/t/2',
      'https://hallo-zkqp.vercel.app/t/4',
      'https://hallo-zkqp.vercel.app/t/5',
      'https://hallo-zkqp.vercel.app/t/7',
    ];
    const result = auditTagBatch(input);

    expect(result.minNum).toBe(1);
    expect(result.maxNum).toBe(7);
    expect(result.missingNumbers).toEqual([3, 6]);
    expect(result.isCompleteSequence).toBe(false);
  });

  it('detects a single missing tag and formats notification', () => {
    // 68, 69 is missing, 70
    const input = ['TAG-068', 'TAG-070'];
    const result = auditTagBatch(input);

    expect(result.minNum).toBe(68);
    expect(result.maxNum).toBe(70);
    expect(result.missingNumbers).toEqual([69]);

    const notifications = result.missingNumbers.map(n => `${n} is missing`);
    expect(notifications).toContain('69 is missing');
  });

  it('verifies a complete perfect sequence with 0 missing tags', () => {
    const input = ['TAG-010', 'TAG-011', 'TAG-012', 'TAG-013', 'TAG-014'];
    const result = auditTagBatch(input);

    expect(result.minNum).toBe(10);
    expect(result.maxNum).toBe(14);
    expect(result.missingNumbers).toHaveLength(0);
    expect(result.isCompleteSequence).toBe(true);
  });

  it('handles out-of-order scans seamlessly', () => {
    // Scanned in random order: 5, 1, 4, 2 (3 is missing)
    const input = ['5', '1', '4', '2'];
    const result = auditTagBatch(input);

    expect(result.minNum).toBe(1);
    expect(result.maxNum).toBe(5);
    expect(result.missingNumbers).toEqual([3]);
  });
});
