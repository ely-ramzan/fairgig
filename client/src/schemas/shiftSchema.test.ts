import { describe, it, expect } from 'vitest';
import { shiftSchema } from './shiftSchema';

const valid = {
  platform_id: '550e8400-e29b-41d4-a716-446655440000',
  shift_date: '2025-01-15',
  hours_worked: 8,
  gross_earned: 1000,
  platform_deductions: 200,
  net_received: 800,
};

describe('shiftSchema', () => {
  it('accepts valid shift', () => {
    expect(shiftSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects deductions above gross', () => {
    const r = shiftSchema.safeParse({ ...valid, platform_deductions: 2000 });
    expect(r.success).toBe(false);
  });
  it('rejects net outside 2% tolerance', () => {
    const r = shiftSchema.safeParse({ ...valid, net_received: 700 });
    expect(r.success).toBe(false);
  });
  it('rejects hours over 24', () => {
    const r = shiftSchema.safeParse({ ...valid, hours_worked: 25 });
    expect(r.success).toBe(false);
  });
});
