import { describe, it, expect } from 'vitest';
import { grievanceTags, type Grievance } from './api';

describe('grievanceTags', () => {
  it('maps grievance_tags to tag strings', () => {
    const g = {
      id: '1',
      worker_id: null,
      platform_id: 'p',
      category: 'other' as const,
      description: '12345678901',
      status: 'open' as const,
      is_anonymous: true,
      resolution_notes: null,
      created_at: '',
      updated_at: '',
      grievance_tags: [{ id: 't1', grievance_id: '1', tag: 'a' }],
    } satisfies Grievance;
    expect(grievanceTags(g)).toEqual(['a']);
  });
  it('returns empty when no tags', () => {
    const g = {
      id: '1',
      worker_id: null,
      platform_id: 'p',
      category: 'other' as const,
      description: '12345678901',
      status: 'open' as const,
      is_anonymous: true,
      resolution_notes: null,
      created_at: '',
      updated_at: '',
    } satisfies Grievance;
    expect(grievanceTags(g)).toEqual([]);
  });
});
