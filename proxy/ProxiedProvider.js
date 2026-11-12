const { providers } = require('tronweb/dist/TronWeb.js')
import axios from 'axios';

const { HttpProvider } = providers;

const QUEUE_TIMEOUT = 30000; // 30s timeout for queued requests
const MAX_QUEUE_SIZE = 100;

class ProxiedProvider extends HttpProvider {
    constructor(url) {
        super(url);
        this.ready = false;
        this.queue = [];
    }

    configure(url) {
        this.host = url;
        this.instance = axios.create({
            baseURL: url,
            timeout: 30000
        });

        this.ready = true;

        while (this.queue.length) {
            const { args, resolve, reject } = this.queue.shift();
            this.request(...args)
                .then(resolve)
                .catch(reject);
        }
    }

    request(endpoint, payload = {}, method = 'get') {
        if (!this.ready) {
            if (this.queue.length >= MAX_QUEUE_SIZE) {
                return Promise.reject(new Error('Provider request queue is full.'));
            }

            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    const idx = this.queue.findIndex(item => item.resolve === resolve);
                    if (idx !== -1) {
                        this.queue.splice(idx, 1);
                    }
                    reject(new Error('Provider request timed out waiting for configuration.'));
                }, QUEUE_TIMEOUT);

                this.queue.push({
                    args: [endpoint, payload, method],
                    resolve: (val) => { clearTimeout(timer); resolve(val); },
                    reject: (err) => { clearTimeout(timer); reject(err); }
                });
            });
        }

        return super.request(endpoint, payload, method).then(res => {
            const payloadDesc = {
                writable: false,
                enumerable: false,
                configurable: false,
                value: payload
            };

            Object.defineProperty(res, '__payload__', payloadDesc);
            if (res.transaction && typeof res.transaction === 'object') {
                Object.defineProperty(res.transaction, '__payload__', payloadDesc);
            }

            return res;
        });
    }
}

export default ProxiedProvider;
