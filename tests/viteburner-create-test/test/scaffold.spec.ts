import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { loadConfigFromFile } from 'vite';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  CHECK_TSCONFIG,
  CREATE_BUILD_SCRIPT,
  CREATE_PACKAGE,
  FIXTURE_DTS,
  PACKAGE_ROOT,
  VITEBURNER_PACKAGE_JSON,
} from './paths';

const require = createRequire(import.meta.url);

let tempRoot = '';
let createEntry: string;
let tsc: string;
let viteburnerVersion: string;

const tempDirs: string[] = [];

function tempDir() {
  const dir = mkdtempSync(join(tempRoot, 'create-'));
  tempDirs.push(dir);
  return dir;
}

function runCreate(args: string[], cwd: string) {
  return spawnSync(process.execPath, [createEntry, ...args], { cwd, encoding: 'utf8' });
}

beforeAll(() => {
  if (!existsSync(join(CREATE_PACKAGE, 'dist/index.mjs'))) {
    throw new Error('create-viteburner is not built. Run "rush build --to viteburner-create-test" first.');
  }

  // Refresh the package's template from the source template so the installed CLI copies exactly
  // what this checkout contains.
  execFileSync(process.execPath, [CREATE_BUILD_SCRIPT], { stdio: 'inherit' });

  createEntry = join(dirname(require.resolve('create-viteburner')), 'entry.js');
  tsc = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');
  viteburnerVersion = JSON.parse(readFileSync(VITEBURNER_PACKAGE_JSON, 'utf8')).version;

  tempRoot = join(PACKAGE_ROOT, 'test/.tmp');
  mkdirSync(tempRoot, { recursive: true });
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

afterAll(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
});

describe('create-viteburner', () => {
  it('scaffolds a project that type-checks and loads as a vite config', async () => {
    const work = tempDir();
    const result = runCreate(['my-project'], work);
    expect(result.status, result.stderr).toBe(0);

    const child = join(work, 'my-project');
    const pkg = JSON.parse(readFileSync(join(child, 'package.json'), 'utf8'));

    expect(pkg.name).toBe('my-project');
    expect(pkg.devDependencies.viteburner).toBe(`^${viteburnerVersion}`);
    expect(pkg.scripts).toMatchObject({
      dev: 'viteburner',
      build: 'tsc --noEmit',
      typecheck: 'tsc --noEmit',
    });

    const files = readdirSync(child);
    expect(files).toEqual(
      expect.arrayContaining([
        '.gitattributes',
        '.gitignore',
        'LICENSE',
        'README.md',
        'package.json',
        'src',
        'tsconfig.json',
        'vite.config.ts',
      ]),
    );
    expect(files).not.toContain('README.mirror.md');
    expect(containsWorkspace(child)).toBe(false);

    // The game downloads this file on the first run; copy the test fixture instead so tsc can check
    // the generated project without a browser.
    copyFileSync(FIXTURE_DTS, join(child, 'NetscriptDefinitions.d.ts'));
    const checked = spawnSync(process.execPath, [tsc, '--noEmit', '-p', join(child, 'tsconfig.json')], {
      encoding: 'utf8',
    });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);

    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'development' },
      join(child, 'vite.config.ts'),
      child,
    );
    const config = loaded?.config as { viteburner?: unknown } | undefined;
    expect(config?.viteburner).toMatchObject({ sourcemap: 'inline', watch: expect.any(Array) });
  });

  it('type-checks the source template in place', () => {
    const checked = spawnSync(process.execPath, [tsc, '--noEmit', '-p', CHECK_TSCONFIG], {
      encoding: 'utf8',
    });
    expect(checked.status, checked.stdout + checked.stderr).toBe(0);
  });

  it('refuses a non-empty directory and accepts --force', () => {
    const work = tempDir();
    const child = join(work, 'existing');
    mkdirSync(child);
    writeFileSync(join(child, 'keep.txt'), 'keep\n');

    const refused = runCreate(['existing'], work);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain('not empty');

    const forced = runCreate(['existing', '--force'], work);
    expect(forced.status, forced.stderr).toBe(0);
    expect(readFileSync(join(child, 'keep.txt'), 'utf8')).toBe('keep\n');
    expect(existsSync(join(child, 'package.json'))).toBe(true);
  });

  it('defaults to viteburner-project', () => {
    const work = tempDir();
    const result = runCreate([], work);

    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(join(work, 'viteburner-project', 'package.json'))).toBe(true);
  });

  it('prints help and version', () => {
    const work = tempDir();
    const version = runCreate(['--version'], work);
    const ownVersion = JSON.parse(readFileSync(join(CREATE_PACKAGE, 'package.json'), 'utf8')).version;

    expect(version.status).toBe(0);
    expect(version.stdout.trim()).toBe(ownVersion);

    const help = runCreate(['--help'], work);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('Usage: create-viteburner');
  });

  it('keeps the CLI entry executable on POSIX', () => {
    const bin = readFileSync(join(CREATE_PACKAGE, 'bin/create-viteburner.js'), 'utf8');

    // npm and pnpm link this file directly on POSIX; a CRLF shebang is an "env: node\r" error.
    expect(bin.split('\n', 1)[0]).toBe('#!/usr/bin/env node');
  });

  it('packs the generated template and package metadata into the tarball', () => {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) {
      throw new Error('npm_execpath is not set; run this suite through npm or rushx.');
    }

    const output = execFileSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: CREATE_PACKAGE,
      encoding: 'utf8',
    });
    const [{ files }] = JSON.parse(output) as { files: { path: string }[] }[];
    const paths = files.map((file) => file.path);

    expect(paths).toContain('bin/create-viteburner.js');
    expect(paths).toContain('LICENSE');
    expect(paths).toContain('template/package.json');
    // npm excludes .gitignore files inside a packaged directory unless the exact path is in `files`.
    expect(paths).toContain('template/.gitignore');
    expect(paths).not.toContain('template/README.mirror.md');
  });
});

function containsWorkspace(dir: string): boolean {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (containsWorkspace(path)) return true;
    } else if (entry.isFile() && readFileSync(path, 'utf8').includes('workspace:')) {
      return true;
    }
  }
  return false;
}
