import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `dist/` after bundling, `src/` under vitest; both are one level below the package root, where the
 * built `template/` lives. The `__dirname` branch keeps the CJS bundle from evaluating
 * `import.meta.url`, which only exists in the ESM build.
 */
const moduleDir = typeof __dirname === 'string' ? __dirname : dirname(fileURLToPath(import.meta.url));
const defaultTemplateDir = resolve(moduleDir, '..', 'template');

export interface ScaffoldOptions {
  /** Directory to create the project in. */
  targetDir: string;
  /** Write into a non-empty directory instead of failing. */
  force?: boolean;
  /** Template directory. Defaults to the package's built `template/`. */
  templateDir?: string;
}

export interface ScaffoldResult {
  targetDir: string;
  packageName: string;
  /** Copied files, relative to `targetDir`, with forward slashes. */
  files: string[];
}

/** Turn a directory name into a valid package name, following the same rules as `create-vite`. */
export function toValidPackageName(name: string): string {
  const result = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-~]+/g, '-');
  return result || 'viteburner-project';
}

/** Copy the built template into `targetDir` and rename the package after the directory. */
export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const targetDir = resolve(options.targetDir);
  const templateDir = resolve(options.templateDir ?? defaultTemplateDir);

  if (!existsSync(join(templateDir, 'package.json'))) {
    throw new Error(`Template not found at ${templateDir}. Build create-viteburner before scaffolding.`);
  }
  if (targetDir === templateDir) {
    throw new Error('Refusing to scaffold into the template directory.');
  }

  const targetStat = await stat(targetDir).catch(() => undefined);
  if (targetStat && !targetStat.isDirectory()) {
    throw new Error(`Target is not a directory: ${targetDir}`);
  }
  if (targetStat) {
    const entries = await readdir(targetDir);
    if (entries.length > 0 && !options.force) {
      throw new Error(`Target directory is not empty: ${targetDir}. Use --force to write into it.`);
    }
  }

  await mkdir(targetDir, { recursive: true });
  await cp(templateDir, targetDir, {
    recursive: true,
    force: true,
    errorOnExist: false,
    filter: (source) => {
      const name = basename(source);
      return name !== 'node_modules' && name !== 'dist' && name !== '.git' && name !== '.rush';
    },
  });

  const packageJsonPath = join(targetDir, 'package.json');
  const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { name?: string };
  pkg.name = toValidPackageName(basename(targetDir));
  await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

  return {
    targetDir,
    packageName: pkg.name,
    files: await listFiles(targetDir),
  };
}

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(join(dir, entry.name), relative)));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files.sort();
}
