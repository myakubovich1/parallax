import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const browser = await chromium.launch({
  executablePath: process.env.PARALLAX_CHROMIUM_PATH || undefined,
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let api = 0;
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/generate', (r) => {
    api++;
    return r.fulfill({ status: 500, json: { error: 'No API calls permitted' } });
  });
  await page.addInitScript(() => {
    const fill = CanvasRenderingContext2D.prototype.fillText,
      clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.classList.contains('catalog-canvas')) this.canvas.__labels = [];
      return clear.apply(this, args);
    };
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...args) {
      if (this.canvas.classList.contains('catalog-canvas')) {
        const m = this.measureText(text),
          w = m.width,
          left = x - (this.textAlign === 'right' ? w : this.textAlign === 'center' ? w / 2 : 0);
        (this.canvas.__labels ??= []).push({
          text,
          left,
          right: left + w,
          top: y - m.actualBoundingBoxAscent,
          bottom: y + m.actualBoundingBoxDescent,
        });
      }
      return fill.call(this, text, x, y, ...args);
    };
  });
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  const formulas = await page.evaluate(async () => {
    const { FORMULAS } = await import('/src/lib/catalog/formulas.ts');
    return FORMULAS.map((f) => ({ id: f.id, title: f.title, params: f.params }));
  });
  for (const f of formulas) {
    await page.getByRole('button', { name: /50 experiments/ }).click();
    await page.getByRole('searchbox').fill(f.title);
    await page
      .locator('.library-card')
      .filter({ has: page.getByText(f.title, { exact: true }) })
      .click();
    await page.locator('.catalog-canvas').waitFor();
    for (const end of ['default', 'min', 'max']) {
      for (const d of f.params) await page.locator(`#generated-${d.id}`).fill(String(d[end]));
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      const problems = await page.locator('.catalog-canvas').evaluate((canvas) => {
        const labels = canvas.__labels ?? [],
          issues = [];
        for (let i = 0; i < labels.length; i++) {
          const a = labels[i];
          if (a.left < 0 || a.right > 1000 || a.top < 0 || a.bottom > 500)
            issues.push('clipped ' + a.text);
          for (let j = i + 1; j < labels.length; j++) {
            const b = labels[j];
            if (
              a.left < b.right - 1 &&
              a.right > b.left + 1 &&
              a.top < b.bottom - 1 &&
              a.bottom > b.top + 1
            )
              issues.push('overlap: ' + a.text + ' / ' + b.text);
          }
        }
        return { count: labels.length, issues };
      });
      assert.ok(problems.count >= 4, f.id + ' annotated');
      assert.deepEqual(problems.issues, [], f.id + ' ' + end);
    }
    await page.getByRole('button', { name: 'Back to start' }).click();
  }
  await page.locator('#concept').fill('½mv²');
  await page.getByRole('button', { name: 'Create experiment' }).click();
  await page.getByRole('heading', { name: 'Kinetic energy', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Pin reference', exact: true }).click();
  await page.locator('#generated-v').fill('8');
  assert.match(await page.locator('.catalog-readout').textContent(), /64/);
  await page.getByRole('button', { name: 'Show response graph' }).click();
  await page.getByRole('img', { name: /Kinetic energy/ }).waitFor();
  await page.getByRole('button', { name: 'Show demonstration' }).click();
  const canvas = page.locator('.catalog-canvas');
  await canvas.focus();
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#generated-v').inputValue(), '0');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#generated-v').inputValue(), '0.1');
  await page.getByRole('radio', { name: 'Build from basics', exact: true }).check();
  await page.getByRole('heading', { name: 'Build the idea' }).waitFor();
  await page.getByRole('tab', { name: 'Predict' }).click();
  await page.getByRole('button', { name: 'Higher', exact: true }).click();
  assert.match(await page.getByRole('status').first().textContent(), /Correct/);
  await page.getByRole('button', { name: 'Reveal in the scene' }).click();
  assert.match(await page.locator('.catalog-prediction-result').textContent(), /400/);
  assert.equal(api, 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS all 47 scenes: actual canvas text bounds and collisions at defaults/minima/maxima, zero API calls, comparison, graph toggle, keyboard manipulation, Basics and prediction.',
  );
} finally {
  await browser.close();
}
