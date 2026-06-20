# AGENTS

## Cursor Cloud specific instructions

This repo is a **static, no-build browser game** (Minecraft-like voxel sandbox)
built with vanilla ES Modules + a vendored Three.js. There is no package manager,
no dependencies to install, and no test/build step.

- Run locally with any static HTTP server from the repo root, then open the
  printed URL. ES Modules require HTTP (not `file://`):
  - `python3 -m http.server 8100` → http://localhost:8100/
- Entry point is `index.html` → `js/main.js`. Three.js is vendored at
  `lib/three.module.js`; modules import it via the relative path `../lib/three.module.js`,
  so there is no import map and no CDN dependency at runtime.
- Textures are generated procedurally on a `<canvas>` (see `js/blocks.js`); there
  are intentionally no binary asset files.
- Quick syntax sanity check without a browser: `node --check js/<file>.js`.
- The game needs a real browser (WebGL + pointer lock). It cannot be exercised
  headlessly from the shell beyond serving/HTTP-status checks.
- Deployment is automatic via `.github/workflows/deploy.yml` (GitHub Pages,
  Source = "GitHub Actions") on push to `master`/`main`.
