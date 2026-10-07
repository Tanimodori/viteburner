import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This package's root, derived from this file's location (`test/paths.ts` → `test/` → package root).
 *
 * The fixture projects the suite points a dev server at live in `src/`, one directory per suite; the
 * spec derives every project path from here so they cannot drift apart.
 */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The directory holding the fixture projects, one per suite. */
export const FIXTURE_ROOT = path.join(PACKAGE_ROOT, 'src');

/** The project directory of one fixture suite, given its directory name under `src/`. */
export function suiteDir(dir: string) {
  return path.join(FIXTURE_ROOT, dir);
}
