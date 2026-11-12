import { version } from '../package.json';
import { ChainIds, RPC_ERRORS, netWorks, SIGN_TIMEOUT } from './constants';
import state from './state';

let _cbId = 0;
function genCallbackId(prefix) {
    return `__${prefix}_${++_cbId}_${Date.now()}__`;
}

// --- Expose window.tronWeb without an address; tronLink.tronWeb / tron.tronWeb are set on connect ---
export function exposeTronWeb() {
    const { tronWeb } = state;
    tronWeb.version = version;
    window.tronWeb = tronWeb;
}

// --- Core injection: set address on all providers ---
export function injectTronWeb(address, onReady) {
    const { tronWeb } = state;
    if (!address) return;

    // setAddress always fires tronWeb's 'addressChanged', so skip it when the address is already set
    const current = tronWeb.defaultAddress;
    if (current.base58 !== address && current.hex !== address) {
        tronWeb.setAddress(address);
    }
    tronWeb.ready = true;
    tronWeb.version = version;
    window.tronWeb = tronWeb;

    window.tronLink.tronWeb = tronWeb;
    window.tronLink.ready = true;

    window.tron.tronWeb = tronWeb;
    window.tron.ready = true;
    state.connected = true;

    // Setup is complete; a throwing DApp 'connect' listener below must not turn it into a failure
    if (onReady) onReady();
    // Announce each new connection or account exactly once. Compare with our own record, not with
    // tronWeb.defaultAddress: the DApp can change that, and an interrupted setup leaves it behind.
    const account = tronWeb.defaultAddress.base58;
    if (account !== state.account) {
        state.account = account;
        state.ee.emit('connect', { chainId: ChainIds[state.cNetwork] });
    }
}

// --- Account request (used by both tronLink and tron providers) ---
// Requests made while one is waiting for the App share its prompt instead of stacking popups.
let pendingAddress = null; // the request currently waiting for the App, if any

function requestAddressOnce() {
    if (pendingAddress) return pendingAddress;

    let settled = false;
    const request = new Promise((resolve, reject) => {
        const cbName = genCallbackId('reqAddr');

        const cleanup = () => {
            delete window[cbName];
        };

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            pendingAddress = null;
            reject(new Error('Request timed out.'));
        }, SIGN_TIMEOUT);

        window[cbName] = function (address) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            cleanup();
            // The wait is over: a request made from here on (e.g. by a listener below) asks the App again
            pendingAddress = null;

            const { tronWeb } = state;
            if (tronWeb.isAddress(address)) {
                // Fail if setup is interrupted (e.g. a throwing 'addressChanged' listener)
                try {
                    injectTronWeb(address, () => resolve(address));
                } catch (e) {
                    reject(e);
                    throw e;
                }
            } else {
                reject(RPC_ERRORS.USER_REJECTED);
            }
        };

        if (window.iTron && window.iTron.requestAddress) {
            try {
                window.iTron.requestAddress(cbName);
            } catch (e) {
                settled = true;
                clearTimeout(timer);
                cleanup();
                reject(e);
            }
        } else {
            settled = true;
            clearTimeout(timer);
            cleanup();
            reject(new Error('unknown error'));
        }
    });

    // Nothing to share if it already finished (the App answered synchronously, or the bridge failed)
    if (!settled) pendingAddress = request;
    return request;
}

export function requestAccount(type) {
    // Always ask the App, even when already connected, so the result is the App's current account
    return requestAddressOnce().then((address) => {
        if (type === 'tron') {
            return [address];
        }
        return { code: 200, message: 'User allowed the request.' };
    });
}

