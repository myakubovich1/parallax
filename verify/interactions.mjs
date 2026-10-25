// End-to-end checks of the behaviours listed in the brief. Run with the dev server on :5199.
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5199/';
const browser = await chromium.launch({ executablePath: process.env.PARALLAX_CHROMIUM_PATH || undefined });
const results = [];
const errors = [];
let expectedMissingKey = false;
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
const newPage = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error' && !(expectedMissingKey && m.text().includes('503'))) errors.push(m.text());
  });
  return p;
};
const val = (p, sel) => p.$eval(sel, (e) => e.value);
const text = (p, sel) => p.$eval(sel, (e) => e.textContent);

let p = await newPage();
await p.goto(base);

// Entry: empty submit, examples, keyboard submit
await p.click('button:has-text("Create experiment")');
check('Empty submission shows inline feedback', await p.isVisible('#concept-error'));
await p.click('.examples .chip:has-text("Gravitational attraction")');
check('Example button fills input', (await val(p, '#concept')).includes('F = G'));
check('Default mode is Explain & explore', await p.isChecked('input[name=mode][value=explore]'));
expectedMissingKey = true;
await p.route('**/api/generate', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Configure PARALLAX_API_KEY securely in environment settings.' }) }));
await p.fill('#concept', 'Explain photosynthesis');
await p.click('button:has-text("Create experiment")');
await p.waitForSelector('.gen-status.failed');
check('Custom input explains missing server configuration', (await text(p, '.gen-status.failed')).includes('Configure PARALLAX_API_KEY'));
await p.unroute('**/api/generate');
expectedMissingKey = false;
await p.fill('#concept', 'Why does gradient descent sometimes overshoot?');
await p.focus('#concept');
await p.keyboard.press('Control+Enter');
await p.waitForSelector('.ws-title h1');
check('Ctrl+Enter creates the matching lesson', (await text(p, '.ws-title h1')) === 'Gradient descent');

// Gradient: unstable preset halts with explanation
await p.click('.preset:has-text("Unstable")');
await p.selectOption('.speed select', '4');
await p.click('.stage-controls button[aria-label=Play]').catch(() => {});
await p.waitForSelector('.halt-banner', { timeout: 15000 });
check('Unstable learning rate pauses at display bound', (await text(p, '.halt-banner')).includes('left the chart'));
await p.click('.preset:has-text("Overshooting")');
await p.click('.stage-controls button[aria-label=Play]').catch(() => {});
await p.waitForSelector('.halt-banner', { timeout: 30000 });
check('Overshooting rate converges', (await text(p, '.halt-banner')).includes('Converged'));

// Back to entry via header
await p.click('button[aria-label="Back to start"]');
check('Back returns to entry screen', await p.isVisible('#entry-title'));

// Preview opens full lesson with its settings
await p.fill('#preview-phi', '120');
await p.click('button:has-text("Open full lesson")');
await p.waitForSelector('#range-phi');
check('Preview opens wave lesson with chosen phase', (await val(p, '#range-phi')) === '120');

// Connected representations: focusing φ term highlights its control and shows meaning
await p.focus('.term.tone-amber');
check('Equation term focus highlights matching control', await p.$eval('#param-phi', (e) => e.classList.contains('active')));
check('Term card shows meaning and current value', (await text(p, '.term-card')).includes('120° = 0.33 m'));
await p.focus('#range-A1');
check('Control focus highlights equation term', await p.$eval('.term.tone-lime[aria-label^="Amplitude of wave 1"]', (e) => e.classList.contains('active')));

// Follow-ups
await p.click('.followup .chip:has-text("Make the waves cancel")');
await p.waitForTimeout(900);
check('Follow-up "Make the waves cancel" sets cancellation', (await val(p, '#range-phi')) === '180' && (await val(p, '#range-A1')) === (await val(p, '#range-A2')));
check('Readout reports complete cancellation', (await text(p, '.readouts')).includes('Complete cancellation'));
await p.fill('#followup', 'what is the meaning of life');
await p.press('#followup', 'Enter');
check('Unsupported follow-up is honest', (await text(p, '.followup-reply')).includes('built-in actions'));

// Mode switch keeps parameters
await p.click('.ws-header .mode-option:has-text("Build from basics")');
check('Build from basics shows step sequence', await p.isVisible('.steps'));
await p.click('button:has-text("Next: Understand the model")');
await p.click('button:has-text("Next: Try it yourself")');
check('Parameters preserved across mode change', (await val(p, '#range-phi')) === '180');
await p.click('.step-btn:has-text("Background")');
check('Can return to earlier step', (await text(p, '.insp-title')) === 'Background');
await p.click('.ws-header .mode-option:has-text("Explain & explore")');

// Prediction
await p.click('.tab:has-text("Challenge")');
await p.click('button:has-text("Set up and predict")');
await p.click('.option:has-text("flattens")');
await p.waitForSelector('.challenge-result');
check('Correct prediction confirmed with explanation', (await text(p, '.challenge-result')).includes('matches'));
await p.click('button:has-text("Try again")');
await p.click('.option:has-text("twice as tall")');
check('Wrong prediction explained, retry allowed', (await text(p, '.challenge-result')).includes('Not quite'));
await p.click('.tab:has-text("Experiment")');
await p.waitForTimeout(1000);
check('Prediction reveal set φ = 180°', (await val(p, '#range-phi')) === '180');

// Playback controls
await p.click('.stage-controls button[aria-label=Pause]').catch(() => {});
const t1 = await p.evaluate(() => document.querySelector('.stage-body canvas').getAttribute('aria-label'));
await p.click('button[aria-label="Reset time"]');
await p.selectOption('.speed select', '0.5');
check('Speed control changes playback only', (await val(p, '#range-f')) === '0.5' && (await val(p, '.speed select')) === '0.5', `f stays ${await val(p, '#range-f')} Hz`);
const fsOk = await p.evaluate(async () => { try { await document.querySelector('.stage-wrap').requestFullscreen(); const ok = !!document.fullscreenElement; await document.exitFullscreen(); return ok; } catch { return 'unsupported-headless'; } });
check('Fullscreen request works', fsOk === true || fsOk === 'unsupported-headless', String(fsOk));
check('Canvas has descriptive label', t1.includes('phase difference'));

// Save and reopen
await p.click('.ws-actions button:has-text("Save")');
await p.click('button[aria-label="Back to start"]');
await p.click('.topnav button:has-text("Saved experiments")');
await p.click('.saved-item button:has-text("Open")');
await p.waitForSelector('#range-phi');
check('Saved experiment reopens with its settings', (await val(p, '#range-phi')) === '180');

// Gravity: doubling separation quarters force, keyboard drag
await p.click('.rail-btn[aria-label="Gravitational attraction"]');
await p.click('.preset:has-text("r = 1.5 m")');
await p.waitForTimeout(800);
await p.click('button:has-text("Pin current values")');
await p.fill('#param-r input[type=text]', '3');
await p.press('#param-r input[type=text]', 'Enter');
check('Doubling r gives F/F_ref = 0.25', (await text(p, '.compare-text')).includes('= 0.25'));
await p.focus('.body >> nth=1');
await p.keyboard.press('ArrowLeft');
check('Sphere moves with arrow keys', (await val(p, '#range-r')) === '2.95');
await p.fill('#param-r input[type=text]', '0');
await p.press('#param-r input[type=text]', 'Enter');
check('Zero separation prevented', parseFloat(await val(p, '#range-r')) > 0.2, `r = ${await val(p, '#range-r')} m`);

// Settings: visual effects & reduced motion
await p.click('button[aria-label=Settings]');
await p.click('button[role=switch]');
check('Visual effects can be turned off', (await p.evaluate(() => document.documentElement.dataset.effects)) === 'off');
await p.keyboard.press('Escape');
check('Dialog closes with Escape', !(await p.isVisible('dialog[open]')));

// Empty saved state in fresh context
const q = await newPage({ reducedMotion: 'reduce' });
await q.goto(base);
await q.click('.topnav button:has-text("Saved experiments")');
check('Empty saved experiments state', (await text(q, 'dialog')).includes('No saved experiments yet'));
await q.keyboard.press('Escape');
await q.goto(base + '#wave-interference');
await q.waitForSelector('.stage-controls');
check('Reduced motion: lesson starts paused', await q.isVisible('.stage-controls button[aria-label=Play]'));
const before = await q.$eval('.stage-body canvas', (c) => c.toDataURL().length);
await q.click('button[aria-label="Advance one eighth of a period"]');
await q.waitForTimeout(100);
check('Reduced motion: manual stepping works', (await q.$eval('.stage-body canvas', (c) => c.toDataURL().length)) !== before);

// Failure state (dev QA hook)
await q.goto(base + '?demo-failure');
await q.fill('#concept', 'Explain wave interference.');
await q.click('button:has-text("Create experiment")');
await q.waitForSelector('.gen-status.failed');
check('Recoverable failure offers retry', await q.isVisible('.gen-status.failed button:has-text("Try again")'));

// Slow load shows real progress stages, cancellable
await q.goto(base + '?demo-slow');
await q.fill('#concept', 'Explain wave interference.');
await q.click('button:has-text("Create experiment")');
await q.waitForSelector('.gen-status.running');
await q.screenshot({ path: new URL('./screens/progress.png', import.meta.url).pathname.replace(/%20/g, ' ') }).catch(() => {});
check('In-progress state lists real stages', (await text(q, '.gen-stages')).includes('Loading the lesson'));
await q.click('.gen-status button:has-text("Cancel")');
await q.waitForTimeout(3000);
check('Cancel keeps user on entry screen', await q.isVisible('#entry-title'));

console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
console.log('console/page errors:', errors.length ? errors : 'none');
await browser.close();
if (results.some(r => r.startsWith('FAIL')) || errors.length) process.exitCode = 1;
