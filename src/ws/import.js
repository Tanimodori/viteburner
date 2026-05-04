import { parse as acornParse } from 'acorn';
import MagicString from 'magic-string';
import { normalizeRequestId } from 'vite-node/utils';
import { logger } from '@/console';
import { isExternalUrl, forceStartingSlash } from '@/utils';
function parse(code) {
    return acornParse(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
    });
}
function getFilename(options, imports) {
    // Issue #8
    const realImports = normalizeRequestId(imports ?? options.filename);
    // external import, Issue #12
    if (isExternalUrl(realImports)) {
        return realImports;
    }
    const importPath = options.manager.getUploadFilenamesByServer(realImports, options.server);
    if (!importPath) {
        // warn user if upload filename is not found on server
        const warnInfo = imports
            ? `Path "${imports}" imported by "${options.filename}" not found on server "${options.server}"`
            : `File "${imports}" not found on server "${options.server}"`;
        logger.warn(`import`, warnInfo);
        logger.warn(`import`, `This may be a problem when the script is running on the server.`);
        return realImports;
    }
    else {
        return forceStartingSlash(importPath);
    }
}
/**
 * Converts absolute path to relative path by the watch options.
 * Vite resolves import path to absolute path to source file.
 * We need to convert it back to relative so the bitburner will like it.
 *
 * Vite add a trailing slash to the path, we need to remove it before converting.
 * We also need to returns a sourcemap.
 */
export function fixImportPath(options) {
    const magicString = new MagicString(options.content);
    const estree = parse(options.content);
    for (const statement of estree.body) {
        if (statement.type === 'ImportDeclaration') {
            const source = statement.source;
            const raw = source.raw;
            const value = source.value;
            // get the import path on the server
            const importPath = getFilename(options, value);
            // get the relative path
            const quote = raw[0];
            magicString.overwrite(source.start, source.end, quote + importPath + quote);
        }
    }
    // TODO: return sourcemap
    return magicString.toString();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wb3J0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaW1wb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxLQUFLLElBQUksVUFBVSxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBQzVDLE9BQU8sV0FBVyxNQUFNLGNBQWMsQ0FBQztBQUN2QyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRW5DLE9BQU8sRUFBRSxhQUFhLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxTQUFTLENBQUM7QUFTNUQsU0FBUyxLQUFLLENBQUMsSUFBWTtJQUN6QixPQUFPLFVBQVUsQ0FBQyxJQUFJLEVBQUU7UUFDdEIsV0FBVyxFQUFFLFFBQVE7UUFDckIsVUFBVSxFQUFFLFFBQVE7UUFDcEIsU0FBUyxFQUFFLElBQUk7S0FDaEIsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELFNBQVMsV0FBVyxDQUFDLE9BQTZCLEVBQUUsT0FBZ0I7SUFDbEUsV0FBVztJQUNYLE1BQU0sV0FBVyxHQUFHLGtCQUFrQixDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFFcEUsNkJBQTZCO0lBQzdCLElBQUksYUFBYSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7UUFDL0IsT0FBTyxXQUFXLENBQUM7SUFDckIsQ0FBQztJQUVELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsMEJBQTBCLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzRixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDaEIsc0RBQXNEO1FBQ3RELE1BQU0sUUFBUSxHQUFHLE9BQU87WUFDdEIsQ0FBQyxDQUFDLFNBQVMsT0FBTyxrQkFBa0IsT0FBTyxDQUFDLFFBQVEsMEJBQTBCLE9BQU8sQ0FBQyxNQUFNLEdBQUc7WUFDL0YsQ0FBQyxDQUFDLFNBQVMsT0FBTywwQkFBMEIsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDO1FBQ2hFLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ2hDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLGlFQUFpRSxDQUFDLENBQUM7UUFDekYsT0FBTyxXQUFXLENBQUM7SUFDckIsQ0FBQztTQUFNLENBQUM7UUFDTixPQUFPLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3hDLENBQUM7QUFDSCxDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILE1BQU0sVUFBVSxhQUFhLENBQUMsT0FBNkI7SUFDekQsTUFBTSxXQUFXLEdBQUcsSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3JELE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFdEMsS0FBSyxNQUFNLFNBQVMsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDcEMsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLG1CQUFtQixFQUFFLENBQUM7WUFDM0MsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQztZQUNoQyxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBYSxDQUFDO1lBQ2pDLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFlLENBQUM7WUFDckMsb0NBQW9DO1lBQ3BDLE1BQU0sVUFBVSxHQUFHLFdBQVcsQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDL0Msd0JBQXdCO1lBQ3hCLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNyQixXQUFXLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLEdBQUcsVUFBVSxHQUFHLEtBQUssQ0FBQyxDQUFDO1FBQzlFLENBQUM7SUFDSCxDQUFDO0lBRUQseUJBQXlCO0lBQ3pCLE9BQU8sV0FBVyxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQ2hDLENBQUMifQ==