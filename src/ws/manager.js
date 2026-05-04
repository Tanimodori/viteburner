import { WebSocket } from 'ws';
import { wsResponseSchema, pushFileResponseSchema, getFileResponseSchema, deleteFileResponseSchema, getFileNamesResponseSchema, getAllFilesResponseSchema, calculateRamResponseSchema, getDefinitionFileResponseSchema, } from './messages';
import { logger } from '@/console';
import { getWss, isWssReused } from './allocator';
export class WsManager {
    options;
    ws;
    wss;
    trackers;
    nextId;
    unregisters;
    _wssReady;
    constructor(options) {
        this.options = {
            timeout: 10000,
            tls: false,
            ...options,
        };
        this.trackers = [];
        this.nextId = 0;
        this.ws = undefined;
        this._wssReady = getWss(this.options.port, this.options.tls);
        this._wssReady.then((wss) => {
            this.wss = wss;
            this._registerHandler();
        });
        this.unregisters = [];
    }
    get connected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
    _registerHandler() {
        const _onConnected = (ws) => {
            this.ws = ws;
            ws.on('message', (response) => this.handleMessage(response));
        };
        const _onError = (e) => {
            const err = String(e);
            if (err.indexOf('EADDRINUSE') !== -1) {
                logger.error('ws', `fatal: port ${this.options.port} is already in use`);
                process.exit(1);
            }
            else {
                logger.error('ws', `${err}`);
            }
        };
        this.wss.on('connection', _onConnected);
        this.wss.on('error', _onError);
        this.unregisters.push(() => {
            this.wss.off('connection', _onConnected);
            this.wss.off('error', _onError);
        });
    }
    async onConnected(cb) {
        await this._wssReady;
        const handler = async (ws) => {
            // ensure ws is saved before any sendMessage calls
            this.ws = ws;
            const unregister = await cb(ws);
            unregister && this.unregisters.push(unregister);
        };
        this.wss.on('connection', handler);
        this.unregisters.push(() => {
            this.wss.off('connection', handler);
        });
    }
    async checkIfWssReused() {
        await this._wssReady;
        if (isWssReused() && this.wss.clients.size > 0) {
            for (const client of this.wss.clients) {
                this.ws = client;
            }
            this.wss.emit('connection', this.ws);
        }
    }
    handleMessage(response) {
        const parsed = wsResponseSchema.parse(JSON.parse(response.toString()));
        const { id, result, error } = parsed;
        if (!this.trackers[id]) {
            return;
        }
        // get those functions before deleting the tracker
        const { resolve, reject } = this.trackers[id];
        if (error) {
            reject(error);
        }
        resolve(result);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async sendMessage(options) {
        await this._wssReady;
        const params = options.params;
        // preflight check
        if (!this.ws || !this.connected) {
            throw new Error('No connection');
        }
        const id = ++this.nextId;
        // send message
        this.ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id,
            method: options.method,
            ...(params && { params }),
        }));
        // constructing the result
        const result = new Promise((resolve, reject) => {
            const onResolve = (data) => {
                try {
                    resolve(options.validator?.parse(data) ?? data);
                }
                catch (e) {
                    reject(e);
                }
                finally {
                    delete this.trackers[id];
                }
            };
            const onReject = (reason) => {
                delete this.trackers[id];
                reject(reason);
            };
            this.trackers[id] = {
                resolve: onResolve,
                reject: onReject,
            };
        });
        // timeout
        if (this.options.timeout) {
            setTimeout(() => {
                if (this.trackers[id]) {
                    this.trackers[id].reject(new Error(`Timeout after ${this.options.timeout}ms`));
                }
            }, this.options.timeout);
        }
        return result;
    }
    async pushFile(params) {
        return this.sendMessage({
            method: 'pushFile',
            params,
            validator: pushFileResponseSchema,
        });
    }
    async getFile(params) {
        return this.sendMessage({
            method: 'getFile',
            params,
            validator: getFileResponseSchema,
        });
    }
    async deleteFile(params) {
        return this.sendMessage({
            method: 'deleteFile',
            params,
            validator: deleteFileResponseSchema,
        });
    }
    async getFileNames(params) {
        return this.sendMessage({
            method: 'getFileNames',
            params,
            validator: getFileNamesResponseSchema,
        });
    }
    async getAllFiles(params) {
        return this.sendMessage({
            method: 'getAllFiles',
            params,
            validator: getAllFilesResponseSchema,
        });
    }
    async calculateRam(params) {
        return this.sendMessage({
            method: 'calculateRam',
            params,
            validator: calculateRamResponseSchema,
        });
    }
    async getDefinitionFile() {
        return this.sendMessage({
            method: 'getDefinitionFile',
            validator: getDefinitionFileResponseSchema,
        });
    }
    close() {
        // remove all handlers
        this.unregisters.forEach((unregister) => unregister());
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFXLFNBQVMsRUFBbUIsTUFBTSxJQUFJLENBQUM7QUFFekQsT0FBTyxFQUNMLGdCQUFnQixFQUVoQixzQkFBc0IsRUFDdEIscUJBQXFCLEVBR3JCLHdCQUF3QixFQUV4QiwwQkFBMEIsRUFFMUIseUJBQXlCLEVBRXpCLDBCQUEwQixFQUMxQiwrQkFBK0IsR0FDaEMsTUFBTSxZQUFZLENBQUM7QUFDcEIsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNuQyxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQXdCbEQsTUFBTSxPQUFPLFNBQVM7SUFDcEIsT0FBTyxDQUF1RDtJQUM5RCxFQUFFLENBQXdCO0lBQzFCLEdBQUcsQ0FBa0I7SUFDckIsUUFBUSxDQUFrQjtJQUMxQixNQUFNLENBQVM7SUFDZixXQUFXLENBQU87SUFDVixTQUFTLENBQTJCO0lBQzVDLFlBQVksT0FBeUI7UUFDbkMsSUFBSSxDQUFDLE9BQU8sR0FBRztZQUNiLE9BQU8sRUFBRSxLQUFLO1lBQ2QsR0FBRyxFQUFFLEtBQUs7WUFDVixHQUFHLE9BQU87U0FDWCxDQUFDO1FBQ0YsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFFLENBQUM7UUFDbkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDaEIsSUFBSSxDQUFDLEVBQUUsR0FBRyxTQUFTLENBQUM7UUFDcEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM3RCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFO1lBQzFCLElBQUksQ0FBQyxHQUFHLEdBQUcs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