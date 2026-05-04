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
            await this.getDts();
            await this.handleHmrMessage();
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