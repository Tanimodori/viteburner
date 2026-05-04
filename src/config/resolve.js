import { defaultUploadLocation, fixStartingSlash } from '..';
export function resolveWatchLocation(location) {
    return (filename) => {
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
export function resolveDts(dts) {
    if (typeof dts === 'string') {
        return dts;
    }
    else if (dts === false) {
        return undefined;
    }
    else {
        return 'NetscriptDefinitions.d.ts';
    }
}
export function resolveDumpFile(dumpFiles) {
    if (typeof dumpFiles === 'string') {
        return (file) => dumpFiles + '/' + file;
    }
    else if (typeof dumpFiles === 'function') {
        return dumpFiles;
    }
    else {
        return undefined;
    }
}
export function resolvePolling(usePolling) {
    if (typeof usePolling === 'boolean') {
        return { usePolling, pollingOptions: {} };
    }
    else if (usePolling) {
        return { usePolling: true, pollingOptions: usePolling };
    }
    else {
        return { usePolling: false, pollingOptions: {} };
    }
}
export function resolveConfig(config) {
    const watch = config.watch ?? [];
    const server = config.download?.server ?? 'home';
    const resolvedConfig = {
        watch: watch.map((item) => ({
            pattern: item.pattern,
            transform: item.transform ?? false,
            location: resolveWatchLocation(item.location),
        })),
        ...resolvePolling(config.usePolling),
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
        tls: config.tls ?? false,
        cwd: config.cwd ?? process.cwd(),
    };
    return resolvedConfig;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb2x2ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJlc29sdmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLHFCQUFxQixFQUFFLGdCQUFnQixFQUFFLE1BQU0sSUFBSSxDQUFDO0FBRTdELE1BQU0sVUFBVSxvQkFBb0IsQ0FBQyxRQUErQjtJQUNsRSxPQUFPLENBQUMsUUFBZ0IsRUFBRSxFQUFFO1FBQzFCLDZCQUE2QjtRQUM3QixNQUFNLGVBQWUsR0FBRyxxQkFBcUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN4RCxJQUFJLE1BQU0sR0FBRyxRQUFRLElBQUksTUFBTSxDQUFDO1FBQ2hDLElBQUksT0FBTyxNQUFNLEtBQUssVUFBVSxFQUFFLENBQUM7WUFDakMsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2xDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDZCxPQUFPLEVBQUUsQ0FBQztZQUNaLENBQUM7WUFDRCxNQUFNLEdBQUcsUUFBUSxDQUFDO1FBQ3BCLENBQUM7UUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQzNCLE1BQU0sR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BCLENBQUM7UUFDRCxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUN0QixNQUFNLFVBQVUsR0FBRztnQkFDakIsUUFBUSxFQUFFLGVBQWU7Z0JBQ3pCLE1BQU0sRUFBRSxNQUFNO2dCQUNkLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDL0MsQ0FBQztZQUNGLFVBQVUsQ0FBQyxRQUFRLEdBQUcsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVE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