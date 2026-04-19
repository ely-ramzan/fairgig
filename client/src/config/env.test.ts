import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const urlOrEmpty = z
  .string()
  .optional()
  .transform((v) => v ?? '')
  .refine((v) => v === '' || /^https?:\/\//.test(v), 'Must be http(s) URL or empty');

describe('env URL validation', () => {
  it('accepts empty and http(s) URLs', () => {
    expect(urlOrEmpty.parse('')).toBe('');
    expect(urlOrEmpty.parse(undefined)).toBe('');
    expect(urlOrEmpty.parse('http://localhost:8001')).toBe('http://localhost:8001');
  });
  it('rejects non-URLs', () => {
    expect(() => urlOrEmpty.parse('ftp://x')).toThrow();
  });
});
