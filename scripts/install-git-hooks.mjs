#!/usr/bin/env node
// Rush has no event hook for publish or changelog generation, and "rush publish" cannot be
// overridden by a custom command. It does run Git hooks when it commits the generated
// changelogs, so install a pre-commit hook that re-renders CHANGELOG.md from CHANGELOG.json
// before that commit is created.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARKER_START = '# >>> viteburner changelog format >>>';
const MARKER_END = '# <<< viteburner changelog format <<<';

const block = [
  MARKER_START,
  '# Rush rewrites CHANGELOG.md when it generates changelogs. Re-render the markdown from',
  '# CHANGELOG.json before the commit so the compact heading format is what gets committed.',
  "if git diff --cached --name-only --diff-filter=ACMR | grep -qE '^packages/[^/]+/CHANGELOG\\.(json|md)$'; then",
  '  node scripts/format-changelog.mjs >/dev/null || exit 1',
  '  git add -- packages/*/CHANGELOG.md || exit 1',
  'fi',
  MARKER_END,
  '',
].join('\n');

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

let repoRoot;
try {
  repoRoot = git(['rev-parse', '--show-toplevel']);
} catch {
  // Not a Git checkout (for example a source tarball): there is nothing to install.
  process.exit(0);
}

const hooksFolder = join(repoRoot, git(['rev-parse', '--git-path', 'hooks']));
const hookPath = join(hooksFolder, 'pre-commit');

mkdirSync(hooksFolder, { recursive: true });

let content;
if (existsSync(hookPath)) {
  content = readFileSync(hookPath, 'utf8');
  const start = content.indexOf(MARKER_START);
  const end = content.indexOf(MARKER_END);
  if (start >= 0 && end >= start) {
    content = content.slice(0, start) + block + content.slice(end + MARKER_END.length + 1);
  } else {
    if (!content.endsWith('\n')) {
      content += '\n';
    }
    content += block;
  }
} else {
  content = `#!/bin/sh\n${block}`;
}

// Git for Windows executes hooks through sh, which tolerates CRLF poorly for the shebang line.
writeFileSync(hookPath, content.replace(/\r\n/g, '\n'));
try {
  execFileSync('chmod', ['+x', hookPath]);
} catch {
  // Windows does not need the executable bit.
}

console.log(`installed ${hookPath}`);
