import type { ResolvedViteBurnerConfig } from 'viteburner';

/** The sample inputs the resolved config's function-valued fields are exercised with. */
export const SAMPLE_UPLOAD_FILE = 'src/sample.ts';
export const SAMPLE_DOWNLOAD_FILE = 'sample.ts';
export const SAMPLE_SERVER = 'home';

export interface WatchView {
  pattern: string;
  transform: boolean;
  location: { filename: string; server: string }[];
}

/**
 * A resolved config collapsed to plain data.
 *
 * Every field of {@link ResolvedViteBurnerConfig} is here, `cwd` excepted — it echoes the suite's own
 * directory, which the spec checks directly.
 */
export interface ResolvedView {
  watch: WatchView[];
  usePolling: boolean;
  pollingOptions: { interval?: number; binaryInterval?: number };
  sourcemap: boolean | 'inline' | 'hidden';
  port: number;
  timeout: number;
  dts?: string;
  ignoreInitial: boolean;
  download: {
    server: string[];
    location: string | null | undefined;
    ignoreTs: boolean;
    ignoreSourcemap: boolean;
  };
  dumpFiles?: string | null | undefined;
}

/**
 * Collapse a resolved config into plain data so two resolutions can be compared field by field.
 *
 * Resolution leaves behavior behind functions — each watch item's `location`, the download
 * `location`, and `dumpFiles` — so each is called here with the same sample inputs; every other
 * field is copied as-is. The fixture configs are written without functions precisely so this view is
 * the whole config: nothing about a resolution can hide behind a closure the comparison skips.
 */
export function viewResolved(config: ResolvedViteBurnerConfig): ResolvedView {
  return {
    watch: config.watch.map((item) => ({
      pattern: item.pattern,
      transform: item.transform,
      location: item.location(SAMPLE_UPLOAD_FILE),
    })),
    usePolling: config.usePolling,
    pollingOptions: config.pollingOptions,
    sourcemap: config.sourcemap,
    port: config.port,
    timeout: config.timeout,
    dts: config.dts,
    ignoreInitial: config.ignoreInitial,
    download: {
      server: config.download.server,
      location: config.download.location(SAMPLE_DOWNLOAD_FILE, SAMPLE_SERVER),
      ignoreTs: config.download.ignoreTs,
      ignoreSourcemap: config.download.ignoreSourcemap,
    },
    dumpFiles: config.dumpFiles ? config.dumpFiles(SAMPLE_UPLOAD_FILE, SAMPLE_SERVER) : undefined,
  };
}
