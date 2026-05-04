import pc from 'picocolors';
import prompt from 'prompts';
import fg from 'fast-glob';
import fs from 'fs';
import { logger } from './console';
import { isScriptFile } from './utils';
import { resolve } from 'path';
export function displayKeyHelpHint() {
    logger.info('help', pc.dim('press ') +
        pc.reset(pc.bold('h')) +
        pc.dim(' to show help, press ') +
        pc.reset(pc.bold('q')) +
        pc.dim(' to exit'));
}
export function displayWatchAndHelp() {
    logger.info('vite', pc.reset('watching for file changes...'));
    displayKeyHelpHint();
}
export function handleKeyInput(wsAdapter) {
    const padding = 18;
    const printStatus = (tag, msg) => {
        logger.info('status', pc.reset(tag.padStart(padding)), msg);
    };
    const displayStatus = () => {
        logger.info('status');
        logger.info('status', ' '.repeat(padding - 4) + pc.reset(pc.bold(pc.inverse(pc.green(' STATUS ')))));
        printStatus('connection:', wsAdapter.manager.connected ? pc.green('connected') : pc.yellow('disconnected'));
        printStatus('port:', pc.magenta(wsAdapter.server.config.viteburner.port));
        const pending = wsAdapter.buffers.size;
        const pendingStr = `${pending} file${pending === 1 ? '' : 's'}`;
        const pendingStrStyled = pending ? pc.yellow(pendingStr) : pc.dim(pendingStr);
        printStatus('pending:', pendingStrStyled);
        logger.info('status', pc.dim('')); // avoid (x2)
    };
    displayStatus();
    displayWatchAndHelp();
    const displayHelp = () => {
        logger.info('help');
        const commands = [
            ['u', 'upload all files'],
            ['d', 'download all files'],
            ['s', 'show status'],
            ['r', 'show RAM usage of scripts'],
            ['q', 'quit'],
        ];
        logger.info('help', pc.reset(pc.bold('Watch Usage')));
        for (const [key, desc] of commands) {
            logger.info('help', `press ${pc.reset(pc.bold(key))}${pc.dim(' to ')}${desc}`);
        }
        logger.info('help', pc.dim('')); // avoid (x2)
    };
    const checkConnection = () => {
        if (!wsAdapter.manager.connected) {
            logger.error('conn', pc.red('no connection'));
            return false;
        }
        return true;
    };
    const fullUpload = () => {
        logger.info('upload', pc.reset('force full-upload triggered'));
        wsAdapter.server.watchManager.fullReload();
    };
    const fullDownload = () => {
        logger.info('download', pc.reset('force full-download triggered'));
        wsAdapter.fullDownload();
    };
    const showRamUsageAll = async () => {
        logger.info('ram', pc.reset('fetching ram usage of scripts...'));
        await wsAdapter.getRamUsage();
        return true;
    };
    const showRamUsageGlob = async () => {
        const { pattern } = await prompt({
            type: 'text',
            name: 'pattern',
            message: 'Enter a glob pattern',
            initial: 'src/**/*.{ts,js}',
        });
        if (!pattern) {
            return false;
        }
        logger.info('ram', pc.reset('fetching ram usage of scripts...'));
        await wsAdapter.getRamUsage(pattern);
        return true;
    };
    const showRamUsageLocal = async () => {
        const pattern = '**/*.{js,ts,script}';
        const files = await fg(pattern, { cwd: wsAdapter.server.config.root });
        files.sort();
        // filter out non-script files, dts, and deadends
        const fileMap = new Map();
        for (const file of files) {
            if (file.endsWith('.d.ts') || file === wsAdapter.server.config.viteburner.dts) {
                continue;
            }
            const resolvedData = wsAdapter.getRamUsageLocalData(file);
            if (resolvedData.length === 0) {
                continue;
            }
            fileMap.set(file, resolvedData);
        }
        const { file } = await prompt({
            type: 'autocomplete',
            name: 'file',
            message: 'Enter a filename',
            choices: [...fileMap.keys()].map((title) => ({ title })),
        });
        if (!file) {
            return false;
        }
        if (!fs.existsSync(resolve(wsAdapter.server.config.root, file))) {
            logger.error('ram', `file ${file} does not exist`);
            return false;
        }
        // check if file in filemap
        if (fileMap.has(file)) {
            await wsAdapter.getRamUsageLocalRaw(file, fileMap.get(file));
        }
        else {
            await wsAdapter.getRamUsageLocal(file);
        }
        return true;
    };
    const showRamUsageRemote = async () => {
        const { server } = await prompt({
            type: 'text',
            name: 'server',
            message: 'Enter a server name',
            initial: 'home',
        });
        if (!server) {
            return false;
        }
        const filenames = await wsAdapter.getFileNames(server);
        if (!filenames) {
            return false;
        }
        const { filename } = await prompt({
            type: 'autocomplete',
            name: 'filename',
            message: 'Enter a filename',
            choices: filenames.filter(isScriptFile).map((title) => ({ title })),
        });
        if (!filename) {
            return false;
        }
        await wsAdapter.getRamUsageRemote(server, filename);
        return true;
    };
    const showRamUsageRaw = async () => {
        const { filter } = await prompt({
            type: 'select',
            name: 'filter',
            message: 'Which script do you want to check?',
            initial: 0,
            choices: [
                { title: 'All local scripts', value: 'all' },
                { title: 'Filter local scripts by glob pattern', value: 'glob' },
                { title: 'Find a local script', value: 'local' },
                { title: 'Find a remote script', value: 'remote' },
            ],
        });
        if (!filter) {
            return false; // cancelled
        }
        if (filter === 'all') {
            return showRamUsageAll();
        }
        else if (filter === 'glob') {
            return showRamUsageGlob();
        }
        else if (filter === 'local') {
            return showRamUsageLocal();
        }
        else if (filter === 'remote') {
            return showRamUsageRemote();
        }
        return false;
    };
    const showRamUsage = async (ctx) => {
        ctx.off();
        const result = await showRamUsageRaw();
        if (result) {
            logger.info('ram', 'done');
        }
        else {
            logger.info('ram', 'cancelled');
        }
        ctx.on();
    };
    return async (ctx) => {
        const { key } = ctx;
        let isKeyHandled = true;
        if (key.name === 'q') {
            // q to quit
            logger.info('bye');
            process.exit();
        }
        else if (key.name === 's') {
            // s to show status
            displayStatus();
        }
        else if (key.name === 'h') {
            // h to show help
            displayHelp();
        }
        else if (key.name === 'u') {
            // u to update all
            checkConnection() && fullUpload();
        }
        else if (key.name === 'd') {
            // d to download all
            checkConnection() && fullDownload();
        }
        else if (key.name === 'r') {
            // f to show ram usage
            checkConnection() && (await showRamUsage(ctx));
        }
        else {
            isKeyHandled = false;
        }
        // tailing info
        if (isKeyHandled) {
            displayWatchAndHelp();
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFzay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInRhc2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzVCLE9BQU8sTUFBTSxNQUFNLFNBQVMsQ0FBQztBQUM3QixPQUFPLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDM0IsT0FBTyxFQUFFLE1BQU0sSUFBSSxDQUFDO0FBQ3BCLE9BQU8sRUFBc0MsTUFBTSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRXZFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxTQUFTLENBQUM7QUFDdkMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLE1BQU0sQ0FBQztBQUUvQixNQUFNLFVBQVUsa0JBQWtCO0lBQ2hDLE1BQU0sQ0FBQyxJQUFJLENBQ1QsTUFBTSxFQUNOLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO1FBQ2QsRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3RCLEVBQUUsQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUM7UUFDL0IsRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3RCLEVBQUUsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQ3JCLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxVQUFVLG1CQUFtQjtJQUNqQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUMsQ0FBQztJQUM5RCxrQkFBa0IsRUFBRSxDQUFDO0FBQ3ZCLENBQUM7QUFFRCxNQUFNLFVBQVUsY0FBYyxDQUFDLFNBQW9CO0lBQ2pELE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQztJQUNuQixNQUFNLFdBQVcsR0FBRyxDQUFDLEdBQVcsRUFBRSxHQUFXLEVBQUUsRUFBRTtRQUMvQyxNQUFN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