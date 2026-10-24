# Parallax

**Turn ideas into intuition.** Parallax turns formulas and scientific questions into interactive visual experiments. The learning loop is: ask → understand → predict → experiment → explain what changed.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # math invariants + prompt matching (Vitest)
npm run build        # typecheck + production build
```

To run the browser checks, start the dev server on port 5199 (`npx vite --port 5199`), then:

```bash
npm run verify       # 36 end-to-end interaction checks (Playwright)
npm run screens      # desktop / tablet / mobile screenshots → verify/screens/
```

## Demo mode

Live lesson generation is **not connected**. Parallax ships three hand-written, deterministic lessons, and `src/lib/generation/demoAdapter.ts` matches prompts and paraphrases to them:

| Lesson | Model | Renderer |
|---|---|---|
| Wave interference (hero) | `y = A₁ sin(kx − 2πft) + A₂ sin(kx − 2πft + φ)`, λ fixed at 1 m | Canvas: particle ribbons, stippled displacement, phase markers, sum envelope |
| Gravitational attraction | `F = G m₁ m₂ / r²`, SI units, lead spheres drawn to scale | SVG: draggable bodies, log-scaled force arrows, equipotential contours |
| Gradient descent | `L(w) = (w − 3)²`, `w_next = w − η·2(w − 3)` | SVG: loss curve, tangent, step track, halts at \|w − 3\| > 12 |

Anything else gets an honest "not available in demo mode" state that links to these three lessons.

Development-only QA hooks: `?demo-slow` shows the in-progress state, and `?demo-failure` triggers the recoverable-failure state.

## Architecture

- `src/lib/physics/*`: pure calculations with no UI code, tested in `physics.test.ts`.
- `src/lib/lessons/*`: concept metadata, equation terms, parameters, steps, predictions and follow-ups (`LessonSpec`).
- `src/lib/generation/adapter.ts`: the `GenerationAdapter` interface. A live service implements `generate()` with real stages, an `AbortSignal` and typed errors, and keeps credentials server-side.
- `src/renderers/*`: one renderer per lesson. `SandboxedStage.tsx` is the boundary for future generated HTML/JS: it runs in an opaque-origin iframe with a strict CSP and exchanges typed `postMessage` data only. Rendering successfully does not mean the content is scientifically correct.
- `src/workspace/*`: `LessonWorkspace`, `SimulationStage`, `EquationStrip`, `ParameterControl`, `PredictionChallenge`, `FollowUpInput`, `Inspector`.

Saved experiments and settings are stored in `localStorage`, so they live in this browser only.
