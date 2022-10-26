import { ResolvedViteBurnerConfig, ViteBurnerConfig, WatchItem } from '@/types';
import { defaultUploadLocation, fixStartingSlash } from '..';

export function resolveWatchLocation(location: WatchItem['location']) {
  return (filename: string) => {
    // get all possible filenames
    const defaultFilename = defaultUploadLocation(filename);
    let result = location ?? 'home';
    if (typeof result === 'function') {
      const resolved = result(filename);
      if (!resolved) {
        return [];
      }
      result = resolved;
    }
    if (!Array.isArray(result)) {
      result = [result];
    }
    return result.map((r) => {
      const itemResult = {
        filename: defaultFilename,
        server: 'home',
        ...(typeof r === 'string' ? { server: r } : r),
      };
      itemResult.filename = fixStartingSlash(itemResult.filename);
      return itemResult;
    });
  };
}

export function resolveDts(dts: ViteBurnerConfig['dts']) {
  if (typeof dts === 'string') {
    return dts;
  } else if (dts === false) {
    return undefined;
  } else {
    return 'NetScriptDefinition.d.ts';
  }
}

export function resolveDumpFile(dumpFiles: ViteBurnerConfig['dumpFiles']) {
  if (typeof dumpFiles === 'string') {
    return (file: string) => dumpFiles + '/' + file;
  } else if (typeof dumpFiles === 'function') {
    return dumpFiles;
  } else {
    return undefined;
  }
}

export function resolveConfig(config: ViteBurnerConfig) {
  const watch = config.watch ?? [];
  const server = config.download?.server ?? 'home';

  const resolvedConfig: ResolvedViteBurnerConfig = {
    watch: watch.map((item) => ({
      pattern: item.pattern,
      transform: item.transform ?? true,
      location: resolveWatchLocation(item.location),
    })),
    sourcemap: config.sourcemap ?? false,
    port: config.port ?? 12525,
    timeout: config.timeout ?? 10000,
    dts: resolveDts(config.dts),
    ignoreInitial: config.ignoreInitial ?? false,
    download: {
      server: Array.isArray(server) ? server : [server],
      location: config?.download?.location ?? ((file) => 'src/' + file),
      ignoreTs: config?.download?.ignoreTs ?? true,
      ignoreSourcemap: config?.download?.ignoreSourcemap ?? true,
    },
    dumpFiles: resolveDumpFile(config.dumpFiles),
    cwd: config.cwd ?? process.cwd(),
  };
  return resolvedConfig;
}
