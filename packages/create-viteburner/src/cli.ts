import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import pkg from '../package.json';
import { scaffold } from './scaffold';

const USAGE = `Usage: create-viteburner [options] [dir]

Create a viteburner project in [dir] (default: viteburner-project).

Options:
  -h, --help        Show this help.
  -v, --version     Show the create-viteburner version.
      --force       Write into a non-empty directory.
      --no-install  Do not install dependencies (the default).`;

interface PackageManager {
  install: string;
}

function detectPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent ?? '';
  if (agent.startsWith('pnpm/')) return { install: 'pnpm install' };
  if (agent.startsWith('yarn/')) return { install: 'yarn' };
  if (agent.startsWith('bun/')) return { install: 'bun install' };
  return { install: 'npm install' };
}

/** Parse arguments, scaffold the project, and print the next steps. */
export async function main(argv = process.argv.slice(2), cwd = process.cwd()): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        force: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        'no-install': { type: 'boolean', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  if (parsed.values.help) {
    console.log(USAGE);
    return;
  }
  if (parsed.values.version) {
    console.log(pkg.version);
    return;
  }
  if (parsed.positionals.length > 1) {
    console.error('Only one target directory may be given.');
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const target = parsed.positionals[0] ?? 'viteburner-project';
  const targetDir = resolve(cwd, target);

  try {
    const result = await scaffold({ targetDir, force: parsed.values.force });
    const where = relative(cwd, result.targetDir) || '.';
    const packageManager = detectPackageManager();

    console.log(`Scaffolded ${result.packageName} in ${result.targetDir}`);
    console.log('');
    console.log('Next steps:');
    console.log(`  cd ${where}`);
    console.log(`  ${packageManager.install}`);
    console.log('  npm run dev');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
