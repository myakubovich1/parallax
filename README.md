# Parallax

**World. Explained.** Parallax turns questions about how the world works into interactive visual experiments. The learning loop is: ask → understand → predict → experiment → explain what changed!

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
node verify/catalog.mjs    # all 47 new models, limits, aliases, save and zero API calls (dev server)
node verify/catalog-quality.mjs # canvas label bounds, collisions, comparison, keyboard and prediction
node verify/input-ux.mjs   # equation confirmation, manual slider control, canvas stability and mobile input
node verify/help.mjs       # robot guide, contextual chat, safe actions, persistence and mobile modal
node verify/eggs.mjs       # triggers all 12 easter eggs (no spoilers here; read the script)
node verify/experiments.mjs # rich lessons: units, modes, predictions, comparisons and visual fallback
node verify/background.mjs # shared background, hover, motion preferences and responsive layouts
npm run screens      # desktop / tablet / mobile screenshots → verify/screens/
```

## Updating a local checkout

`npm run dev` serves local files; it does not fetch GitHub changes. Updates from this work are on `codex/live-generation-terminal-ui` until merged into `main`. Stop the dev server, then run:

```bash
git fetch origin
git switch codex/live-generation-terminal-ui
git pull --ff-only
npm ci
npm run dev
```

Keep your ignored `.env.local` on your computer. If Git reports conflicts or local changes, resolve or preserve those changes before updating; do not discard them blindly. Check `git log -1 --oneline` to confirm the downloaded version. Open the port printed by the new dev server; an older server may still be running on a different port.

## Preloaded formula library

Parallax ships **50 authored, deterministic experiments**: 47 common formulas plus the three detailed lessons below. Enter a formula, a concept name, or a question on the home screen. Matching formulas open their premium visual scenes directly; the catalogue and source labels are not shown in the interface. Preloaded matches never call an AI provider and need no API key. Subjects include mechanics, waves, electricity, thermodynamics, fluids, optics, and mathematics.

The matcher accepts common notation and equivalent product forms, for example `kinetic energy`, `½mv²`, `1/2*m*v^2`, `0.5mv**2`, and `E = mv²/2`. Recognition preserves displayed Unicode/LaTeX grouping and uses bounded polynomial/rational normalization, equation aliases, and concept names. Rearrangements such as `P=W/t`, `W=Pt`, and `t=W/P` select the same power scene. Exact equation matches take priority over broad keyword matches; it is not a general symbolic theorem prover. Requests outside the library continue to the selected AI provider.

Likely input mistakes are reviewed before generation. An extra slash (`1//2mv^2`), a missing closing parenthesis, or a small coefficient/exponent difference from a known formula prompts a suggested correction. The user can confirm, edit, or keep the original; nothing is silently substituted and a pending review makes no provider call. Incomplete equations and vague topics ask for more detail. Valid unfamiliar formulas and specific scientific questions continue to AI. This review is a bounded input check, not a general scientific correctness validator.

Each new model has an authored canvas demonstration with stippled bodies, measurements and annotations, plus an optional numerical response graph. Scenes are designed for their particular formula: motion trails, force vectors, impulse areas, combined charge-potential contours, spring deformation, circuit charge separation, gas particles, fluid flow, optical rays or geometric areas. The workspace includes linked variables, diagram dragging/keyboard input, presets, reference comparison, a computed prediction/reveal, live readouts and Save/reopen support. Motion-based models have play/pause, speed and reset controls; static relationships stay static. Harmonic displacement, RC discharge and cooling can animate the time parameter so readouts remain connected. Animation speed and schematic dimensions are illustrative. Quick, Explore and Basics provide different explanation lengths.

The original three lessons retain their richer custom renderers, predictions and follow-ups:

| Lesson | Model | Renderer |
|---|---|---|
| Wave interference (hero) | `y = A₁ sin(kx − 2πft) + A₂ sin(kx − 2πft + φ)`, λ fixed at 1 m | Canvas: particle ribbons, stippled displacement, phase markers, sum envelope |
| Gravitational attraction | `F = G m₁ m₂ / r²`, SI units, lead spheres drawn to scale | SVG: draggable bodies, log-scaled force arrows, equipotential contours |
| Gradient descent | `L(w) = (w − 3)²`, `w_next = w − η·2(w − 3)` | SVG: loss curve, tangent, step track, halts at \|w − 3\| > 12 |

Prompts that do not match the library are sent to the same-origin `/api/generate` endpoint. The server calls the configured provider (OpenAI in `.env.example`), validates the structured lesson, and returns an equation, explanation, parameter controls and an interactive visualization. AI-generated content can be incorrect; each lesson displays its assumptions and limitations. Use Save experiment to keep a generated lesson and its current slider settings in Saved experiments. Saved lessons reopen without another API call, including after a browser refresh; storage is local to that browser.

