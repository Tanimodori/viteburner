#!/usr/bin/env node
// Release metadata checks that the unit tests and the normal build do not cover:
// npm packlist behavior, POSIX shebangs, and the publish lifecycle that Rush relies on.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8'));
}

function check(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const packages = {
  viteburner: readJson('packages/viteburner/package.json'),
  plugin: readJson('packages/vite-plugin/package.json'),
  create: readJson('packages/create-viteburner/package.json'),
  template: readJson('templates/viteburner-template/package.json'),
};

const nodeRange = '^20.19.0 || >=22.12.0';
for (const pkg of Object.values(packages)) {
  check(pkg.engines?.node === nodeRange, `${pkg.name}: engines.node must be "${nodeRange}"`);
}

const publishable = [packages.viteburner, packages.plugin, packages.create];
for (const pkg of publishable) {
  check(
    pkg.scripts?.prepublishOnly === 'node ../../scripts/check-publish-manager.mjs',
    `${pkg.name}: prepublishOnly must run scripts/check-publish-manager.mjs`,
  );
}

check(packages.viteburner.scripts?.prepack === 'npm run build', 'viteburner: prepack must build the package');
check(packages.plugin.scripts?.prepack === 'npm run build', '@viteburner/vite-plugin: prepack must build the package');
check(packages.create.scripts?.prepack === 'npm run build', 'create-viteburner: prepack must build the package');
check(
  packages.plugin.publishConfig?.access === 'public',
  '@viteburner/vite-plugin: publishConfig.access must be "public" for the first scoped publish',
);

const createFiles = packages.create.files ?? [];
for (const entry of ['bin', 'dist', 'template', 'template/.gitignore', 'LICENSE', 'CHANGELOG.md']) {
  check(createFiles.includes(entry), `create-viteburner: files must include "${entry}"`);
}
check(existsSync(join(repoRoot, 'packages/create-viteburner/LICENSE')), 'create-viteburner: LICENSE is missing');
check(existsSync(join(repoRoot, 'scripts/check-publish-manager.mjs')), 'scripts/check-publish-manager.mjs is missing');

const gitattributes = readFileSync(join(repoRoot, '.gitattributes'), 'utf8');
for (const bin of ['packages/viteburner/bin/viteburner.js', 'packages/create-viteburner/bin/create-viteburner.js']) {
  const escaped = bin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  check(
    new RegExp(`^${escaped}\\s+text eol=lf$`, 'm').test(gitattributes),
    `.gitattributes: ${bin} must be pinned to "text eol=lf"`,
  );

  const firstLine = readFileSync(join(repoRoot, bin), 'utf8').split('\n', 1)[0];
  check(firstLine === '#!/usr/bin/env node', `${bin}: shebang must use LF line endings`);
}

const packageFolders = new Map([
  ['viteburner', 'packages/viteburner'],
  ['@viteburner/vite-plugin', 'packages/vite-plugin'],
  ['create-viteburner', 'packages/create-viteburner'],
]);
for (const pkg of publishable) {
  const folder = packageFolders.get(pkg.name);
  for (const [name, target] of Object.entries(pkg.bin ?? {})) {
    check(existsSync(join(repoRoot, folder, target)), `${pkg.name}: bin "${name}" points to a missing file`);
  }
}

if (errors.length > 0) {
  console.error('Release checks failed:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log('Release checks passed.');
