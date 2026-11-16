const { TronWeb, utils } = require('tronweb/dist/TronWeb.js');
import ProxiedProvider from '../proxy/ProxiedProvider';

import { netWorks } from './constants';
import state from './state';
import { applySignProxy } from './signing';
import { setupTronLinkProvider, setupTronProvider } from './providers';
import { exposeTronWeb } from './injection';
import { setupTip6963 } from './tip6963';

// --- Read native environment ---
const isTest = window.iTron && window.iTron.isTest ? window.iTron.isTest() : '';
const netWork = window.iTron && window.iTron.getCurrentNet ? window.iTron.getCurrentNet() : '';

const validNetwork = netWork && Object.prototype.hasOwnProperty.call(netWorks, netWork) ? netWork : null;
state.cNetwork = validNetwork || (isTest ? 'ShastaNet' : 'MainNet');
state.httpUrl = netWorks[state.cNetwork];
state.utils = utils;

// --- Create providers ---
const fullNode = new ProxiedProvider(state.httpUrl);
const solidityNode = new ProxiedProvider(state.httpUrl);
const eventServer = new ProxiedProvider(state.httpUrl);

// --- Create TronWeb instance ---
state.tronWeb = new TronWeb({ fullNode, solidityNode, eventServer });

state.tronWeb.fullNode.configure(state.httpUrl);
state.tronWeb.solidityNode.configure(state.httpUrl);
state.tronWeb.eventServer.configure(state.httpUrl);

// --- Proxy signing methods to native ---
applySignProxy(state.tronWeb.trx);

// --- Set up window providers ---
setupTronLinkProvider();   // window.tronLink
setupTronProvider();       // window.tron

// --- TIP-6963 multi-provider discovery ---
setupTip6963(window.tron);

// --- Init: expose tronWeb only; DApps connect via tron_requestAccounts / eth_requestAccounts ---
exposeTronWeb();