## Robot guide: Ask Parallax

The observer robot is a dedicated help button in the header on every screen, separate from the home link. Hover or keyboard focus introduces the guide; click or tap to open it. The large welcome-screen robot has a matching Ask Parallax button. Desktop chat is a nonmodal side panel; mobile chat and help opened from Settings/Saved use a native modal dialog with focus containment and Escape support. Closing preserves this tab's conversation; Clear conversation deletes it. History uses bounded `sessionStorage`, and remains usable in memory if storage is unavailable.

Quick help is answered directly from the versioned app guide. Other questions use hosted **Gemma** via Google AI Studio's API, grounded in that guide plus a small snapshot of the current screen: title, mode, visible error, control labels/values, readouts and saved count. It does not send the full DOM, stored experiments, API keys or account details. Each answer identifies its source. Suggested actions can fill a question without submitting, return to the question input or open saved experiments, show learning modes, open settings, or highlight a real control. These actions run only when clicked and cannot execute arbitrary model code or change experiment parameters.

Add these **server-only** Vercel environment variables for **Production** and **Preview**, then redeploy:

| Variable | Value | Required |
|---|---|---|
| `PARALLAX_HELP_API_KEY` | API key from [Google AI Studio](https://aistudio.google.com/apikey) with access to hosted Gemma | For AI help answers |
| `PARALLAX_HELP_MODEL` | `gemma-4-26b-a4b-it` | Optional; this is the default |

`gemma-4-31b-it` is also supported. Model access and quotas depend on the Google project; this does not imply unlimited or free usage. Google hosts these Gemma models through the Gemini API transport; the configured model is Gemma. See [Google's hosted Gemma documentation](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api). `GET /api/help` reports the model and whether its key is configured without revealing credentials. Basic quick help works without a key; other questions show a recoverable setup error until configured.

The helper uses only `PARALLAX_HELP_API_KEY`. It never reuses lesson-generation credentials or falls back to OpenAI/Gemini models. Keep the existing `PARALLAX_PROVIDER`, `PARALLAX_API_KEY` and `PARALLAX_MODEL` settings for lesson generation. Never add a `VITE_` prefix to either secret. Local `.env.local` uses the same helper variable names; Vite's API middleware, the Node server, and `api/help.mjs` on Vercel share the same handler. Requests have bounded history/context, same-origin checks, a 35-second timeout, cancellation, and basic per-instance request/concurrency limits; these are not a distributed rate limiter.

## Lesson generation configuration

Generated lessons now use a versioned experiment contract: a learning objective, central intuition, misconception, connected equation terms, fixed constants, computed outputs, presets, a prediction/reveal challenge and a guided sequence. The UI provides Quick intuition, Explain & explore and Build from basics without regenerating the lesson. Symbol selection connects the equation, control and scene; pinned values support before/after comparisons. Shared comparison and spring renderers use the same colors and controls as the authored lessons, with an optional graph and readable compact views.

The shared arithmetic engine interprets bounded postfix formulas without `eval`. It converts display units into SI once, checks formula dimensions, tests endpoints and interior samples, rejects inert sliders and evaluates numerical reference cases. Mass–energy and Hooke’s law also have independent reference calculations. For example, 1 g corresponds to about 89.88 TJ of rest energy; 1 kg is about 0.08988 EJ. These checks establish numerical consistency, not scientific correctness for arbitrary generated models. Unsupported domains and failed checks produce a recoverable error; one repair request to the same provider is allowed. No automatic provider fallback is introduced.

Custom HTML remains isolated in an opaque-origin iframe. It is hidden while defaults and every combination of parameter endpoints are checked. Its outputs must agree with the shared engine, and display checks detect clipped, overlapping or unreadably small SVG labels. Failed or unresponsive custom scenes fall back to a shared quantity view. Old saved visualizations remain readable, and new saved experiments preserve their learning mode and parameters. The essential limitation stays visible; detailed assumptions and checks expand on demand.

Use Node.js 24.5 or newer. The server honors the platform’s HTTPS proxy and trusted CA configuration.

**OpenAI configuration:** `.env.example` selects OpenAI with the following server-only variables:

```dotenv
PARALLAX_PROVIDER=openai
PARALLAX_API_KEY=
PARALLAX_MODEL=gpt-5.6-sol
```

Fill in `PARALLAX_API_KEY` privately in `.env.local` or your hosting provider's secret settings. For Vercel, add these same three variables in Project Settings → Environment Variables for Production and Preview, store the API key as a Secret, and redeploy. The server needs OpenAI API credits, HTTPS access to `api.openai.com`, and access to the configured model through the Chat Completions API with structured outputs. The example model is a configuration choice; confirm its availability for your account. Runtime defaults match this example: an omitted provider selects OpenAI and an omitted OpenAI model selects `gpt-5.6-sol`. An explicit provider value takes precedence; Gemini runs only when `PARALLAX_PROVIDER=gemini` is set.

**Optional Gemini alternative:** set `PARALLAX_PROVIDER=gemini`, configure `PARALLAX_GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey), and optionally set `PARALLAX_GEMINI_MODEL` (default `gemini-3.1-flash-lite`). The Gemini variables are commented out in `.env.example`. This mode needs HTTPS access to `generativelanguage.googleapis.com`. Free-tier availability and quotas depend on account, project, region and model; review [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing). The app never automatically switches providers when a key is missing or a request fails.

For local development, copy `.env.example` to `.env.local` and fill in the key privately. `.env.local` and all `.env` files except the blank example are ignored by Git. Restart the dev server after changing values. Never put credentials in `VITE_*` variables, source files, or browser storage. The browser calls only your own server; it never receives the API key. No real key is included in this repository.

```bash
npm run dev           # Vite serves both the UI and /api endpoints
npm run test:api      # server integration tests with mocked provider responses
npm run build
npm start             # Node serves dist and /api on 127.0.0.1:3000
```

Production requires the Node server, rather than a static-only host such as GitHub Pages or `vite preview`. For public hosting, use a reverse proxy with HTTPS and access controls; the endpoint consumes the server owner's API quota. The server includes per-process request and concurrency limits. Configure `HOST` and `PORT` for your host as needed. Keep secrets in the host's secret settings, outside the build output.

Without a configured key, all 50 preloaded experiments still work; other prompts display a setup error. `GET /api/status` reports the selected provider, model, whether its key is configured, the required key variable, whether the provider came from an explicit environment setting or the default, and the deployment environment/commit when Vercel supplies them. It never returns key values and is not cached. A live provider call is needed to verify key validity and model access.

Vercel does not import `.env.example` or your ignored `.env.local` from GitHub. Add variables to the actual Vercel project and the environment you are visiting: Production for its production domain, Preview for branch deployments. Updating variables does not change an existing deployment; redeploy to apply them. After deployment, open `/api/status` on the exact domain you are using and check `provider: "openai"`, the intended `model`, `configured: true`, and the expected Git commit. If a deployment still reports Gemini, check for an explicit `PARALLAX_PROVIDER=gemini`, a Preview branch override, or an older deployment URL. Keep API keys server-only; never use a `VITE_` prefix.

Development-only QA hooks: `?demo-slow` shows the in-progress state, and `?demo-failure` triggers the recoverable-failure state.

## Architecture

- `src/lib/catalog/*`: 47 formula definitions, bounded notation/equation matching and calculation tests; `CatalogStage.tsx` provides playback and graph controls; `src/renderers/catalog/*` contains the formula-specific scene painters. Canvas rendering uses the shared visibility-aware clock and suspends playback off-screen or in a hidden tab.
- `src/lib/physics/*`: pure calculations with no UI code, tested in `physics.test.ts`.
- `src/lib/lessons/*`: concept metadata, equation terms, parameters, steps, predictions and follow-ups (`LessonSpec`).
- `src/lib/generation/adapter.ts`: the `GenerationAdapter` interface. `liveAdapter.ts` uses the same-origin API for custom lessons, with an `AbortSignal` and typed errors; the API key stays in `server/api.mjs`.
- `src/renderers/*`: one renderer per lesson. `SandboxedStage.tsx` is the boundary for generated HTML/JS: it runs in an opaque-origin iframe with a strict CSP and exchanges typed `postMessage` data only. Rendering successfully does not mean the content is scientifically correct.
- `src/workspace/*`: `LessonWorkspace`, `SimulationStage`, `EquationStrip`, `ParameterControl`, `PredictionChallenge`, `FollowUpInput`, `Inspector`.

Saved experiments and settings are stored in `localStorage`, so they live in this browser only.

## Phosphor environment

Every screen shares an ordered-dither canvas with green and ice-blue contour fields. On pointer hover, nearby pixels ease upward and brighten into a raised surface. The canvas is decorative and never intercepts controls; it renders only while the pointer response is settling, stops in hidden tabs, and caps its grain count on larger displays. Touch and reduced-motion users get a static field. Settings → Visual effects disables the background and surface treatments throughout the app.
