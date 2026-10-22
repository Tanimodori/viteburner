#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { exportTemplate } from '../dist/index.mjs';

const USAGE = `Usage: node scripts/export-template.mjs --dest <dir> [options]

Write the generated viteburner template into a standalone checkout.

Options:
  --dest <dir>    Destination directory (required).
  --prune         Delete everything except .git and --keep paths before writing.
  --keep <path>   Keep this path when pruning; repeatable.
  --check         Compare the destination with a fresh export; write nothing.
  --force         Allow a non-template directory or a dirty git tree with --prune.`;

const IGNORED = new Set(['.git', 'node_modules']);

function parse() {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      options: {
        dest: { type: 'string' },
        prune: { type: 'boolean', default: false },
        keep: { type: 'string', multiple: true, default: [] },
        check: { type: 'boolean', default: false },
        force: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(USAGE);
    process.exit(1);
  }
}

function normalizePath(value) {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function isKept(relative, keeps) {
  return keeps.some((keep) => relative === keep || relative.startsWith(`${keep}/`));
}

function isKeptOrParent(relative, keeps) {
  return isKept(relative, keeps) || keeps.some((keep) => keep.startsWith(`${relative}/`));
}

async function listFiles(root, keeps, prefix = '') {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (isKept(relative, keeps)) continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(join(root, entry.name), keeps, relative)));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files.sort();
}

async function readTree(root, keeps) {
  const files = await listFiles(root, keeps);
  const tree = new Map();
  for (const relative of files) {
    tree.set(relative, await readFile(join(root, relative)));
  }
  return tree;
}

function reportDifferences(expected, actual) {
  const missing = [...expected.keys()].filter((file) => !actual.has(file));
  const extra = [...actual.keys()].filter((file) => !expected.has(file));
  const changed = [...expected.keys()].filter(
    (file) => actual.has(file) && !expected.get(file).equals(actual.get(file)),
  );

  for (const file of missing) console.error(`missing: ${file}`);
  for (const file of changed) console.error(`changed: ${file}`);
  for (const file of extra) console.error(`extra:   ${file}`);

  return missing.length + changed.length + extra.length;
}

async function main() {
  const { values } = parse();
  if (!values.dest) {
    console.error('--dest is required.');
    console.error(USAGE);
    process.exit(1);
  }

  const dest = resolve(values.dest);
  const keeps = ['.git', ...values.keep.map(normalizePath)];

  if (values.check) {
    const actualStat = await stat(dest).catch(() => undefined);
    if (!actualStat?.isDirectory()) {
      console.error(`Destination does not exist or is not a directory: ${dest}`);
      process.exit(1);
    }
    const temp = await mkdtemp(join(tmpdir(), 'create-viteburner-check-'));
    try {
      await exportTemplate({ outDir: temp, clean: true, mirror: true });
      const differences = reportDifferences(await readTree(temp, keeps), await readTree(dest, keeps));
      if (differences > 0) {
        console.error(`Template is out of date (${differences} difference(s)).`);
        process.exit(1);
      }
      console.log(`Template is up to date: ${dest}`);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
    return;
  }

  const destStat = await stat(dest).catch(() => undefined);
  if (destStat && !destStat.isDirectory()) {
    console.error(`Destination is not a directory: ${dest}`);
    process.exit(1);
  }

  if (destStat) {
    const entries = await readdir(dest);
    const packageJsonPath = join(dest, 'package.json');
    let packageName;
    if (existsSync(packageJsonPath)) {
      packageName = JSON.parse(await readFile(packageJsonPath, 'utf8')).name;
    }
    if (entries.length > 0 && packageName !== 'viteburner-template' && !values.force) {
      console.error(
        `Refusing to write into ${dest}: it is not a viteburner-template checkout. Use --force to override.`,
      );
      process.exit(1);
    }

    if (values.prune) {
      if (existsSync(join(dest, '.git')) && !values.force) {
        const status = spawnSync('git', ['-C', dest, 'status', '--porcelain'], {
          encoding: 'utf8',
        });
        if (status.error || status.status !== 0) {
          const detail = status.error?.message ?? status.stderr ?? 'unknown error';
          console.error(`Cannot check git status: ${detail}`);
          process.exit(1);
        }
        if (status.stdout.trim()) {
          console.error(`Refusing to prune ${dest}: it has uncommitted changes. Commit them or pass --force.`);
          process.exit(1);
        }
      }
      for (const entry of await readdir(dest)) {
        if (isKeptOrParent(entry, keeps)) continue;
        await rm(join(dest, entry), { recursive: true, force: true });
      }
    }
  }

  await mkdir(dest, { recursive: true });
  const result = await exportTemplate({ outDir: dest, clean: false, mirror: true });
  console.log(`Exported viteburner@${result.version} (${result.files.length} files) to ${dest}`);
}

await main();
