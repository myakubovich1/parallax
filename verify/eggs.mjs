// Triggers all 12 easter eggs the way a person would and checks each is discovered.
// Run with the dev server on :5199: node verify/eggs.mjs [base]
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const base = (process.argv[2] ?? 'http://localhost:5199') + '/?eggs-fast';
const out = fileURLToPath(new URL('./screens/', import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const found = () => page.evaluate(() => JSON.parse(localStorage.getItem('parallax.eggs') || '[]'));
const results = [];
const expect = async (id, label) => {
  const ok = (await found()).includes(id);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
};
const shot = (name) => page.screenshot({ path: `${out}egg-${name}.png` });

/** Mirrors the preview robot's geometry so clicks land on its features. */
async function head() {
  const r = await (await page.$('.observer canvas')).boundingBox();
  const S = Math.min((r.height - 16) / 1.96, (r.width - 128) / 1.62);
  const cy = Math.max(14 + 0.96 * S, (r.height - 1.96 * S) / 2 + 0.96 * S);
  return { x: r.x + r.width / 2, y: r.y + cy, S };
}

await page.goto(base);
await page.evaluate(() => localStorage.removeItem('parallax.eggs'));
await page.reload();
await page.waitForSelector('.observer canvas');
await page.waitForTimeout(800);
let h = await head();

// 1. Stare contest: hold the cursor still on the face.
await page.mouse.move(h.x, h.y - 0.3 * h.S);
await page.waitForTimeout(2300);
await expect('stare', 'Stare contest: blink after holding still on the face');

// 2. Don't poke me: five quick clicks on the forehead plate.
for (let i = 0; i < 5; i++) await page.mouse.click(h.x, h.y - 0.53 * h.S);
await page.waitForTimeout(250);
await shot('poke');
await expect('poke', 'Don’t poke me: five forehead clicks → OUCH');

// 3. Dizzy: three-plus laps around the head.
for (let i = 0; i <= 3.5 * 48; i++) {
  const a = (i / 48) * 2 * Math.PI;
  await page.mouse.move(h.x + Math.cos(a) * h.S * 0.95, h.y + Math.sin(a) * h.S * 0.95);
}
await page.waitForTimeout(500);
await shot('dizzy');
await expect('dizzy', 'Dizzy robot: three laps → spiral eyes');
await page.waitForTimeout(1800);

// 4. Perfect silence: exactly 180°.
await page.fill('#preview-phi', '180');
await page.waitForTimeout(1000);
await shot('silence');
await expect('silence', 'Perfect silence: φ = 180° held → SHHH');

// 5. Resonance: alternate Constructive / Cancelled six times.
for (let i = 0; i < 6; i++) await page.click(`.preset-tile:has-text("${i % 2 ? 'Cancelled' : 'Constructive'}")`);
await page.waitForTimeout(900);
await shot('resonance');
await expect('resonance', 'Resonance overload: six alternating presets → wobble');
await page.waitForTimeout(2500);

// 6. Parallax, literally: hold Shift and move the mouse.
await page.mouse.click(30, 980); // focus the page, not a field
await page.keyboard.down('Shift');
await page.mouse.move(h.x + 200, h.y);
await page.mouse.move(h.x + 220, h.y + 10);
await page.waitForTimeout(400);
await shot('parallax');
await page.keyboard.up('Shift');
await expect('parallax', 'Parallax, literally: Shift + move → stereo split');

// 7. Konami code → overdrive.
for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await page.keyboard.press(k);
await page.waitForTimeout(400);
const serial = await page.textContent('.preview-frame .serial');
await shot('overdrive');
await expect('overdrive', `Phosphor overdrive: Konami code (serial reads "${serial?.trim()}")`);
await page.evaluate(() => (document.documentElement.dataset.overdrive = 'off'));

// 8. Typing "parallax" outside a field.
await page.keyboard.type('parallax');
await page.waitForTimeout(300);
await expect('logo', 'Say my name: typing "parallax" redraws the mark');

// 9. E = mc².
await page.fill('#concept', 'E = mc²');
await page.click('button:has-text("Create experiment")');
await page.waitForTimeout(500);
await shot('classic');
await expect('classic', 'A classic: E = mc² → CLASSIC. face before the lesson');
// Leave during the robot's pause so no real generation request is sent.
await page.goto('about:blank');

// 10. Beats: follow-up in the wave lesson.
await page.goto(base + '#wave-interference');
await page.waitForSelector('#followup');
await page.fill('#followup', 'beats');
await page.press('#followup', 'Enter');
await page.waitForTimeout(1500);
await shot('beats');
await expect('beats', 'Beat frequency: "beats" follow-up → swelling sum');

// 11. Rollercoaster: η = 1.00 in gradient descent.
await page.goto(base + '#gradient-descent');
await page.waitForSelector('#param-eta input[type=text]');
await page.fill('#param-eta input[type=text]', '1');
await page.press('#param-eta input[type=text]', 'Enter');
await page.click('.stage-controls button[aria-label=Play]').catch(() => {});
await page.selectOption('.speed select', '4');
await page.waitForTimeout(1500);
await shot('coaster');
await expect('coaster', 'Rollercoaster: η = 1 → bouncing cart');

// 12. Sleepy observer: idle on a lesson page, then move.
await page.waitForTimeout(3800);
await page.screenshot({ path: `${out}egg-sleepy.png`, clip: { x: 0, y: 0, width: 360, height: 70 } });
await page.mouse.move(700, 500);
await page.waitForTimeout(300);
await expect('sleepy', 'Sleepy observer: idle → asleep, input → wakes');

const settingsCount = await (async () => {
  await page.click('button[aria-label=Settings]');
  const t = await page.textContent('.egg-count').catch(() => null);
  await page.keyboard.press('Escape');
  return t;
})();

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} eggs found · Settings shows: ${settingsCount}`);
console.log('console/page errors:', errors.length ? errors : 'none');
await browser.close();
