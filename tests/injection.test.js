import state from '../src/state';
import { exposeTronWeb, injectTronWeb, requestAccount } from '../src/injection';
import { ChainIds, netWorks } from '../src/constants';

beforeEach(() => {
    // Reset state
    const { TronWeb } = require('tronweb/dist/TronWeb.js');
    state.tronWeb = new TronWeb({ fullNode: {}, solidityNode: {}, eventServer: {} });
    state.cNetwork = 'MainNet';
    state.httpUrl = netWorks.MainNet;
    state.connected = false;
    state.account = '';
    state.ee.removeAllListeners();

    // Set up minimal window.tronLink and window.tron
    window.tronLink = { ready: false };
    window.tron = { ready: false };

    window.iTron = {
        requestAddress: jest.fn((cbName) => {
            setTimeout(() => window[cbName]('TNewAddr999'), 10);
        }),
    };
});

afterEach(() => {
    delete window.iTron;
    delete window.tronWeb;
    Object.keys(window).forEach((key) => {
        if (key.startsWith('__')) delete window[key];
    });
});

describe('injectTronWeb', () => {
    test('sets address and ready state when given an address', () => {
        injectTronWeb('TTestAddr');
        expect(state.tronWeb.defaultAddress.base58).toBe('TTestAddr');
        expect(state.tronWeb.ready).toBe(true);
        expect(window.tronWeb).toBe(state.tronWeb);
        expect(window.tronLink.ready).toBe(true);
        expect(window.tron.ready).toBe(true);
        expect(state.connected).toBe(true);
    });

    test('does nothing if no address given', () => {
        injectTronWeb();
        expect(state.tronWeb.ready).toBeFalsy();
        expect(state.connected).toBe(false);
        expect(window.tronWeb).toBeUndefined();
    });

    test('emits connect event when address is provided', () => {
        const handler = jest.fn();
        state.ee.on('connect', handler);
        injectTronWeb('TTestAddr');
        expect(handler).toHaveBeenCalledWith({ chainId: ChainIds.MainNet });
    });
});

describe('exposeTronWeb', () => {
    test('exposes window.tronWeb only, without connecting', () => {
        const handler = jest.fn();
        state.ee.on('connect', handler);
        exposeTronWeb();
        expect(window.tronWeb).toBe(state.tronWeb);
        expect(window.tronLink.tronWeb).toBeUndefined();
        expect(window.tron.tronWeb).toBeUndefined();
        expect(state.tronWeb.ready).toBe(false);
        expect(state.connected).toBe(false);
        expect(handler).not.toHaveBeenCalled();
    });
});

