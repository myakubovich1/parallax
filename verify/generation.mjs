import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const lesson = {
  title: 'Hooke’s law', equation: 'F = -kx', explanation: ['A spring exerts a restoring force.'],
  stageHtml: `<style>body{color:white;background:#101310}</style><p id="force"></p><p id="isolation"></p><script>
    try { parent.document.body; document.querySelector('#isolation').textContent='unsafe'; }
    catch { document.querySelector('#isolation').textContent='isolated'; }
    addEventListener('message',e=>{if(e.data.type==='params') document.querySelector('#force').textContent='Force: '+(-2*e.data.params.x)+' N';});
    parent.postMessage({type:'ready'},'*');
  </script>`,
  params: [{ id: 'x', label: 'Displacement', symbol: 'x', unit: 'm', min: -2, max: 2, step: 0.1, default: 1, digits: 1, hint: 'Move the spring.' }],
  assumptions: ['Ideal spring with k = 2 N/m.'],
};
const browser = await chromium.launch({ executablePath: process.env.PARALLAX_CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/generate', async route => {
    assert.deepEqual(route.request().postDataJSON(), { prompt: 'Explain F = -kx', mode: 'explore' });
    assert.equal(route.request().headers().authorization, undefined);
    await route.fulfill({ json: { lesson } });
  });
  await page.goto(base);
  await page.locator('#concept').fill('Explain F = -kx');
  await page.getByRole('button', { name: 'Create experiment' }).click();
  await page.getByRole('heading', { name: lesson.title, exact: true }).waitFor();
  const frame = page.frameLocator('iframe');
  await frame.locator('#force').filter({ hasText: 'Force: -2 N' }).waitFor();
  assert.equal(await frame.locator('#isolation').textContent(), 'isolated');
  assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
  await page.locator('#generated-x').fill('2');
  await frame.locator('#force').filter({ hasText: 'Force: -4 N' }).waitFor();
  await page.getByRole('button', { name: 'Reset values' }).click();
  await frame.locator('#force').filter({ hasText: 'Force: -2 N' }).waitFor();
  await page.getByRole('button', { name: 'Back to start' }).click();
  await page.route('**/api/generate', route => route.fulfill({ json: { lesson: { title: 'invalid' } } }));
  await page.getByRole('button', { name: 'Create experiment' }).click();
  await page.locator('.gen-status.failed').filter({ hasText: 'invalid lesson' }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS custom equation UI, iframe initialization, slider updates, reset, sandbox isolation, invalid response handling');
} finally { await browser.close(); }
