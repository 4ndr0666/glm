// ==UserScript==
// @name        4ndr0tools - Recon 2 [Dock]
// @namespace   https://github.com
// @author      4ndr0666
// @version     8.1.0-Ω
// @description Alt+R hotkey
// @match       *://*/*
// @run-at      document-start
// @grant       GM_setClipboard
// @grant       unsafeWindow
// @downloadURL https://github.com/4ndr0666/glm/raw/refs/heads/main/recond.user.js
// @updateURL   https://github.com/4ndr0666/glm/raw/refs/heads/main/recond.user.js
// ==/UserScript==

(function() {
    'use strict';
    if (window.__RECON_Ω_DOCK_ISO_V8__) return;
    window.__RECON_Ω_DOCK_ISO_V8__ = true;

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
        isHidden: false
    };

    // ────── [1] CORE INSTRUMENTATION ──────
    const Hook = {
        init() {
            this.hookConsole();
            this.hookFetch();
            this.hookXHR();
            this.hookPostMessage();
            console.log('%c[Ψ-RECON-Ω] ISO-DOCK v8.1 ARMED', 'color:#00E5FF;font-weight:bold');
        },
        hookConsole() {
            ['log', 'warn', 'error'].forEach(type => {
                const org = console[type];
                console[type] = (...args) => {
                    const content = args.map(arg => {
                        try { return typeof arg === 'object' ? JSON.stringify(arg) : String(arg); }
                        catch (e) { return "[Unserializable]"; }
                    }).join(' ');
                    STATE.logs.push({ ts: new Date().toLocaleTimeString(), type: type.toUpperCase(), content });
                    if (STATE.logs.length > 500) STATE.logs.shift();
                    window.dispatchEvent(new CustomEvent('psi-update'));
                    return org.apply(console, args);
                };
            });
        },
        hookFetch() {
            const orgFetch = window.fetch;
            window.fetch = async (...args) => {
                const url = typeof args[0] === 'string' ? args[0] : args[0].url;
                const res = await orgFetch(...args);
                const clone = res.clone();
                clone.text().then(t => this.record(url, args[1]?.method || 'GET', t, 'FETCH')).catch(()=>{});
                return res;
            };
        },
        hookXHR() {
            const open = XMLHttpRequest.prototype.open;
            const send = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function(m, url) { this._url = url; this._m = m; return open.apply(this, arguments); };
            XMLHttpRequest.prototype.send = function() {
                this.addEventListener('load', () => this.record(this._url, this._m, this.responseText, 'XHR'));
                return send.apply(this, arguments);
            };
        },
        hookPostMessage() {
            window.addEventListener('message', (e) => this.record(window.location.href, 'MSG', JSON.stringify(e.data), 'BRIDGE'));
        },
        record(url, method, data, type) {
            if (!url || url.includes('blob:')) return;
            STATE.network.push({ ts: new Date().toLocaleTimeString(), type, method, url: url.split('?')[0], data: data?.substring(0, 500) });
            if (STATE.network.length > 500) STATE.network.shift();
            if (data && data.includes('eyJ')) {
                const tokens = data.match(/eyJ[a-zA-Z0-9._-]+/g);
                if (tokens) tokens.forEach(t => STATE.identities.add(t));
            }
            window.dispatchEvent(new CustomEvent('psi-update'));
        }
    };

    function generateReport() {
        let r = `# 📂 Ψ-FORENSIC RECON REPORT\n**Host:** ${window.location.host}\n\n## 🌐 Identities\n` + (STATE.identities.size ? [...STATE.identities].map(i => `* \`${i.slice(0, 40)}...\``).join('\n') : "* None");
        r += `\n\n## 📡 Network\n| Type | Method | Path |\n|---|---|---|\n` + STATE.network.slice(-50).reverse().map(n => `| ${n.type} | ${n.method} | \`${n.url}\` |`).join('\n');
        return r;
    }

    // ────── [3] ISOLATED HORIZONTAL DOCK ──────
    function injectUI() {
        const host = document.createElement('div');
        host.id = 'psi-dock-host';
        // USE pointer-events: none on host to allow clicks through to site when not touching panel
        host.style.cssText = 'all:initial; position:fixed; bottom:0; left:0; width:100%; z-index:2147483647; pointer-events:none;';
        document.documentElement.appendChild(host);

        const shadow = host.attachShadow({ mode: 'closed' });
        const style = document.createElement('style');
        style.textContent = `
            #panel {
                width: 100%; height: 280px; background: ${THEME.glass}; border-top: 1px solid ${THEME.border};
                backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                display: flex; flex-direction: column; font-family: 'JetBrains Mono', monospace;
                overflow: hidden; color: #fff; box-shadow: 0 -4px 15px ${THEME.glow};
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto; /* Re-enable clicks for the panel itself */
            }
            #panel.hidden { transform: translateY(100%); }
            #resizer {
                height: 8px; cursor: ns-resize; width: 100%;
                background: transparent; position: absolute; top: 0; z-index: 10;
            }
            #resizer:hover { background: ${THEME.border}; }
            .header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 10px 15px; background: rgba(0, 229, 255, 0.05); border-bottom: 1px solid ${THEME.border};
            }
            .header-info { display: flex; align-items: center; gap: 10px; color: ${THEME.cyan}; font-weight: bold; font-size: 11px; }
            .tabs { display: flex; background: rgba(0,0,0,0.2); }
            .tab { padding: 8px 20px; cursor: pointer; font-size: 10px; border-right: 1px solid ${THEME.border}; opacity: 0.6; }
            .tab.active { opacity: 1; color: ${THEME.cyan}; background: rgba(0,229,255,0.05); border-bottom: 2px solid ${THEME.cyan}; }
            #viewport { flex: 1; overflow-y: auto; padding: 10px; font-size: 9px; background: rgba(0,0,0,0.1); }
            .row { margin-bottom: 3px; border-bottom: 1px solid rgba(255,255,255,0.02); padding: 2px 0; white-space: nowrap; }
            .btn { background: transparent; border: 1px solid ${THEME.border}; color: ${THEME.cyan}; padding: 3px 10px; font-size: 10px; cursor: pointer; font-weight: bold; }
        `;
        shadow.appendChild(style);

        const ui = document.createElement('div');
        ui.id = 'panel';
        ui.innerHTML = `
            <div id="resizer"></div>
            <div class="header">
                <div class="header-info">
                    <svg viewBox="0 0 128 128" style="width:14px; height:14px;"><path d="M 64,12 A 52,52 0 1 1 63.9,12 Z" stroke="${THEME.cyan}" fill="none" stroke-width="2" /><text x="64" y="75" text-anchor="middle" fill="${THEME.cyan}" font-size="50" font-weight="700">Ψ</text></svg>
                    <span>RECON_Ω_DOCK_8.1</span>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn" id="do-rep">REPORT</button>
                    <button class="btn" id="do-purge" style="color:#FF00FF;">PURGE</button>
                </div>
            </div>
            <div class="tabs">
                <div class="tab active" id="tab-net">NETWORK</div>
                <div class="tab" id="tab-log">CONSOLE</div>
                <div class="tab" id="tab-rep">VIEW</div>
            </div>
            <div id="viewport"></div>
        `;
        shadow.appendChild(ui);

        const resizer = shadow.getElementById('resizer');
        resizer.onmousedown = (e) => {
            e.preventDefault();
            const startH = ui.offsetHeight;
            const startY = e.clientY;
            const onMouseMove = (ev) => {
                const h = window.innerHeight - ev.clientY;
                // Safety Floor: Prevent height from going below 40px so resizer is always clickable
                if (h > 40 && h < window.innerHeight * 0.95) ui.style.height = h + 'px';
            };
            const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const vp = shadow.getElementById('viewport');
        const tabs = shadow.querySelectorAll('.tab');
        const updateView = () => {
            if (STATE.currentTab === 'net') {
                vp.innerHTML = STATE.network.slice(-40).reverse().map(n => `<div class="row"><span style="color:#555">[${n.ts}]</span> <span style="color:${THEME.cyan}">${n.type}</span> ${n.url}</div>`).join('');
            } else if (STATE.currentTab === 'log') {
                vp.innerHTML = STATE.logs.slice(-40).reverse().map(l => `<div class="row"><span style="color:#555">[${l.ts}]</span> ${l.type}: ${l.content}</div>`).join('');
            } else {
                vp.innerHTML = `<pre style="white-space:pre-wrap; color:#666;">${generateReport()}</pre>`;
            }
        };

        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                STATE.currentTab = tab.id.replace('tab-', '');
                updateView();
            };
        });

        shadow.getElementById('do-rep').onclick = () => { GM_setClipboard(generateReport()); alert("Copied."); };
        shadow.getElementById('do-purge').onclick = () => { STATE.network = []; STATE.logs = []; STATE.identities.clear(); updateView(); };

        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.key.toLowerCase() === 'r') {
                STATE.isHidden = !STATE.isHidden;
                ui.classList.toggle('hidden');
                // PHANTOM MITIGATION: Disable host visibility entirely to stop click obstruction
                host.style.visibility = STATE.isHidden ? 'hidden' : 'visible';
            }
        });

        window.addEventListener('psi-update', updateView);
        updateView();
    }

    Hook.init();
    if (document.body) injectUI(); else document.addEventListener('DOMContentLoaded', injectUI);
})();
