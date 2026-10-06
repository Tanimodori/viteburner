/**
 * Which leg this run is.
 *
 * `--mode live` reaches the specs through `import.meta.env.MODE` (Vite injects it); a bare
 * `vitest run` is mode `test`. Both spec files are always collected, and each one gates itself with
 * `describe.skipIf(…)` on these values, so the file the run does not intend is skipped rather than
 * reached. The local leg's global setup is attached by `vitest.config.ts` on the same condition.
 */
export const mode = import.meta.env.MODE;
export const live = mode === 'live';
