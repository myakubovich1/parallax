import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { massEnergy, spring } from './fixtures/experiments.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const browser = await chromium.launch({ executablePath: process.env.PARALLAX_CHROMIUM_PATH || undefined });
const out = new URL('./screens/', import.meta.url);
await mkdir(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let lesson = massEnergy,
    calls = 0;
  await page.route('**/api/generate', (route) => {
    calls++;
    return route.fulfill({ json: { lesson } });
  });
  const generate = async (mode = 'explore') => {
    await page.goto(base);
    await page.locator('#concept').fill('Explain E=mc^2');
    await page.locator(`input[name=mode][value=${mode}]`).check();
    await page.getByRole('button', { name: 'Create experiment' }).click();
    await page.locator('.experiment-workspace').waitFor();
    await page.evaluate(() => document.fonts.ready);
  };
  await generate();
  assert.match(await page.locator('.experiment-readout').innerText(), /89\.88/);
  await page.getByRole('button', { name: 'Double the mass', exact: true }).click();
  assert.equal(await page.locator('#range-m').inputValue(), '2');
  assert.match(await page.locator('.experiment-readout').innerText(), /179\.75/);
  assert.match(await page.locator('.experiment-feedback').innerText(), /Mass × 2; Rest energy × 2/);
  await page.getByRole('button', { name: 'Pin current values' }).click();
  await page.locator('#range-m').fill('1');
  assert.match(await page.locator('.experiment-feedback').innerText(), /Mass × 0\.5; Rest energy × 0\.5/);
  await page.locator('.experiment-equation-parts .term').filter({ hasText: /^m$/ }).click();
  assert.match(await page.locator('.experiment-term').innerText(), /Adjustable variable/i);
  await page.getByRole('button', { name: 'Adjust this variable' }).click();
  await page.waitForFunction(() => document.activeElement === document.querySelector('#range-m'));
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  assert.match(await page.locator('.experiment-stage-frame svg').getAttribute('aria-label'), /89\.88 TJ/);
  await page.getByRole('button', { name: 'Scene', exact: true }).click();
  await page.getByRole('tab', { name: 'Challenge', exact: true }).click();
  await page.getByRole('button', { name: 'Set up and predict' }).click();
  await page.getByRole('button', { name: 'It quadruples', exact: true }).click();
  assert.match(await page.locator('.challenge-result').innerText(), /Here’s what happened/);
  assert.match(await page.locator('.challenge-result').innerText(), /89\.88 → 179\.75/);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('button', { name: 'It doubles', exact: true }).click();
  assert.match(await page.locator('.challenge-result').innerText(), /prediction matches/);
  await page.getByRole('radio', { name: 'Build from basics' }).check();
  await page.getByRole('button', { name: 'Next: Understand the model' }).click();
  await page.getByRole('button', { name: 'Next: Try it yourself' }).click();
  assert.equal(await page.locator('#range-m').inputValue(), '2');
  await page.getByRole('radio', { name: 'Quick intuition' }).check();
  assert.equal(await page.locator('#range-m').count(), 0);
  await page.getByRole('button', { name: 'Try it: Double the mass' }).click();
  assert.match(await page.locator('.experiment-readout').innerText(), /179\.75/);
  await page.getByRole('button', { name: 'Save experiment', exact: true }).click();
  const before = calls;
  await page.reload();
  await page.getByRole('button', { name: 'Saved experiments', exact: true }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  assert.equal(calls, before);
  assert.equal(await page.getByRole('radio', { name: 'Quick intuition' }).isChecked(), true);
  assert.match(await page.locator('.experiment-readout').innerText(), /179\.75/);
  await page.getByRole('radio', { name: 'Explain & explore' }).check();
  await page.getByRole('tab', { name: 'Experiment', exact: true }).click();
  await page.getByRole('button', { name: '1 kg', exact: true }).click();
  assert.match(await page.locator('.experiment-readout').innerText(), /89,875\.52 TJ/);
  await page.getByRole('button', { name: 'Reset values', exact: true }).click();
  await page.screenshot({ path: new URL('experiment-mass-energy.png', out).pathname, fullPage: true });
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of ['Scene', 'Graph']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${width} ${view} should fit`,
      );
    }
    if (width === 390)
      await page.screenshot({ path: new URL('experiment-mobile.png', out).pathname, fullPage: true });
  }
  lesson = spring;
  await generate('basics');
  await page.getByRole('button', { name: 'Next: Understand the model' }).click();
  await page.getByRole('button', { name: 'Next: Try it yourself' }).click();
  await page.getByRole('button', { name: 'Compress', exact: true }).click();
  assert.match(await page.locator('.experiment-readout').innerText(), /2 N/);
  await page.screenshot({ path: new URL('experiment-spring.png', out).pathname, fullPage: true });

  // An independent shared calculation must reject a custom scene's false readout.
  lesson = {
    ...spring,
    renderer: { ...spring.renderer, kind: 'custom' },
    stageHtml: `<p>Custom spring</p><script>addEventListener('message',e=>{if(e.data.type==='params')parent.postMessage({type:'value',id:'F',value:999},'*')});parent.postMessage({type:'ready'},'*')</script>`,
  };
  await generate();
  await page.locator('.stage-quality-note').waitFor();
  assert.match(await page.locator('.stage-quality-note').innerText(), /numbers disagree/);
  assert.equal(await page.locator('iframe').count(), 0);
  assert.match(await page.locator('.experiment-readout').innerText(), /-2 N/);
  lesson = {
    ...spring,
    renderer: { ...spring.renderer, kind: 'custom' },
    stageHtml: `<p id="value"></p><script>addEventListener('message',e=>{if(e.data.type==='params'){const v=-2*e.data.params.x;document.querySelector('#value').textContent=v;parent.postMessage({type:'value',id:'F',value:v},'*')}});parent.postMessage({type:'ready'},'*')</script>`,
  };
  await generate();
  await page.locator('.checked-custom-stage[aria-busy=false]').waitFor();
  assert.equal(await page.locator('.stage-quality-note').count(), 0);
  await page.locator('#range-x').fill('2');
  await page.frameLocator('iframe').locator('#value').filter({ hasText: '-4' }).waitFor();
  lesson = { ...lesson, stageHtml: '<p>Never reports a calculation</p>' };
  await generate();
  await page.locator('.stage-quality-note').waitFor();
  assert.match(await page.locator('.stage-quality-note').innerText(), /did not confirm/);
  assert.deepEqual(errors, []);
  console.log(
    'PASS rich lessons: mass-energy units, causal feedback, pinning, linked equation, graph, wrong/right predictions, all modes, saved mode/values, responsive views, signed spring force and rejected custom readout',
  );
} finally {
  await browser.close();
}
