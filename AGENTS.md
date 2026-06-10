# Project Instructions

- Do not use Playwright in this project. Do not add Playwright tests, scripts, dependencies, screenshots, or automation.
- Do not use browser-based verification tools in this project. The user performs visual testing manually and provides feedback.
- Preserve deterministic world generation. Changes to terrain, biome, river, lake, resource, or structure generation must keep identical inputs producing identical outputs unless the change intentionally updates generation behavior.
- Keep biome naming/API stable: `POLAR` is the canonical and only biome name for id `12`; do not reintroduce old ice-biome aliases.
- When changing biome ids or biome classification, update the public docs, UI labels/colors, compatibility matrix, resource/lake/river biome lists, `NUM_BIOMES` consumers, and focused Vitest coverage in the same change.
- Journey and the infinite world editor must share the same temperature/moisture climate grid. Journey may change scale or directional climate bias, but must not fork separate biome rules.
- Keep engine code renderer-neutral. Code under `src/` must not depend on DOM, browser globals, Vite app code, or Three.js except inside explicit adapter entrypoints.
- Keep browser app code inside `app/`. UI, input handling, visual controls, and demo-only behavior should not leak into the published engine package.
- Use the `imagegen` skill whenever an AI-generated raster image could materially improve the visual result, such as textures, sprites, concept art, UI mockups, visual variants, or project-bound bitmap assets. Prefer repo-native SVG, HTML/CSS, canvas, or existing editable assets when those are a better fit.
- Prefer focused Vitest coverage for logic changes. Add or update nearby tests for generation, geometry, water, economy, serialization, config, and public API behavior.
- Run the narrowest relevant verification first, then broader checks when touching shared behavior. Use `npm test -- <test-file>` for focused changes, `npm run typecheck` / `npm run typecheck:app` for TypeScript contracts, and `npm run build` when package output may be affected.
- After finishing any implementation, end the response with a short, explicit note on how to verify the change visually in the app or demo.
- Avoid large cross-cutting refactors while implementing visual or gameplay tweaks. Keep changes scoped to the affected subsystem unless an extraction clearly reduces existing complexity.
- Be careful with performance-sensitive paths. Avoid per-frame allocations, unnecessary geometry rebuilds, unbounded caches, and expensive work inside render loops, chunk streaming, terrain mesh generation, and worker communication.
- When proposing implementation options or visual changes, always consider and state the expected FPS impact, including likely render-loop, geometry, material, texture, shader, allocation, and chunk-streaming costs when relevant.
- Dispose Three.js resources explicitly in app/viewer code when replacing geometries, materials, textures, render targets, or scene objects.
- Keep public package entrypoints stable. Changes to `exports`, public types, config schemas, serialized formats, or docs examples should be treated as API changes and verified accordingly.
- Do not edit generated build output (`dist`, `dist-app`, `test-results`, `output`) unless the task explicitly concerns generated artifacts.
