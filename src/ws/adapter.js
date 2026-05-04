import { getSourceMapString, logger, writeFile, isScriptFile, fixStartingSlash, forceStartingSlash, removeStartingSlash, } from '..';
import fs from 'fs';
import pc from 'picocolors';
import path, { relative, resolve } from 'path';
import { slash } from 'vite-node/utils';
import fg from 'fast-glob';
import { fixImportPath } from './import';
import { match } from 'micromatch';
export const formatUpload = (from, to, serverName) => {
    to = forceStartingSlash(to);
    const dest = `@${serverName}:${to}`;
    return {
        styled: `${pc.dim(from)} ${pc.reset('->')} ${pc.dim(dest)}`,
        raw: `${from} -> ${dest}`,
    };
};
export const formatDownload = (from, to, serverName) => {
    to = removeStartingSlash(to);
    const src = `@${serverName}:/${from}`;
    return {
        styled: `${pc.dim(src)} ${pc.reset('->')} ${pc.dim(to)}`,
        raw: `${src} -> ${to}`,
    };
};
export const defaultDownloadLocation = (file) => {
    return 'src/' + file;
};
export const defaultDts = 'NetscriptDefinitions.d.ts';
export class WsAdapter {
    buffers = new Map();
    manager;
    server;
    constructor(manager, server) {
        this.manager = manager;
        this.server = server;
        this.manager.onConnected(async (ws) => {
            logger.info('conn', '', 'connected');
            const handler = () => {
                logger.info('conn', '', pc.yellow('disconnected'));
            };
            ws.on('close', handler);
            await this._wssReady;
            await this.getDts();
            await this.server.watchManager.fullReload();
            return () => {
                ws.off('close', handler);
            };
        });
        this.manager.checkIfWssReused();
    }
    async getDts() {
        const filename = this.server.config.viteburner.dts;
        if (!filename) {
            return;
        }
        try {
            const data = await this.manager.getDefinitionFile();
            const root = this.server.config.root;
            const fullpath = path.resolve(root, filename);
            await writeFile(fullpath, data);
            logger.info('dts change', filename);
        }
        catch (e) {
            logger.error(`error getting dts file: ${e}`);
        }
    }
    async checkDependencies(data) {
        for (const item of data) {
            // change won't affect import glob generated files, skippping
            if (item.event === 'change') {
                continue;
            }
            const resolvedFile = slash(resolve(this.server.config.root, item.file));
            this.server._importGlobMap?.forEach((value, key) => {
                if (value.some((pattern) => match([resolvedFile], pattern).length > 0)) {
                    // push key to data
                    const importer = slash(relative(this.server.config.root, key));
                    // recursive import, skipping
                    if (data.some((item) => item.file === importer)) {
                        return;
                    }
                    const importerData = this.server.watchManager.findItem(importer);
                    if (importerData?.transform) {
                        data.push({
                            file: importer,
                            timestamp: item.timestamp,
                            initial: item.initial,
                            event: 'change',
                            ...importerData,
                        });
                    }
                }
            });
        }
        return data;
    }
    async handleHmrMessage(data) {
        if (!data) {
            data = [];
        }
        else if (!Array.isArray(data)) {
            data = [data];
        }
        // check deps
        data = await this.checkDependencies(data);
        const connected = this.manager.connected;
        for (const item of data) {
            this.buffers.set(item.file, item);
            logger.info(`hmr ${item.event}`, item.file, pc.yellow('(pending)'));
        }
        if (!connected) {
            return;
        }
        // transmit buffered data
        if (this.buffers.size) {
            for (const item of this.buffers.values()) {
                await this.uploadFile(item);
            }
        }
    }
    deleteCache(data) {
        const currentData = this.buffers.get(data.file);
        if (currentData && data.timestamp === currentData.timestamp) {
            this.buffers.delete(data.file);
        }
    }
    async dumpFile(data, content, server) {
        const relative = this.server.config.viteburner.dumpFiles?.(data.file, server);
        if (!relative) {
            return;
        }
        const fullpath = path.resolve(this.server.config.root, relative);
        await writeFile(fullpath, content);
        logger.info('dump', formatUpload(data.file, slash(relative), server).styled);
    }
    async fetchModule(data) {
        let content = '';
        if (data.transform) {
            this.server.invalidateFile(data.file);
            const module = await this.server.fetchModule(data.file);
            if (!module) {
                throw new Error('module not found: ' + data.file);
            }
            content = module.code;
            if (this.server.config.viteburner.sourcemap === 'inline' && module.map) {
                content += getSourceMapString(module.map);
            }
        }
        else {
            const buffer = await fs.promises.readFile(path.resolve(this.server.config.root, data.file));
            content = buffer.toString();
        }
        return content;
    }
    fixImport(content, data, serverName) {
        if (data.transform) {
            return fixImportPath({
                content,
                filename: data.file,
                server: serverName,
                manager: this.server.watchManager,
            });
        }
        else {
            return content;
        }
    }
    async uploadFile(data) {
        // check timestamp and clear cache to prevent repeated entries
        this.deleteCache(data);
        // if true, we need to transmit the file
        const isAdd = data.event !== 'unlink';
        // try to get the file content
        let content = '';
        if (isAdd) {
            try {
                content = await this.fetchModule(data);
            }
            catch (e) {
                logger.error(String(e));
                return;
            }
        }
        // resolve actual filename and servers
        const payloads = this.server.watchManager.getUploadFilenames(data.file);
        // no payload, skip
        if (!payloads.length) {
            logger.info(`hmr ${data.event}`, data.file, pc.dim('(ignored)'));
            return;
        }
        // for each payload execute upload/delete tasks
        for (const { filename, server: serverName } of payloads) {
            const fileChangeStrs = formatUpload(data.file, filename, serverName);
            try {
                if (isAdd) {
                    // fix import path
                    if (data.transform) {
                        content = this.fixImport(content, data, serverName);
                    }
                    // dump file
                    this.dumpFile(data, content, serverName);
                    await this.manager.pushFile({
                        filename,
                        content,
                        server: serverName,
                    });
                }
                else {
                    await this.manager.deleteFile({
                        filename,
                        server: serverName,
                    });
                }
                logger.info(`hmr ${data.event}`, fileChangeStrs.styled, pc.green('(done)'));
            }
            catch (e) {
                logger.error(`error ${data.event}: ${fileChangeStrs.raw} ${e}`);
                logger.error(`hmr ${data.event} ${data.file} (error)`);
                continue;
            }
        }
    }
    async fullDownload() {
        // stop watching
        logger.info('vite', pc.reset('stop watching for file changes while downloading'));
        this.server.watchManager.setEnabled(false);
        // get servers
        const servers = this.server.config.viteburner.download.server;
        // get files
        const filesMap = new Map();
        for (const server of servers) {
            try {
                filesMap.set(server, await this.manager.getAllFiles({ server }));
            }
            catch (e) {
                logger.error(`error: connot get filelist from server ${server}: ${e}`);
                continue;
            }
        }
        for (const [server, files] of filesMap) {
            const { location: locationFn, ignoreTs, ignoreSourcemap } = this.server.config.viteburner.download;
            for (const file of files) {
                file.filename = removeStartingSlash(file.filename);
                const location = locationFn(file.filename, server);
                if (!location) {
                    logger.info(`download`, `@${server}:/${file.filename}`, pc.dim('(ignored)'));
                    continue;
                }
                const resolvedLocation = resolve(this.server.config.root, location);
                const fileChangeStrs = formatDownload(file.filename, location, server);
                try {
                    // ignoreTs
                    const isIgnoreTs = () => {
                        return (ignoreTs &&
                            resolvedLocation.endsWith('.js') &&
                            fs.existsSync(resolvedLocation.substring(0, resolvedLocation.length - 3) + '.ts'));
                    };
                    // ignoreSourcemap
                    const isIgnoreSourceMap = () => {
                        return ignoreSourcemap && file.content.match(/\/\/# sourceMappingURL=\S+\s*$/g);
                    };
                    if (isIgnoreTs() || isIgnoreSourceMap()) {
                        logger.info(`download`, fileChangeStrs.styled, pc.dim('(ignored)'));
                        continue;
                    }
                    // copy
                    await writeFile(resolvedLocation, file.content);
                    logger.info(`download`, fileChangeStrs.styled, pc.green('(done)'));
                }
                catch (e) {
                    logger.error(`download`, fileChangeStrs.raw, `(${e})`);
                }
            }
        }
        logger.info('vite', pc.reset('download completed, watching for file changes...'));
        this.server.watchManager.setEnabled(true);
    }
    async getRamUsage(pattern) {
        // get patterns
        const patterns = pattern ?? this.server.watchManager.patterns;
        if (!patterns) {
            logger.warn('ram', 'no pattern found');
            return;
        }
        // get files
        const files = await fg(patterns, { cwd: this.server.config.root });
        if (files.length === 0) {
            logger.warn('ram', 'no file found');
            return;
        }
        files.sort();
        // get ram usage
        for (const file of files) {
            await this.getRamUsageLocal(file);
        }
    }
    getRamUsageLocalData(file) {
        return this.server.watchManager.getUploadFilenames(file);
    }
    async getRamUsageLocalRaw(file, resolvedData) {
        // loop through all resolved data
        let isScript = false;
        let ramUsage = -1;
        if (resolvedData.length === 0) {
            logger.info('ram', `${file} (ignored)`);
            return true;
        }
        for (const { filename, server } of resolvedData) {
            const formatUploadStrs = formatUpload(file, filename, server);
            // if not a scipt file after filename resolve, skip
            if (!isScriptFile(filename)) {
                continue;
            }
            // if it is mapped as a script file, mark it
            isScript = true;
            try {
                ramUsage = await this.manager.calculateRam({ filename, server });
                logger.info('ram', pc.reset(`${file}: ${ramUsage} GB`));
                break; // resolved
            }
            catch (e) {
                logger.warn(`ram`, formatUploadStrs.raw, `(${e})`);
            }
        }
        // if isScript is true and no ramUsage fetched
        // throws an error
        if (isScript) {
            if (ramUsage === -1) {
                logger.warn(`ram`, file, `(no target found)`);
                return false;
            }
        }
        else {
            // not a script, print an ignore message
            logger.info('ram', file, pc.dim('(ignored)'));
        }
        return true;
    }
    async getRamUsageLocal(file) {
        const resolvedData = this.getRamUsageLocalData(file);
        return this.getRamUsageLocalRaw(file, resolvedData);
    }
    async getRamUsageRemote(server, filename) {
        const resolvedFilename = fixStartingSlash(filename);
        logger.info('ram', pc.reset('fetching ram usage of scripts...'));
        try {
            const ramUsage = await this.manager.calculateRam({ filename: resolvedFilename, server });
            logger.info('ram', pc.reset(`@${server}/${filename}: ${ramUsage} GB`));
        }
        catch (e) {
            logger.error(`ram`, `@${server}/${filename}: ${e}`);
        }
    }
    async getFileNames(server) {
        try {
            const filenames = await this.manager.getFileNames({ server });
            return filenames.map(removeStartingSlash);
        }
        catch (e) {
            logger.error(`list`, `cannot fetch filenames from server ${server}: ${e}`);
            return null;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLGtCQUFrQixFQUNsQixNQUFNLEVBQ04sU0FBUyxFQUNULFlBQVksRUFDWixnQkFBZ0IsRUFDaEIsa0JBQWtCLEVBQ2xCLG1CQUFtQixHQUNwQixNQUFNLElBQUksQ0FBQztBQUVaLE9BQU8sRUFBRSxNQUFNLElBQUksQ0FBQztBQUNwQixPQUFPLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDNUIsT0FBTyxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQy9DLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUN4QyxPQUFPLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDM0IsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUV6QyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRW5DLE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBRyxDQUFDLElBQVksRUFBRSxFQUFVLEVBQUUsVUFBa0IsRUFBRSxFQUFFO0lBQzNFLEVBQUUsR0FBRyxrQkFBa0IsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUM1QixNQUFNLElBQUksR0FBRyxJQUFJLFVBQVUsSUFBSSxFQUFFLEVBQUUsQ0FBQztJQUNwQyxPQUFPO1FBQ0wsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDM0QsR0FBRyxFQUFFLEdBQUcsSUFBSSxPQUFPLElBQUksRUFBRTtLQUMxQixDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBRUYsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLENBQUMsSUFBWSxFQUFF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