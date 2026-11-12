import state from '../src/state';

describe('state', () => {
    test('initial state has correct shape', () => {
        expect(state).toHaveProperty('tronWeb', null);
        expect(state).toHaveProperty('utils', null);
        expect(state).toHaveProperty('cNetwork', '');
        expect(state).toHaveProperty('httpUrl', '');
        expect(state).toHaveProperty('connected', false);
        expect(state).toHaveProperty('account', '');
        expect(state).toHaveProperty('ee');
    });

    test('ee is an EventEmitter', () => {
        expect(typeof state.ee.on).toBe('function');
        expect(typeof state.ee.emit).toBe('function');
        expect(typeof state.ee.removeListener).toBe('function');
    });

    describe('ee', () => {
        afterEach(() => state.ee.removeAllListeners());

        test('emit reaches every listener and rethrows the first error', () => {
            const after = jest.fn();
            state.ee.on('connect', () => { throw new Error('first'); });
            state.ee.on('connect', () => { throw new Error('second'); });
            state.ee.on('connect', after);
            expect(() => state.ee.emit('connect', 1)).toThrow('first');
            expect(after).toHaveBeenCalledWith(1);
        });

        test('keeps context, once, removal and listener identity', () => {
            const model = { seen: 0 };
            const plain = jest.fn();
            const once = jest.fn();
            function withContext() { this.seen += 1; }
            expect(state.ee.on('connect', withContext, model)).toBe(state.ee);
            state.ee.addListener('connect', plain);
            state.ee.once('connect', once);
            expect(state.ee.listeners('connect')).toEqual([withContext, plain, once]);

            expect(state.ee.emit('connect')).toBe(true);
            state.ee.off('connect', plain);
            state.ee.emit('connect');

            expect(model.seen).toBe(2);
            expect(plain).toHaveBeenCalledTimes(1);
            expect(once).toHaveBeenCalledTimes(1);
            expect(state.ee.listenerCount('connect')).toBe(1);
            state.ee.removeListener('connect', withContext);
            expect(state.ee.emit('connect')).toBe(false);
        });

        test('rejects a non-function listener like the base emitter', () => {
            expect(() => state.ee.on('connect', 'nope')).toThrow(TypeError);
        });
    });

    test('state is mutable', () => {
        state.connected = true;
        expect(state.connected).toBe(true);
        state.connected = false;
    });
});
