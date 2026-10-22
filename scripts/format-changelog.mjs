#!/usr/bin/env node
// Rush renders CHANGELOG.md from CHANGELOG.json with a fixed layout (the date on its own
// line), and "rush publish --apply" / "--regenerate-changelogs" will overwrite the markdown.
// This script re-renders the same JSON in the compact heading format used in this repo, so run
// it after a publish that regenerated the changelogs.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { EOL } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesFolder = join(repoRoot, 'packages');

const sections = [
  ['Breaking changes', 'major'],
  ['Minor changes', 'minor'],
  ['Patches', 'patch'],
  ['Updates', 'none'],
  ['Hotfixes', 'hotfix'],
];

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function render(changelog) {
  let markdown = [
    `# Change Log - ${changelog.name}`,
    '',
    `This log was last generated on ${new Date().toUTCString()} and should not be manually modified.`,
    '',
    '',
  ].join(EOL);

  for (const entry of changelog.entries) {
    const date = entry.date ? formatDate(entry.date) : undefined;
    markdown += `## ${entry.version}${date ? ` (${date})` : ''}${EOL}${EOL}`;

    let rendered = false;
    for (const [title, type] of sections) {
      const comments = entry.comments?.[type];
      if (!comments?.length) {
        continue;
      }
      rendered = true;
      markdown += `### ${title}${EOL}${EOL}`;
      for (const comment of comments) {
        markdown += `- ${comment.comment}${EOL}`;
      }
      markdown += EOL;
    }

    if (!rendered) {
      markdown += (changelog.entries.length === 1 ? '_Initial release_' : '_Version update only_') + EOL + EOL;
    }
  }

  return markdown;
}

let count = 0;
for (const name of readdirSync(packagesFolder, { withFileTypes: true })) {
  if (!name.isDirectory()) {
    continue;
  }
  const packageFolder = join(packagesFolder, name.name);
  const jsonPath = join(packageFolder, 'CHANGELOG.json');
  if (!existsSync(jsonPath)) {
    continue;
  }

  const changelog = JSON.parse(readFileSync(jsonPath, 'utf8'));
  writeFileSync(join(packageFolder, 'CHANGELOG.md'), render(changelog));
  console.log(`formatted ${join('packages', name.name, 'CHANGELOG.md')}`);
  count += 1;
}

console.log(`formatted ${count} changelog${count === 1 ? '' : 's'}`);
