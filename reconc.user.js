// ==UserScript==
// @name        4ndr0tools - Chimera's Eye Recon Platform
// @namespace   https://github.com/4ndr0666/userscripts
// @author      Ψ-Anarch
// @version     3.0.0
// @description A high-fidelity, dual-layer intelligence platform. This script has NO offensive capabilities. It hijacks BOTH Fetch and XMLHttpRequest to passively record all network traffic to a functional UI, guaranteeing capture of the true communication channel.
// @icon        https://raw.githubusercontent.com/4ndr0666/4ndr0site/refs/heads/main/static/cyanglassarch.png
// @match       *://*.*.*/*
// @run-at      document-start
// @grant       none
// @license     MIT
// ==/UserScript==

(() => {
    "use strict";

    //────── 1. POLYMORPHIC INITIALIZATION & SINGLETON LOCK ──────//
    const generateUUID = () => 'psi'.concat(Math.random().toString(36).substring(2, 10));
    const SCRIPT_ID = generateUUID();
    if (window[SCRIPT_ID]) return;
    window[SCRIPT_ID] = true;

    //────── 2. OPSEC & ALIASED GLOBALS ──────//
    const _window = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const _console = _window['console'];
    const _JSON = _window['JSON'];
    const _document = _window['document'];
    const _navigator = _window['navigator'];

    //────── 3. STATE MANAGEMENT ──────//
    const STATE = {
        isInitialized: false,
        originalFetch: _window.fetch,
        originalXhrOpen: _window.XMLHttpRequest.prototype.open,
        originalXhrSend: _window.XMLHttpRequest.prototype.send,
        sessionData: [],
        ui: {
            cssPrefix: generateUUID().substring(0, 4),
            panelId: generateUUID(),
        }
    };

    // Expose control functions globally for operator access.
    _window.chimeraRecon = {
        get sessionData() { return STATE.sessionData; },
        startNewSession: () => {
            STATE.sessionData = [];
            HELPERS.log('New reconnaissance session started. All captured data has been cleared.');
            UI_MODULE.update();
            UI_MODULE.showToast("New Recon Session Started");
        },
    };

    //────── 4. CORE & HELPER MODULE ──────//
    const HELPERS = {
        log: (...args) => _console.log(`%c[Chimera's Eye]%c`, 'color:#00ffff;font-weight:bold;', 'color:inherit;', ...args),
        error: (...args) => _console.error(`%c[Chimera's Eye]%c`, 'color:#ff0000;font-weight:bold;', 'color:inherit;', ...args),
        safeDeepClone: (obj) => { try { return _JSON.parse(_JSON.stringify(obj)); } catch (e) { return null; } },
        parseBody: async (body, headers = {}) => {
            if (!body) return { format: 'empty', content: null };
            const contentType = (headers.get ? headers.get('content-type') : headers['content-type']) || '';
            try {
                if (body instanceof FormData) { const obj = {}; for (const [key, value] of body.entries()) { obj[key] = (value instanceof File) ? `[File: ${value.name}]` : value; } return { format: 'form-data', content: obj }; }
                if (contentType.includes('application/json')) { const text = await (body.text ? body.text() : body); return { format: 'json', content: _JSON.parse(text) }; }
                if (body instanceof Blob) { const text = await body.text(); try { return { format: 'json-from-blob', content: _JSON.parse(text) }; } catch(e) { return { format: 'text-from-blob', content: text }; } }
                if (typeof body === 'string') { try { return { format: 'json-from-string', content: _JSON.parse(body) }; } catch (e) { return { format: 'text', content: body }; } }
            } catch (e) { return { format: 'error', content: `[Parse Error: ${e.message}]` }; }
            return { format: 'unknown', content: '[Unsupported Body Type]' };
        },
        logApiResponse: (source, url, data, type, method) => {
            const clonedData = HELPERS.safeDeepClone(data);
            if (clonedData !== null) {
                STATE.sessionData.push({ timestamp: new Date().toISOString(), source, url, type, method, data: clonedData });
                UI_MODULE.update();
            }
        }
    };

    //────── 5. DUAL-LAYER NETWORK INTERCEPTION ──────//
    const NETWORK_MODULE = {
        overrideFetch: () => {
            _window.fetch = async function(...args) {
                const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
                const method = (args[1]?.method || "GET").toUpperCase();
                if (args[1]?.body) {
                    const bodyContent = await HELPERS.parseBody(args[1].body);
                    HELPERS.logApiResponse('FETCH', url, bodyContent, 'request', method);
                }
                const response = await STATE.originalFetch.apply(this, args);
                const clone = response.clone();
                try {
                    const responseContent = await HELPERS.parseBody(clone, response.headers);
                    HELPERS.logApiResponse('FETCH', url, responseContent, 'response', method);
                } catch (e) { /* Expected for non-JSON/text responses */ }
                return response;
            };
            HELPERS.log('Passive FETCH recorder is ARMED.');
        },
        overrideXHR: () => {
            _window.XMLHttpRequest.prototype.open = function(method, url) {
                this._recon = { method, url };
                STATE.originalXhrOpen.apply(this, arguments);
            };
            _window.XMLHttpRequest.prototype.send = function(body) {
                if (this._recon) {
                    HELPERS.parseBody(body).then(parsedBody => {
                        HELPERS.logApiResponse('XHR', this._recon.url, parsedBody, 'request', this._recon.method);
                    });
                    this.addEventListener('loadend', async () => {
                        const responseBody = await HELPERS.parseBody(this.response, { 'content-type': this.getResponseHeader('content-type') });
                        HELPERS.logApiResponse('XHR', this._recon.url, responseBody, 'response', this._recon.method);
                    }, { once: true });
                }
                STATE.originalXhrSend.apply(this, [body]);
            };
            HELPERS.log('Passive XHR recorder is ARMED.');
        }
    };

    //────── 6. REPORTING & UI FRAMEWORK ──────//
    const UI_MODULE = {
        showToast: (msg, duration = 3000) => {
            if (!_document.body) return;
            _document.querySelectorAll(`.${STATE.ui.cssPrefix}-toast`).forEach(e => e.remove());
            const el = _document.createElement("div"); el.className = `${STATE.ui.cssPrefix}-toast`; el.textContent = msg;
            _document.body.appendChild(el); requestAnimationFrame(() => el.classList.add(`${STATE.ui.cssPrefix}-toast-visible`));
            setTimeout(() => { el.classList.remove(`${STATE.ui.cssPrefix}-toast-visible`); el.addEventListener("transitionend", () => el.remove(), { once: true }); }, duration);
        },
        injectStyles: () => {
            const p = STATE.ui.cssPrefix; const styleId = `${p}-styles`; if (_document.getElementById(styleId)) return;
            const style = _document.createElement("style"); style.id = styleId;
            style.textContent = `
                #${STATE.ui.panelId} { position: fixed; bottom: 10px; right: 10px; width: 600px; height: 450px; background: #1a1a1a; color: #e0e0e0; border: 1px solid #00ffff; border-radius: 8px; font-family: 'Consolas', monospace; font-size: 12px; z-index: 2147483647; box-shadow: 0 5px 15px rgba(0,0,0,0.5); display: flex; flex-direction: column; resize: both; overflow: auto; }
                .${p}-header { padding: 8px; background: #2a2a2a; display: flex; justify-content: space-between; align-items: center; cursor: grab; border-bottom: 1px solid #444; user-select: none; }
                .${p}-header span { color: #00ffff; font-weight: bold; }
                .${p}-controls button { background: #008080; color: #00ffff; border: 1px solid #00ffff; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-left: 5px; }
                .${p}-body { display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; }
                .${p}-textarea { width: 100%; height: 100%; background: #0d0d0d; color: #e0e0e0; border: none; font-family: 'Consolas', monospace; font-size: 11px; white-space: pre; word-break: break-all; resize: none; }
                .${p}-toast { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(20, 40, 48, 0.95); color:#00ffff; padding:10px 22px; border-radius:6px; font: 15px monospace; z-index:2147483647; opacity:0; transition:opacity .25s ease; pointer-events:none; }
                .${p}-toast-visible { opacity:1; }
            `;
            _document.head.appendChild(style);
        },
        create: () => {
            if (_document.getElementById(STATE.ui.panelId)) return;
            const p = STATE.ui.cssPrefix;
            const panel = _document.createElement("div"); panel.id = STATE.ui.panelId;
            panel.innerHTML = `
                <div class="${p}-header">
                    <span>Chimera's Eye Recon Platform</span>
                    <div class="${p}-controls">
                        <button id="${p}-session-btn">New Session</button>
                        <button id="${p}-report-btn">Generate & Copy Report</button>
                    </div>
                </div>
                <div class="${p}-body">
                    <textarea id="${p}-log-output" readonly placeholder="Network traffic will be recorded here..."></textarea>
                </div>
            `;
            _document.body.appendChild(panel);

            _document.getElementById(`${p}-session-btn`).addEventListener('click', _window.chimeraRecon.startNewSession);
            _document.getElementById(`${p}-report-btn`).addEventListener('click', () => {
                const report = `## Chimera's Eye Reconnaissance Report (${new Date().toISOString()})\n\n### Raw Data Dump (JSON)\n\n\`\`\`json\n${_JSON.stringify(STATE.sessionData, null, 2)}\n\`\`\``;
                _navigator.clipboard.writeText(report);
                UI_MODULE.showToast("Full Recon Report copied to clipboard!");
            });

            let isDragging = false, offsetX, offsetY; const header = panel.querySelector(`.${p}-header`);
            header.addEventListener('mousedown', (e) => { isDragging = true; offsetX = e.clientX - panel.getBoundingClientRect().left; offsetY = e.clientY - panel.getBoundingClientRect().top; });
            _document.addEventListener('mousemove', (e) => { if (isDragging) { panel.style.left = `${e.clientX - offsetX}px`; panel.style.top = `${e.clientY - offsetY}px`; } });
            _document.addEventListener('mouseup', () => { isDragging = false; });
        },
        update: () => {
            const logOutput = _document.getElementById(`${STATE.ui.cssPrefix}-log-output`);
            const headerSpan = _document.querySelector(`#${STATE.ui.panelId} .${STATE.ui.cssPrefix}-header span`);
            if (!logOutput || !headerSpan) return;
            logOutput.value = _JSON.stringify(STATE.sessionData, null, 2);
            logOutput.scrollTop = logOutput.scrollHeight;
            headerSpan.textContent = `Chimera's Eye Recon Platform (${STATE.sessionData.length} events)`;
        }
    };

    //────── 7. INITIALIZATION LIFECYCLE ──────//
    function initialize() {
        if (STATE.isInitialized) return;
        NETWORK_MODULE.overrideFetch();
        NETWORK_MODULE.overrideXHR();
        STATE.isInitialized = true;
        UI_MODULE.injectStyles();
        UI_MODULE.create();
        UI_MODULE.showToast("Chimera's Eye ARMED");
    }

    const initiationPoll = setInterval(() => {
        if (_document.body && _document.head) {
            clearInterval(initiationPoll);
            HELPERS.log('Document body confirmed. Injecting Recon Platform...');
            initialize().catch(e => HELPERS.error('Catastrophic failure during initialization:', e));
        }
    }, 50);

})();
