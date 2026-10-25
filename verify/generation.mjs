import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const lesson = {
  title: 'Hooke’s law', equation: 'F = -kx', explanation: ['A spring exerts a restoring force.'],
  stageHtml: `<style>body{color:white;background:#101310}</style><svg viewBox="0 0 640 160" width="100%" height="160"><circle cx="130" cy="80" r="20"/><text id="label-a" x="130" y="80">Spring stiffness</text><text id="label-b" x="130" y="80">Displacement</text></svg><p id="force"></p><p id="isolation"></p><script>
    try { parent.document.body; document.querySelector('#isolation').textContent='unsafe'; }
    catch { document.querySelector('#isolation').textContent='isolated'; }
    addEventListener('message',e=>{if(e.data.type==='params') { document.querySelector('#force').textContent='Force: '+(-2*e.data.params.x)+' N'; document.querySelector('#label-b').setAttribute('x',130+e.data.params.x); }});
    parent.postMessage({type:'ready'},'*');
  </script>`,
  params: [{ id: 'x', label: 'Displacement', symbol: 'x', unit: 'm', min: -2, max: 2, step: 0.1, default: 1, digits: 1, hint: 'Move the spring.' }],
  assumptions: ['Ideal spring with k = 2 N/m.'],
};
const browser = await chromium.launch({ executablePath: process.env.PARALLAX_CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  const errors = [];
  let generationCalls = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/generate', async route => {
    generationCalls++;
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
  // The same intentionally overlapping SVG must stay legible after a parameter update.
  await page.waitForFunction(() => document.querySelector('iframe') !== null);
  const labelsSeparate = async () => frame.locator('svg').evaluate(svg => {
    const a = svg.querySelector('#label-a').getBoundingClientRect(), b = svg.querySelector('#label-b').getBoundingClientRect();
    return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
  });
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(await labelsSeparate(), true);
  await page.getByRole('button', { name: 'Save experiment', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Saved experiments', exact: true }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await frame.locator('#force').filter({ hasText: 'Force: -4 N' }).waitFor();
  assert.equal(await page.locator('#generated-x').inputValue(), '2');
  assert.equal(generationCalls, 1, 'Opening a saved lesson must not call the API');
  await page.setViewportSize({ width: 390, height: 844 });
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(await labelsSeparate(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: 'Reset values' }).click();
  await frame.locator('#force').filter({ hasText: 'Force: -2 N' }).waitFor();
  await page.getByRole('button', { name: 'Back to start' }).click();
  await page.locator('#concept').fill('Explain F = -kx');
  await page.route('**/api/generate', route => route.fulfill({ json: { lesson: { title: 'invalid' } } }));
  await page.getByRole('button', { name: 'Create experiment' }).click();
  await page.locator('.gen-status.failed').filter({ hasText: 'invalid lesson' }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS generated lesson save/reload/reopen, SVG label collisions on desktop/mobile, sliders, reset, sandbox isolation, invalid response handling');
} finally { await browser.close(); }
