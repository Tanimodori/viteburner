import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The directory this module lives in after bundling (`dist/`) or when vitest loads the source
 * (`src/`). Both are one level below the package root, so `packageRoot` is the same either way.
 *
 * The CJS bundle has no `import.meta.url`; the `__dirname` branch keeps it from evaluating there.
 * Rollup still rewrites the ESM expression in the CJS output, but the branch is never taken.
 */
const moduleDir = typeof __dirname === 'string' ? __dirname : dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(moduleDir, '..');
const repoRoot = resolve(packageRoot, '../..');

/** The hand-written template project in this repository. */
export const defaultSourceTemplate = resolve(repoRoot, 'templates/viteburner-template');

/** The template directory bundled into the published package. */
export const defaultOutputTemplate = resolve(packageRoot, 'template');

/** The package whose version every `workspace:*` reference is resolved against. */
export const viteburnerPackageJson = resolve(repoRoot, 'packages/viteburner/package.json');

/** Workspace packages the template is allowed to reference. */
const workspacePackages = new Set(['viteburner', '@viteburner/vite-plugin']);

const IGNORED_NAMES = new Set(['node_modules', 'dist', '.git', '.rush', 'rush-logs', '.tmp']);
const IGNORED_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'NetscriptDefinitions.d.ts']);

/** The no-op build script that exists only so `rush rebuild` has something to run in the template. */
const NOOP_BUILD = 'node -e "process.exit(0)"';

export interface ExportTemplateOptions {
  /** Source template project. Defaults to `templates/viteburner-template`. */
  sourceDir?: string;
  /** Output directory. Defaults to the package's `template/`. */
  outDir?: string;
  /** Version to pin. Defaults to the `viteburner` package's version. */
  version?: string;
  /** Use `README.mirror.md` as the standalone repository's `README.md`. */
  mirror?: boolean;
  /** Remove the output directory before writing. */
  clean?: boolean;
}

export interface ExportTemplateResult {
  outDir: string;
  version: string;
  /** Written files, relative to `outDir`, with forward slashes. */
  files: string[];
}

/** Read the version that a scaffolded project should pin. */
export async function readViteburnerVersion(): Promise<string> {
  const raw = await readFile(viteburnerPackageJson, 'utf8');
  const pkg = JSON.parse(raw) as { version?: string };
  if (!pkg.version) {
    throw new Error(`No version field in ${viteburnerPackageJson}`);
  }
  return pkg.version;
}

/**
 * Copy the source template into a distributable form.
 *
 * `workspace:*` references are replaced with `^<version>`; development-only files and the mirror
 * README are left out, and any remaining `workspace:` reference is an error rather than something
 * that leaks into a user project.
 */
export async function exportTemplate(options: ExportTemplateOptions = {}): Promise<ExportTemplateResult> {
  const sourceDir = resolve(options.sourceDir ?? defaultSourceTemplate);
  const outDir = resolve(options.outDir ?? defaultOutputTemplate);
  const version = options.version ?? (await readViteburnerVersion());
  const mirror = options.mirror ?? false;

  const sourceFiles = await walk(sourceDir);
  const outputs = new Map<string, string>();

  for (const relative of sourceFiles) {
    if (relative === 'README.md' && mirror) continue;
    if (relative === 'README.mirror.md' && !mirror) continue;

    const output = relative === 'README.mirror.md' ? 'README.md' : relative;
    const content = await readFile(join(sourceDir, relative), 'utf8');

    if (output === 'package.json') {
      const pkg = JSON.parse(content) as Record<string, unknown>;
      rewritePackageJson(pkg, version);
      outputs.set(output, `${JSON.stringify(pkg, null, 2)}\n`);
    } else {
      assertNoWorkspaceSpec(output, content);
      outputs.set(output, content);
    }
  }

  if (options.clean) {
    await rm(outDir, { recursive: true, force: true });
  }
  await mkdir(outDir, { recursive: true });

  for (const [relative, content] of outputs) {
    const path = join(outDir, relative);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  return { outDir, version, files: [...outputs.keys()].sort() };
}

function rewritePackageJson(pkg: Record<string, unknown>, version: string) {
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const dependencies = pkg[section];
    if (!dependencies || typeof dependencies !== 'object') continue;

    for (const [name, spec] of Object.entries(dependencies as Record<string, unknown>)) {
      if (typeof spec !== 'string' || !spec.startsWith('workspace:')) continue;
      if (!workspacePackages.has(name)) {
        throw new Error(`Cannot resolve workspace dependency "${name}": ${spec}`);
      }
      (dependencies as Record<string, string>)[name] = `^${version}`;
    }
  }

  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  if (scripts.build === NOOP_BUILD) {
    scripts.build = 'tsc --noEmit';
  }
  scripts.typecheck ??= 'tsc --noEmit';
  pkg.scripts = scripts;
}

function assertNoWorkspaceSpec(relative: string, content: string) {
  if (/\bworkspace:/.test(content)) {
    throw new Error(`Unresolved workspace reference in ${relative}`);
  }
}

/** List files recursively, skipping directories that must never be exported. */
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name) || IGNORED_FILES.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      files.push(...(await walk(join(dir, entry.name))).map((file) => `${entry.name}/${file}`));
    } else if (entry.isFile()) {
      files.push(entry.name);
    }
  }
  return files.sort();
}
