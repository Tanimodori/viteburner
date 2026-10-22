import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { exportTemplate, defaultSourceTemplate, readViteburnerVersion } from '../src';

const tempDirs: string[] = [];

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'create-viteburner-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('exportTemplate', () => {
  it('rewrites workspace dependencies to the current viteburner version', async () => {
    const version = await readViteburnerVersion();
    const outDir = join(await tempDir(), 'template');

    const result = await exportTemplate({ outDir, clean: true });
    const pkg = JSON.parse(await readFile(join(outDir, 'package.json'), 'utf8'));
    const source = JSON.parse(await readFile(join(defaultSourceTemplate, 'package.json'), 'utf8'));

    expect(source.devDependencies.viteburner).toBe('workspace:*');
    expect(result.version).toBe(version);
    expect(pkg.devDependencies.viteburner).toBe(`^${version}`);
    expect(pkg.scripts).toMatchObject({ build: 'tsc --noEmit', typecheck: 'tsc --noEmit' });
    expect(JSON.stringify(pkg)).not.toContain('workspace:');
  });

  it('leaves development-only files out of the scaffold', async () => {
    const outDir = join(await tempDir(), 'template');

    const result = await exportTemplate({ outDir, clean: true });

    expect(result.files).toContain('README.md');
    expect(result.files).not.toContain('README.mirror.md');
    expect(result.files).not.toContain('NetscriptDefinitions.d.ts');
    expect(existsSync(join(outDir, 'README.mirror.md'))).toBe(false);
  });

  it('uses the mirror README for the standalone repository', async () => {
    const outDir = join(await tempDir(), 'mirror');

    await exportTemplate({ outDir, clean: true, mirror: true });
    const readme = await readFile(join(outDir, 'README.md'), 'utf8');

    expect(readme).toContain('generated from');
    expect(existsSync(join(outDir, 'README.mirror.md'))).toBe(false);
  });

  it('is deterministic', async () => {
    const first = join(await tempDir(), 'first');
    const second = join(await tempDir(), 'second');

    const a = await exportTemplate({ outDir: first, clean: true });
    const b = await exportTemplate({ outDir: second, clean: true });

    expect(a.files).toEqual(b.files);
    for (const file of a.files) {
      expect(await readFile(join(first, file), 'utf8')).toBe(await readFile(join(second, file), 'utf8'));
    }
  });

  it('rejects an unknown workspace dependency', async () => {
    const sourceDir = await tempDir();
    await mkdir(join(sourceDir, 'src'), { recursive: true });
    await writeFile(
      join(sourceDir, 'package.json'),
      JSON.stringify({ name: 'demo', dependencies: { other: 'workspace:*' } }),
    );
    await writeFile(join(sourceDir, 'README.md'), '# demo\n');

    await expect(
      exportTemplate({
        sourceDir,
        outDir: join(await tempDir(), 'out'),
        clean: true,
        version: '1.2.3',
      }),
    ).rejects.toThrow(/other/);
  });
});
