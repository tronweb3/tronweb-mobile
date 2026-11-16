import EventEmitter from 'eventemitter3';

// EventEmitter whose emit() reaches every listener even if one of them throws; the first error is
// rethrown once all have run. Listeners are wrapped on registration so only the public API is used.
const guards = new WeakMap(); // listener -> guarded listener
let caught = null;            // errors collected by the emit() in progress

function guard(fn) {
    if (typeof fn !== 'function') return fn;
    if (!guards.has(fn)) {
        const guarded = function (...args) {
            try {
                return fn.apply(this, args);
            } catch (e) {
                if (!caught) throw e;
                caught.push(e);
            }
        };
        guarded.listener = fn;
        guards.set(fn, guarded);
    }
    return guards.get(fn);
}

class SafeEmitter extends EventEmitter {
    on(event, fn, context) {
        return super.on(event, guard(fn), context);
    }

    once(event, fn, context) {
        return super.once(event, guard(fn), context);
    }

    removeListener(event, fn, context, once) {
        return super.removeListener(event, guards.get(fn) || fn, context, once);
    }

    listeners(event) {
        return super.listeners(event).map((fn) => fn.listener || fn);
    }

    emit(...args) {
        const outer = caught;
        const errors = caught = [];
        try {
            const result = super.emit(...args);
            if (errors.length) throw errors[0];
            return result;
        } finally {
            caught = outer;
        }
    }
}
SafeEmitter.prototype.addListener = SafeEmitter.prototype.on;
SafeEmitter.prototype.off = SafeEmitter.prototype.removeListener;

// Shared mutable state across all modules
const state = {
    tronWeb: null,
    utils: null,       // TronWeb utils (for EIP712 etc.)
    cNetwork: '',      // current network name: 'MainNet' | 'NileNet' | 'ShastaNet'
    httpUrl: '',       // current full node HTTP URL
    connected: false,  // whether a DApp has connected
    account: '',       // last account announced through 'connect'
    ee: new SafeEmitter(),
};

export default state;
