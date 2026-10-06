import fs from 'node:fs';
import path from 'node:path';

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
 * Copy the in-package fixture (`src/`) into the given destination so E2E runs never touch the actual
 * fixture directory (watch events + the CLI's `dumpFiles` output write into `dist/`).
 *
 * A `dist/` in the fixture is skipped: it is generated output, and copying a stale one would let the
 * dump assertions pass on last run's bytes.
 */
export function createProject(fixtureDir: string, destDir: string): E2eProject {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(fixtureDir)) {
    if (entry === 'dist') {
      continue;
    }
    fs.cpSync(path.join(fixtureDir, entry), path.join(destDir, entry), { recursive: true });
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
