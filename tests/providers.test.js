import state from '../src/state';
import { ChainIds, RPC_ERRORS } from '../src/constants';
import { setupTronLinkProvider, setupTronProvider } from '../src/providers';

beforeEach(() => {
    const { TronWeb } = require('tronweb/dist/TronWeb.js');
    state.tronWeb = new TronWeb({ fullNode: {}, solidityNode: {}, eventServer: {} });
    state.tronWeb.setAddress('TProviderAddr');
    state.cNetwork = 'MainNet';
    state.connected = true;
    state.ee.removeAllListeners();

    window.iTron = {
        requestAddress: jest.fn((cbName) => {
            setTimeout(() => window[cbName]('TProviderAddr'), 10);
        }),
    };

    setupTronLinkProvider();
    setupTronProvider();
});

afterEach(() => {
    delete window.iTron;
    delete window.tronLink;
    delete window.tron;
    delete window.tronWeb;
    Object.keys(window).forEach((key) => {
        if (key.startsWith('__')) delete window[key];
    });
});

describe('window.tronLink', () => {
    test('has initial ready false', () => {
        expect(window.tronLink.ready).toBe(false);
    });

    test('tron_requestAccounts resolves on valid address', async () => {
        const result = await window.tronLink.request({ method: 'tron_requestAccounts' });
        expect(result).toEqual({ code: 200, message: 'User allowed the request.' });
    });

    test('unsupported method rejects', async () => {
        await expect(
            window.tronLink.request({ method: 'unknown_method' })
        ).rejects.toEqual(RPC_ERRORS.UNSUPPORTED_METHOD);
    });
});

describe('window.tron', () => {
    test('has initial structure', () => {
        expect(window.tron.ready).toBe(false);
        expect(window.tron.isTronLink).toBe(true);
        expect(typeof window.tron.on).toBe('function');
        expect(typeof window.tron.removeListener).toBe('function');
        expect(typeof window.tron.isConnected).toBe('function');
    });

    test('isConnected returns state.connected', () => {
        state.connected = true;
        expect(window.tron.isConnected()).toBe(true);
        state.connected = false;
        expect(window.tron.isConnected()).toBe(false);
    });

    test('eth_requestAccounts resolves with address array', async () => {
        const result = await window.tron.request({ method: 'eth_requestAccounts' });
        expect(result).toEqual(['TProviderAddr']);
    });

    test('wallet_switchEthereumChain rejects invalid params', async () => {
        await expect(
            window.tron.request({ method: 'wallet_switchEthereumChain' })
        ).rejects.toEqual(RPC_ERRORS.INVALID_PARAMS);
    });

    test('wallet_switchEthereumChain rejects unknown chainId', async () => {
        await expect(
            window.tron.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xdeadbeef' }],
            })
        ).rejects.toEqual(RPC_ERRORS.INVALID_CHAIN);
    });

    test('wallet_switchEthereumChain rejects with UNSUPPORTED for valid chainId', async () => {
        await expect(
            window.tron.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: ChainIds.NileNet }],
            })
        ).rejects.toEqual(RPC_ERRORS.UNSUPPORTED_METHOD);
    });

    test('unknown method rejects with UNSUPPORTED_METHOD', async () => {
        await expect(
            window.tron.request({ method: 'foo_bar' })
        ).rejects.toEqual(RPC_ERRORS.UNSUPPORTED_METHOD);
    });

    describe('eth_signTypedData', () => {
        const validParams = {
            domain: { name: 'TRON Mail', version: '1', chainId: '0x2b6653dc', verifyingContract: 'TUe6BwpA7sVTDKaJQoia7FWZpC9sK8WM2t' },
            types: { Mail: [{ name: 'contents', type: 'string' }] },
            message: { contents: 'Hello' },
        };

        beforeEach(() => {
            state.utils = {
                _TypedDataEncoder: {
                    getPrimaryType: (types) => Object.keys(types).filter(k => k !== 'EIP712Domain')[0] || '',
                },
            };
            window.iTron.sign = jest.fn((data, cbName) => {
                setTimeout(() => window[cbName]('0xtyped_sig'), 5);
            });
        });

        test('signs valid typed data', async () => {
            const result = await window.tron.request({ method: 'eth_signTypedData', params: validParams });
            expect(result).toBe('0xtyped_sig');
            expect(window.iTron.sign).toHaveBeenCalledTimes(1);
        });

        test('rejects when params is missing', async () => {
            await expect(
                window.tron.request({ method: 'eth_signTypedData' })
            ).rejects.toEqual(RPC_ERRORS.INVALID_PARAMS);
        });

        test('rejects when domain is missing', async () => {
            await expect(
                window.tron.request({ method: 'eth_signTypedData', params: { types: validParams.types, message: validParams.message } })
            ).rejects.toEqual(RPC_ERRORS.INVALID_PARAMS);
        });

        test('rejects when types is missing', async () => {
            await expect(
                window.tron.request({ method: 'eth_signTypedData', params: { domain: validParams.domain, message: validParams.message } })
            ).rejects.toEqual(RPC_ERRORS.INVALID_PARAMS);
        });

        test('rejects when message is missing', async () => {
            await expect(
                window.tron.request({ method: 'eth_signTypedData', params: { domain: validParams.domain, types: validParams.types } })
            ).rejects.toEqual(RPC_ERRORS.INVALID_PARAMS);
        });

        test('rejects when params is a string', async () => {
            await expect(
                window.tron.request({ method: 'eth_signTypedData', params: 'invalid' })
            ).rejects.toEqual(RPC_ERRORS.INVALID_PARAMS);
        });

        test('rejects when domain is not an object', async () => {
            await expect(
                window.tron.request({ method: 'eth_signTypedData', params: { domain: 'bad', types: validParams.types, message: validParams.message } })
            ).rejects.toEqual(RPC_ERRORS.INVALID_PARAMS);
        });
    });
});
