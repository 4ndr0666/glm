// ==UserScript==
// @name         4ndr0tools - Recon 3 [HUD]
// @namespace    https://github.com/4ndr0666/userscripts
// @version      3.0.0
// @description  Enterprise-grade packet sniffer, console harvester, and endpoint analyzer with Moveable HUD.
// @author       💀Ψ•-⦑4NDR0666OS⦒-•Ψ💀
// @match        *://*/*
// @grant        GM_setClipboard
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    if (window.__PSI_RECON_ACTIVE__) return;
    window.__PSI_RECON_ACTIVE__ = true;

    // ────── CONFIGURATION & STATE ──────
    const HUD_ID = 'psi-universal-recon-v4';
    const BUFFER_LIMIT = 1000;

    const STATE = {
        network: [],
        logs: [],
        startTime: new Date().toISOString(),
        packetCount: 0,
        logCount: 0
    };

    // ────── CORE INTERCEPTORS ──────

    // 1. Console Harvester
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        debug: console.debug
    };

    const hookConsole = (type) => {
        console[type] = (...args) => {
            const entry = {
                timestamp: new Date().toISOString(),
                type: type.toUpperCase(),
                content: args.map(arg => {
                    try {
                        return typeof arg === 'object' ? JSON.parse(JSON.stringify(arg)) : String(arg);
                    } catch (e) { return "[Unserializable Object]"; }
                }).join(' ')
            };
            STATE.logs.push(entry);
            STATE.logCount++;
            if (STATE.logs.length > BUFFER_LIMIT) STATE.logs.shift();
            updateHUD();
            return originalConsole[type].apply(console, args);
        };
    };

    ['log', 'warn', 'error', 'debug'].forEach(hookConsole);

    // 2. Network: XHR Interceptor
    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._psi_method = method;
        this._psi_url = url;
        return origXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        const url = this._psi_url;
        const method = this._psi_method;

        this.addEventListener('load', () => {
            let resData = "[Non-JSON Response]";
            try { resData = JSON.parse(this.responseText); } catch(e) { resData = this.responseText.substring(0, 500); }

            captureNetwork(url, method, body, resData, 'XHR');
        });
        return origXHRSend.apply(this, arguments);
    };

    // 3. Network: Fetch Interceptor
    const origFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url || 'Unknown';
        const method = (args[1]?.method || 'GET').toUpperCase();
        const reqBody = args[1]?.body || null;

        const response = await origFetch.apply(this, args);
        const clone = response.clone();

        clone.text().then(text => {
            let resData;
            try { resData = JSON.parse(text); } catch(e) { resData = text.substring(0, 500); }
            captureNetwork(url, method, reqBody, resData, 'FETCH');
        }).catch(() => {});

        return response;
    };

    function captureNetwork(url, method, req, res, proto) {
        if (url.includes('blob:')) return;
        const entry = {
            timestamp: new Date().toISOString(),
            protocol: proto,
            method: method,
            url: url,
            request: req ? (typeof req === 'string' ? req : "[Object/Blob]") : null,
            response: res
        };
        STATE.network.push(entry);
        STATE.packetCount++;
        if (STATE.network.length > BUFFER_LIMIT) STATE.network.shift();
        updateHUD();
    }

    // ────── REPORT GENERATION ──────

    function generateMarkdownReport() {
        let md = `# 📂 Ψ-FORENSIC RECON REPORT\n`;
        md += `**Session Start:** ${STATE.startTime}\n`;
        md += `**Report Generated:** ${new Date().toISOString()}\n`;
        md += `**Target Host:** ${window.location.host}\n\n`;

        md += `## 📊 Telemetry Summary\n`;
        md += `* Total Network Packets: ${STATE.packetCount}\n`;
        md += `* Total Console Logs: ${STATE.logCount}\n\n`;

        md += `## 🌐 Network Stream (Latest ${STATE.network.length})\n`;
        STATE.network.forEach((n, i) => {
            md += `### [${n.protocol}] ${n.method} - ${n.url}\n`;
            md += `* **Timestamp:** ${n.timestamp}\n`;
            if (n.request) md += `* **Request Payload:** \`\`\`json\n${JSON.stringify(n.request, null, 2)}\n\`\`\`\n`;
            md += `* **Response:** \`\`\`json\n${JSON.stringify(n.response, null, 2)}\n\`\`\`\n\n`;
            md += `---\n`;
        });

        md += `\n## 💻 Console Output (Latest ${STATE.logs.length})\n`;
        md += `| Timestamp | Type | Content |\n|---|---|---|\n`;
        STATE.logs.forEach(l => {
            md += `| ${l.timestamp} | ${l.type} | \`${l.content.substring(0, 200)}\` |\n`;
        });

        return md;
    }

    // ────── MOVEABLE HUD UI ──────

    let shadow;
    function injectHUD() {
        if (document.getElementById(HUD_ID)) return;
        const host = document.createElement('div');
        host.id = HUD_ID;
        host.style.cssText = 'all:initial; position:fixed; top:50px; left:50px; z-index:2147483647;';
        document.documentElement.appendChild(host);

        shadow = host.attachShadow({ mode: 'closed' });
        const ui = document.createElement('div');
        ui.style.cssText = `
            background: rgba(10,10,10,0.95); border: 1px solid #00FFFF;
            width: 320px; color: #00FFFF; font-family: 'Consolas', monospace;
            border-radius: 4px; box-shadow: 0 0 20px rgba(0,255,255,0.4);
            backdrop-filter: blur(10px); overflow: hidden;
        `;

        ui.innerHTML = `
            <div id="handle" style="background:#003333; padding:10px; cursor:move; font-weight:bold; text-align:center; border-bottom:1px solid #00FFFF; font-size:12px;">
                Ψ-RECON-V4 [ENTERPRISE]
            </div>
            <div style="padding:15px; display:flex; flex-direction:column; gap:10px;">
                <div style="display:flex; justify-content:space-between; font-size:11px;">
                    <span>PACKETS: <b id="p-count">0</b></span>
                    <span>LOGS: <b id="l-count">0</b></span>
                </div>
                <div id="status" style="font-size:9px; color:#00AAAA; text-align:center; border:1px solid #004444; padding:4px;">SNIFFING_ACTIVE...</div>
                <button id="gen-btn" style="background:#00FFFF; color:#000; border:none; padding:10px; font-weight:bold; cursor:pointer; border-radius:2px; transition:0.2s;">GENERATE & COPY REPORT</button>
            </div>
        `;
        shadow.appendChild(ui);

        // Moveable Logic
        const handle = shadow.getElementById('handle');
        let dragging = false;
        handle.onmousedown = (e) => {
            dragging = true;
            let offset = { x: e.clientX - host.offsetLeft, y: e.clientY - host.offsetTop };
            const onMouseMove = (ev) => {
                if (!dragging) return;
                host.style.left = (ev.clientX - offset.x) + 'px';
                host.style.top = (ev.clientY - offset.y) + 'px';
            };
            const onMouseUp = () => { dragging = false; document.removeEventListener('mousemove', onMouseMove); };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        // Actions
        shadow.getElementById('gen-btn').onclick = function() {
            const btn = this;
            const report = generateMarkdownReport();
            GM_setClipboard(report);
            btn.innerText = "COPIED TO CLIPBOARD!";
            btn.style.background = "#00FF00";
            setTimeout(() => {
                btn.innerText = "GENERATE & COPY REPORT";
                btn.style.background = "#00FFFF";
            }, 2000);
        };
    }

    function updateHUD() {
        if (!shadow) return;
        const p = shadow.getElementById('p-count');
        const l = shadow.getElementById('l-count');
        if (p) p.innerText = STATE.packetCount;
        if (l) l.innerText = STATE.logCount;
    }

    // Delayed injection for DOM stability
    const boot = () => {
        if (document.body || document.documentElement) {
            injectUI();
        } else {
            setTimeout(boot, 100);
        }
    };
    boot();

    originalConsole.log('%c[Ψ-RECON-V4] ENTERPRISE ENGINE LOADED', 'color:#00FFFF;font-weight:bold');
})();
