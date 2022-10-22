import { ViteBurnerUserConfig } from '../src/config';

const config: ViteBurnerUserConfig = {
  watch: [{ pattern: 'src/**/*.{js,ts}', transform: true }, { pattern: 'src/**/*.{script,txt}' }],
  sourcemap: 'inline',
  dumpFiles: (file: string) => {
    return file.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js');
  },
};

export default config;
