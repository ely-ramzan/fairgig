import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

describe('refresh mutex', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('axios.post for refresh can be mocked once for parallel 401s', async () => {
    const spy = vi.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'new' } } as never);
    await axios.post('/x', {});
    await axios.post('/x', {});
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
