import { createServer as createHttpsServer } from 'https';
import { readFileSync } from 'fs';
import { join } from 'path';
import { WebSocketServer } from 'ws';
let reused = false;
let wss = null;
let wssPort = -1;
export function getWss(port, tls = false) {
    return new Promise((resolve) => {
        if (wss === null || wssPort !== port) {
            if (wss) {
                wss.clients.forEach((ws) => ws.close());
                wss.close();
            }
            wssPort = port;
            if (tls) {
                const certPath = join(__dirname, '../tls/cert.pem');
                const keyPath = join(__dirname, '../tls/key.pem');
                const httpsServer = createHttpsServer({
                    cert: readFileSync(certPath),
                    key: readFileSync(keyPath),
                });
                wss = new WebSocketServer({ server: httpsServer });
                httpsServer.listen(port, () => {
                    reused = false;
                    resolve(wss);
                });
            }
            else {
                wss = new WebSocketServer({ port });
                reused = false;
                resolve(wss);
            }
        }
        else {
            reused = true;
            resolve(wss);
        }
    });
}
export function isWssReused() {
    return reused;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxsb2NhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWxsb2NhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxZQUFZLElBQUksaUJBQWlCLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFDMUQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLElBQUksQ0FBQztBQUNsQyxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxlQUFlLEVBQWlCLE1BQU0sSUFBSSxDQUFDO0FBRXBELElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQztBQUNuQixJQUFJLEdBQUcsR0FBMkIsSUFBSSxDQUFDO0FBQ3ZDLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBRWpCLE1BQU0sVUFBVSxNQUFNLENBQUMsSUFBWSxFQUFFLEdBQUcsR0FBRyxLQUFLO0lBQzlDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtRQUM3QixJQUFJLEdBQUcsS0FBSyxJQUFJLElBQUksT0FBTyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3JDLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQ1IsR0FBRyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO2dCQUN4QyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDZCxDQUFDO1lBQ0QsT0FBTyxHQUFHLElBQUksQ0FBQztZQUVmLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQ1IsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO2dCQUNwRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxFQUFFLGdCQUFnQixDQUFDLENBQUM7Z0JBQ2xELE1BQU0sV0FBVyxHQUFHLGlCQUFpQixDQUFDO29CQUNwQyxJQUFJLEVBQUUsWUFBWSxDQUFDLFFBQVEsQ0FBQztvQkFDNUIsR0FBRyxFQUFFLFlBQVksQ0FBQyxPQUFPLENBQUM7aUJBQzNCLENBQUMsQ0FBQztnQkFDSCxHQUFHLEdBQUcsSUFBSSxlQUFlLENBQUMsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFtQixDQUFDLENBQUM7Z0JBQ3BFLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtvQkFDNUIsTUFBTSxHQUFHLEtBQUssQ0FBQztvQkFDZixPQUFPLENBQUMsR0FBSSxDQUFDLENBQUM7Z0JBQ2hCLENBQUMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLEdBQUcsR0FBRyxJQUFJLGVBQWUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7Z0JBQ3BDLE1BQU0sR0FBRyxLQUFLLENBQUM7Z0JBQ2YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2YsQ0FBQztRQUNILENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxHQUFHLElBQUksQ0FBQztZQUNkLE9BQU8sQ0FBQyxHQUFJLENBQUMsQ0FBQztRQUNoQixDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsTUFBTSxVQUFVLFdBQVc7SUFDekIsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQyJ9