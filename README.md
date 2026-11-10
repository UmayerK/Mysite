# Umayer Khan — Five Working Miniatures

A portfolio made of five interactive pieces, each a playable miniature of real work, plus a hub that links them.

| | Piece | What runs in your browser |
|---|---|---|
| 01 | Resonance | A 3D instrument of light: Web Audio synthesis, one GLSL vertex shader driven by the live spectrum, mic pitch detection |
| 02 | Zero | Argon2id (WASM) and AES-256-GCM (Web Crypto), with a live dictionary attack |
| 03 | Radius | A seeded auction-market engine and a stock bidding agent to compete against |
| 04 | Seam | A hand-written neural network trained in a Web Worker, drawn as a 3D terrain |
| 05 | Glyph | A hand-written lexer, parser and evaluator for a small poster language |

Where something is simulated, the piece says so. The markets and data are invented for the demos.

## Run it

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # outputs dist/
```

Vite, React, TypeScript, Three.js, GSAP, Motion. Deploys as a static site (`vercel.json` holds the SPA rewrite).