describe('requestAccount', () => {
    test('tronLink type resolves with code 200', async () => {
        const result = await requestAccount('tronLink');
        expect(result).toEqual({ code: 200, message: 'User allowed the request.' });
    });

    test('tron type resolves with address array', async () => {
        const result = await requestAccount('tron');
        expect(result).toEqual(['TNewAddr999']);
    });

    test('rejects with USER_REJECTED for invalid address', async () => {
        window.iTron.requestAddress = jest.fn((cbName) => {
            setTimeout(() => window[cbName]('invalid'), 10);
        });
        await expect(requestAccount('tron')).rejects.toEqual(
            expect.objectContaining({ code: 4001 })
        );
    });

    test('concurrent requests share a single native prompt', async () => {
        const [tronResult, tronLinkResult] = await Promise.all([
            requestAccount('tron'),
            requestAccount('tronLink'),
        ]);
        expect(window.iTron.requestAddress).toHaveBeenCalledTimes(1);
        expect(tronResult).toEqual(['TNewAddr999']);
        expect(tronLinkResult).toEqual({ code: 200, message: 'User allowed the request.' });
    });

    test('a new request after the previous one is rejected prompts again', async () => {
        window.iTron.requestAddress = jest.fn((cbName) => {
            setTimeout(() => window[cbName]('invalid'), 10);
        });
        await expect(requestAccount('tron')).rejects.toEqual(
            expect.objectContaining({ code: 4001 })
        );
        await expect(requestAccount('tron')).rejects.toEqual(
            expect.objectContaining({ code: 4001 })
        );
        expect(window.iTron.requestAddress).toHaveBeenCalledTimes(2);
    });

    test('resolves even if a connect listener throws', async () => {
        state.ee.on('connect', () => { throw new Error('dapp listener error'); });
        window.iTron.requestAddress = jest.fn((cbName) => {
            setTimeout(() => {
                expect(() => window[cbName]('TNewAddr999')).toThrow('dapp listener error');
            }, 10);
        });
        await expect(requestAccount('tron')).resolves.toEqual(['TNewAddr999']);
        expect(state.connected).toBe(true);
    });

    test('rejects if connection setup is interrupted', async () => {
        state.tronWeb.setAddress = () => { throw new Error('dapp addressChanged listener error'); };
        window.iTron.requestAddress = jest.fn((cbName) => {
            setTimeout(() => {
                expect(() => window[cbName]('TNewAddr999')).toThrow('dapp addressChanged listener error');
            }, 10);
        });
        await expect(requestAccount('tron')).rejects.toThrow('dapp addressChanged listener error');
        expect(state.connected).toBe(false);
    });

    test('asks the App again when already connected', async () => {
        const handler = jest.fn();
        state.ee.on('connect', handler);
        await expect(requestAccount('tron')).resolves.toEqual(['TNewAddr999']);
        await expect(requestAccount('tron')).resolves.toEqual(['TNewAddr999']);
        expect(window.iTron.requestAddress).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test('emits connect again when the App returns a different account', async () => {
        const handler = jest.fn();
        state.ee.on('connect', handler);
        await requestAccount('tron');
        window.iTron.requestAddress = jest.fn((cbName) => {
            setTimeout(() => window[cbName]('TSwitchedAddr'), 10);
        });
        await expect(requestAccount('tron')).resolves.toEqual(['TSwitchedAddr']);
        expect(handler).toHaveBeenCalledTimes(2);
    });

    test('a connect listener that requests accounts does not loop', async () => {
        state.ee.on('connect', () => {
            setTimeout(() => requestAccount('tron'), 0);
        });
        await requestAccount('tron');
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(window.iTron.requestAddress).toHaveBeenCalledTimes(2);
    });

    test('a connect listener that queries another account, then confirms, does not loop', async () => {
        const handler = jest.fn(() => {
            state.tronWeb.setAddress('TOtherAddr');
            setTimeout(() => requestAccount('tron'), 0);
        });
        state.ee.on('connect', handler);
        await requestAccount('tron');
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(window.iTron.requestAddress).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(state.tronWeb.defaultAddress.base58).toBe('TNewAddr999');
    });

    test('a request started by a listener during a synchronous App reply is shared by later requests', async () => {
        const queued = [];
        let immediate = true;
        window.iTron.requestAddress = jest.fn((cbName) => {
            if (immediate) {
                immediate = false;
                window[cbName]('TNewAddr999');
            } else {
                queued.push(cbName);
            }
        });
        let nested;
        state.ee.on('connect', () => { nested = requestAccount('tron'); });
        await requestAccount('tron');
        const follower = requestAccount('tron');
        expect(window.iTron.requestAddress).toHaveBeenCalledTimes(2);
        queued.forEach((cbName) => window[cbName]('TNewAddr999'));
        await expect(Promise.all([nested, follower])).resolves.toEqual([['TNewAddr999'], ['TNewAddr999']]);
    });

    test('keeps the listener context and once semantics of the event emitter', async () => {
        const model = { seen: 0, update() { this.seen += 1; } };
        const once = jest.fn();
        state.ee.on('connect', function () { this.update(); }, model);
        state.ee.once('connect', once);
        await requestAccount('tron');
        window.iTron.requestAddress = jest.fn((cbName) => {
            setTimeout(() => window[cbName]('TSwitchedAddr'), 10);
        });
        await requestAccount('tron');
        expect(model.seen).toBe(2);
        expect(once).toHaveBeenCalledTimes(1);
    });

    test.each(['tron', 'tronLink'])('a listener that changes the address and confirms at once gets the App address back (%s)', async (type) => {
        let nested;
        const handler = jest.fn(() => {
            state.tronWeb.setAddress('TOtherAddr');
            nested = requestAccount(type);
        });
        state.ee.on('connect', handler);
        await requestAccount(type);
        await nested;
        expect(window.iTron.requestAddress).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(state.tronWeb.defaultAddress.base58).toBe('TNewAddr999');
    });

    test('a listener that fails once does not keep the other listeners from being notified', async () => {
        const seen = jest.fn();
        function failOnce() {
            state.ee.removeListener('connect', failOnce);
            throw new Error('first observer failed once');
        }
        state.ee.on('connect', failOnce);
        state.ee.on('connect', seen);
        window.iTron.requestAddress = jest.fn((cbName) => {
            setTimeout(() => {
                try { window[cbName]('TNewAddr999'); } catch (e) { /* surfaces in the App */ }
            }, 10);
        });
        await expect(requestAccount('tron')).resolves.toEqual(['TNewAddr999']);
        expect(seen).toHaveBeenCalledTimes(1);
        await requestAccount('tron');
        expect(seen).toHaveBeenCalledTimes(1);
    });

    test('does not call setAddress again when the address is unchanged', async () => {
        await requestAccount('tron');
        const setAddress = jest.spyOn(state.tronWeb, 'setAddress');
        await requestAccount('tron');
        expect(setAddress).not.toHaveBeenCalled();
    });

    test('announces an account switch after an interrupted attempt is retried', async () => {
        const handler = jest.fn();
        state.ee.on('connect', handler);
        await requestAccount('tron');

        // tronweb sets defaultAddress before its 'addressChanged' listeners run
        const setAddress = state.tronWeb.setAddress.bind(state.tronWeb);
        state.tronWeb.setAddress = (addr) => {
            setAddress(addr);
            throw new Error('dapp addressChanged listener error');
        };
        window.iTron.requestAddress = jest.fn((cbName) => {
            setTimeout(() => {
                try { window[cbName]('TSwitchedAddr'); } catch (e) { /* surfaces in the App */ }
            }, 10);
        });
        await expect(requestAccount('tron')).rejects.toThrow('dapp addressChanged listener error');
        expect(handler).toHaveBeenCalledTimes(1);

        await expect(requestAccount('tron')).resolves.toEqual(['TSwitchedAddr']);
        expect(handler).toHaveBeenCalledTimes(2);
    });

    test('times out when the App never calls back, and the next request asks again', async () => {
        jest.useFakeTimers();
        try {
            window.iTron.requestAddress = jest.fn();
            const pending = requestAccount('tron');
            const assertion = expect(pending).rejects.toThrow('Request timed out.');
            jest.advanceTimersByTime(5 * 60 * 1000);
            await assertion;

            const cbName = window.iTron.requestAddress.mock.calls[0][0];
            expect(window[cbName]).toBeUndefined();
            requestAccount('tron').catch(() => {});
            expect(window.iTron.requestAddress).toHaveBeenCalledTimes(2);
            window[window.iTron.requestAddress.mock.calls[1][0]]('');
        } finally {
            jest.useRealTimers();
        }
    });

    test('rejects when the App bridge throws, and the next request works', async () => {
        window.iTron.requestAddress = jest.fn(() => { throw new Error('bridge error'); });
        await expect(requestAccount('tron')).rejects.toThrow('bridge error');
        window.iTron.requestAddress = jest.fn((cbName) => {
            setTimeout(() => window[cbName]('TNewAddr999'), 10);
        });
        await expect(requestAccount('tron')).resolves.toEqual(['TNewAddr999']);
    });

    test('rejects when the App bridge is missing', async () => {
        delete window.iTron;
        await expect(requestAccount('tron')).rejects.toThrow('unknown error');
    });

    test('a new request restores the App address after a DApp calls tronWeb.setAddress', async () => {
        await requestAccount('tron');
        state.tronWeb.setAddress('TOtherAddr');
        await expect(requestAccount('tron')).resolves.toEqual(['TNewAddr999']);
        expect(state.tronWeb.defaultAddress.base58).toBe('TNewAddr999');
    });
});


