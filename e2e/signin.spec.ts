import { test, expect, type Page } from '@playwright/test';

const BUSINESS_REF = process.env.E2E_BUSINESS_REF;
const USERNAME = process.env.E2E_USERNAME;
const PASSWORD = process.env.E2E_PASSWORD;

// Both pages post to the same `signin` edge function and share field ids. They differ
// only in how they surface a rejection: /signin renders it inline, /gated-signin toasts.
const ROUTES = [
  { path: '/signin', name: 'signin', error: /invalid business id, username, or password/i },
  { path: '/gated-signin', name: 'gated-signin', error: /invalid credentials/i },
] as const;

async function submit(page: Page, password: string) {
  await page.locator('#businessRefNo').fill(BUSINESS_REF!);
  await page.locator('#username').fill(USERNAME!);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

for (const route of ROUTES) {
  test.describe(route.name, () => {
    test('renders the form', async ({ page }) => {
      await page.goto(route.path);

      await expect(page.locator('#businessRefNo')).toBeVisible();
      await expect(page.locator('#username')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
    });

    test('rejects a wrong password', async ({ page }) => {
      test.skip(!BUSINESS_REF || !USERNAME, 'set E2E_BUSINESS_REF and E2E_USERNAME in .env.local');

      await page.goto(route.path);
      await submit(page, 'definitely-not-the-password');

      // signin is deliberately vague: same message for unknown user and wrong password.
      // .first() because a toast also renders into an aria-live mirror node.
      await expect(page.getByText(route.error).first()).toBeVisible({ timeout: 30_000 });
      await expect(page).toHaveURL(new RegExp(route.path));
    });

    test('signs in with valid credentials and lands on the dashboard', async ({ page }) => {
      test.skip(!BUSINESS_REF || !USERNAME || !PASSWORD, 'set E2E_* credentials in .env.local');

      await page.goto(route.path);
      await submit(page, PASSWORD!);

      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
      await expect(page.getByText('404')).toHaveCount(0);
    });
  });
}
