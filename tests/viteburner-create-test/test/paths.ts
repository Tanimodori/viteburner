import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** This package's root (`test/paths.ts` → `test/` → package root). */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The repository root, two levels above this package. */
export const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');

/** The hand-written template the tests scaffold from. */
export const SOURCE_TEMPLATE = path.join(REPO_ROOT, 'templates', 'viteburner-template');

/** The create-viteburner package, for the build script and its built output. */
export const CREATE_PACKAGE = path.join(REPO_ROOT, 'packages', 'create-viteburner');

/** Rebuilds `packages/create-viteburner/template` from the source template. */
export const CREATE_BUILD_SCRIPT = path.join(CREATE_PACKAGE, 'scripts', 'build-template.mjs');

/** The package the scaffolded version range is expected to match. */
export const VITEBURNER_PACKAGE_JSON = path.join(REPO_ROOT, 'packages', 'viteburner', 'package.json');

/** The test-only dts copied into each generated project. */
export const FIXTURE_DTS = path.join(PACKAGE_ROOT, 'fixtures', 'ns-definitions.d.ts');

/** The check config that type-checks the source template in place. */
export const CHECK_TSCONFIG = path.join(PACKAGE_ROOT, 'fixtures', 'tsconfig.check.json');
