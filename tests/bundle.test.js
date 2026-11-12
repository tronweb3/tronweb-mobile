// Loads src/index.js against the real tronweb dist (not the mock) to catch integration gaps.
const path = require('path');

const realTronWeb = path.resolve(__dirname, '../node_modules/tronweb/dist/TronWeb.js');

beforeEach(() => {
    window.iTron = { requestAddress: jest.fn() };
});

afterEach(() => {
    delete window.iTron;
    delete window.tronWeb;
});

test('page load with real TronWeb exposes tronWeb but does not connect', () => {
    jest.isolateModules(() => {
        jest.doMock('tronweb/dist/TronWeb.js', () => jest.requireActual(realTronWeb));
        require('../src/index');
    });
    expect(window.tronWeb.constructor.version).toBe(require(realTronWeb).TronWeb.version);
    expect(window.iTron.requestAddress).not.toHaveBeenCalled();
    expect(window.tronWeb.ready).toBeFalsy();
    expect(window.tronWeb.defaultAddress.base58).toBeFalsy();
    expect(window.tronLink.tronWeb).toBeUndefined();
    expect(window.tron.isConnected()).toBe(false);
});
