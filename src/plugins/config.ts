import { UserConfig } from 'vite';
import { ResolvedViteBurnerConfig } from '@/types';

export function configPlugin(resolvedConfig: ResolvedViteBurnerConfig) {
  return {
    name: 'viteburner:config',
    config(config: UserConfig) {
      config.viteburner = resolvedConfig;
    },
  };
}

export default configPlugin;
