import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * This package's root, derived from this file's location (`test/paths.ts` → `test/` → package root).
 *
 * Everything the suite reads or writes outside its own source is derived from here: the read-only
 * fixture project (`src/`) and the run's own artifacts, the cached game build (`test/.cache/`) and the
 * temp project copy (`test/.tmp/`). One definition keeps those paths from drifting apart across modules.
 */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
