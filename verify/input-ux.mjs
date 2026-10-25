import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spring } from './fixtures/experiments.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const browser = await chromium.launch({
  executablePath: process.env.PARALLAX_CHROMIUM_PATH || undefined,
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/generate', (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { lesson: spring } });
  });
  const enter = async (text) => {
    await page.goto(base);
    await page.locator('#concept').fill(text);
    await page.getByRole('button', { name: 'Create experiment', exact: true }).click();
  };
  await enter('1//2mv^2');
  const review = page.getByRole('region', { name: 'Did you mean this equation?' });
  await review.waitFor();
  assert.equal(await page.locator('#concept').inputValue(), '1//2mv^2');
  assert.match(await review.textContent(), /1\/2mv/);
  assert.equal(requests.length, 0);
  await page.waitForFunction(() => document.activeElement?.id === 'equation-review');
  await page.getByRole('button', { name: 'Edit input', exact: true }).click();
  assert.equal(await review.count(), 0);
  assert.equal(await page.locator('#concept').inputValue(), '1//2mv^2');
  await page.locator('#concept').press('Control+Enter');
  await review.waitFor();
  // Editing clears the suggestion, so stale suggestions cannot replace newer input.
  await page.locator('#concept').fill('KE = 1//2mv^2');
  assert.equal(await review.count(), 0);
  await page.getByRole('button', { name: 'Create experiment', exact: true }).click();
  await page.getByRole('button', { name: 'Use corrected equation' }).click();
  await page.getByRole('heading', { name: 'Kinetic energy', exact: true }).waitFor();
  assert.equal(requests.length, 0);
  await page.waitForFunction(() => !document.querySelector('body > canvas'));
  await page.evaluate(() => {
    window.uxCanvas = document.querySelector('.catalog-canvas');
  });
  const range = page.locator('#generated-v');
  await range.scrollIntoViewIfNeeded();
  const rect = await range.boundingBox();
  await page.mouse.move(rect.x + rect.width * 0.2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.8, rect.y + rect.height / 2, { steps: 30 });
  await page.mouse.up();
  const selected = await range.inputValue();
  assert.ok(Number(selected) > 10);
  await page.waitForTimeout(200);
  assert.equal(await range.inputValue(), selected);
  assert.equal(
    await page.evaluate(() => window.uxCanvas === document.querySelector('.catalog-canvas')),
    true,
  );
  await page.getByRole('button', { name: 'Play animation', exact: true }).waitFor();
  for (const [value, fill] of [['0', '0%'], ['5', '25%'], ['20', '100%']]) {
    await range.fill(value);
    assert.equal(await range.evaluate((el) => getComputedStyle(el).getPropertyValue('--fill')), fill);
  }
  await page.screenshot({ path: 'verify/screens/ux-kinetic.png', fullPage: true });

  await enter('Simple harmonic motion');
  await page.getByRole('button', { name: 'Play animation', exact: true }).click();
  await page.waitForTimeout(200);
  assert.ok(Number(await page.locator('#generated-t').inputValue()) > 1);
  await page.locator('#generated-t').fill('8');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#generated-t').inputValue(), '8');
  await page.getByRole('button', { name: 'Play animation', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reset animation', exact: true }).click();
  assert.equal(await page.locator('#generated-t').inputValue(), '0');

  // A manual slider edit wins over an in-progress preset transition.
  await page.goto(base + '/#wave-interference');
  await page.getByRole('button', { name: /^Constructive Equal amplitudes/ }).click();
  await page.locator('#range-phi').fill('75');
  await page.waitForTimeout(800);
  assert.equal(await page.locator('#range-phi').inputValue(), '75');

  await enter('F=-kx^2');
  await review.waitFor();
  assert.equal(requests.length, 0);
  await page.getByRole('button', { name: 'Use my original input', exact: true }).click();
  await page.locator('.experiment-workspace').waitFor();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].prompt, 'F=-kx^2');
  for (const input of ['sex', 'E =', 'x=sin(']) {
    await enter(input);
    await page.locator('#concept-error').waitFor();
    assert.equal(await page.locator('#concept').inputValue(), input);
    assert.equal(requests.length, 1);
  }
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await enter('1//2mv^2');
    await review.waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.screenshot({ path: 'verify/screens/ux-correction-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'verify/screens/ux-correction.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'PASS correction confirmation/edit/original, stale suggestion dismissal, no premature API calls, real slider drag, stable canvas, paused time edits, preset interruption, invalid input guidance and mobile fit.',
  );
} finally {
  await browser.close();
}
