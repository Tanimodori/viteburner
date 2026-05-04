import cac from 'cac';
import { logger } from './console';
import pkg from '../package.json';
import { createServer } from 'vite';
import { viteburnerPlugin } from './plugins/viteburner';
const cli = cac('viteburner');
cli
    .command('', 'start dev server')
    .alias('serve')
    .alias('dev')
    .option('--cwd <cwd>', 'Working directory')
    .option('--port <port>', 'Port to listen on')
    .action(startDev);
cli.help();
cli.version(pkg.version);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function startDev(options) {
    const cwd = options.cwd;
    const port = options.port;
    const resolveInlineConfig = {
        ...(cwd && { cwd }),
        ...(port && { port }),
    };
    logger.info('version', pkg.version);
    // create server
    logger.info('vite', 'creating dev server...');
    createServer({
        ...(cwd && { root: cwd }),
        viteburner: resolveInlineConfig,
        plugins: [viteburnerPlugin(resolveInlineConfig)],
    });
}
export async function main() {
    cli.parse();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sR0FBRyxNQUFNLEtBQUssQ0FBQztBQUN0QixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQ25DLE9BQU8sR0FBRyxNQUFNLGlCQUFpQixDQUFDO0FBRWxDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDcEMsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFFeEQsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBRTlCLEdBQUc7S0FDQSxPQUFPLENBQUMsRUFBRSxFQUFFLGtCQUFrQixDQUFDO0tBQy9CLEtBQUssQ0FBQyxPQUFPLENBQUM7S0FDZCxLQUFLLENBQUMsS0FBSyxDQUFDO0tBQ1osTUFBTSxDQUFDLGFBQWEsRUFBRSxtQkFBbUIsQ0FBQztLQUMxQyxNQUFNLENBQUMsZUFBZSxFQUFFLG1CQUFtQixDQUFDO0tBQzVDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUVwQixHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7QUFFWCxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUV6Qiw4REFBOEQ7QUFDOUQsTUFBTSxDQUFDLEtBQUssVUFBVSxRQUFRLENBQUMsT0FBWTtJQUN6QyxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDO0lBQ3hCLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDMUIsTUFBTSxtQkFBbUIsR0FBMkI7UUFDbEQsR0FBRyxDQUFDLEdBQUcsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ25CLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQztLQUN0QixDQUFDO0lBRUYsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRXBDLGdCQUFnQjtJQUNoQixNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO0lBQzlDLFlBQVksQ0FBQztRQUNYLEdBQUcsQ0FBQyxHQUFHLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUM7UUFDekIsVUFBVSxFQUFFLG1CQUFtQjtRQUMvQixPQUFPLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0tBQ2pELENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxNQUFNLENBQUMsS0FBSyxVQUFVLElBQUk7SUFDeEIsR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDO0FBQ2QsQ0FBQyJ9