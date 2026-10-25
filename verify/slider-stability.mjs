// Slider panels must not move while a learner drags them. Any layout change during a drag
// (page height, panel box, phantom scroll in a side column) can feed back through hover and
// focus handlers and make the panel shake. Run with the dev server: node verify/slider-stability.mjs [base]
import { chromium } from 'playwright';
import { massEnergy, spring } from './fixtures/experiments.mjs';

const base = process.argv[2] ?? 'http://localhost:5199';
// Real scrollbars: headless Chromium hides them by default, which masks width feedback loops.
const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'], executablePath: process.env.PARALLAX_CHROMIUM_PATH || undefined });
const VIEWPORTS = [[1440, 900], [1920, 1080], [2560, 1440]];
const failures = [];
let cases = 0;

const workspaces = [
  { name: 'wave lesson', open: (p) => p.goto(`${base}/#wave-interference`), ranges: '.inspector input[type=range]' },
  { name: 'gravity lesson', open: (p) => p.goto(`${base}/#gravitational-attraction`), ranges: '.inspector input[type=range]' },
  { name: 'gradient lesson', open: (p) => p.goto(`${base}/#gradient-descent`), ranges: '.inspector input[type=range]' },
  ...[massEnergy, spring].map((lesson) => ({
    name: `AI · ${lesson.title}`,
    lesson,
    open: async (p) => {
      await p.goto(base);
      await p.locator('#concept').fill('Explain this custom experiment');
      await p.getByRole('button', { name: 'Create experiment' }).click();
      await p.locator('.experiment-workspace').waitFor();
    },
    ranges: '.experiment-workspace input[type=range]',
  })),
  ...[0, 1, 2].map((i) => ({
    name: `catalog #${i + 1}`,
    open: async (p) => {
      await p.goto(base);
      await p.getByRole('button', { name: /50 experiments/ }).click();
      await p.locator('.library-card').nth((i + 1) * 7).click();
      await p.locator('.catalog-inspector input[type=range]').first().waitFor();
    },
    ranges: '.catalog-inspector input[type=range]',
  })),
];

for (const [w, h] of VIEWPORTS) {
  for (const ws of workspaces) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    if (ws.lesson) await page.route('**/api/generate', (r) => r.fulfill({ json: { lesson: ws.lesson } }));
    await ws.open(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const count = Math.min(3, await page.locator(ws.ranges).count());
    for (let i = 0; i < count; i++) {
      cases++;
      const range = page.locator(ws.ranges).nth(i);
      await range.scrollIntoViewIfNeeded();
      await page.mouse.move(2, 2);
      await page.waitForTimeout(150);
      const rb = await range.boundingBox();
      await page.evaluate((el) => {
        const panel = el.closest('.param, .catalog-control') ?? el.parentElement;
        const side = el.closest('.inspector, .experiment-inspector, .catalog-inspector, aside');
        window.__rec = { doc: new Set(), box: new Set(), phantom: 0, stop: false };
        const tick = () => {
          const r = panel.getBoundingClientRect();
          window.__rec.doc.add(document.documentElement.scrollHeight);
          window.__rec.box.add(`${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`);
          if (side && getComputedStyle(side).overflowY !== 'visible') {
            const extra = side.scrollHeight - side.clientHeight;
            if (extra > 0 && extra <= 8) window.__rec.phantom = extra;
          }
          if (!window.__rec.stop) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, await range.elementHandle());
      // Hover in, press, overshoot both ends while drifting vertically across the panel edges, hold.
      const y = rb.y + rb.height / 2;
      await page.mouse.move(rb.x + rb.width * 0.5, y);
      await page.waitForTimeout(120);
      await page.mouse.down();
      for (let k = 0; k <= 24; k++) await page.mouse.move(rb.x + rb.width * (0.5 + k * 0.03), y + ((k % 6) - 2) * 11);
      for (let k = 0; k <= 30; k++) await page.mouse.move(rb.x + rb.width * (1.22 - k * 0.048), y - ((k % 5) - 1) * 13);
      await page.waitForTimeout(400);
      await page.mouse.up();
      await page.mouse.move(rb.x + rb.width * 0.5, y - 400);
      await page.waitForTimeout(250);
      const rec = await page.evaluate(() => {
        window.__rec.stop = true;
        return { doc: [...window.__rec.doc], box: [...window.__rec.box], phantom: window.__rec.phantom };
      });
      const where = `${w}×${h} ${ws.name} slider ${i + 1}`;
      if (rec.doc.length > 1) failures.push(`${where}: page height changed during drag (${rec.doc.join(' → ')})`);
      if (rec.box.length > 1) failures.push(`${where}: slider panel moved or resized (${rec.box.length} positions)`);
      if (rec.phantom) failures.push(`${where}: side column scrollable by only ${rec.phantom}px (phantom overflow)`);
    }
    await page.close();
  }
}
await browser.close();

if (failures.length) {
  console.log(failures.join('\n'));
  console.log(`\nFAIL ${failures.length} problem(s) across ${cases} slider drags`);
  process.exitCode = 1;
} else console.log(`PASS ${cases} slider drags across ${VIEWPORTS.length} screen sizes: page height, panel position and side columns stayed still`);
