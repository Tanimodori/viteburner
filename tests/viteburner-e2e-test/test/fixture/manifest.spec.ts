import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURE_DIR, FIXTURE_FILES, GAME_DIRECTORIES, escapeRegExp, gamePath } from './manifest';

/**
 * The fixture manifest (`test/fixture/manifest.ts`) is the only source of truth for what the E2E suite
 * expects the sync pipeline to produce. These checks keep that truth aligned with the files on disk,
 * with no browser and no CLI involved, so a mismatch fails fast and in isolation.
 */

/** Every file under the fixture's `src/`, as POSIX paths relative to the fixture root. */
function listFixtureSources(): string[] {
  const srcRoot = path.join(FIXTURE_DIR, 'src');
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        found.push(path.relative(FIXTURE_DIR, full).split(path.sep).join('/'));
      }
    }
  };
  walk(srcRoot);
  return found.sort();
}

describe('fixture manifest', () => {
  it('declares every source file in the fixture and nothing else', () => {
    const declared = FIXTURE_FILES.map((file) => file.source).sort();
    expect(declared).toEqual(listFixtureSources());
  });

  it('derives upload and dump paths the way the fixture config does', () => {
    for (const file of FIXTURE_FILES) {
      // `dumpFiles` maps `src/x.ts` -> `dist/x.js`; the upload drops `src/` and keeps the same name.
      const expectedUpload = file.source.replace(/^src\//, '').replace(/\.ts$/, '.js');
      expect(file.upload, `upload path for ${file.source}`).toBe(expectedUpload);
      expect(file.dump, `dump path for ${file.source}`).toBe(`dist/${file.upload}`);
      // A `.ts` source is the only thing vite transforms; everything else is copied byte for byte.
      expect(file.transformed, `transformed flag for ${file.source}`).toBe(file.source.endsWith('.ts'));
      expect(file.contains.length, `content checks for ${file.source}`).toBeGreaterThan(0);
    }
  });

  it('declares one run outcome per file and consistent game paths', () => {
    for (const file of FIXTURE_FILES) {
      expect(['prints', 'refused', 'library', 'data'], `run kind for ${file.source}`).toContain(file.run.kind);
      if (file.run.kind === 'prints') {
        expect(file.run.lines.length, `expected output for ${file.source}`).toBeGreaterThan(0);
      }
      expect(gamePath(file.upload)).toBe(`/${file.upload}`);
      // A file with no `main()` cannot be run; a data file is not a script at all.
      if (file.run.kind === 'library' || file.run.kind === 'data') {
        expect(file.transformed).toBe(file.run.kind === 'library');
      }
    }
  });

  it('lists every uploaded directory, including the root', () => {
    expect(GAME_DIRECTORIES).toContain('.');
    for (const file of FIXTURE_FILES) {
      const dir = path.posix.dirname(file.upload);
      if (dir !== '.') {
        // Intermediate directories must be listed too, so `ls importGlob` and `ls importGlob/modules` both run.
        for (let i = 1; i <= dir.split('/').length; i++) {
          expect(GAME_DIRECTORIES).toContain(dir.split('/').slice(0, i).join('/'));
        }
      }
    }
  });

  it('escapes literals used in CLI log patterns', () => {
    expect(escapeRegExp('src/a.b.ts')).toBe('src/a\\.b\\.ts');
  });
});
