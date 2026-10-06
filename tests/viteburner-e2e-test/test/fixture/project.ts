import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT } from '../paths';

/**
 * The fixture project handed to the CLI: a `vite.config.ts`, its own `tsconfig.json` and `src/**` —
 * the former `packages/viteburner/playground`, moved here so its only consumer owns it.
 *
 * It sits at the package root, not under `test/`: `src/**` imports `@ns`, which only resolves through
 * the fixture's own tsconfig once the CLI has downloaded the game's definitions, so it must stay
 * outside this package's tsc (see `tsconfig.json`). Tests never run against it in place — every run
 * copies it to `PROJECT_TMP_DIR` first, so nothing under here is ever written.
 */
export const FIXTURE_PROJECT_DIR = path.join(PACKAGE_ROOT, 'src');

/** The isolated copy a run drives the CLI against (gitignored; removed after the run unless E2E_KEEP). */
export const PROJECT_TMP_DIR = path.join(PACKAGE_ROOT, 'test', '.tmp', 'project');

export interface E2eProject {
  /** Absolute path of the temp project root (contains vite.config.ts and src/). */
  root: string;
  /** Absolute path of the source directory inside the project. */
  srcDir: string;
  /** Create (or overwrite) a source file with the given content. */
  writeSource(relative: string, content: string): void;
  /** Remove a source file if present. */
  removeSource(relative: string): void;
  /** Read a project-relative file (source, or the CLI's dump) as text. */
  readFile(relative: string): string;
  /** Whether a project-relative path exists (source, or the CLI's dump). */
  exists(relative: string): boolean;
}

/**
 * Copy the read-only fixture project into an isolated destination so E2E runs never touch it (watch
 * events and the CLI's `dumpFiles` output write into `dist/`).
 *
 * A `dist/` in the fixture is skipped: it is generated output, and copying a stale one would let the
 * dump assertions pass on last run's bytes.
 */
export function createProject(destDir = PROJECT_TMP_DIR): E2eProject {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(FIXTURE_PROJECT_DIR)) {
    if (entry === 'dist') {
      continue;
    }
    fs.cpSync(path.join(FIXTURE_PROJECT_DIR, entry), path.join(destDir, entry), { recursive: true });
  }
  const srcDir = path.join(destDir, 'src');
  return {
    root: destDir,
    srcDir,
    writeSource(relative: string, content: string) {
      const file = path.join(srcDir, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content, 'utf8');
    },
    removeSource(relative: string) {
      fs.rmSync(path.join(srcDir, relative), { force: true });
    },
    readFile(relative: string) {
      return fs.readFileSync(path.join(destDir, relative), 'utf8');
    },
    exists(relative: string) {
      return fs.existsSync(path.join(destDir, relative));
    },
  };
}

/** Drop the run's project copy, keeping it around when `E2E_KEEP` is set for manual inspection. */
export function removeProject(project: E2eProject) {
  if (!process.env.E2E_KEEP) {
    fs.rmSync(project.root, { recursive: true, force: true });
  }
}
