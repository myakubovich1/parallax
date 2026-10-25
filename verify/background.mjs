import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const out = new URL('./screens/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PARALLAX_CHROMIUM_PATH || undefined });
const errors = [];
const snapshot = page => page.locator('.phosphor-background').evaluate(canvas => canvas.toDataURL());
const settle = page => page.waitForFunction(() => {
  const canvas = document.querySelector('.phosphor-background');
  return canvas?.width === innerWidth && canvas?.height === innerHeight;
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await settle(page);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('.phosphor-background').getAttribute('aria-hidden'), 'true');
  assert.equal(await page.locator('.phosphor-background').evaluate(canvas => getComputedStyle(canvas).pointerEvents), 'none');
  const idle = await snapshot(page);
  await page.mouse.move(250, 340);
  await page.waitForTimeout(1300);
  const raised = await snapshot(page);
  assert.notEqual(raised, idle, 'Hover should raise and brighten the field');
  await page.waitForTimeout(300);
  assert.equal(await snapshot(page), raised, 'The field should stop drawing once settled');
  await page.screenshot({ path: new URL('phosphor-hover.png', out).pathname });
  await page.mouse.move(-10, -10);
  await page.waitForTimeout(1300);
  assert.equal(await snapshot(page), idle, 'Leaving should restore the resting field');
  await page.screenshot({ path: new URL('phosphor-entry.png', out).pathname });

  for (const id of ['wave-interference', 'gravitational-attraction', 'gradient-descent']) {
    await page.goto(`${base}/#${id}`);
    await settle(page);
    await page.locator('.stage-body .stage-canvas canvas, .stage-body .stage-svg svg').waitFor();
    assert.equal(await page.locator('.phosphor-background').count(), 1, `${id} should retain the shared background`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: new URL(`phosphor-${id}.png`, out).pathname });
  }

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.screenshot({ path: new URL('phosphor-settings.png', out).pathname });
  await page.getByRole('switch', { name: 'Visual effects' }).click();
  assert.equal(await page.locator('.phosphor-background').count(), 0);
  await page.keyboard.press('Escape');
  await page.reload();
  assert.equal(await page.locator('.phosphor-background').count(), 0, 'Effects preference should persist');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Visual effects' }).click();
  await settle(page);
  await page.getByRole('radio', { name: /Reduce motion/ }).check();
  await page.keyboard.press('Escape');
  const reduced = await snapshot(page);
  await page.mouse.move(350, 300);
  await page.waitForTimeout(200);
  assert.equal(await snapshot(page), reduced, 'Explicit reduced motion should disable pointer animation');

  const generated = {
    title: 'Spring experiment', equation: 'F = -kx', explanation: ['Displacement creates a restoring force.'],
    stageHtml: '<style>body{background:#10201a;color:#c3f86b}</style><p>Spring visualization</p>',
    params: [], assumptions: ['Ideal spring.'],
  };
  await page.route('**/api/generate', route => route.fulfill({ json: { lesson: generated } }));
  await page.goto(base);
  await page.locator('#concept').fill('Explain a hypothetical cubic restoring force');
  await page.getByRole('button', { name: 'Create experiment' }).click();
  await page.getByRole('heading', { name: 'Spring experiment', exact: true }).waitFor();
  assert.equal(await page.locator('.phosphor-background').count(), 1);
  await page.screenshot({ path: new URL('phosphor-generated.png', out).pathname });

  const reducedContext = await browser.newContext({ reducedMotion: 'reduce' });
  const systemReduced = await reducedContext.newPage();
  await systemReduced.goto(base);
  await settle(systemReduced);
  const staticField = await snapshot(systemReduced);
  await systemReduced.mouse.move(240, 300);
  await systemReduced.waitForTimeout(200);
  assert.equal(await snapshot(systemReduced), staticField, 'System reduced motion should also disable animation');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on('pageerror', error => errors.push(error.message));
  for (const hash of ['', '#wave-interference', '#gravitational-attraction', '#gradient-descent']) {
    await mobile.goto(`${base}/${hash}`);
    await settle(mobile);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Mobile ${hash} should fit the viewport`);
  }
  await mobile.goto(base);
  await settle(mobile);
  await mobile.evaluate(() => document.fonts.ready);
  const touchField = await snapshot(mobile);
  await mobile.touchscreen.tap(220, 340);
  await mobile.waitForTimeout(200);
  assert.equal(await snapshot(mobile), touchField, 'Touch should preserve a static background');
  await mobile.screenshot({ path: new URL('phosphor-mobile.png', out).pathname, fullPage: true });
  await mobile.setViewportSize({ width: 820, height: 1000 });
  await settle(mobile);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS hover depth, idle settling, pointer exit, all three lessons, generated lesson, dialogs, persistent effects toggle, reduced motion, touch and resize');
} finally {
  await browser.close();
}
