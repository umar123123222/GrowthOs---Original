import { test, expect } from '@playwright/test';

/**
 * Visual regression check: the Skip Drip toggle must always render in the
 * collapsed student row across common screen widths. Guards against the
 * toggle being hidden behind responsive utility classes (e.g. `hidden md:flex`)
 * or pushed out of the viewport on smaller breakpoints.
 */

const VIEWPORTS = [
  { name: 'mobile',       width: 375,  height: 800 },
  { name: 'tablet',       width: 768,  height: 1024 },
  { name: 'laptop',       width: 1280, height: 800 },
  { name: 'desktop',      width: 1440, height: 900 },
  { name: 'wide-desktop', width: 1920, height: 1080 },
];

test.describe('Skip Drip toggle — visual regression across viewports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/superadmin/);
    await page.goto('/superadmin?tab=students');
    // Wait for at least one student row to render
    await page.waitForSelector('[data-testid="drip-toggle-row"]', { timeout: 15_000 });
  });

  for (const vp of VIEWPORTS) {
    test(`toggle is visible and in-viewport at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const toggle = page.locator('[data-testid="drip-toggle-row"]').first();

      // 1. Element exists and is visible (not display:none / visibility:hidden / 0-size)
      await expect(toggle).toBeVisible();

      // 2. Bounding box sits within the viewport horizontally (catches overflow hiding)
      const box = await toggle.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      }

      // 3. Belongs to the COLLAPSED row (not inside an expanded panel)
      const inExpandedPanel = await toggle.evaluate((el) =>
        !!el.closest('[data-state="open"]') ||
        !!el.closest('[data-expanded-panel="true"]')
      );
      expect(inExpandedPanel).toBe(false);

      // 4. Snapshot for visual diffing
      await expect(toggle).toHaveScreenshot(`skip-drip-toggle-${vp.name}.png`, {
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
