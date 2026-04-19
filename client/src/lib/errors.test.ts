import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { classifyAxiosError, AuthError, NetworkError } from './errors';

describe('classifyAxiosError', () => {
  it('maps 401 to AuthError', () => {
    const err = new axios.AxiosError('Unauthorized');
    err.response = { status: 401, data: { detail: 'bad' } } as never;
    const out = classifyAxiosError(err);
    expect(out).toBeInstanceOf(AuthError);
  });
  it('maps network failure', () => {
    const err = new axios.AxiosError('Network Error');
    const out = classifyAxiosError(err);
    expect(out).toBeInstanceOf(NetworkError);
  });
  it('maps generic Error', () => {
    const out = classifyAxiosError(new Error('x'));
    expect(out.message).toContain('x');
  });
});
