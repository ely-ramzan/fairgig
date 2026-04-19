import { http, HttpResponse } from 'msw';

/** Default handlers — overridden per test via server.use(...). */
export const handlers = [
  http.get('*/api/auth/me', () => HttpResponse.json({ id: '1', email: 't@test.com', role: 'worker', display_name: 'T' })),
];
