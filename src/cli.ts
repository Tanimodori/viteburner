import { watch } from './watcher';
import cac from 'cac';
import { loadConfig, ViteBurnerInlineConfig } from './config';
import { formatNormal } from './console';
import pkg from '../package.json';

const cli = cac('viteburner');

cli
  .command('', 'start dev server')
  .alias('serve')
  .alias('dev')
  .option('--cwd <cwd>', 'Working directory', { default: process.cwd() });

cli.help();

cli.version(pkg.version);

export async function main() {
  const parsed = cli.parse();

  const resolveInlineConfig: ViteBurnerInlineConfig = {
    cwd: parsed.options.cwd,
  };

  // resolve config
  console.log(formatNormal('resolving user config...'));
  const config = await loadConfig(resolveInlineConfig);
  console.log(formatNormal('config resolved, starting dev server...'));

  watch({
    ...resolveInlineConfig,
    ...config,
  });
}

main();
