import fs from 'fs';
import path from 'path';
export function getSourceMapString(map) {
    if (!map)
        return '';
    const mapDataString = JSON.stringify(map);
    // splitted due to vite-node issue
    // https://github.com/vitest-dev/vitest/issues/2918
    const resultA = `//# sourceMappingURL=data:`;
    const resultB = `application/json;base64,${Buffer.from(mapDataString).toString('base64')}`;
    return resultA + resultB;
}
export async function writeFile(file, content) {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
    }
    return fs.promises.writeFile(file, content, {
        flag: 'w',
        encoding: 'utf8',
    });
}
export function isScriptFile(filename) {
    return filename.endsWith('.js') || filename.endsWith('.script');
}
/** Enforce starting slash */
export const forceStartingSlash = (s) => {
    return s.startsWith('/') ? s : '/' + s;
};
/** Enforce starting slash if file is not in root dir */
export const fixStartingSlash = (s) => {
    const index = s.lastIndexOf('/');
    if (index === 0) {
        // if file is in root dir with starting slash, remove it
        return s.substring(1);
    }
    else if (index !== -1) {
        // if file is not in root dir, add starting slash
        return forceStartingSlash(s);
    }
    else {
        // if file is in root dir without starting slash, keep it as-is
        return s;
    }
};
/** Remove starting slash on download */
export const removeStartingSlash = (s) => {
    return s.startsWith('/') ? s.substring(1) : s;
};
export const defaultUploadLocation = (file) => {
    return file.replace(/^src\//, '').replace(/\.ts$/, '.js');
};
// from vite packages\vite\src\node\utils.ts
export const externalRE = /^(https?:)?\/\//;
export const isExternalUrl = (url) => externalRE.test(url);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ1dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDcEIsT0FBTyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBRXhCLE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxHQUFzQjtJQUN2RCxJQUFJLENBQUMsR0FBRztRQUFFLE9BQU8sRUFBRSxDQUFDO0lBQ3BCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUMsa0NBQWtDO0lBQ2xDLG1EQUFtRDtJQUNuRCxNQUFNLE9BQU8sR0FBRyw0QkFBNEIsQ0FBQztJQUM3QyxNQUFNLE9BQU8sR0FBRywyQkFBMkIsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztJQUMzRixPQUFPLE9BQU8sR0FBRyxPQUFPLENBQUM7QUFDM0IsQ0FBQztBQUVELE1BQU0sQ0FBQyxLQUFLLFVBQVUsU0FBUyxDQUFDLElBQVksRUFBRSxPQUFlO0lBQzNELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0IsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUN4QixNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFDRCxPQUFPLEVBQUUsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7UUFDMUMsSUFBSSxFQUFFLEdBQUc7UUFDVCxRQUFRLEVBQUUsTUFBTTtLQUNqQixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsTUFBTSxVQUFVLFlBQVksQ0FBQyxRQUFnQjtJQUMzQyxPQUFPLFFBQVEsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNsRSxDQUFDO0FBRUQsNkJBQTZCO0FBQzdCLE1BQU0sQ0FBQyxNQUFNLGtCQUFrQixHQUFHLENBQUMsQ0FBUyxFQUFFLEVBQUU7SUFDOUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7QUFDekMsQ0FBQyxDQUFDO0FBRUYsd0RBQXdEO0FBQ3hELE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHLENBQUMsQ0FBUyxFQUFFLEVBQUU7SUFDNUMsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNqQyxJQUFJLEtBQUssS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUNoQix3REFBd0Q7UUFDeEQsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hCLENBQUM7U0FBTSxJQUFJLEtBQUssS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3hCLGlEQUFpRDtRQUNqRCxPQUFPLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQy9CLENBQUM7U0FBTSxDQUFDO1FBQ04sK0RBQStEO1FBQy9ELE9BQU8sQ0FBQyxDQUFDO0lBQ1gsQ0FBQztBQUNILENBQUMsQ0FBQztBQUVGLHdDQUF3QztBQUN4QyxNQUFNLENBQUMsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLENBQVMsRUFBRSxFQUFFO0lBQy9DLE9BQU8sQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hELENBQUMsQ0FBQztBQUVGLE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFHLENBQUMsSUFBWSxFQUFFLEVBQUU7SUFDcEQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzVELENBQUMsQ0FBQztBQUVGLDRDQUE0QztBQUM1QyxNQUFNLENBQUMsTUFBTSxVQUFVLEdBQUcsaUJBQWlCLENBQUM7QUFDNUMsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFHLENBQUMsR0FBVyxFQUFXLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDIn0=