/**
 * Which leg this run is: the offline leg against the pinned build, or the online leg against the live site.
 *
 * `--mode live` reaches the specs through `import.meta.env.MODE` (Vite injects it); a bare `vitest run`
 * is mode `test`. Both legs run the same spec file and the same six steps — the mode only decides which
 * game the suite drives, so this flag picks the game source (see `e2e.spec.ts`) rather than gating whole
 * files in or out. `vitest.config.ts` attaches the global setup (which downloads the pinned build) on
 * the same condition.
 */
export const mode = import.meta.env.MODE;
export const live = mode === 'live';
