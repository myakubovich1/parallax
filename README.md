# Parallax

**Turn ideas into intuition.** Parallax turns formulas and scientific questions into interactive visual experiments. The learning loop is: ask → understand → predict → experiment → explain what changed.

## Run it

```bash
npm ci --cache /workspace/.npm-cache
npm run dev          # http://localhost:5173
npm test             # math invariants + prompt matching (Vitest)
npm run build        # typecheck + production build
```

Browser checks can use system Chromium with `PARALLAX_CHROMIUM_PATH=/usr/bin/chromium` for the interaction and generation scripts; otherwise install Playwright Chromium. To run the browser checks, start the dev server on port 5199 (`npx vite --port 5199`), then:

```bash
npm run verify       # 36 end-to-end interaction checks (Playwright)
node verify/generation.mjs # custom equation UI checks (mocked provider)
node verify/background.mjs # shared background, hover, motion preferences and responsive layouts
npm run screens      # desktop / tablet / mobile screenshots → verify/screens/
```

## Authored examples

Parallax ships three hand-written, deterministic lessons, and `src/lib/generation/demoAdapter.ts` matches prompts and paraphrases to them:

| Lesson | Model | Renderer |
|---|---|---|
| Wave interference (hero) | `y = A₁ sin(kx − 2πft) + A₂ sin(kx − 2πft + φ)`, λ fixed at 1 m | Canvas: particle ribbons, stippled displacement, phase markers, sum envelope |
| Gravitational attraction | `F = G m₁ m₂ / r²`, SI units, lead spheres drawn to scale | SVG: draggable bodies, log-scaled force arrows, equipotential contours |
| Gradient descent | `L(w) = (w − 3)²`, `w_next = w − η·2(w − 3)` | SVG: loss curve, tangent, step track, halts at \|w − 3\| > 12 |

Other prompts are sent to the same-origin `/api/generate` endpoint. The server calls Gemini by default, validates the structured lesson, and returns an equation, explanation, parameter controls and an interactive visualization. AI-generated content can be incorrect; each lesson displays its assumptions and limitations. Custom lessons are temporary and are not included in Saved experiments.

## Secure live generation

Use Node.js 24.5 or newer. The server honors the platform’s HTTPS proxy and trusted CA configuration.

**Default: Gemini free-tier AI.** Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and add it securely as `PARALLAX_GEMINI_API_KEY` in environment settings or your hosting provider's secret manager. Keep `PARALLAX_PROVIDER=gemini` (also the default when unset). Use a Google project on the free tier with billing disabled if you want to avoid charges. Free-tier availability and quotas depend on account, project, region and model; review [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing). Creating a key does not provide unlimited usage. Google’s applicable free-tier data terms apply to submitted prompts.

The default model is `gemini-3.1-flash-lite`; `PARALLAX_GEMINI_MODEL=gemini-3.8-flash` is also supported, but timed out in this environment. Older 2.5 Flash models may be unavailable to new users. Live model access must be checked with your key. The server needs HTTPS access to `generativelanguage.googleapis.com`. Keys travel only in the server's `x-goog-api-key` header, never URLs or browser code. Live Gemini Flash-Lite generation has been validated through the app: a Hooke’s law lesson returned HTTP 200, rendered in the sandbox without page errors, and its force readout and mass position responded correctly to slider changes and reset. Mocked provider tests cover errors and paid-fallback prevention.

The app **never automatically falls back to a paid provider**, including when Gemini is missing a key, rate-limited or unavailable. Quota exhaustion displays an error and leaves the prompt available for retry.

**Optional paid integration:** OpenAI is used only when you explicitly set `PARALLAX_PROVIDER=openai`, with the server secret `PARALLAX_API_KEY` and optional `PARALLAX_MODEL` (default `gpt-4.1-mini`). That mode needs OpenAI API credits and HTTPS access to `api.openai.com`. An existing OpenAI key alone does not enable this mode. Never send either key in chat.

For local development, copy `.env.example` to `.env.local` and fill in the key privately. `.env.local` and all `.env` files except the blank example are ignored by Git. Restart the dev server after changing values. Never put credentials in `VITE_*` variables, source files, or browser storage. The browser calls only your own server; it never receives the API key. No real key is included in this repository.

```bash
npm run dev           # Vite serves both the UI and /api endpoints
npm run test:api      # server integration tests with mocked provider responses
npm run build
npm start             # Node serves dist and /api on 127.0.0.1:3000
```

Production requires the Node server, rather than a static-only host such as GitHub Pages or `vite preview`. For public hosting, use a reverse proxy with HTTPS and access controls; the endpoint consumes the server owner's API quota. The server includes per-process request and concurrency limits. Configure `HOST` and `PORT` for your host as needed. Keep secrets in the host's secret settings, outside the build output.

Without a configured key, the three authored lessons still work; other prompts display a setup error. `GET /api/status` reports the selected provider and whether its key is configured, without credentials. A live provider call is needed to verify key validity and model access.

Development-only QA hooks: `?demo-slow` shows the in-progress state, and `?demo-failure` triggers the recoverable-failure state.

## Architecture

- `src/lib/physics/*`: pure calculations with no UI code, tested in `physics.test.ts`.
- `src/lib/lessons/*`: concept metadata, equation terms, parameters, steps, predictions and follow-ups (`LessonSpec`).
- `src/lib/generation/adapter.ts`: the `GenerationAdapter` interface. `liveAdapter.ts` uses the same-origin API for custom lessons, with an `AbortSignal` and typed errors; the API key stays in `server/api.mjs`.
- `src/renderers/*`: one renderer per lesson. `SandboxedStage.tsx` is the boundary for generated HTML/JS: it runs in an opaque-origin iframe with a strict CSP and exchanges typed `postMessage` data only. Rendering successfully does not mean the content is scientifically correct.
- `src/workspace/*`: `LessonWorkspace`, `SimulationStage`, `EquationStrip`, `ParameterControl`, `PredictionChallenge`, `FollowUpInput`, `Inspector`.

Saved experiments and settings are stored in `localStorage`, so they live in this browser only.

## Phosphor environment

Every screen shares an ordered-dither canvas with green and ice-blue contour fields. On pointer hover, nearby pixels ease upward and brighten into a raised surface. The canvas is decorative and never intercepts controls; it renders only while the pointer response is settling, stops in hidden tabs, and caps its grain count on larger displays. Touch and reduced-motion users get a static field. Settings → Visual effects disables the background and surface treatments throughout the app.
