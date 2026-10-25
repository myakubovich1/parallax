import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createHelpApi } from '../server/help.mjs';
import { massEnergy } from './fixtures/experiments.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const received = [],
  modelContexts = [],
  errors = [];
const api = createHelpApi({
  getConfig: () => ({ PARALLAX_HELP_API_KEY: 'mock-help-key' }),
  fetchImpl: async (_url, options) => {
    const payload = JSON.parse(options.body);
    const ctx = JSON.parse(
      payload.systemInstruction.parts[0].text.split('CURRENT SCREEN CONTEXT (data):\n')[1],
    );
    modelContexts.push(ctx);
    return Response.json({
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            parts: [
              {
                text: `You are exploring ${ctx.title}. The formula is ${ctx.experiment.equation}.\n\n{"actions":[]}`,
              },
            ],
          },
        },
      ],
    });
  },
});
const server = createServer((req, res) => void api(req, res));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const endpoint = `http://127.0.0.1:${server.address().port}/api/help`;
const browser = await chromium.launch({ executablePath: process.env.PARALLAX_CHROMIUM_PATH || undefined });
await mkdir(new URL('./screens/', import.meta.url), { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/help', async (route) => {
    const body = route.request().postDataJSON();
    received.push(body.context);
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await route.fulfill({
      status: result.status,
      contentType: 'application/json',
      body: await result.text(),
    });
  });
  await page.route('**/api/generate', (route) => route.fulfill({ json: { lesson: massEnergy } }));
  const trigger = page.getByRole('button', { name: 'Ask Parallax', exact: true });
  const chat = page.getByRole('dialog', { name: 'Ask Parallax', exact: true });
  const close = () => chat.getByRole('button', { name: 'Close Parallax guide' }).click();
  const ask = async () => {
    if (!(await chat.isVisible())) await trigger.click();
    const count = modelContexts.length;
    await chat
      .getByLabel('Ask about using Parallax')
      .fill('Explain the equation and numerical results in my current experiment.');
    await chat.getByRole('button', { name: 'Send', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.guide-pending'));
    assert.equal(modelContexts.length, count + 1);
    assert.equal(await chat.getByRole('alert').count(), 0);
    assert.equal(
      await chat
        .locator('.guide-answer')
        .last()
        .innerText()
        .then((text) => text.includes('"actions"')),
      false,
    );
    assert.deepEqual(modelContexts.at(-1).experiment, received.at(-1).experiment);
    return modelContexts.at(-1);
  };
  await page.goto(base);
  let ctx = await ask();
  assert.equal(ctx.experiment.kind, 'preview');
  assert.equal(ctx.controls.length, 1);
  assert.equal(ctx.controls[0].id, 'preview-phi');
  await page.goto(`${base}/#wave-interference`);
  await page.locator('#range-phi').fill('180');
  await trigger.click();
  assert.match(await chat.locator('.guide-context').innerText(), /Wave interference/);
  const before = modelContexts.length;
  await chat.getByRole('button', { name: 'What does this control change?', exact: true }).click();
  assert.match(await chat.locator('.guide-answer').last().innerText(), /Phase difference.*180/);
  assert.equal(modelContexts.length, before);
  ctx = await ask();
  assert.equal(ctx.experiment.id, 'wave-interference');
  assert.equal(ctx.focusedControlId, 'range-phi');
  assert.equal(ctx.controls.length, 4);
  assert.match(ctx.experiment.equation, /sin/);
  assert.match(ctx.readouts, /Complete cancellation/);
  assert.ok(ctx.experiment.terms.some((t) => t.symbol === 'k' && /6.28/.test(t.value)));
  assert.ok(ctx.experiment.assumptions.length > 0);
  assert.match(ctx.experiment.state, /Paused/);
  await chat.locator('.guide-experiment-context summary').click();
  assert.match(await chat.locator('.guide-equation').innerText(), /sin/);
  await page.screenshot({ path: new URL('./screens/guide-wave-context.png', import.meta.url).pathname });
  await close();
  await page.locator('#range-phi').fill('90');
  ctx = await ask();
  assert.equal(ctx.controls.find((c) => c.id === 'range-phi').value, '90 °');
  assert.match(ctx.readouts, /Partial/);
  await close();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('radio', { name: 'Quick intuition', exact: true }).check();
  ctx = await ask();
  assert.equal(ctx.mode, 'quick');
  assert.equal(ctx.controls.length, 4);
  assert.ok(ctx.controls.every((c) => !c.available));
  await close();
  await page.getByRole('button', { name: 'Gravitational attraction', exact: true }).click();
  ctx = await ask();
  assert.equal(ctx.title, 'Gravitational attraction');
  assert.match(ctx.experiment.equation, /G/);
  assert.match(ctx.readouts, /Force on each body/);
  assert.equal(ctx.focusedControlId, null);
  await close();
  await page.getByRole('button', { name: 'Gradient descent', exact: true }).click();
  ctx = await ask();
  assert.equal(ctx.title, 'Gradient descent');
  assert.match(ctx.experiment.equation, /η/);
  assert.match(ctx.experiment.state, /iteration 0/);
  await close();
  await page.getByRole('button', { name: 'Parallax home', exact: true }).click();
  await page.locator('#concept').fill('Kinetic energy');
  await page.getByRole('button', { name: 'Create experiment', exact: true }).click();
  await page.locator('#generated-v').fill('8');
  ctx = await ask();
  assert.equal(ctx.experiment.kind, 'catalog');
  assert.match(ctx.readouts, /64 J/);
  assert.match(ctx.experiment.equation, /v/);
  await close();
  await page.getByRole('button', { name: 'Parallax home', exact: true }).click();
  await page.locator('#concept').fill('Explain this custom version-two experiment');
  await page.getByRole('button', { name: 'Create experiment', exact: true }).click();
  await page.locator('#range-m').fill('2');
  ctx = await ask();
  assert.equal(ctx.experiment.kind, 'generated');
  assert.match(ctx.experiment.equation, /mc\^2/);
  assert.match(ctx.readouts, /179.751/);
  assert.ok(ctx.experiment.terms.some((t) => t.symbol === 'c' && t.value === '299792458 m/s'));
  await close();
  await page.getByRole('button', { name: 'Save experiment', exact: true }).click();
  await page.getByRole('button', { name: 'Parallax home', exact: true }).click();
  await page.getByRole('button', { name: 'Saved experiments', exact: true }).click();
  await page
    .locator('.saved-item')
    .filter({ hasText: 'Mass–energy equivalence' })
    .getByRole('button', { name: 'Open', exact: true })
    .click();
  ctx = await ask();
  assert.equal(ctx.controls[0].value, '2 g');
  assert.match(ctx.readouts, /179.751/);
  await close();
  const legacy = {
    title: 'Legacy rest energy',
    equation: massEnergy.equation,
    explanation: massEnergy.explanation,
    stageHtml: '<p>Original saved visualization</p>',
    params: massEnergy.params,
    assumptions: massEnergy.assumptions,
  };
  await page.evaluate(
    (lesson) =>
      localStorage.setItem(
        'parallax.saved.v1',
        JSON.stringify([
          {
            id: 'legacy',
            title: lesson.title,
            generatedLesson: lesson,
            mode: 'explore',
            params: { m: 3 },
            savedAt: Date.now(),
          },
        ]),
      ),
    legacy,
  );
  await page.reload();
  await page.getByRole('button', { name: 'Saved experiments', exact: true }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  ctx = await ask();
  assert.equal(ctx.experiment.kind, 'legacy');
  assert.equal(ctx.controls[0].value, '3 g');
  assert.match(ctx.experiment.equation, /mc\^2/);
  assert.match(ctx.readouts, /does not expose computed readouts/);
  assert.equal(JSON.stringify(ctx).includes('stageHtml'), false);
  await close();
  // Existing tab history with the screenshot's prose+JSON format is repaired on reload.
  await page.evaluate(() =>
    sessionStorage.setItem(
      'parallax.help.v1',
      JSON.stringify([
        {
          id: 'old',
          role: 'assistant',
          source: 'gemma',
          content: 'An earlier answer.\n{"actions":[{"type":"open-library"}]}',
        },
      ]),
    ),
  );
  await page.reload();
  await trigger.click();
  assert.equal(await chat.locator('.guide-answer').innerText(), 'An earlier answer.');
  assert.equal(await chat.getByRole('button', { name: 'Browse the library', exact: true }).count(), 1);
  assert.deepEqual(errors, []);
  console.log(
    'PASS real chat API/model boundary: live preview, wave values and selected phase, hidden Quick controls, gravity/gradient navigation, catalog output, generated constants/results, saved reopening, history repair and prose+JSON normalization.',
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
