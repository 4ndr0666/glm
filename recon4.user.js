// ==UserScript==
// @name        4ndr0tools - Recon 4 [Dock] v8.2.02-Ω
// @namespace   https://github.com
// @author      4ndr0666
// @version     8.2.02-Ω
// @description Alt+R hotkey — robust network/console/bridge/identity capture & report
// @match       *://*/*
// @run-at      document-start
// @grant       GM_setClipboard
// @grant       unsafeWindow
// @downloadURL https://github.com/4ndr0666/glm/raw/refs/heads/main/recon4.user.js
// @updateURL   https://github.com/4ndr0666/glm/raw/refs/heads/main/recon4.user.js
// ==/UserScript==

(function() {
    'use strict';
    if (window.__RECON_Ω_DOCK_V822_OMEGA__) return;
    window.__RECON_Ω_DOCK_V822_OMEGA__ = true;

    const THEME = {
        cyan: '#00E5FF',
        glass: 'rgba(10, 19, 26, 0.45)',
        border: 'rgba(0, 229, 255, 0.2)',
        glow: 'rgba(0, 229, 255, 0.4)'
    };

    const STATE = {
        network: [],
        logs: [],
        identities: new Set(),
        startTime: new Date().toISOString(),
        currentTab: 'net',
        isHidden: false,
        lastReportCopy: 0
    };

    // ────── [1] ROBUST SHARED HOOKS ──────
    window.Hook = {
        record(url, method, data, type) {
            if (!url || url.includes('blob:') || url.includes('data:')) return;
            const snippet = typeof data === 'string' ? data.substring(0, 500) : '[binary]';
            STATE.network.push({
                ts: new Date().toLocaleTimeString(),
                type,
                method,
                url: url.split('?')[0],
                data: snippet
            });
            if (STATE.network.length > 1000) STATE.network.shift();

            if (typeof data === 'string') {
                const tokens = data.match(/eyJ[a-zA-Z0-9._-]+/g);
                if (tokens) tokens.forEach(t => STATE.identities.add(t));
            }

            window.dispatchEvent(new CustomEvent('psi-recon-update'));
        },

        logConsole(type, ...args) {
            let content;
            try {
                content = args.map(a => {
                    if (a == null) return String(a);
                    if (typeof a === 'object') return JSON.stringify(a, null, 2);
                    return String(a);
                }).join(' ');
            } catch {
                content = '[Complex object]';
            }
            STATE.logs.push({ ts: new Date().toLocaleTimeString(), type: type.toUpperCase(), content });
            if (STATE.logs.length > 1000) STATE.logs.shift();
            window.dispatchEvent(new CustomEvent('psi-recon-update'));
        }
    };

    // Hook console
    ['log','warn','error','info','debug'].forEach(t => {
        const org = console[t];
        console[t] = (...args) => {
            window.Hook.logConsole(t, ...args);
            return org.apply(console, args);
        };
    });

    // Hook fetch
    const orgFetch = window.fetch;
    window.fetch = async (...args) => {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '[unknown]';
        const method = args[1]?.method || 'GET';
        const res = await orgFetch.apply(this, args);
        res.clone().text().then(t => window.Hook.record(url, method, t, 'FETCH')).catch(()=>{});
        return res;
    };

    // Hook XHR
    const proto = XMLHttpRequest.prototype;
    const open = proto.open;
    proto.open = function(m, url) { this._method = m; this._url = url; return open.apply(this, arguments); };
    const send = proto.send;
    proto.send = function() {
        this.addEventListener('load', () => {
            let data = this.responseText || this.response || '[no body]';
            window.Hook.record(this._url, this._method, data, 'XHR');
        });
        return send.apply(this, arguments);
    };

    // Hook WebSocket
    const NativeWS = WebSocket;
    WebSocket = function(url, protocols) {
        const ws = new NativeWS(url, protocols);
        ws.addEventListener('message', e => {
            let data = e.data;
            let snippet = (typeof data === 'string') ? data.substring(0, 500) : '[binary/blob]';
            window.Hook.record(url, 'WS', snippet, 'BRIDGE');
        });
        return ws;
    };

    // Hook postMessage
    const origAdd = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
        if (type === 'message') {
            const wrapped = e => {
                try {
                    window.Hook.record(location.href, 'MSG', JSON.stringify(e.data), 'BRIDGE');
                } catch {
                    window.Hook.record(location.href, 'MSG', '[non-serializable]', 'BRIDGE');
                }
                listener(e);
            };
            return origAdd.call(this, type, wrapped, options);
        }
        return origAdd.apply(this, arguments);
    };

    function generateReport() {
        let r = `# 📂 Ψ-FORENSIC RECON REPORT\n**Host:** ${location.host}\n**Time:** ${new Date().toISOString()}\n\n## 🌐 Identities\n` + (STATE.identities.size ? [...STATE.identities].map(i => `* \`${i.slice(0,40)}...\``).join('\n') : "* None");
        r += `\n\n## 📡 Network (last 50)\n| Type | Method | Path |\n|---|---|---|\n` + STATE.network.slice(-50).reverse().map(n => `| ${n.type} | ${n.method} | \`${n.url}\` |`).join('\n');
        r += `\n\n## 🖥️ Console (last 50)\n` + STATE.logs.slice(-50).reverse().map(l => `[${l.ts}] ${l.type}: ${l.content}`).join('\n');
        return r;
    }

    // ────── [2] ISOLATED HORIZONTAL DOCK ──────
    function injectUI() {
        const host = document.createElement('div');
        host.id = 'psi-dock-host';
        host.style.cssText = 'all:initial; position:fixed; bottom:0; left:0; width:100%; z-index:2147483647; pointer-events:none;';
        document.documentElement.appendChild(host);

        const shadow = host.attachShadow({ mode: 'closed' });
        const style = document.createElement('style');
        style.textContent = `
            #panel { width:100%; height:280px; background:${THEME.glass}; border-top:1px solid ${THEME.border};
                backdrop-filter:blur(12px); display:flex; flex-direction:column; font-family:'JetBrains Mono',monospace;
                overflow:hidden; color:#fff; box-shadow:0 -4px 15px ${THEME.glow}; transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);
                pointer-events:auto; }
            #panel.hidden { transform:translateY(100%); }
            #resizer { height:8px; cursor:ns-resize; width:100%; background:transparent; position:absolute; top:0; z-index:10; }
            #resizer:hover { background:${THEME.border}; }
            .header { display:flex; justify-content:space-between; align-items:center; padding:10px 15px; background:rgba(0,229,255,0.05); border-bottom:1px solid ${THEME.border}; }
            .header-info { display:flex; align-items:center; gap:10px; color:${THEME.cyan}; font-weight:bold; font-size:11px; }
            .tabs { display:flex; background:rgba(0,0,0,0.2); }
            .tab { padding:8px 20px; cursor:pointer; font-size:10px; border-right:1px solid ${THEME.border}; opacity:0.6; }
            .tab.active { opacity:1; color:${THEME.cyan}; background:rgba(0,229,255,0.05); border-bottom:2px solid ${THEME.cyan}; }
            #viewport { flex:1; overflow-y:auto; padding:10px; font-size:9px; background:rgba(0,0,0,0.1); white-space:pre-wrap; word-break:break-all; }
            .row { margin-bottom:3px; border-bottom:1px solid rgba(255,255,255,0.02); padding:2px 0; }
            .btn { background:transparent; border:1px solid ${THEME.border}; color:${THEME.cyan}; padding:3px 10px; font-size:10px; cursor:pointer; font-weight:bold; }
        `;
        shadow.appendChild(style);

        const ui = document.createElement('div');
        ui.id = 'panel';
        ui.innerHTML = `
            <div id="resizer"></div>
            <div class="header">
                <div class="header-info">
                    <svg viewBox="0 0 128 128" style="width:14px;height:14px;"><path d="M64,12 A52,52 0 1 1 63.9,12 Z" stroke="${THEME.cyan}" fill="none" stroke-width="2"/><text x="64" y="75" text-anchor="middle" fill="${THEME.cyan}" font-size="50" font-weight="700">Ψ</text></svg>
                    <span>RECON_Ω_DOCK_8.2.01-Ω</span>
                </div>
                <div style="display:flex;gap:10px;">
                    <button class="btn" id="do-rep">REPORT</button>
                    <button class="btn" id="do-purge" style="color:#FF00FF;">PURGE</button>
                </div>
            </div>
            <div class="tabs">
                <div class="tab active" id="tab-net">NETWORK</div>
                <div class="tab" id="tab-log">CONSOLE</div>
                <div class="tab" id="tab-rep">REPORT</div>
            </div>
            <div id="viewport"></div>
        `;
        shadow.appendChild(ui);

        // Event delegation for buttons/tabs
        ui.addEventListener('click', e => {
            const t = e.target.closest('.tab, .btn');
            if (!t) return;

            if (t.classList.contains('tab')) {
                ui.querySelectorAll('.tab').forEach(tt => tt.classList.remove('active'));
                t.classList.add('active');
                STATE.currentTab = t.id.replace('tab-', '');
                updateView();
            } else if (t.id === 'do-rep') {
                if (Date.now() - STATE.lastReportCopy < 2000) return;
                GM_setClipboard(generateReport());
                STATE.lastReportCopy = Date.now();
                alert('Report copied.');
            } else if (t.id === 'do-purge') {
                STATE.network = [];
                STATE.logs = [];
                STATE.identities.clear();
                updateView();
            }
        });

        // Resizer
        const resizer = ui.querySelector('#resizer');
        resizer.addEventListener('mousedown', e => {
            e.preventDefault();
            const startY = e.clientY;
            const startH = ui.offsetHeight;
            const onMove = ev => {
                const h = innerHeight - ev.clientY;
                if (h > 40 && h < innerHeight * 0.95) ui.style.height = h + 'px';
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        const vp = ui.querySelector('#viewport');
        const updateView = () => {
            vp.innerHTML = '';
            if (STATE.currentTab === 'net') {
                vp.innerHTML = STATE.network.slice(-50).reverse().map(n =>
                    `<div class="row"><span style="color:#555">[${n.ts}]</span> <span style="color:${THEME.cyan}">${n.type}</span> ${n.method} ${n.url}</div>`
                ).join('');
            } else if (STATE.currentTab === 'log') {
                vp.innerHTML = STATE.logs.slice(-50).reverse().map(l =>
                    `<div class="row"><span style="color:#555">[${l.ts}]</span> ${l.type}: ${l.content}</div>`
                ).join('');
            } else {
                vp.innerHTML = `<pre style="white-space:pre-wrap; color:#ccc;">${generateReport()}</pre>`;
            }
        };

        window.addEventListener('keydown', e => {
            if (e.altKey && e.key.toLowerCase() === 'r') {
                STATE.isHidden = !STATE.isHidden;
                ui.classList.toggle('hidden');
                host.style.visibility = STATE.isHidden ? 'hidden' : 'visible';
            }
        });

        window.addEventListener('psi-recon-update', updateView);
        updateView();
    }

    // Delay UI injection until body ready
    if (document.body) injectUI();
    else document.addEventListener('DOMContentLoaded', injectUI);

    // Init hooks immediately
    Hook.init();
})();
