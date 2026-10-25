import { useId, useState } from 'react';
import { Icon } from './Icon';

/**
 * A field note for the gravitation lesson: a small animated Newton under an apple tree.
 * The animation plays the popular legend (the apple lands on his head); the explanation
 * that opens on click says what is actually recorded and why the moment matters.
 */
export function NewtonNote({ onTryIt }: { onTryIt: () => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <section className="newton-note frame" aria-label="Field note: Newton and the apple">
      <span className="reg tl" aria-hidden="true" />
      <span className="reg br" aria-hidden="true" />
      <button
        type="button"
        className="newton-note-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <NewtonScene />
        <span className="newton-note-text">
          <span className="instrument-label">Field note · Woolsthorpe, 1666</span>
          <strong>An apple, the Moon, and one law</strong>
          <span className="newton-note-cta">
            {open ? 'Hide the story' : 'What happened here?'} <span aria-hidden="true">{open ? '▴' : '▸'}</span>
          </span>
        </span>
      </button>
      <div id={panelId} className="newton-note-panel" hidden={!open}>
        <h3>What actually happened</h3>
        <p>
          In 1665–66 plague closed Cambridge, and Isaac Newton, then about 23, worked at his family farm, Woolsthorpe Manor
          in Lincolnshire. Sixty years later he told his friend William Stukeley that the idea of gravitation came to him
          “as he sat in a contemplative mood” and watched an apple fall. Stukeley published the conversation in 1752.
        </p>
        <p className="muted">
          The apple almost certainly didn’t hit his head. That detail was added in later retellings; the animation plays
          the legend. What mattered was the question the fall raised.
        </p>
        <h3>Why it matters</h3>
        <p>
          Newton asked whether the pull that brings an apple straight down could reach much higher, all the way to the
          Moon. If gravity weakens with the square of distance, the Moon, about 60 Earth radii away, should be pulled
          60² = 3,600 times more weakly than the apple:
        </p>
        <p className="newton-note-math">
          9.81 m/s² ÷ 3,600 ≈ <strong>0.0027 m/s²</strong>
        </p>
        <p>
          That is the acceleration the Moon needs to keep curving around Earth on its 27.3-day orbit (4π²r / T² ≈ 0.0027
          m/s²). Newton later wrote that when he compared the two they answered “pretty nearly”. One force explains both
          the falling apple and the orbiting Moon: the same physics on Earth and in the sky.
        </p>
        <p>
          This story belongs to the law of universal gravitation, not to Newton’s three laws of motion (inertia, F = ma,
          action and reaction), although both appear in the same book. He published the idea in his <i>Principia</i> (1687)
          as the law in this lesson, F = G m₁m₂ / r². It went on to
          predict planetary orbits, the tides and the return of Halley’s comet, and it still plots spacecraft
          trajectories today.
        </p>
        <div className="newton-note-actions">
          <button type="button" className="btn primary" onClick={onTryIt}>
            Try the inverse square: double the distance <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
            <Icon name="close" size={14} /> Close
          </button>
        </div>
      </div>
    </section>
  );
}

/** Pixel-art scene, drawn in SVG so it stays crisp; motion lives in CSS (and stops under reduced motion). */
function NewtonScene() {
  const leaves: [number, number][] = [];
  // Dithered canopy: a disc of dots, denser toward the lit upper left.
  for (let y = 6; y < 70; y += 4) {
    for (let x = 60; x < 170; x += 4) {
      const dx = (x - 112) / 54, dy = (y - 38) / 32;
      const r = dx * dx + dy * dy;
      if (r > 1) continue;
      const light = 1 - r * 0.6 - (dx + dy) * 0.18;
      if (((x * 7 + y * 13) % 16) / 16 < light) leaves.push([x, y]);
    }
  }
  return (
    <svg className="newton-scene" viewBox="0 0 220 140" role="img" aria-label="Animation: Isaac Newton sits under an apple tree reading; an apple falls and bounces off his head." shapeRendering="crispEdges">
      {/* Ground */}
      <rect x="0" y="122" width="220" height="2" fill="var(--rule)" />
      {Array.from({ length: 27 }, (_, i) => (
        <rect key={i} x={i * 8 + ((i * 5) % 3)} y={118 + (i % 3)} width="2" height="4" fill="var(--lime)" opacity="0.45" />
      ))}
      {/* Trunk and branches */}
      <rect x="104" y="58" width="12" height="64" fill="#3a4a2e" />
      <rect x="106" y="58" width="3" height="64" fill="#556b3f" />
      <rect x="92" y="60" width="14" height="4" fill="#3a4a2e" />
      <rect x="116" y="56" width="18" height="4" fill="#3a4a2e" />
      {/* Canopy */}
      <g className="newton-canopy">
        {leaves.map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="3" height="3" fill="var(--lime)" opacity={0.55 + ((i * 37) % 10) / 25} />
        ))}
      </g>
      {/* Apples still on the tree */}
      <rect x="78" y="40" width="5" height="5" fill="var(--amber)" />
      <rect x="140" y="28" width="5" height="5" fill="var(--amber)" />
      {/* Newton, seated against the trunk, reading */}
      <g className="newton-figure">
        {/* legs */}
        <rect x="70" y="112" width="26" height="6" fill="#6f7f9a" />
        <rect x="66" y="116" width="8" height="5" fill="#2b2f38" />
        {/* coat */}
        <rect x="86" y="92" width="16" height="22" fill="#4a5a7a" />
        <rect x="86" y="92" width="16" height="3" fill="#5d6f94" />
        {/* book */}
        <rect x="74" y="100" width="12" height="9" fill="var(--text)" />
        <rect x="79" y="100" width="1" height="9" fill="#8a93a8" />
        {/* arm */}
        <rect x="80" y="104" width="10" height="4" fill="#4a5a7a" />
        {/* head + wig */}
        <g className="newton-head">
          <rect x="88" y="78" width="12" height="13" fill="#e8c9a0" />
          <rect x="86" y="74" width="16" height="6" fill="#d9d9d0" />
          <rect x="84" y="78" width="5" height="14" fill="#d9d9d0" />
          <rect x="99" y="78" width="4" height="10" fill="#d9d9d0" />
          <rect x="90" y="84" width="2" height="2" fill="#2b2f38" />
        </g>
        <g className="newton-bang" aria-hidden="true">
          <rect x="94" y="58" width="3" height="9" fill="var(--amber)" />
          <rect x="94" y="69" width="3" height="3" fill="var(--amber)" />
        </g>
      </g>
      {/* The falling apple: drops from the branch, bounces off his head, rolls away */}
      <g className="newton-apple">
        <rect x="93" y="42" width="6" height="6" fill="#d9614c" />
        <rect x="94" y="43" width="2" height="2" fill="#f2a58f" />
        <rect x="96" y="40" width="1" height="3" fill="#556b3f" />
      </g>
      {/* The idea it prompted */}
      <text className="newton-idea" x="134" y="100" fill="var(--lime)" fontFamily="'VT323', monospace" fontSize="15">F = Gm₁m₂/r²</text>
    </svg>
  );
}
