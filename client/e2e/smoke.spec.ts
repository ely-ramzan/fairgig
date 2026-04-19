import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('landing loads', async ({ page }) => {
    await page.goto('/landing');
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  });
});
