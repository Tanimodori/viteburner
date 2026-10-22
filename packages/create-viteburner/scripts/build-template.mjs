import { defaultOutputTemplate, exportTemplate } from '../dist/index.mjs';

const result = await exportTemplate({ outDir: defaultOutputTemplate, clean: true });
console.log(`create-viteburner: wrote ${result.files.length} files to template (viteburner ^${result.version})`);
