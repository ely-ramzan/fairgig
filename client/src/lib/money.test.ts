import { describe, it, expect } from 'vitest';
import { toCents, fromCents, formatPKRFromCents, parseMoneyWire } from './money';

describe('toCents', () => {
  it('parses positive decimals', () => {
    expect(toCents('1234.50')).toBe(123450n);
    expect(toCents('0.01')).toBe(1n);
  });
  it('parses negatives', () => {
    expect(toCents('-99.99')).toBe(-9999n);
  });
  it('handles commas', () => {
    expect(toCents('1,234.56')).toBe(123456n);
  });
  it('handles number input', () => {
    expect(toCents(10.5)).toBe(1050n);
  });
  it('returns 0 for empty', () => {
    expect(toCents('')).toBe(0n);
    expect(toCents(null)).toBe(0n);
  });
});

describe('fromCents', () => {
  it('round-trips', () => {
    expect(fromCents(123450n)).toBe('1234.50');
    expect(fromCents(-1n)).toBe('-0.01');
  });
});

describe('formatPKRFromCents', () => {
  it('formats without throwing', () => {
    const out = formatPKRFromCents(10000n);
    expect(out.length).toBeGreaterThan(3);
    expect(/\d/.test(out)).toBe(true);
  });
});

describe('parseMoneyWire', () => {
  it('unifies string and number', () => {
    expect(parseMoneyWire('10.00')).toBe(1000n);
    expect(parseMoneyWire(10)).toBe(1000n);
  });
});
