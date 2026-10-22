import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { exportTemplate, scaffold, toValidPackageName } from '../src';

let templateDir: string;
const tempDirs: string[] = [];

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'create-viteburner-scaffold-'));
  tempDirs.push(dir);
  return dir;
}

beforeAll(async () => {
  templateDir = join(await tempDir(), 'template');
  await exportTemplate({ outDir: templateDir, clean: true });
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(1).map((dir) => rm(dir, { recursive: true, force: true })));
});

afterAll(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('scaffold', () => {
  it('copies the template and names the package after the directory', async () => {
    const targetDir = join(await tempDir(), 'My Project');

    const result = await scaffold({ targetDir, templateDir });
    const pkg = JSON.parse(await readFile(join(targetDir, 'package.json'), 'utf8'));

    expect(result.packageName).toBe('my-project');
    expect(pkg.name).toBe('my-project');
    expect(pkg.scripts).toMatchObject({
      dev: 'viteburner',
      build: 'tsc --noEmit',
      typecheck: 'tsc --noEmit',
    });
    expect(existsSync(join(targetDir, '.gitignore'))).toBe(true);
    expect(existsSync(join(targetDir, 'src/template.ts'))).toBe(true);
    expect(existsSync(join(targetDir, 'README.mirror.md'))).toBe(false);
    expect(await containsWorkspace(targetDir)).toBe(false);
  });

  it('refuses a non-empty directory without force', async () => {
    const targetDir = await tempDir();
    await writeFile(join(targetDir, 'keep.txt'), 'keep\n');

    await expect(scaffold({ targetDir, templateDir })).rejects.toThrow(/not empty/);
  });

  it('keeps unrelated files when forced', async () => {
    const targetDir = await tempDir();
    await writeFile(join(targetDir, 'keep.txt'), 'keep\n');

    await scaffold({ targetDir, templateDir, force: true });

    expect(await readFile(join(targetDir, 'keep.txt'), 'utf8')).toBe('keep\n');
    expect(existsSync(join(targetDir, 'package.json'))).toBe(true);
  });

  it('sanitizes package names', () => {
    expect(toValidPackageName('My Project')).toBe('my-project');
    expect(toValidPackageName('.hidden')).toBe('hidden');
    expect(toValidPackageName('   ')).toBe('viteburner-project');
  });
});

async function containsWorkspace(dir: string): Promise<boolean> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (await containsWorkspace(path)) return true;
    } else if (entry.isFile()) {
      if ((await readFile(path, 'utf8')).includes('workspace:')) return true;
    }
  }
  return false;
}
