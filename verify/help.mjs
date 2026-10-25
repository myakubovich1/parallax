import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const browser = await chromium.launch({ executablePath: process.env.PARALLAX_CHROMIUM_PATH || undefined });
await mkdir(new URL('./screens/', import.meta.url), { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [],
    requests = [];
  let fail = false,
    deferred = null;
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/help', async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    assert.equal(route.request().headers().authorization, undefined);
    assert.equal(JSON.stringify(body).includes('PARALLAX_API_KEY'), false);
    if (fail) return route.fulfill({ status: 503, json: { error: 'The guide is temporarily unavailable.' } });
    if (deferred) await deferred;
    await route.fulfill({
      json: {
        answer:
          'Use the current controls to explore the relationship. <img src=x onerror="window.guideXss=true">',
        actions: [{ type: 'open-library' }],
        source: 'gemma',
      },
    });
  });
  await page.goto(base);
  await page.locator('#concept').fill('My original question');
  const trigger = page.getByRole('button', { name: 'Ask Parallax', exact: true });
  await trigger.hover();
  await page.getByRole('region', { name: 'Meet your Parallax guide' }).waitFor();
  assert.equal(requests.length, 0);
  assert.equal(await page.locator('#parallax-help-dialog').isVisible(), false);
  await trigger.click();
  const chat = page.getByRole('dialog', { name: 'Ask Parallax', exact: true });
  await chat.waitFor();
  assert.equal(await chat.evaluate((d) => d.matches(':modal')), false);
  assert.equal(await page.locator('#concept').inputValue(), 'My original question');
  await chat.getByRole('button', { name: 'Show me a good example', exact: true }).click();
  assert.equal(requests.length, 0);
  await chat.getByRole('button', { name: 'Use this question', exact: true }).click();
  assert.equal(await chat.isVisible(), false);
  assert.equal(await page.locator('#concept').inputValue(), 'Why do waves cancel each other out?');
  assert.equal(await page.locator('#entry-title').isVisible(), true);
  await page.locator('#concept').fill('Kinetic energy');
  await page.getByRole('button', { name: 'Create experiment', exact: true }).click();
  await page.getByRole('heading', { name: 'Kinetic energy', exact: true }).waitFor();
  await trigger.click();
  await chat.getByRole('button', { name: 'What should I try first?', exact: true }).click();
  const firstId = await page.locator('#main input[type=range]').first().getAttribute('id');
  const before = await page.locator(`#${firstId}`).inputValue();
  await chat.getByRole('button', { name: 'Highlight this control', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.matches('#main input[type=range]'));
  assert.equal(await page.locator(`#${firstId}`).inputValue(), before);
  await trigger.click();
  await chat.getByLabel('Ask about using Parallax').fill('Explain what just happened');
  await chat.getByRole('button', { name: 'Send', exact: true }).click();
  await chat
    .locator('.guide-source')
    .filter({ hasText: /^Gemma$/ })
    .waitFor();
  assert.equal(requests.at(-1).context.screen, 'lesson');
  assert.equal(requests.at(-1).context.title, 'Kinetic energy');
  assert.ok(requests.at(-1).context.controls.length > 0);
  assert.equal(await chat.locator('.guide-answer img').count(), 0);
  assert.equal(await page.evaluate(() => window.guideXss), undefined);
  await page.screenshot({ path: new URL('./screens/guide-desktop.png', import.meta.url).pathname });
  await chat.getByRole('button', { name: 'Start an experiment', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.id === 'concept');
  assert.equal(await page.locator('.formula-library,.library-toggle').count(), 0);
  assert.equal(await page.locator('#concept').inputValue(), 'Kinetic energy');
  await trigger.click();
  const count = await chat.locator('.guide-message').count();
  assert.ok(count >= 4);
  await page.reload();
  await trigger.click();
  assert.equal(await chat.locator('.guide-message').count(), count);
  fail = true;
  await chat.getByLabel('Ask about using Parallax').fill('Could you describe the learning loop in detail?');
  await chat.getByRole('button', { name: 'Send', exact: true }).click();
  await chat.getByRole('alert').waitFor();
  const users = await chat.locator('.guide-message.user').count();
  fail = false;
  await chat.getByRole('button', { name: 'Retry question', exact: true }).click();
  await chat.getByRole('alert').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => !document.querySelector('.guide-pending'));
  assert.equal(await chat.locator('.guide-message.user').count(), users);
  // Closing preserves an in-flight reply; Stop cancels it and blocks a late reply.
  let release;
  deferred = new Promise((resolve) => {
    release = resolve;
  });
  await chat.getByLabel('Ask about using Parallax').fill('Help me investigate a result');
  await chat.getByRole('button', { name: 'Send', exact: true }).click();
  await chat.locator('.guide-pending').waitFor();
  await chat.getByRole('button', { name: 'Close Parallax guide' }).click();
  release();
  deferred = null;
  await page.waitForFunction(() => !document.querySelector('.guide-pending'));
  await trigger.click();
  assert.equal(
    await chat.locator('.guide-message.user').last().innerText(),
    'YOU\nHelp me investigate a result',
  );
  deferred = new Promise((resolve) => {
    release = resolve;
  });
  await chat.getByLabel('Ask about using Parallax').fill('Suggest a next investigation');
  await chat.getByRole('button', { name: 'Send', exact: true }).click();
  await chat.locator('.guide-pending').waitFor();
  const stoppedCount = await chat.locator('.guide-message').count();
  await chat.getByRole('button', { name: 'Stop', exact: true }).click();
  await chat.getByRole('alert').filter({ hasText: 'Response stopped' }).waitFor();
  release();
  deferred = null;
  await page.waitForTimeout(150);
  assert.equal(await chat.locator('.guide-message').count(), stoppedCount);
  await chat.getByRole('button', { name: 'Retry question', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.guide-pending'));
  await page.getByRole('button', { name: 'Saved experiments', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#parallax-help-dialog')?.matches(':modal'));
  assert.match(await chat.locator('.guide-context').innerText(), /saved experiments/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ask Parallax about saved experiments' }).click();
  assert.equal(await chat.evaluate((d) => d.matches(':modal')), true);
  await chat.getByRole('button', { name: 'Where are my experiments saved?', exact: true }).click();
  assert.match(await chat.locator('.guide-message.assistant').last().innerText(), /don’t sync/);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog', { name: 'Saved experiments', exact: true }).isVisible(), true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Ask Parallax about settings' }).click();
  await chat.getByRole('button', { name: 'What does reduced motion do?', exact: true }).click();
  assert.match(await chat.locator('.guide-message.assistant').last().innerText(), /Reduced motion/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    await trigger.click();
    assert.equal(await chat.evaluate((d) => d.matches(':modal')), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const bounds = await chat.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
    assert.equal(await chat.evaluate((d) => d.contains(document.activeElement)), true);
    await page.screenshot({ path: new URL(`./screens/guide-mobile-${width}.png`, import.meta.url).pathname });
    await page.keyboard.press('Escape');
    assert.equal(await chat.isVisible(), false);
  }
  await trigger.click();
  await chat.getByRole('button', { name: 'Clear conversation' }).click();
  assert.equal(await chat.locator('.guide-message').count(), 0);
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('parallax.help.v1')).length), 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS robot hover/click, local FAQ, Gemma context, explicit safe actions, preserved experiment values, navigation/reload history, retry, nested dialogs, mobile focus/fit, XSS-safe text and clear chat.',
  );
} finally {
  await browser.close();
}
