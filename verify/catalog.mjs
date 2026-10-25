import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const browser = await chromium.launch({
  executablePath: process.env.PARALLAX_CHROMIUM_PATH || undefined,
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  let calls = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/generate', (route) => {
    calls++;
    return route.fulfill({
      status: 503,
      json: { error: 'Preloaded experiments must not call the API' },
    });
  });
  await page.goto(base);
  const formulas = await page.evaluate(async () => {
    const { FORMULAS, formatValue } = await import('/src/lib/catalog/formulas.ts');
    return FORMULAS.map((f) => ({
      id: f.id,
      title: f.title,
      equation: f.equation,
      first: f.params[0],
      minOutput: formatValue(
        f.calculate({
          ...Object.fromEntries(f.params.map((d) => [d.id, d.default])),
          [f.params[0].id]: f.params[0].min,
        }),
      ),
      maxOutput: formatValue(
        f.calculate({
          ...Object.fromEntries(f.params.map((d) => [d.id, d.default])),
          [f.params[0].id]: f.params[0].max,
        }),
      ),
    }));
  });
  assert.equal(await page.locator('.formula-library,.library-card').count(), 0);
  assert.doesNotMatch(
    await page.locator('body').innerText(),
    /preloaded|authored example|browse library/i,
  );
  for (const prompt of ['p=w/t', 'P = W / t', 'W=Pt', 't=W/P', 'Please explain P=W/t']) {
    await page.locator('#concept').fill(prompt);
    await page.getByRole('button', { name: 'Create experiment', exact: true }).click();
    await page.getByRole('heading', { name: 'Mechanical power', exact: true }).waitFor();
    assert.equal(await page.locator('.catalog-canvas').count(), 1);
    assert.equal(await page.locator('iframe').count(), 0);
    assert.doesNotMatch(
      await page.locator('main').innerText(),
      /preloaded|authored example|library/i,
    );
    if (prompt === 'p=w/t') {
      await page.waitForFunction(() => !document.querySelector('body > canvas'));
      await page.screenshot({ path: 'verify/screens/premium-power-input.png', fullPage: true });
    }
    await page.getByRole('button', { name: 'Back to start' }).click();
  }
  for (const f of formulas) {
    await page.locator('#concept').fill(f.equation);
    await page.getByRole('button', { name: 'Create experiment', exact: true }).click();
    await page.getByRole('heading', { name: f.title, exact: true }).waitFor();
    assert.equal(await page.evaluate(() => scrollY), 0, 'New experiments open at the top');
    for (const [value, expected] of [
      [f.first.min, f.minOutput],
      [f.first.max, f.maxOutput],
    ]) {
      await page.locator(`#generated-${f.first.id}`).fill(String(value));
      assert.equal(
        await page
          .locator(`#generated-${f.first.id}`)
          .evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--fill'))),
        value === f.first.min ? 0 : 100,
        f.id + ' slider fill',
      );
      assert.ok(
        (await page.locator('.catalog-readout strong').first().textContent()).includes(expected),
        f.id + ' readout',
      );
      assert.equal(
        await page
          .locator('.catalog-visual svg')
          .evaluate((svg) =>
            [...svg.querySelectorAll('*')].some((e) =>
              [...e.attributes].some((a) => /NaN|Infinity/.test(a.value)),
            ),
          ),
        false,
        f.id + ' finite SVG coordinates',
      );
    }
    if (['hooke', 'snell', 'projectile', 'coulomb', 'ideal-gas', 'kinetic'].includes(f.id)) {
      await page.getByRole('button', { name: 'Reset values' }).click();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForFunction(() => document.querySelectorAll('body > canvas').length === 0);
      await page.screenshot({ path: `verify/screens/library-${f.id}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: 'Back to start' }).click();
  }
  for (const prompt of ['kinetic energy', '1/2mv^2', '½mv²', 'E = mv²/2']) {
    await page.locator('#concept').fill(prompt);
    await page.getByRole('button', { name: 'Create experiment' }).click();
    await page.getByRole('heading', { name: 'Kinetic energy', exact: true }).waitFor();
    if (prompt === 'E = mv²/2') break;
    await page.getByRole('button', { name: 'Back to start' }).click();
  }
  await page.locator('#generated-v').fill('8');
  await page.getByRole('button', { name: 'Save experiment', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Saved experiments', exact: true }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  assert.equal(await page.locator('#generated-v').inputValue(), '8');
  await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
  const paused = await page.locator('.catalog-canvas').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(100);
  assert.equal(
    await page.locator('.catalog-canvas').evaluate((canvas) => canvas.toDataURL()),
    paused,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'verify/screens/library-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(calls, 0);
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${formulas.length} premium models: equation submission, sliders at both limits, exact numeric readouts, finite SVGs, formula aliases, save/reload/reopen, pause, mobile, zero API calls.`,
  );
} finally {
  await browser.close();
}
