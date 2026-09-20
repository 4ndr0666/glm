// ==UserScript==
// @name        4ndr0tools - Recon (Headless)
// @namespace   https://github.com/4ndr0666/userscripts
// @author      4ndr0666
// @version     2.3.7-HEADLESS
// @description Red-team tool with reliable console-based data exfiltration. Captures all traffic, allowing rule-based blocking and muting. All features and comments integrated.
// @downloadURL https://github.com/4ndr0666/userscripts/raw/refs/heads/main/4ndr0tools%20-%2_ReconAnalysisEngine.user.js
// @updateURL   https://github.com/4ndr0666/userscripts/raw/refs/heads/main/4ndr0tools%20-%2_ReconAnalysisEngine.user.js
// @icon        https://raw.githubusercontent.com/4ndr0666/4ndr0site/refs/heads/main/static/cyanglassarch.png
// @match       *://*/*
// @run-at      document-start
// @grant       none
// @license     MIT
// ==/UserScript==

(() => {
    "use strict";

    if (window._reconEngineInitialized) return;
    window._reconEngineInitialized = true;

    //--- WORKFLOW --- //
    // 1. Activate: Open Developer Tools (F12) -> Console.
    // 2. Operate: Use the site. All traffic is logged to the console.
    // 3. Silence Noise (Optional): If the console is noisy with irrelevant logs (e.g., telemetry):
    //    * reconEngine.applyMuteRules('play.google.com/log')
    // 4. Block Target (Optional): Once the target URL is identified, block it:
    //    * reconEngine.applyBlockRules('/_/rpc/PostImage/Annotate')
    // 5. Extract Data: To stage and copy all captured data for analysis:
    //    * reconEngine.copySessionData()
    //    * Then, run the foolproof command provided in the console: copy(reconEngine.sessionData)

    //────── CONFIGURATION & STATE ──────//
    const DEBUG_PREFIX = '[ReconEngine]';
    let _sessionData = []; // In-memory buffer for all captures.
    let _blockRules = [];  // Rules for blocking requests.
    let _muteRules = [];   // Rules for silencing console logs.

    // Expose control functions globally for console access.
    window.reconEngine = {
        get sessionData() { return _sessionData; },
        startNewSession: () => {
            _sessionData = [];
            log('New session started. All captured data has been cleared.');
        },
        applyBlockRules: (rulesStr) => {
            if (typeof rulesStr !== 'string') { return error("applyBlockRules expects a string."); }
            _blockRules = rulesStr.split('\n').map(r => r.trim()).filter(Boolean);
            log(`Applied ${_blockRules.length} block rule(s):`, _blockRules);
        },
        applyMuteRules: (rulesStr) => {
            if (typeof rulesStr !== 'string') { return error("applyMuteRules expects a string."); }
            _muteRules = rulesStr.split('\n').map(r => r.trim()).filter(Boolean);
            log(`Applied ${_muteRules.length} mute rule(s):`, _muteRules);
        },
        copySessionData: () => {
            if (_sessionData.length === 0) {
                log("Session data is empty. Nothing to copy.");
                return;
            }
            log(`Session data (${_sessionData.length} entries) staged below.`);
            console.log(_sessionData);
            log(">>> FOOLPROOF COPY: Run the following command in the console to copy the data as a JSON object:");
            console.log("copy(reconEngine.sessionData)");
        },
    };

    //────── CORE HELPERS ──────//
    const log = (...args) => console.log(DEBUG_PREFIX, ...args);
    const error = (...args) => console.error(DEBUG_PREFIX, ...args);
    const safeDeepClone = (obj) => { try { return JSON.parse(JSON.stringify(obj)); } catch (e) { error("Clone failed:", e); return null; } };

    const parseBody = (body) => {
        if (!body) return null;
        if (body instanceof FormData) {
            const obj = {};
            for (const [key, value] of body.entries()) {
                obj[key] = (value instanceof File) ? { fileName: value.name, fileSize: value.size, fileType: value.type } : value;
            }
            return obj;
        }
        if (typeof body === "string") { try { return JSON.parse(body); } catch (e) { return body; } }
        if (body instanceof URLSearchParams) return Object.fromEntries(body.entries());
        return null;
    };

    const logApiResponse = (url, data, type, method) => {
        // Always record the data regardless of mute status
        const clonedData = safeDeepClone(data);
        if (clonedData === null) return;

        const entry = { timestamp: new Date().toISOString(), url, type, method, data: clonedData };
        _sessionData.push(entry);

        // Mute check: only log to console if it doesn't match a mute rule.
        if (_muteRules.some(rule => url && url.includes(rule))) {
            return;
        }
        console.log(`${DEBUG_PREFIX} [${type.toUpperCase()}] ${method} -> ${url}`, clonedData);
    };

    //────── NETWORK INTERCEPTION (ACTIVE) ──────//

    //--- Google 204 Pacification --- //
	//When a fetch call is killed by a content blocker, we now catch the fatal TypeError, log the true cause for intel
	//("Blocked by an external filter"), and then forge a benign 204 No Content response. This lie pacifies the host
	//application, which receives the "all clear" signal it expects and continues its operation, completely unaware that its communication was terminated.
    function overrideFetch() {
        const origFetch = window.fetch;
        window.fetch = async function(...args) {
            const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
            const method = (args[1]?.method || "GET").toUpperCase();

            if (_blockRules.some(rule => url.includes(rule))) {
                log(`[MITM] BLOCKED Fetch request to: ${url}`);
                logApiResponse(url, { body: parseBody(args[1]?.body) }, 'blocked', method);
                return Promise.resolve(new Response(null, { status: 204, statusText: "Blocked by ReconEngine Rule" }));
            }

            if (args[1]?.body) {
                logApiResponse(url, parseBody(args[1].body), 'request', method);
            }
            try {
                const response = await origFetch.apply(this, args);
                const clone = response.clone();
                try {
                    const jsonResponse = await clone.json();
                    logApiResponse(url, jsonResponse, 'response', method);
                } catch (e) { /* Not JSON */ }
                return response;
            } catch (fetchError) {
                if (fetchError instanceof TypeError) {
                    if (!_muteRules.some(rule => url.includes(rule))) {
                         error(`Fetch to ${url} was blocked by an external filter (e.g., ad-blocker).`);
                    }
                    logApiResponse(url, { error: fetchError.message }, 'external_block', method);
                    return Promise.resolve(new Response(null, { status: 204, statusText: "Intercepted & Nullified by ReconEngine" }));
                }
                error(`Fetch failed for ${method} ${url}:`, fetchError);
                throw fetchError;
            }
        };
        log('Hardened Fetch override active.');
    }

    function overrideXHR() {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            this._method = method;
            this._url = url;
            return origOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function(body) {
            if (this._url && _blockRules.some(rule => this._url.includes(rule))) {
                log(`[MITM] BLOCKED XHR request to: ${this._url}`);
                logApiResponse(this._url, { body: parseBody(body) }, 'blocked', this._method.toUpperCase());
                Object.defineProperty(this, 'status', { value: 204, configurable: true });
                Object.defineProperty(this, 'readyState', { value: 4, configurable: true });
                this.dispatchEvent(new Event('load'));
                return;
            }

            if (body) {
                logApiResponse(this._url, parseBody(body), 'request', (this._method || 'POST').toUpperCase());
            }

            this.addEventListener('load', () => {
                if (this.readyState === 4 && this.responseText) {
                    try {
                        const jsonResponse = JSON.parse(this.responseText);
                        logApiResponse(this._url, jsonResponse, 'response', (this._method || 'GET').toUpperCase());
                    } catch (e) { /* Not JSON */ }
                }
            });

            this.addEventListener('error', () => {
                if (!this._url || !_muteRules.some(rule => this._url.includes(rule))) {
                    error(`XHR Error for ${this._method} ${this._url}. This may be due to an external filter.`);
                }
                logApiResponse(this._url, { error: "XHR failed" }, 'external_block', this._method.toUpperCase());
            });

            return origSend.apply(this, arguments);
        };
        log('Hardened XHR override active.');
    }

    //────── INITIALIZATION ──────//
    function initialize() {
        log('Headless Engine initializing...');
        overrideFetch();
        overrideXHR();
        log('Engine Initialized. All C2 is via the `reconEngine` object in the console.');
    }
    initialize();

})();
