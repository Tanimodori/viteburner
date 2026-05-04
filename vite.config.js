import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'node:module';
import dts from 'vite-plugin-dts';
const externalModules = [
    // exclude all dependencies
    'acorn',
    'cac',
    'chokidar',
    'fast-glob',
    'magic-string',
    'micromatch',
    'pathe',
    'picocolors',
    'prompts',
    'unconfig',
    'vite',
    'ws',
    'zod',
    // node builtins
    ...builtinModules,
    // node builtins with prefix
    ...builtinModules.map((name) => `node:${name}`),
];
export default defineConfig({
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    build: {
        ssr: true,
        lib: {
            entry: {
                entry: resolve(__dirname, 'src/entry.ts'),
                index: resolve(__dirname, 'src/index.ts'),
            },
            fileName: '[name]',
            formats: ['cjs', 'es'],
        },
        rollupOptions: {
            external: (src) => {
                const name = src.split('/')[0];
                return externalModules.includes(name);
            },
        },
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
    },
    ssr: {
        noExternal: true,
    },
    plugins: [
        dts({
            include: 'src/**/*.ts',
            entryRoot: resolve(__dirname, 'src'),
            outputDir: resolve(__dirname, 'dist/typings'),
            rollupTypes: true,
        }),
    ],
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS5jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2aXRlLmNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3BDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDL0IsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUM3QyxPQUFPLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQztBQUVsQyxNQUFNLGVBQWUsR0FBRztJQUN0QiwyQkFBMkI7SUFDM0IsT0FBTztJQUNQLEtBQUs7SUFDTCxVQUFVO0lBQ1YsV0FBVztJQUNYLGNBQWM7SUFDZCxZQUFZO0lBQ1osT0FBTztJQUNQLFlBQVk7SUFDWixTQUFTO0lBQ1QsVUFBVTtJQUNWLE1BQU07SUFDTixJQUFJO0lBQ0osS0FBSztJQUNMLGdCQUFnQjtJQUNoQixHQUFHLGNBQWM7SUFDakIsNEJBQTRCO0lBQzVCLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQztDQUNoRCxDQUFDO0FBRUYsZUFBZSxZQUFZLENBQUM7SUFDMUIsT0FBTyxFQUFFO1FBQ1AsS0FBSyxFQUFFO1lBQ0wsR0FBRyxFQUFFLE9BQU8sQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDO1NBQy9CO0tBQ0Y7SUFDRCxLQUFLLEVBQUU7UUFDTCxHQUFHLEVBQUUsSUFBSTtRQUNULEdBQUcsRUFBRTtZQUNILEtBQUssRUFBRTtnQkFDTCxLQUFLLEVBQUUsT0FBTyxDQUFDLFNBQVMsRUFBRSxjQUFjLENBQUM7Z0JBQ3pDLEtBQUssRUFBRSxPQUFPLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQzthQUMxQztZQUNELFFBQVEsRUFBRSxRQUFRO1lBQ2xCLE9BQU8sRUFBRSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUM7U0FDdkI7UUFDRCxhQUFhLEVBQUU7WUFDYixRQUFRLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRTtnQkFDaEIsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDL0IsT0FBTyxlQUFlLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3hDLENBQUM7U0FDRjtRQUNELE1BQU0sRUFBRSxNQUFNO1FBQ2QsV0FBVyxFQUFFLElBQUk7UUFDakIsU0FBUyxFQUFFLEtBQUs7S0FDakI7SUFDRCxHQUFHLEVBQUU7UUFDSCxVQUFVLEVBQUUsSUFBSTtLQUNqQjtJQUNELE9BQU8sRUFBRTtRQUNQLEdBQUcsQ0FBQztZQUNGLE9BQU8sRUFBRSxhQUFhO1lBQ3RCLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQztZQUNwQyxTQUFTLEVBQUUsT0FBTyxDQUFDLFNBQVMsRUFBRSxjQUFjLENBQUM7WUFDN0MsV0FBVyxFQUFFLElBQUk7U0FDbEIsQ0FBQztLQUNIO0NBQ0YsQ0FBQyxDQUFDIn0=