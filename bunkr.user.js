// ==UserScript==
// @name         4ndr0tools - Bunkr++BETA
// @namespace    https://github.com/4ndr0666/userscripts
// @version      7.0.0
// @author       4ndr0666
// @description  Direct URL routing, auto-sort, hide visited, bypass dl gateway, bulk download, m3u8/CDN URL aggregation, broken-link repair, power-user hotkeys
// @icon         data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20128%20128%22%20fill%3D%22none%22%20stroke%3D%22%2300E5FF%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M%2064%2C12%20A%2052%2C52%200%201%201%2063.9%2C12%20Z%22%20stroke-dasharray%3D%2221.78%2021.78%22%20stroke-width%3D%222%22%2F%3E%3Cpath%20d%3D%22M%2064%2C20%20A%2044%2C44%200%201%201%2063.9%2C20%20Z%22%20stroke-dasharray%3D%2210%2010%22%20stroke-width%3D%221.5%22%20opacity%3D%220.7%22%2F%3E%3Cpath%20d%3D%22M64%2030%20L91.3%2047%20L91.3%2081%20L64%2098%20L36.7%2081%20L36.7%2047%20Z%22%2F%3E%3Ctext%20x%3D%2264%22%20y%3D%2267%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%20fill%3D%22%2300E5FF%22%20stroke%3D%22none%22%20font-size%3D%2256%22%20font-weight%3D%22700%22%20font-family%3D%22Cinzel%20Decorative%2C%20serif%22%3E%CE%A8%3C%2Ftext%3E%3C%2Fsvg%3E
// @include      /^[^:]*?:\/\/bunkr\.[^/]*?\/.*?$/
// @include      /^[^:]*?:\/\/[^/]*?\.bunkr\.[^/]*?\/.*?$/
// @include      /^[^:]*?:\/\/bunker\.[^/]*?\/.*?$/
// @include      /^[^:]*?:\/\/[^/]*?\.bunker\.[^/]*?\/.*?$/
// @include      /^[^:]*?:\/\/bunkrr\.[^/]*?\/.*?$/
// @include      /^[^:]*?:\/\/[^/]*?\.bunkrr\.[^/]*?\/.*?$/
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_download
// @grant        unsafeWindow
// @connect      *
// @noframes
// @run-at       document-start
// @downloadURL  https://raw.githubusercontent.com/4ndr0666/glm/main/bunkr.user.js
// @updateURL    https://raw.githubusercontent.com/4ndr0666/glm/main/bunkr.user.js
// @license      UNLICENSED - RED TEAM USE ONLY
// ==/UserScript==
// v7.0.0-Ψ superset revision (GUP v5.3 audited).
// GAP 17 fix: the baseline @require of jquery-3.6.0.min.js is removed — a
// repository-wide scan found zero jQuery/$ references, making it a dead
// declared dependency (alignment: declaration with no observed consumer).
// GAP 16 fix: console banner now reports the true header version (baseline
// banner was frozen at v5.9.0-Ψ while @version read 6.0.1).

(function () {
    'use strict';
    console.log('%c[4NDR0tools] Bunkr++ v7.0.0-Ψ', 'color:#00E5FF; font-family:monospace; font-weight:bold;');

    // =========================================================================
    // MODULE 0.1: SYNCHRONOUS ENVIRONMENT MOCKING (Sandbox Escape)
    // =========================================================================
    try {
        unsafeWindow.aclib = {
            runAutoTag: function(){},
            runBanner:  function(){},
            runPop:     function(){},
            runVideo:   function(){}
        };
        unsafeWindow.kxysy    = function(){};
        unsafeWindow.ggihyqfb = function(){};

        const origFetch = unsafeWindow.fetch;
        unsafeWindow.fetch = async function (...args) {
            try {
                const reqUrl = typeof args[0] === 'string'
                    ? args[0]
                    : (args[0] && args[0].url ? args[0].url : '');
                if (
                    reqUrl.includes('/api/album/stats/') ||
                    reqUrl.includes('/api/file/stats/')  ||
                    reqUrl.includes('s.bunkr.ru')        ||
                    reqUrl.includes('/api/lv')
                ) {
                    return new Response(
                        JSON.stringify({ status: 'success', viewCount: 0, downloadCount: 0, live: 1 }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    );
                }
            } catch (e) { /* EAFP */ }
            return origFetch.apply(this, args);
        };
        console.log('[Ψ-4NDR0666] Synchronous environment isolation deployed.');
    } catch (e) {
        console.warn('[Ψ-4NDR0666] unsafeWindow context inaccessible.', e);
    }

    if (!document.getElementById('lunchGallery')) {
        const dummy = document.createElement('div');
        dummy.id = 'lunchGallery';
        dummy.style.display = 'none';
        (document.body || document.documentElement).appendChild(dummy);
    }

    // =========================================================================
    // MODULE 0.2: ANTI-TAMPER & SCRIPT DEFUSION LAYER
    // =========================================================================
    const textKeywords = [
        'DisableDevtool', 'DevtoolsDetector', 'adblock',
        'devtool', 'contextmenu', '_ads', 'kxysy', 'ggihyqfb',
    ];
    const srcKeywords = [
        'disable-devtool', 'devtools-detector', 'detect2', 'on.js', 'bn.js',
    ];

    function defuseScript(script) {
        const text = script.innerHTML || '';
        const src  = script.src || '';
        if (
            textKeywords.some(w => text.includes(w)) ||
            srcKeywords.some(w  => src.includes(w))
        ) {
            script.type = 'javascript/blocked';
            script.remove();
            console.log('[Ψ-4NDR0666] Aborted anti-analysis script safely.');
            return true;
        }
        return false;
    }

    window.addEventListener('beforescriptexecute', (e) => {
        if (defuseScript(e.target)) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    const originalAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function () {
        if (arguments[0] && arguments[0].tagName === 'SCRIPT') {
            if (defuseScript(arguments[0])) return arguments[0];
        }
        return originalAppendChild.apply(this, arguments);
    };

    const originalInsertBefore = Element.prototype.insertBefore;
    Element.prototype.insertBefore = function () {
        if (arguments[0] && arguments[0].tagName === 'SCRIPT') {
            if (defuseScript(arguments[0])) return arguments[0];
        }
        return originalInsertBefore.apply(this, arguments);
    };

    new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.tagName === 'SCRIPT') defuseScript(node);
                if (node.querySelectorAll) node.querySelectorAll('script').forEach(defuseScript);
            }
        }
    }).observe(document.documentElement, { childList: true, subtree: true });

    // =========================================================================
    // MODULE 0.3: PERSISTED POWER-USER SETTINGS
    // =========================================================================
    // Vision item "power user control": canonical domain, bulk concurrency
    // and inter-item delay survive page loads via GM storage. GM_getValue is
    // synchronous, so TARGET_DOMAIN resolves before the Module 1 routing
    // decision even at document-start.
    const SETTINGS_KEY = 'psi_settings';

    function getSettings() {
        try {
            const raw = GM_getValue(SETTINGS_KEY, null);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        } catch (e) {
            console.warn('[Ψ-4NDR0666] Settings store unreadable — defaults engaged.', e);
            return {};
        }
    }

    function setSetting(key, value) {
        const settings = getSettings();
        settings[key] = value;
        try { GM_setValue(SETTINGS_KEY, JSON.stringify(settings)); }
        catch (e) { console.warn('[Ψ-4NDR0666] Settings write failed.', e); }
    }

    function clampSetting(value, lo, hi, fallback) {
        const n = parseInt(value, 10);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(hi, Math.max(lo, n));
    }

    const _settings = getSettings();
    const TARGET_DOMAIN = (
        typeof _settings.canonicalDomain === 'string' &&
        /^[a-z0-9][a-z0-9.-]{1,252}$/i.test(_settings.canonicalDomain)
    ) ? _settings.canonicalDomain.toLowerCase() : 'bunkr.cr';

    GM_registerMenuCommand('🌐 Set Canonical Domain', () => {
        const input = window.prompt(
            `[Ψ-4NDR0666OS] Canonical Bunkr domain (current: ${TARGET_DOMAIN}):`,
            TARGET_DOMAIN
        );
        if (input === null) return;
        const domain = input.trim().toLowerCase();
        if (!/^[a-z0-9][a-z0-9.-]{1,252}$/.test(domain)) {
            showToast('⚠ Invalid hostname — canonical domain unchanged.', 4000);
            return;
        }
        setSetting('canonicalDomain', domain);
        showToast(`🌐 Canonical domain set: ${domain}. Reloading…`, 3000, true);
        setTimeout(() => window.location.reload(), 600);
    });

    GM_registerMenuCommand('⚙ Bulk Concurrency (1-6)', () => {
        const input = window.prompt(
            'Max concurrent bulk downloads (1-6):',
            String(clampSetting(_settings.bulkConcurrency, 1, 6, 2))
        );
        if (input === null) return;
        const n = clampSetting(input, 1, 6, 2);
        setSetting('bulkConcurrency', n);
        showToast(`⚙ Concurrency = ${n} — applied on next engine init.`, 4000);
    });

    GM_registerMenuCommand('⏱ Bulk Inter-Item Delay (ms)', () => {
        const input = window.prompt(
            'Delay between bulk downloads in ms (200-10000):',
            String(clampSetting(_settings.bulkDelayMs, 200, 10000, 1200))
        );
        if (input === null) return;
        const n = clampSetting(input, 200, 10000, 1200);
        setSetting('bulkDelayMs', n);
        showToast(`⏱ Delay = ${n}ms — applied on next engine init.`, 4000);
    });

    // =========================================================================
    // INTERNAL STATE & CONSTANTS
    // =========================================================================
    let _visitedCache   = null;
    let _visitedDirty   = false;
    let _visitedMode    = 'DIM';
    let _sortExecuted   = false;
    let _debounceTimer  = null;

    // Module-scope reference populated by initBulkEngine so M7 grid glyphs can call it
    let resolveBulkFile = null;

    const VISITED_KEY   = 'psi_visited_assets';
    const MODE_KEY      = 'psi_visited_mode';
    const MODES         = ['DIM', 'HIDE', 'SHOW'];
    const MAX_VISITED   = 10_000;

    // URL ledger (Module 3.5) — insertion-ordered Map, FIFO-capped
    const URL_LEDGER_MAX = 500;
    const _urlLedger     = new Map();

    function ensureRelative(el) {
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    }

    // =========================================================================
    // MODULE 1: CANONICAL ROUTING & PARAMETRIC SORT
    // =========================================================================
    const u = new URL(window.location.href);
    let redirectNeeded = false;

    if (u.hostname !== TARGET_DOMAIN) {
        const isAssetEndpoint = /cdn|get|media/i.test(u.hostname);
        if (!isAssetEndpoint) {
            const pat = /(?:^|\.)(bunkr|bunker|bunkrr)\.[a-z0-9-]{2,}$/i;
            if (pat.test(u.hostname)) {
                u.hostname = TARGET_DOMAIN;
                redirectNeeded = true;
            }
        }
    }

    const albumMatch = u.pathname.match(/^\/a\/([^/]+)\/?$/);
    if (albumMatch) {
        if (u.searchParams.get('sort') !== 'size' || u.searchParams.get('order') !== 'desc') {
            u.searchParams.set('sort', 'size');
            u.searchParams.set('order', 'desc');
            redirectNeeded = true;
            console.log('[Ψ-4NDR0666] Enforcing parametric size descent via URL.');
        }
    }

    if (redirectNeeded) {
        window.location.replace(u.href);
        return;
    }

    // =========================================================================
    // MODULE 2: SYSTEM STYLING — 3LECTRIC-GLASS PARADIGM
    // =========================================================================
    // v7 spec realignment (3lectric-Glass GTK spec): JetBrains Mono body /
    // Orbitron display typography, glass levels L1(0.72 window)/L2(0.65
    // button+popover)/L3(0.55 nested panel) off the RGB(10,19,26) base,
    // 0px-radius brutalist buttons, 150ms ease-in-out state transitions,
    // spec scrollbar + notification tokens, destructive STOP surface, and a
    // 4px radius on glass panels per the .glass-panel topology. Dead
    // palette entries from the baseline (--bg-dark-base, --font-glyph,
    // --yellow, and the never-read --accent-cyan-border-hover) are removed —
    // zero dead declarations survive.
    GM_addStyle(`
        :root {
            --bg-glass-l1: rgba(10, 19, 26, 0.72);
            --bg-glass-l2: rgba(10, 19, 26, 0.65);
            --bg-glass-l3: rgba(10, 19, 26, 0.55);
            --accent-cyan: #00E5FF;
            --text-cyan-active: #67E8F9;
            --accent-cyan-border-idle: rgba(0, 229, 255, 0.2);
            --accent-cyan-border-btn: rgba(0, 229, 255, 0.4);
            --accent-cyan-bg-hover: rgba(0, 229, 255, 0.2);
            --accent-cyan-bg-active: rgba(0, 229, 255, 0.3);
            --glow-cyan-active: rgba(0, 229, 255, 0.4);
            --glow-cyan-strong: rgba(0, 229, 255, 0.5);
            --aura-window: 0 0 40px rgba(0, 229, 255, 0.15);
            --aura-popover: 0 0 20px rgba(0, 229, 255, 0.15);
            --shadow-glass-base: -4px 8px 32px 0 rgba(0, 0, 0, 0.37);
            --edge-light-top: rgba(255, 255, 255, 0.1);
            --edge-light-left: rgba(255, 255, 255, 0.1);
            --text-primary: #00E5FF;
            --text-secondary: rgba(0, 229, 255, 0.7);
            --text-light: #ffffff;
            --font-body: 'JetBrains Mono', monospace;
            --font-display: 'Orbitron', sans-serif;
            --red: #FF0055;
        }

        .psi-glass-panel {
            background: var(--bg-glass-l2);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 229, 255, 0.3);
            border-top: 1px solid var(--edge-light-top);
            border-left: 1px solid var(--edge-light-left);
            border-radius: 4px;
            box-shadow: var(--shadow-glass-base), var(--aura-popover);
        }
        @supports not (backdrop-filter: blur(1px)) {
            .psi-glass-panel, #psi-bulk-panel { background: rgba(10, 19, 26, 0.95) !important; }
        }

        .psi-btn {
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-size: 0.875rem;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 20px;
            color: var(--text-primary);
            background: var(--bg-glass-l2);
            border: 1px solid var(--accent-cyan-border-btn);
            border-radius: 0px;
            transition: all 150ms ease-in-out;
            cursor: pointer;
            font-family: var(--font-body);
        }
        .psi-btn:hover:not(:disabled) {
            color: var(--text-cyan-active);
            background: var(--accent-cyan-bg-hover);
            border-color: var(--accent-cyan);
            box-shadow: 0 0 20px var(--glow-cyan-strong);
        }
        .psi-btn:active:not(:disabled) {
            color: var(--text-light);
            background: var(--accent-cyan-bg-active);
            border-color: var(--accent-cyan);
            box-shadow: inset 0 0 10px var(--glow-cyan-active);
        }
        .psi-btn:focus-visible {
            outline: 2px solid var(--accent-cyan);
            outline-offset: 2px;
        }
        .psi-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
            border-color: rgba(0, 229, 255, 0.3);
            color: var(--text-secondary);
        }
        .psi-btn.psi-destructive {
            border-color: var(--red);
            color: var(--red);
        }
        .psi-btn.psi-destructive:hover:not(:disabled) {
            background: rgba(255, 0, 85, 0.3);
            border-color: var(--red);
            box-shadow: 0 0 25px var(--red);
            color: var(--text-light);
        }

        .psi-dl-glyph, .psi-stream-glyph {
            position: absolute;
            bottom: 8px;
            width: 32px;
            height: 32px;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            color: var(--accent-cyan);
            text-decoration: none !important;
            padding: 0;
            border-radius: 0px;
        }
        .psi-dl-glyph    { right: 8px; }
        .psi-stream-glyph { right: 48px; }
        .psi-dl-glyph svg,
        .psi-stream-glyph svg {
            width: 18px;
            height: 18px;
            stroke-width: 2.5;
            pointer-events: none;
            fill: currentColor;
        }

        .psi-main-dl-glyph     { top: 42px !important; bottom: auto !important; right: 8px  !important; z-index: 99999 !important; }
        .psi-main-stream-glyph { top: 42px !important; bottom: auto !important; right: 48px !important; z-index: 99999 !important; }

        #psi-visited-toggle {
            position: fixed;
            bottom: 8px;
            left: 8px;
            z-index: 999999;
            padding: 6px 12px;
            font: 700 11px var(--font-body);
            color: var(--text-secondary);
            user-select: none;
            border-radius: 0px;
            transition: all 150ms ease-in-out;
        }
        #psi-visited-toggle:hover { color: var(--accent-cyan); }

        body[data-psi-visited-mode="DIM"]  .psi-visited { opacity: 0.3 !important; filter: grayscale(100%); transition: opacity 150ms ease-in-out, filter 150ms ease-in-out; }
        body[data-psi-visited-mode="DIM"]  .psi-visited:hover { opacity: 0.9 !important; filter: none; }
        body[data-psi-visited-mode="HIDE"] .psi-visited { display: none !important; }

        .psi-img-dead { opacity: 0.25; filter: grayscale(1); }

        header, .bg-mute, .live-indicator-container, #liveCount, footer, [data-cl-spot],
        iframe[src*="ads"], iframe[src*="pop"], .banner, .ad-container, .ad-box,
        .adsbygoogle, .popup-ad, .ad-wrap { display: none !important; }

        .truncate.theName {
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: unset !important;
        }

        @keyframes psi-slide-in {
            from { opacity: 0; transform: translateX(40px) scale(0.96); }
            to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes psi-fade-out {
            from { opacity: 1; transform: scale(1); }
            to   { opacity: 0; transform: translateX(20px) scale(0.94); }
        }
        @keyframes psi-fadeIn { to { opacity: 1; } }

        .psi-toast {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 9999999;
            padding: 10px 16px;
            font: 700 11px/1.4 var(--font-body);
            color: var(--text-light);
            pointer-events: none;
            max-width: 420px;
            animation: psi-slide-in 0.15s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .psi-toast--dying { animation: psi-fade-out 0.15s ease forwards; }
        .psi-toast--glyph {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 14px 8px 10px;
            border-color: rgba(0, 229, 255, 0.55);
        }
        .psi-toast-icon  { flex-shrink: 0; width: 36px; height: 36px; color: var(--accent-cyan); filter: drop-shadow(0 0 4px var(--glow-cyan-active)); }
        .psi-toast-label { color: var(--text-light); font: 700 11px/1.4 var(--font-body); letter-spacing: 0.05em; }

        /* Bulk Acquisition Panel */
        #psi-bulk-panel {
            position: fixed;
            bottom: 85px;
            right: 0;
            z-index: 2147483646;
            display: flex;
            border-radius: 4px 0 0 4px;
            overflow: hidden;
            background: var(--bg-glass-l1);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--accent-cyan-border-idle);
            border-right: none;
            border-top: 1px solid var(--edge-light-top);
            border-left: 1px solid var(--edge-light-left);
            box-shadow: var(--shadow-glass-base), var(--aura-window);
            transition: transform 150ms ease-in-out, background 150ms ease-in-out;
            transform: translateX(calc(100% - 32px));
        }
        #psi-bulk-panel:hover,
        #psi-bulk-panel.psi-open { transform: translateX(0); }

        #psi-bulk-peek {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 32px;
            flex-shrink: 0;
            background: var(--bg-glass-l3);
            border-right: 1px solid var(--accent-cyan-border-btn);
            color: var(--accent-cyan);
            cursor: pointer;
        }
        #psi-bulk-peek svg {
            width: 20px;
            height: 20px;
            filter: drop-shadow(0 0 8px var(--glow-cyan-active));
            transition: filter 150ms ease-in-out, transform 150ms ease-in-out;
        }
        #psi-bulk-panel:hover #psi-bulk-peek svg,
        #psi-bulk-panel.psi-open #psi-bulk-peek svg {
            filter: drop-shadow(0 0 12px var(--accent-cyan));
        }

        #psi-bulk-content {
            width: 320px;
            max-height: 80vh;
            overflow-y: hidden;
            padding: 12px;
            color: var(--text-cyan-active);
            font: 11px var(--font-body);
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        #psi-bulk-content h3 {
            margin: 0;
            font-family: var(--font-display);
            font-size: 14px;
            text-transform: uppercase;
            color: var(--text-cyan-active);
            text-shadow: 0 0 8px var(--glow-cyan-active);
            font-weight: 700;
            letter-spacing: 0.05em;
        }
        #psi-bulk-content .controls { display: flex; gap: 6px; margin-top: 4px; }

        #psi-bulk-progress {
            width: 100%;
            height: 6px;
            background: rgba(0, 0, 0, 0.4);
            border-radius: 0px;
            overflow: hidden;
            border: 1px solid rgba(0, 0, 0, 0.4);
        }
        #psi-bulk-bar {
            width: 0%;
            height: 100%;
            background: var(--accent-cyan);
            box-shadow: 0 0 8px var(--glow-cyan-active);
            transition: width 150ms ease-in-out;
        }

        #psi-bulk-log {
            max-height: 180px;
            overflow-y: auto;
            background: transparent;
            padding: 4px 0 0 0;
            display: none;
            margin-top: 4px;
        }
        #psi-bulk-log span {
            display: block;
            margin-bottom: 4px;
            border-left: 2px solid var(--accent-cyan);
            padding-left: 8px;
            opacity: 0;
            animation: psi-fadeIn 0.15s forwards;
            color: var(--text-cyan-active);
            font-size: 11px;
            word-break: break-all;
        }
        #psi-bulk-log::-webkit-scrollbar { width: 6px; height: 6px; }
        #psi-bulk-log::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.4); }
        #psi-bulk-log::-webkit-scrollbar-thumb { background: var(--accent-cyan); border-radius: 0px; }
        #psi-bulk-log::-webkit-scrollbar-thumb:hover { background: var(--text-cyan-active); }
        .psi-log-inf { color: var(--text-cyan-active); }
        .psi-log-ok  { color: #4ade80 !important; border-left-color: #4ade80 !important; }
        .psi-log-err { color: var(--red)   !important; border-left-color: var(--red)   !important; }
        .psi-log-dbg { color: #6b7280 !important; border-left-color: #6b7280 !important; display: none; }
    `);

    // =========================================================================
    // MODULE 3: NETWORK SNIFFING — CDN URL CLASSIFICATION
    // =========================================================================
    // Passively intercepts outgoing fetch/XHR to capture CDN media URLs in
    // transit. Stored in _lastCdnMedia for use as a fast-path fallback when
    // video.currentSrc is not yet populated (race condition on page load).
    // v7: every capture is also folded into the Module 3.5 URL ledger so
    // m3u8 playlists (hls.js traffic) and file CDN URLs aggregate uniformly.
    let _lastCdnMedia = null;

    const _origFetchM3 = window.fetch;
    window.fetch = async function (...args) {
        const reqUrl = typeof args[0] === 'string'
            ? args[0]
            : (args[0] && args[0].url ? args[0].url : '');
        if (reqUrl && isCdnUrl(reqUrl)) {
            _lastCdnMedia = reqUrl;
            recordUrl(reqUrl, 'sniffer');
            console.log(`[Ψ-4NDR0666] M3: CDN URL captured: ${reqUrl.slice(0, 80)}`);
        } else if (reqUrl && isMediaPlaylist(reqUrl)) {
            recordUrl(reqUrl, 'sniffer');
        }
        return _origFetchM3.apply(this, args);
    };

    const _origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        if (typeof url === 'string') {
            if (isCdnUrl(url)) {
                _lastCdnMedia = url;
                recordUrl(url, 'sniffer');
            } else if (isMediaPlaylist(url)) {
                recordUrl(url, 'sniffer');
            }
        }
        return _origXhrOpen.apply(this, [method, url, ...rest]);
    };

    // =========================================================================
    // MODULE 3.5: URL LEDGER — m3u8 / CDN AGGREGATION
    // =========================================================================
    // Vision item "m3u8 URL aggregation": every media URL observed anywhere
    // (passive sniffer, DOM resolvers, signed-API pipeline, download
    // vector) is recorded here exactly once, FIFO-capped, and exportable to
    // the clipboard as a newline-delimited list with m3u8 playlists first.
    function isMediaPlaylist(url) {
        if (!url || typeof url !== 'string') return false;
        return /\.m3u8(\?|#|$)/i.test(url);
    }

    function recordUrl(url, source) {
        if (!url || typeof url !== 'string') return;
        const kind = isMediaPlaylist(url) ? 'm3u8' : (isCdnUrl(url) ? 'file' : null);
        if (!kind) return;
        if (_urlLedger.has(url)) {
            const rec = _urlLedger.get(url);
            rec.ts = Date.now();
            rec.sources.add(source);
            _urlLedger.delete(url);
            _urlLedger.set(url, rec); // re-insert to refresh LRU position
            return;
        }
        _urlLedger.set(url, { kind, ts: Date.now(), sources: new Set([source]) });
        if (_urlLedger.size > URL_LEDGER_MAX) {
            const oldest = _urlLedger.keys().next().value; // FIFO eviction
            _urlLedger.delete(oldest);
        }
    }

    function copyUrlLedger() {
        if (!_urlLedger.size) {
            showToast('Ledger empty — no CDN/m3u8 URLs captured yet.');
            return;
        }
        const playlists = [];
        const files = [];
        for (const rec of _urlLedger.values()) {
            if (rec.kind === 'm3u8') playlists.push(rec.url); else files.push(rec.url);
        }
        robustCopy(playlists.concat(files).join('\n'), null);
        showToast(`📋 Ledger copied: ${playlists.length} m3u8 / ${files.length} CDN URLs.`, 4000, true);
    }

    GM_registerMenuCommand('📋 Copy URL Ledger (m3u8 + CDN)', copyUrlLedger);

    // =========================================================================
    // MODULE 4: STATE-AWARE SORT HIJACK (Polled)
    // =========================================================================
    function forceLargestFirst() {
        if (!albumMatch) return;
        if (_sortExecuted) return;
        let attempts = 0;
        const sortInterval = setInterval(() => {
            attempts++;
            const sizeBtn =
                document.querySelector('.btnSize, button[title*="size"], a[href*="sort=size"]') ||
                Array.from(document.querySelectorAll('a, button')).find(
                    e => e.textContent.trim().toLowerCase() === 'size'
                );
            if (sizeBtn) {
                clearInterval(sortInterval);
                _sortExecuted = true;
                console.log('[Ψ-4NDR0666] Size sort node acquired. Initiating descent (click 1/2).');
                sizeBtn.click();
                setTimeout(() => {
                    console.log('[Ψ-4NDR0666] Secondary descent strike (click 2/2).');
                    if (sizeBtn.tagName === 'A' && sizeBtn.href) {
                        const descUrl = new URL(sizeBtn.href);
                        descUrl.searchParams.set('order', 'desc');
                        window.location.href = descUrl.href;
                    } else {
                        sizeBtn.click();
                    }
                }, 400);
            } else if (attempts > 15) {
                clearInterval(sortInterval);
                console.log('[Ψ-4NDR0666] Size sort node not found after 15 cycles. Aborting.');
            }
        }, 400);
        window.addEventListener('beforeunload', () => clearInterval(sortInterval), { once: true });
        activateAdvancedView();
    }

    function activateAdvancedView() {
        if (!albumMatch) return;
        let avAttempts = 0;
        const avInterval = setInterval(() => {
            avAttempts++;
            const hasPagination = document.querySelector(
                '.pagination, [aria-label="Pagination"], nav.pagination'
            );
            if (!hasPagination) { clearInterval(avInterval); return; }

            let advBtn = document.querySelector('body > main > div.album-toolbar > div > a');
            if (!advBtn) {
                advBtn = Array.from(
                    document.querySelectorAll('.album-toolbar a, [class*="toolbar"] a')
                ).find(a => /advanced|infinite|grid/i.test(a.textContent));
            }
            if (advBtn) {
                clearInterval(avInterval);
                console.log('[Ψ-4NDR0666] Advanced view anchor found. Activating infinite scroll.');
                advBtn.click();
            } else if (avAttempts > 20) {
                clearInterval(avInterval);
                console.log('[Ψ-4NDR0666] Advanced view anchor not found after 20 cycles. Aborting.');
            }
        }, 500);
        window.addEventListener('beforeunload', () => clearInterval(avInterval), { once: true });
    }

    // =========================================================================
    // MODULE 5: FORENSIC STATE TRACKER
    // =========================================================================
    function _loadVisitedFromStorage() {
        try {
            const raw = localStorage.getItem(VISITED_KEY);
            if (raw) return new Set(JSON.parse(raw));
        } catch { /* fall through */ }
        try {
            const raw = GM_getValue(VISITED_KEY, null);
            if (raw) return new Set(JSON.parse(raw));
        } catch { /* fall through */ }
        return new Set();
    }

    function getVisitedCache() {
        if (_visitedCache === null) _visitedCache = _loadVisitedFromStorage();
        return _visitedCache;
    }

    function addVisited(id) {
        if (!id) return;
        const cache = getVisitedCache();
        if (cache.has(id)) return;
        cache.add(id);
        _visitedDirty = true;
        if (cache.size > MAX_VISITED) {
            const [oldest] = cache;   // FIFO eviction
            cache.delete(oldest);
        }
    }

    window.addEventListener('beforeunload', () => {
        if (_visitedDirty && _visitedCache) {
            try { localStorage.setItem(VISITED_KEY, JSON.stringify([..._visitedCache])); } catch {}
            try { GM_setValue(VISITED_KEY, JSON.stringify([..._visitedCache])); } catch {}
        }
    });

    function initVisitedTracker() {
        const pathParts = window.location.pathname.split('/');
        if (['v', 'f', 'd'].includes(pathParts[1]) && pathParts[2]) {
            addVisited(pathParts[2]);
        }
        if (document.getElementById('psi-visited-toggle')) return;
        _visitedMode = localStorage.getItem(MODE_KEY) || 'DIM';
        document.body.setAttribute('data-psi-visited-mode', _visitedMode);

        const toggleBtn       = document.createElement('button');
        toggleBtn.id          = 'psi-visited-toggle';
        toggleBtn.className   = 'psi-glass-panel psi-btn';
        toggleBtn.setAttribute('aria-label', 'Toggle visited assets visibility');
        toggleBtn.textContent = `👁 VISITED: ${_visitedMode}`;
        toggleBtn.title       =
            'Left-Click: Cycle Mode (DIM/HIDE/SHOW)\n' +
            'Right-Click: Purge Registry\n' +
            'Hotkey V: Cycle Mode\n' +
            'Buffer: 10,000 items max (FIFO)';
        toggleBtn.onclick = (e) => {
            e.preventDefault();
            const idx    = MODES.indexOf(_visitedMode);
            _visitedMode = MODES[(idx + 1) % MODES.length];
            localStorage.setItem(MODE_KEY, _visitedMode);
            document.body.setAttribute('data-psi-visited-mode', _visitedMode);
            toggleBtn.textContent = `👁 VISITED: ${_visitedMode}`;
        };
        toggleBtn.oncontextmenu = (e) => {
            e.preventDefault();
            if (window.confirm(
                '[Ψ-4NDR0666OS] PURGE WARNING:\nClear the local storage of all visited assets?'
            )) {
                localStorage.removeItem(VISITED_KEY);
                _visitedCache = new Set();
                _visitedDirty = false;
                location.reload();
            }
        };
        document.body.appendChild(toggleBtn);

        GM_registerMenuCommand('💾 Save History',  exportVisitedRegistry);
        GM_registerMenuCommand('📂 Load History',  importVisitedRegistry);
        GM_registerMenuCommand('☠ Purge History', () => {
            localStorage.removeItem(VISITED_KEY);
            try { GM_setValue(VISITED_KEY, null); } catch {}
            _visitedCache = new Set();
            _visitedDirty = false;
            location.reload();
        });
    }

    function exportVisitedRegistry() {
        const cache   = getVisitedCache();
        const fname   = 'bunkr_visited.json';
        const payload = JSON.stringify({
            version:  '1.0',
            exported: new Date().toISOString(),
            count:    cache.size,
            domain:   TARGET_DOMAIN,
            assets:   [...cache],
        }, null, 2);

        const blob = new Blob([payload], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = fname;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`💾 ${cache.size} assets exported → ${fname}`);
    }

    // Persists the live cache through both storage backends. Mirrors the
    // dual-write already used by the beforeunload handler — kept identical
    // rather than factored into a shared helper, so this unit stays a
    // faithful drop-in twin of the existing save path (no new abstraction
    // layer introduced for a two-line write).
    function _persistVisitedNow(cache) {
        try { localStorage.setItem(VISITED_KEY, JSON.stringify([...cache])); } catch { /* EAFP */ }
        try { GM_setValue(VISITED_KEY, JSON.stringify([...cache])); } catch { /* EAFP */ }
    }

    function importVisitedRegistry() {
        const input       = document.createElement('input');
        input.type        = 'file';
        input.accept       = 'application/json,.json';
        input.style.display = 'none';

        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            input.remove();
            if (!file) return;

            const reader = new FileReader();
            reader.onerror = () => showToast('⚠ Import failed: could not read file.', 4000);
            reader.onload = () => {
                let parsed;
                try {
                    parsed = JSON.parse(reader.result);
                } catch (e) {
                    showToast('⚠ Import failed: not valid JSON.', 4000);
                    return;
                }

                // Accept both the exportVisitedRegistry() envelope
                // ({assets:[...]}) and a bare array, for portability with
                // hand-edited or externally generated registries.
                const assets = Array.isArray(parsed) ? parsed : parsed?.assets;
                if (!Array.isArray(assets)) {
                    showToast('⚠ Import failed: no assets[] array found.', 4000);
                    return;
                }

                const cache = getVisitedCache();
                let added   = 0;
                for (const id of assets) {
                    if (typeof id !== 'string' || !id || cache.has(id)) continue;
                    cache.add(id);
                    added++;
                }
                // Same FIFO eviction policy as addVisited() — a bulk import
                // must not silently blow past the cap it would otherwise
                // respect one addVisited() call at a time.
                while (cache.size > MAX_VISITED) {
                    const [oldest] = cache;
                    cache.delete(oldest);
                }

                _visitedDirty = false; // just wrote it below; beforeunload has nothing further to do
                _persistVisitedNow(cache);

                // Re-tag any grid items already rendered on the current page
                // so the imported registry takes visible effect immediately,
                // without requiring a reload.
                document.querySelectorAll(
                    '.grid > div, .grid-images_box, .theItem, main.grid > div, main[class*="grid"] > div'
                ).forEach(el => {
                    const link = el.querySelector('a[href^="/f/"], a[href^="/v/"], a[href*="/d/"]');
                    if (!link) return;
                    const alphaId = link.getAttribute('href').split('/').pop();
                    if (cache.has(alphaId)) el.classList.add('psi-visited');
                });

                showToast(`📂 Imported ${added} new / ${cache.size} total assets.`, 4000, true);
            };
            reader.readAsText(file);
        }, { once: true });

        // v7 GAP 20 fix: browsers fire 'cancel' when the file dialog is
        // dismissed without a selection — remove the orphaned hidden input
        // instead of leaving it parked in the DOM for the page lifetime.
        input.addEventListener('cancel', () => input.remove());

        document.body.appendChild(input);
        input.click();
    }

    // =========================================================================
    // MODULE 6: ACQUISITION UTILITIES
    // =========================================================================
    const downloadSvg  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    const streamSvg    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    const spinnerHtml  = '<span style="font-size:8px;font-family:var(--font-body);">...</span>';
    const specPsiSvg   = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" class="psi-toast-icon" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path class="glyph-ring-1" d="M 64,12 A 52,52 0 1 1 63.9,12 Z" stroke-dasharray="21.78 21.78" stroke-width="2" /><path class="glyph-ring-2" d="M 64,20 A 44,44 0 1 1 63.9,20 Z" stroke-dasharray="10 10" stroke-width="1.5" opacity="0.7" /><path class="glyph-hex" d="M64 30 L91.3 47 L91.3 81 L64 98 L36.7 81 L36.7 47 Z" /><text x="64" y="67" text-anchor="middle" dominant-baseline="middle" fill="currentColor" stroke="none" font-size="56" font-weight="700" font-family="'Cinzel Decorative', serif" class="glyph-core-psi">Ψ</text></svg>`;

    function isCdnUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return /(cdn\.cr|bunkr|bunkrr|scdn\.st|media-)/i.test(url) &&
               /\.(mp4|webm|mkv|mov|avi|zip|rar|7z|jpg|jpeg|png|gif|webp|m3u8)(\?|#|$)/i.test(url);
    }

    function nativeDownload(url, hint) {
        const name = hint ||
            url.split('/').pop().split('?')[0].split('#')[0] ||
            'bunkr_download';
        console.log(`[Ψ-4NDR0666] Initiating native download: ${name}`);
        recordUrl(url, 'download'); // v7: every download vector feeds the ledger
        showToast(`⦒ █▓░ Download initiated: ${name}`, 3000, true);
        const a = document.createElement('a');
        a.href     = url;
        a.download = name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
    }

    function robustCopy(text, overlay) {
        const isGlyph     = overlay && (
            overlay.classList.contains('psi-dl-glyph') ||
            overlay.classList.contains('psi-stream-glyph')
        );
        const origContent = isGlyph ? overlay.innerHTML    : '';
        const origColor   = isGlyph ? overlay.style.color  : '';
        const origBorder  = isGlyph ? overlay.style.borderColor : '';

        const onCopied = () => {
            if (!isGlyph) return;
            overlay.innerHTML = '<span style="font-size:14px;font-family:var(--font-body);font-weight:bold;">✓</span>';
            overlay.style.color       = 'var(--accent-cyan)';
            overlay.style.borderColor = 'var(--accent-cyan)';
            setTimeout(() => {
                overlay.innerHTML = origContent;
                overlay.style.color       = origColor;
                overlay.style.borderColor = origBorder;
            }, 1400);
        };
        const onFailed = () => {
            if (!isGlyph) return;
            overlay.innerHTML = '<span style="font-size:14px;font-family:var(--font-body);font-weight:bold;">X</span>';
            overlay.style.color       = 'var(--red)';
            overlay.style.borderColor = 'var(--red)';
            setTimeout(() => {
                overlay.innerHTML = origContent;
                overlay.style.color       = origColor;
                overlay.style.borderColor = origBorder;
            }, 2200);
        };

        try {
            if (typeof GM_setClipboard !== 'undefined') {
                GM_setClipboard(text, 'text');
                onCopied();
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                Object.assign(ta.style, { position: 'absolute', left: '-9999px' });
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                onCopied();
            }
        } catch (e) {
            onFailed();
        }
    }

    // =========================================================================
    // MODULE 6.4: DOM-DRIVEN CDN EXTRACTOR
    // =========================================================================
    /**
     * resolveDomStreamUrl — DOM-first single-asset CDN URL resolver.
     *
     * Used ONLY for single-asset view pages (/v/, /f/, /d/) where
     * video.currentSrc may not yet be populated. Falls back through:
     *   1. OG video meta tag
     *   2. <source src> / <video src>
     *   3. Direct CDN anchor in fetched HTML
     *   4. Gateway page #download-btn (second GM_xmlhttpRequest hop)
     *
     * For grid items, use resolveBulkFile() which uses the authenticated
     * dl.bunkr.cr API pipeline and is far more reliable.
     *
     * v7: every successful resolution is folded into the Module 3.5 URL
     * ledger so DOM-sourced URLs aggregate with sniffed/API-sourced ones.
     */
    async function resolveDomStreamUrl(targetUrl) {
        if (!targetUrl) return null;
        if (isCdnUrl(targetUrl)) return targetUrl;

        // Also check M3 passive intercept cache
        if (_lastCdnMedia && isCdnUrl(_lastCdnMedia)) {
            console.log('[Ψ-4NDR0666] M3 passive intercept fast-path hit.');
            recordUrl(_lastCdnMedia, 'dom');
            return _lastCdnMedia;
        }

        let gatewayUrl    = null;
        const initialReferer = targetUrl;

        if (targetUrl.includes('get.bunk') || targetUrl.includes('/file/')) {
            gatewayUrl = targetUrl;
        } else {
            try {
                const res = await new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        method:    'GET',
                        url:       targetUrl,
                        headers:   { 'Referer': targetUrl, 'Accept': 'text/html' },
                        timeout:   8000,
                        onload:    resolve,
                        onerror:   () => resolve({ status: 500 }),
                        ontimeout: () => resolve({ status: 408 }),
                    });
                });

                if (res.status >= 200 && res.status < 300) {
                    const doc = new DOMParser().parseFromString(res.responseText, 'text/html');

                    const ogVideo = doc.querySelector("meta[property='og:video']");
                    if (ogVideo?.content && isCdnUrl(ogVideo.content)) {
                        recordUrl(ogVideo.content, 'dom');
                        return ogVideo.content;
                    }

                    const videoSrc = doc.querySelector('source[src], video[src]');
                    if (videoSrc) {
                        const src = videoSrc.getAttribute('src') || videoSrc.src;
                        if (src && !src.startsWith('blob:') && isCdnUrl(src)) {
                            recordUrl(src, 'dom');
                            return src;
                        }
                    }

                    const cdnAnchor = doc.querySelector(
                        'a[href*="cdn.cr"][href$=".mp4"], a[href*="cdn.cr"][href$=".zip"]'
                    );
                    if (cdnAnchor && isCdnUrl(cdnAnchor.href)) {
                        recordUrl(cdnAnchor.href, 'dom');
                        return cdnAnchor.href;
                    }

                    const gw = doc.querySelector(
                        'a[href*="get.bunkr"], a.ic-download-01, a[href*="/file/"]'
                    );
                    if (gw) gatewayUrl = new URL(gw.getAttribute('href'), targetUrl).href;
                }
            } catch (e) {
                console.warn(`[Ψ-4NDR0666] Initial DOM fetch failed: ${e.message}`);
            }
        }

        if (!gatewayUrl) return null;

        console.log(`[Ψ-4NDR0666] Extracting from gateway: ${gatewayUrl}`);
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method:  'GET',
                url:     gatewayUrl,
                headers: {
                    'Referer': initialReferer,
                    'Accept':  'text/html,application/xhtml+xml',
                },
                timeout:   8000,
                onload:    (resp) => {
                    if (resp.status < 200 || resp.status >= 300) return resolve(null);
                    const doc = new DOMParser().parseFromString(resp.responseText, 'text/html');
                    const dlAnchor = doc.querySelector(
                        '#download-btn[href], a[href*="cdn"][href$=".mp4"], ' +
                        'a[href*="cdn"][href$=".zip"], a.ic-download-01[href]'
                    );
                    if (dlAnchor) {
                        const finalUrl = new URL(dlAnchor.getAttribute('href'), gatewayUrl).href;
                        console.log(`[Ψ-4NDR0666] Direct CDN resolved: ${finalUrl}`);
                        recordUrl(finalUrl, 'gateway');
                        return resolve(finalUrl);
                    }
                    resolve(null);
                },
                onerror:   () => resolve(null),
                ontimeout: () => resolve(null),
            });
        });
    }

    // =========================================================================
    // MODULE 7: UNIFIED DIRECT ACQUISITION
    // =========================================================================
    function makeAccessible(glyph, label, activateFn) {
        glyph.setAttribute('role', 'button');
        glyph.setAttribute('tabindex', '0');
        glyph.setAttribute('aria-label', label);
        glyph.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateFn(e); }
        };
    }

    const NATIVE_DL_SEL = [
        'a.ic-download-01',
        'a[href*="get.bunkr"]',
        'a[href*="/file/"]',
        'a[download][href]',
        'a.btn-main[href]',
        '#download-btn',
    ].join(', ');

    function injectCaptureVector() {
        const visited = getVisitedCache();

        const urlSlugMatch = window.location.pathname.match(/\/[vfd]\/([\w-]+)/);
        const pageSlug     = (typeof window.jsSlug !== 'undefined' && window.jsSlug)
            ? window.jsSlug
            : (urlSlugMatch ? urlSlugMatch[1] : null);

        // ── Context 1: Single-Asset View ─────────────────────────────────────
        const mediaContainer = document.querySelector(
            '.video-container, .lightgallery, img.w-full, video, #video-container'
        );
        if (mediaContainer) {
            const wrapper = mediaContainer.parentElement;
            ensureRelative(wrapper);

            if (!document.querySelector('.psi-main-dl-glyph')) {
                const dlGlyph     = document.createElement('a');
                dlGlyph.className = 'psi-dl-glyph psi-main-dl-glyph psi-glass-panel psi-btn';
                dlGlyph.innerHTML = downloadSvg;
                dlGlyph.title     = 'Direct Download';
                const activateDl  = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dlGlyph.innerHTML = spinnerHtml;

                    // Tier A: video.currentSrc (fastest — player already running)
                    const vidEl = document.querySelector('video');
                    if (vidEl?.currentSrc && !vidEl.currentSrc.startsWith('blob:') && isCdnUrl(vidEl.currentSrc)) {
                        dlGlyph.innerHTML = downloadSvg;
                        nativeDownload(vidEl.currentSrc);
                        return;
                    }

                    // Tier B: 3-hop authenticated API pipeline (dl.bunkr.cr)
                    // Requires initBulkEngine to have run and populated resolveBulkFile
                    if (resolveBulkFile && pageSlug) {
                        try {
                            const item = {
                                filePageURL: window.location.href,
                                slug:        pageSlug,
                                name:        document.title || pageSlug,
                            };
                            const { cdnURL, fname } = await resolveBulkFile(item);
                            if (cdnURL) {
                                dlGlyph.innerHTML = downloadSvg;
                                nativeDownload(cdnURL, fname);
                                return;
                            }
                        } catch (e) {
                            console.warn(`[Ψ-4NDR0666] Single-asset API pipeline failed: ${e.message}`);
                        }
                    }

                    // Tier C: DOM gateway parse (last resort)
                    const gatewayAnchor = document.querySelector(NATIVE_DL_SEL);
                    const targetUrl     = (gatewayAnchor?.href && gatewayAnchor.href !== window.location.href)
                        ? gatewayAnchor.href
                        : window.location.href;

                    const cdnUrl = await resolveDomStreamUrl(targetUrl);
                    dlGlyph.innerHTML = downloadSvg;
                    if (cdnUrl) {
                        nativeDownload(cdnUrl);
                    } else {
                        showToast('Download failed. No resolvable CDN URL found.', 3000);
                        if (targetUrl !== window.location.href) window.open(targetUrl, '_blank');
                    }
                };
                dlGlyph.onclick = activateDl;
                makeAccessible(dlGlyph, 'Download file', activateDl);
                wrapper.appendChild(dlGlyph);
            }

            if (!document.querySelector('.psi-main-stream-glyph')) {
                const streamGlyph     = document.createElement('a');
                streamGlyph.className = 'psi-stream-glyph psi-main-stream-glyph psi-glass-panel psi-btn';
                streamGlyph.innerHTML = streamSvg;
                streamGlyph.title     = 'Copy Stream URL';
                const activateStream  = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const savedHtml               = streamGlyph.innerHTML;
                    streamGlyph.innerHTML         = spinnerHtml;
                    streamGlyph.style.color       = '#fff';
                    streamGlyph.style.borderColor = '';

                    // Tier A: video.currentSrc
                    const vidEl = document.querySelector('video');
                    let streamUrl = (vidEl?.currentSrc && !vidEl.currentSrc.startsWith('blob:') && isCdnUrl(vidEl.currentSrc))
                        ? vidEl.currentSrc
                        : null;

                    // Tier B: 3-hop API pipeline
                    if (!streamUrl && resolveBulkFile && pageSlug) {
                        try {
                            const item = {
                                filePageURL: window.location.href,
                                slug:        pageSlug,
                                name:        document.title || pageSlug,
                            };
                            const result = await resolveBulkFile(item);
                            if (result?.cdnURL) streamUrl = result.cdnURL;
                        } catch (e) {
                            console.warn(`[Ψ-4NDR0666] Single-asset stream API failed: ${e.message}`);
                        }
                    }

                    // Tier C: DOM gateway
                    if (!streamUrl) {
                        const gatewayAnchor = document.querySelector(NATIVE_DL_SEL);
                        const targetUrl     = (gatewayAnchor?.href && gatewayAnchor.href !== window.location.href)
                            ? gatewayAnchor.href
                            : window.location.href;
                        streamUrl = await resolveDomStreamUrl(targetUrl);
                    }

                    streamGlyph.innerHTML = savedHtml;
                    if (streamUrl) {
                        recordUrl(streamUrl, 'stream'); // v7: ledger aggregation
                        robustCopy(streamUrl, streamGlyph);
                        if (streamUrl.includes('token=') && streamUrl.includes('ex=')) {
                            showToast('⦒ █▓░URL copied for IP streaming.', 6000, true);
                        }
                    } else {
                        streamGlyph.style.color       = 'var(--red)';
                        streamGlyph.style.borderColor = 'var(--red)';
                        setTimeout(() => {
                            streamGlyph.style.color       = '';
                            streamGlyph.style.borderColor = '';
                        }, 2500);
                    }
                };
                streamGlyph.onclick = activateStream;
                makeAccessible(streamGlyph, 'Copy stream URL', activateStream);
                wrapper.appendChild(streamGlyph);
            }
        }

        // ── Context 2: Grid View — Visited Tracking + Per-Item DL Glyphs ─────
        // GAP 11 fix: was container-first — querySelectorAll a broad, OR'd
        // list of container-level selectors, then find the first link
        // inside each match and treat that whole match as "one item." If any
        // one of those OR'd selectors (e.g. `main[class*="grid"] > div`)
        // matched an *outer* wrapper spanning the whole grid rather than a
        // single card, that wrapper was iterated as one more "item," its
        // first descendant link received a second click listener bound to
        // the wrapper, and clicking that one link added .psi-visited to the
        // whole-grid wrapper — hiding every item at once in HIDE mode, not
        // just the one clicked. Link-first + closest() structurally cannot
        // make that mistake: closest() always returns the *smallest*
        // enclosing ancestor, and the distinct-href guard below refuses to
        // treat any candidate as a single item's wrapper if it encloses
        // links to more than one distinct file (while still tolerating a
        // thumbnail+title anchor pair that both point at the *same* file,
        // which is normal markup).
        const LINK_SEL = 'a[href^="/f/"], a[href^="/v/"], a[href*="/d/"]';
        const ITEM_SEL = '.theItem, .grid-images_box, .grid > div, main.grid > div, main[class*="grid"] > div';
        const seenEls  = new Set();

        document.querySelectorAll(LINK_SEL).forEach(link => {
            // GAP 12 fix: injectCaptureVector re-runs on every debounced
            // MutationObserver pass; without this guard, an already-bound
            // link accumulated one more pair of click/auxclick listeners
            // on every pass instead of being skipped.
            if (link.dataset.psiVisitedBound) return;

            let el = link.closest(ITEM_SEL);
            if (el) {
                const hrefs = new Set(
                    [...el.querySelectorAll(LINK_SEL)].map(a => a.getAttribute('href'))
                );
                if (hrefs.size > 1) el = null; // spans distinct files — reject, too broad
            }
            if (!el) el = link.parentElement; // conservative single-link fallback scope
            if (!el || seenEls.has(el)) return;
            seenEls.add(el);
            link.dataset.psiVisitedBound = '1';

            const alphaId = link.getAttribute('href').split('/').pop();

            if (visited.has(alphaId)) el.classList.add('psi-visited');
            const markVisited = () => {
                addVisited(alphaId);
                el.classList.add('psi-visited');
            };
            link.addEventListener('click',    markVisited, { passive: true });
            link.addEventListener('auxclick', markVisited, { passive: true }); // middle-click / new-tab

            // Per-item DL glyph — uses resolveBulkFile 3-hop pipeline when available
            if (!el.querySelector('.psi-dl-glyph') && resolveBulkFile) {
                const dlGlyph     = document.createElement('a');
                dlGlyph.className = 'psi-dl-glyph psi-glass-panel psi-btn';
                dlGlyph.innerHTML = downloadSvg;
                dlGlyph.title     = 'Direct Download';
                ensureRelative(el);
                el.appendChild(dlGlyph);

                const activateDl = async (e) => {
                    if (e.type === 'mousedown' && e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    addVisited(alphaId);
                    el.classList.add('psi-visited');

                    // Use cached resolution if available
                    if (dlGlyph.dataset.resolvedUrl) {
                        nativeDownload(dlGlyph.dataset.resolvedUrl);
                        return;
                    }

                    // v7: in-progress glyph state remapped from the off-spec
                    // --yellow token to the spec highlight #67E8F9.
                    dlGlyph.style.color       = 'var(--text-cyan-active)';
                    dlGlyph.style.borderColor = 'var(--text-cyan-active)';
                    dlGlyph.innerHTML         = spinnerHtml;

                    try {
                        // Name extraction mirrors scanFiles() logic
                        let name = link.getAttribute('title') || '';
                        if (!name) { const img = link.querySelector('img'); name = img ? (img.alt || '') : ''; }
                        if (!name) { const sp  = el.querySelector('p,span'); name = sp ? sp.textContent.trim() : ''; }

                        const item   = { filePageURL: link.href, slug: alphaId, name: name || alphaId };
                        const { cdnURL, fname } = await resolveBulkFile(item);
                        dlGlyph.dataset.resolvedUrl = cdnURL;
                        dlGlyph.innerHTML           = downloadSvg;
                        dlGlyph.style.color         = '';
                        dlGlyph.style.borderColor   = '';
                        nativeDownload(cdnURL, fname);
                    } catch (err) {
                        dlGlyph.innerHTML = downloadSvg;
                        dlGlyph.style.color       = 'var(--red)';
                        dlGlyph.style.borderColor = 'var(--red)';
                        console.warn(`[Ψ-4NDR0666] Grid DL failed for ${alphaId}: ${err.message}`);
                        setTimeout(() => {
                            dlGlyph.style.color       = '';
                            dlGlyph.style.borderColor = '';
                        }, 2500);
                    }
                };
                dlGlyph.onmousedown = activateDl;
                makeAccessible(dlGlyph, 'Download file', activateDl);
            }
        });
    }

    // =========================================================================
    // MODULE 8: DIAGNOSTIC PROBE & TOAST
    // =========================================================================
    function showToast(msg, durationMs = 4000, isPsi = false) {
        const toast     = document.createElement('div');
        toast.className = isPsi
            ? 'psi-toast psi-toast--glyph psi-glass-panel'
            : 'psi-toast psi-glass-panel';
        if (isPsi) {
            // GAP 14 fix (CodeQL js/xss-through-dom): `msg` is not always a
            // literal — several call sites (e.g. nativeDownload's `hint`)
            // build it from a resolved filename, which traces back to
            // whoever uploaded the file to bunkr.cr, not to us. The old code
            // interpolated `msg` directly into an innerHTML template, so a
            // filename like `<img src=x onerror=...>` would execute as
            // markup the instant the toast rendered. specPsiSvg is a static
            // constant defined once in this script (never derived from page,
            // API, or DOM data), so it's still safe to inject as markup; the
            // label is now a real text node, which cannot be reinterpreted
            // as HTML no matter what it contains.
            toast.innerHTML   = specPsiSvg;
            const label       = document.createElement('span');
            label.className   = 'psi-toast-label';
            label.textContent = msg;
            toast.appendChild(label);
        } else {
            toast.textContent = msg;
        }
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('psi-toast--dying'), Math.max(0, durationMs - 400));
        setTimeout(() => toast.remove(), durationMs);
    }

    function executeDiagnosticProbe() {
        let ledgerM3u8 = 0;
        let ledgerFiles = 0;
        for (const rec of _urlLedger.values()) {
            if (rec.kind === 'm3u8') ledgerM3u8++; else ledgerFiles++;
        }
        const report = {
            timestamp:       new Date().toISOString(),
            url:             window.location.href,
            topology:        albumMatch ? 'GRID_VIEW' : 'SINGLE_ASSET_VIEW',
            scripts:         Array.from(document.querySelectorAll('script[data-file-id]'))
                               .map(s => s.outerHTML),
            nativeDls:       Array.from(document.querySelectorAll(
                               'a[download], a.ic-download-01, a[href*="get.bunk"], a.btn-main, #download-btn'
                             )).map(a => ({
                               className: a.className,
                               href:      a.href,
                               text:      a.innerText.trim(),
                               id:        a.id,
                             })),
            gridItemsCount:  document.querySelectorAll('.grid > div, .grid-images_box, .theItem').length,
            lastCdnMedia:    _lastCdnMedia || 'none',
            bulkEngineReady: !!resolveBulkFile,
            urlLedger: {
                m3u8:  ledgerM3u8,
                files: ledgerFiles,
                total: _urlLedger.size,
                cap:   URL_LEDGER_MAX,
            },
            settings: {
                canonicalDomain:  TARGET_DOMAIN,
                bulkConcurrency:  clampSetting(_settings.bulkConcurrency, 1, 6, 2),
                bulkDelayMs:      clampSetting(_settings.bulkDelayMs, 200, 10000, 1200),
            },
            hotkeys: 'V=cycle visited, B=pin bulk panel, U=copy URL ledger',
            envGlobals: {
                jsSlug:        typeof window.jsSlug        !== 'undefined' ? window.jsSlug        : 'undefined',
                jsCDN:         typeof window.jsCDN         !== 'undefined' ? window.jsCDN         : 'undefined',
                videoCoverUrl: typeof window.videoCoverUrl !== 'undefined' ? window.videoCoverUrl : 'undefined',
            },
        };
        const dump = JSON.stringify(report, null, 2);
        console.log('[Ψ-4NDR0666OS] Diagnostic Probe:\n', dump);
        robustCopy(dump, null);
        showToast('📡 Probe complete — data copied to clipboard.');
    }
    GM_registerMenuCommand('📡 Execute Diagnostic Probe', executeDiagnosticProbe);

    // =========================================================================
    // MODULE 9: AUTONOMOUS GATEWAY BYPASS
    // =========================================================================
    function autoEngageDownloadEndpoint() {
        const isGateway = /get\.bunkr/i.test(window.location.hostname) &&
                          window.location.pathname.includes('/file/');
        if (!isGateway) return;

        console.log('[Ψ-4NDR0666] Gateway page detected. Hunting #download-btn...');
        let attempts = 0;
        const MAX_ATTEMPTS   = 30;
        const engageInterval = setInterval(() => {
            attempts++;
            const dlBtn = document.getElementById('download-btn') ||
                          document.querySelector('a.ic-download-01');
            if (dlBtn?.href && dlBtn.href !== window.location.href && dlBtn.href !== '#') {
                clearInterval(engageInterval);
                console.log(`[Ψ-4NDR0666] Gateway: anchor found after ${attempts} attempt(s). Navigating.`);
                window.open(dlBtn.href, '_self');
            } else if (attempts >= MAX_ATTEMPTS) {
                clearInterval(engageInterval);
                console.warn(`[Ψ-4NDR0666] Gateway: anchor not ready after ${MAX_ATTEMPTS} attempts. Aborting.`);
            }
        }, 500);
        window.addEventListener('beforeunload', () => clearInterval(engageInterval), { once: true });
    }

    // =========================================================================
    // MODULE 10.5: BROKEN LINK FIXER — IMAGE HOST REPAIR
    // =========================================================================
    // Vision item "broken link fixer": bunkr rotates registrable domains
    // (bunkr.is → bunkr.cr → …), and stale bookmarked pages keep requesting
    // thumbnails/files from dead hosts. The capture-phase error listener
    // (error never bubbles, so capture on document is the only vantage
    // point) rewrites any <img> on a legacy bunkr/bunker/bunkrr host to the
    // canonical domain and retries exactly once (dataset guard). A second
    // failure marks the node .psi-img-dead instead of looping.
    function initBrokenLinkFixer() {
        document.addEventListener('error', (e) => {
            const el = e.target;
            if (!el || el.tagName !== 'IMG') return;
            const src = el.currentSrc || el.getAttribute('src') || '';
            if (!src || !/^https?:\/\//i.test(src)) return;

            const hostMatch = src.match(/^https?:\/\/([^\/]+)/i);
            if (!hostMatch) return;
            const host = hostMatch[1].toLowerCase();

            const legacy = host.match(/^(.+)\.(bunkr|bunker|bunkrr)\.[a-z0-9-]+$/);
            if (!legacy) return;

            if (el.dataset.psiImgRetry) {
                el.classList.add('psi-img-dead');
                console.warn(`[Ψ-4NDR0666] Broken-link fixer: unrecoverable image — ${src.slice(0, 80)}`);
                return;
            }

            el.dataset.psiImgRetry = '1';
            const repairedHost = `${legacy[1]}.${TARGET_DOMAIN}`;
            el.src = src.replace(hostMatch[1], repairedHost);
            console.log(`[Ψ-4NDR0666] Broken-link fixer: ${host} → ${repairedHost}`);
        }, true);
    }

    // =========================================================================
    // MODULE 10.6: POWER-USER HOTKEYS
    // =========================================================================
    // Vision item "power user control": V cycles visited visibility (reuses
    // the toggle button's own handler so behaviour can never diverge), B
    // pins/unpins the bulk panel (touch/click parity with the hover peek),
    // U exports the aggregated URL ledger. Modifier combos and text-entry
    // contexts are excluded so page search/typing never collides.
    function initHotkeys() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
            const t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

            switch (e.key.toLowerCase()) {
                case 'v': {
                    const btn = document.getElementById('psi-visited-toggle');
                    if (btn) btn.click();
                    break;
                }
                case 'b': {
                    const panel = document.getElementById('psi-bulk-panel');
                    if (panel) panel.classList.toggle('psi-open');
                    break;
                }
                case 'u': {
                    copyUrlLedger();
                    break;
                }
            }
        });

        GM_registerMenuCommand('⌨ Hotkey Reference', () => {
            showToast('⌨ V: cycle visited · B: pin bulk panel · U: copy URL ledger', 8000, true);
        });
    }

    // =========================================================================
    // MODULE 10.7: SPA NAVIGATION PATCH
    // =========================================================================
    // v7 GAP 19 fix: bunkr's Next.js client navigates via history
    // .pushState/.replaceState, which fires NEITHER popstate NOR hashchange
    // — the baseline's only two SPA re-init hooks were dead code on this
    // site, so sort enforcement, visited re-tagging and the bulk engine
    // never re-armed after in-site navigation. Patching the prototype emits
    // a synthetic 'psi-spa-nav' event that bootstrap's onSpaNav also
    // listens to. The patch wraps the native method with a try/catch and
    // preserves its return value, so the page's own routing is untouched.
    function initSpaNavigationPatch() {
        try {
            for (const method of ['pushState', 'replaceState']) {
                const orig = History.prototype[method];
                History.prototype[method] = function (...args) {
                    const result = orig.apply(this, args);
                    window.dispatchEvent(new Event('psi-spa-nav'));
                    return result;
                };
            }
            console.log('[Ψ-4NDR0666] SPA navigation patch deployed (pushState/replaceState).');
        } catch (e) {
            console.warn('[Ψ-4NDR0666] SPA history patch failed — popstate/hashchange fallback only.', e);
        }
    }

    // =========================================================================
    // MODULE 11: BULK ACQUISITION ENGINE
    // =========================================================================
    function initBulkEngine() {
        if (!albumMatch) return;
        if (document.getElementById('psi-bulk-panel')) return;

        // ── Panel DOM ────────────────────────────────────────────────────────
        const panel = document.createElement('div');
        panel.id    = 'psi-bulk-panel';
        // specPsiSvg is defined at module scope — no re-declaration needed (GAP 1)
        panel.innerHTML = `
            <div id="psi-bulk-peek">${specPsiSvg}</div>
            <div id="psi-bulk-content">
                <h3>// DOWNLOAD ALL</h3>
                <div id="psi-bulk-status">Scanning files...</div>
                <div id="psi-bulk-info">0 OK / 0 ERR / 0 TOTAL</div>
                <div id="psi-bulk-progress"><div id="psi-bulk-bar"></div></div>
                <div class="controls">
                    <button id="btn-bulk-start"   class="psi-btn" aria-label="Start Bulk Download"  style="flex:1;padding:10px 6px;" disabled>START</button>
                    <button id="btn-bulk-pause"   class="psi-btn" aria-label="Pause Bulk Download"  style="flex:1;padding:10px 6px;" disabled>PAUSE</button>
                    <button id="btn-bulk-stop"    class="psi-btn psi-destructive" aria-label="Stop Bulk Download" style="flex:1;padding:10px 6px;" disabled>STOP</button>
                    <button id="btn-bulk-log-tog" class="psi-btn" aria-label="Toggle Log Display"   style="flex:0 0 auto;padding:10px 8px;">LOG</button>
                </div>
                <div id="psi-bulk-log"></div>
            </div>
        `;
        document.body.appendChild(panel);

        // v7: clicking/tapping the peek handle pins the panel open — parity
        // with the CSS hover reveal and the 'B' hotkey, and the only reveal
        // path available on touch devices.
        document.getElementById('psi-bulk-peek').addEventListener('click', () => {
            panel.classList.toggle('psi-open');
        });

        // ── Queue state ───────────────────────────────────────────────────────
        const BulkState = {
            queue:          [],
            running:        0,
            done:           0,
            failed:         0,
            total:          0,
            paused:         false,
            aborted:        false,
            // v7: pacing and concurrency honor the persisted power-user
            // settings (Module 0.3); defaults match the baseline exactly.
            DELAY_MS:       clampSetting(_settings.bulkDelayMs, 200, 10000, 1200),
            MAX_CONCURRENT: clampSetting(_settings.bulkConcurrency, 1, 6, 2),
            API_TIMEOUT:    20000,
            DOWNLOAD_TIMEOUT: 60000, // GAP 8 fix: GM_download had no hard bound at all
            activeRequests: new Set(), // GAP 9 fix: live GM_* control handles, so STOP can abort() them
        };

        const sleep = ms => new Promise(r => setTimeout(r, ms));

        // ── Logging helpers ───────────────────────────────────────────────────
        function logBulk(msg, level = 'inf') {
            const logEl = document.getElementById('psi-bulk-log');
            if (!logEl) return;
            const span     = document.createElement('span');
            span.className = `psi-log-${level}`;
            span.textContent = `[Ψ] ${msg}`;
            logEl.appendChild(span);
            logEl.scrollTop = logEl.scrollHeight;
            if (level !== 'dbg') console.log(`[Ψ-BULK] ${msg}`);
        }

        function setBulkStatus(msg) {
            const st = document.getElementById('psi-bulk-status');
            if (st) st.textContent = msg;
        }

        function updateBulkUI() {
            const bar  = document.getElementById('psi-bulk-bar');
            const info = document.getElementById('psi-bulk-info');
            if (!BulkState.total) return;
            const pct = ((BulkState.done + BulkState.failed) / BulkState.total) * 100;
            if (bar)  bar.style.width    = `${pct}%`;
            if (info) info.textContent   =
                `${BulkState.done} OK / ${BulkState.failed} ERR / ${BulkState.total} TOTAL`;
        }

        // ── scanFiles ─────────────────────────────────────────────────────────
        // v7 GAP 15 fix: the baseline scanned ONLY a[href*="/f/"] anchors, so
        // video-heavy albums (whose grid cards link through /v/<slug>) and
        // /d/ endpoints were invisible to the bulk engine — START reported
        // "⚠ No files found!" on exactly the albums this script exists for.
        // The selector and the pathname gate now accept the full /f|/v|/d
        // asset surface while keeping per-pathname dedupe.
        function scanFiles() {
            const seen  = new Set();
            const files = [];
            for (const a of document.querySelectorAll('a[href*="/f/"], a[href*="/v/"], a[href*="/d/"]')) {
                try {
                    const url = new URL(a.href);
                    if (!/^\/[fvd]\//.test(url.pathname) || seen.has(url.pathname)) continue;
                    seen.add(url.pathname);
                    const slug = url.pathname.split('/').pop();
                    let name = a.getAttribute('title') || '';
                    if (!name) { const img = a.querySelector('img');  name = img ? (img.alt || '') : ''; }
                    if (!name) { const sp  = a.querySelector('p,span'); name = sp ? sp.textContent.trim() : ''; }
                    files.push({ filePageURL: a.href, slug, name: name || slug });
                } catch (_) { /* EAFP */ }
            }
            return files;
        }

        // ── GM_xmlhttpRequest wrapper ─────────────────────────────────────────
        function gmFetch(opts) {
            return new Promise((resolve, reject) => {
                // GAP 9 fix: capture the control handle so an in-flight
                // request can be abort()-ed from the STOP button, and
                // deregister on every terminal path (finally-equivalent —
                // GM_xmlhttpRequest has no promise/finally of its own).
                const control = GM_xmlhttpRequest({
                    timeout:   BulkState.API_TIMEOUT,
                    ...opts,
                    onload:    r  => { BulkState.activeRequests.delete(control); resolve(r); },
                    onerror:   () => { BulkState.activeRequests.delete(control); reject(new Error('Network error: ' + opts.url)); },
                    ontimeout: () => { BulkState.activeRequests.delete(control); reject(new Error('Timeout: '       + opts.url)); },
                    onabort:   () => { BulkState.activeRequests.delete(control); reject(new Error('Aborted: '       + opts.url)); },
                });
                BulkState.activeRequests.add(control);
            });
        }

        // ── findFileObj (deep __NEXT_DATA__ traversal) ────────────────────────
        function findFileObj(obj, depth = 0) {
            if (depth > 12 || !obj || typeof obj !== 'object') return null;
            if (Array.isArray(obj)) {
                for (const v of obj) { const r = findFileObj(v, depth + 1); if (r) return r; }
                return null;
            }
            const hasNumId = obj.id && /^\d{5,12}$/.test(String(obj.id));
            const hasName  = obj.name || obj.filename || obj.original;
            if (hasNumId && hasName) {
                return { id: String(obj.id), name: obj.name || obj.filename || obj.original };
            }
            for (const v of Object.values(obj)) {
                const r = findFileObj(v, depth + 1);
                if (r) return r;
            }
            return null;
        }

        // ── getNumericId ──────────────────────────────────────────────────────
        async function getNumericId(item) {
            const res  = await gmFetch({
                method:  'GET',
                url:     item.filePageURL,
                headers: { 'User-Agent': navigator.userAgent, 'Referer': window.location.href },
            });
            const html = res.responseText;

            // 1. __NEXT_DATA__ JSON — most reliable
            const ndm = html.match(
                /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
            );
            if (ndm) {
                try {
                    const nd   = JSON.parse(ndm[1]);
                    const pp   = nd?.props?.pageProps || {};
                    const keys = ['file', 'media', 'item', 'data', 'video', 'image'];
                    for (const k of keys) {
                        if (pp[k]?.id) {
                            const numId = String(pp[k].id);
                            const fname = pp[k].name || pp[k].filename || pp[k].original || item.name;
                            logBulk(`  [ND] ${k}.id=${numId}`, 'dbg');
                            return { numId, fname };
                        }
                    }
                    if (pp.id) return { numId: String(pp.id), fname: pp.name || item.name };

                    const found = findFileObj(nd);
                    if (found) {
                        logBulk(`  [ND-deep] id=${found.id}`, 'dbg');
                        return { numId: String(found.id), fname: found.name || item.name };
                    }
                } catch (e) {
                    logBulk(`  ND err: ${e.message}`, 'dbg');
                }
            }

            // 2. dl.bunkr.cr/file/<id> href in raw HTML
            const dlm = html.match(/dl\.bunkr\.cr\/file\/(\d+)/i);
            if (dlm) return { numId: dlm[1], fname: item.name };

            // 3. Generic numeric id regex fallback
            const idMatches = [...html.matchAll(/"id"\s*:\s*(\d{5,12})/g)];
            if (idMatches.length) {
                const numId = idMatches[idMatches.length - 1][1];
                logBulk(`  [regex] id=${numId}`, 'dbg');
                return { numId, fname: item.name };
            }

            throw new Error('Numeric ID resolution failure.');
        }

        // ── callMainAPI ───────────────────────────────────────────────────────
        async function callMainAPI(numId) {
            logBulk(`  POST _001_v2 {id:"${numId}"}`, 'dbg');
            const res = await gmFetch({
                method: 'POST',
                url:    'https://dl.bunkr.cr/api/_001_v2',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin':       'https://dl.bunkr.cr',
                    'Referer':      'https://dl.bunkr.cr/',
                    'User-Agent':   navigator.userAgent,
                },
                data: JSON.stringify({ id: numId }),
            });
            logBulk(`  API ${res.status}: ${res.responseText.slice(0, 120)}`, 'dbg');

            if (res.status < 200 || res.status >= 300)
                throw new Error(`API ${res.status}: ${res.responseText.slice(0, 80)}`);

            let json;
            try { json = JSON.parse(res.responseText); }
            catch (_) { throw new Error('JSON parse error: ' + res.responseText.slice(0, 80)); }

            if (!json?.mediafiles || !json?.path)
                throw new Error('API routing payload empty: ' + res.responseText.slice(0, 80));

            return {
                cdnBase:  json.mediafiles.replace(/\/$/, ''),
                filePath: json.path,
                original: json.original || '',
            };
        }

        // ── getSignedToken ────────────────────────────────────────────────────
        async function getSignedToken(filePath) {
            const signURL = `https://glb-apisign.cdn.cr/sign?path=${encodeURIComponent(filePath)}`;
            logBulk(`  SIGN ${signURL}`, 'dbg');
            const res = await gmFetch({
                method:  'GET',
                url:     signURL,
                headers: {
                    'Origin':     'https://dl.bunkr.cr',
                    'Referer':    'https://dl.bunkr.cr/',
                    'User-Agent': navigator.userAgent,
                },
            });
            logBulk(`  SIGN ${res.status}: ${res.responseText.slice(0, 120)}`, 'dbg');

            if (res.status < 200 || res.status >= 300)
                throw new Error(`Sign API ${res.status}: ${res.responseText.slice(0, 80)}`);

            let json;
            try { json = JSON.parse(res.responseText); }
            catch (_) { throw new Error('Sign JSON parse error: ' + res.responseText.slice(0, 80)); }

            if (!json?.token || !json?.ex)
                throw new Error('Sign response payload empty: ' + res.responseText.slice(0, 80));

            return { token: json.token, ex: json.ex };
        }

        // ── resolveBulkFile (module-scope export) ─────────────────────────────
        // GAP 13 fix: removed the albumGalleryCache "fast-path" (GAP 2, prior
        // revision). `/api/album/gallery`'s `image_url` is a preview/thumbnail
        // asset — it is never the signed, authenticated original-file CDN URL
        // that dl.bunkr.cr's sign pipeline produces. Every bulk (and per-item
        // grid glyph) download that hit this cache was handed a thumbnail URL
        // to download as if it were the file; the CDN correctly rejected the
        // request, surfacing as a uniform SERVER_BAD_CONTENT across every
        // item. There is no valid fast-path around the signed-URL requirement
        // — every file must go through getNumericId → callMainAPI →
        // getSignedToken.
        // GAP 6 fix: 3-retry exponential backoff on API failures.
        //
        // Resolution order:
        //   1. getNumericId (fetch /f/<slug> page, parse __NEXT_DATA__)
        //   2. callMainAPI  (POST dl.bunkr.cr/api/_001_v2 → CDN base + file path)
        //   3. getSignedToken (GET glb-apisign.cdn.cr/sign → token + ex)
        //   4. Assemble signed CDN URL
        resolveBulkFile = async function _resolveBulkFile(item, attempt = 0) {
            const MAX_RETRIES = 3;

            try {
                const { numId, fname }                = await getNumericId(item);
                item._numId = numId;

                const { cdnBase, filePath, original } = await callMainAPI(numId);
                const { token, ex }                   = await getSignedToken(filePath);
                const n      = original || fname || item.name;
                const cdnURL = `${cdnBase}${filePath}?n=${encodeURIComponent(n)}&token=${token}&ex=${ex}`;
                logBulk(`  CDN: ${cdnURL.slice(0, 80)}…`, 'dbg');
                recordUrl(cdnURL, 'api'); // v7: signed resolutions feed the ledger
                return { cdnURL, fname: n };

            } catch (e) {
                // Exponential backoff retry for transient failures (429, network errors)
                if (attempt < MAX_RETRIES) {
                    const backoff = Math.pow(2, attempt) * 1000;
                    logBulk(
                        `  Retry ${attempt + 1}/${MAX_RETRIES} for ${item.name} in ${backoff}ms: ${e.message}`,
                        'dbg'
                    );
                    await sleep(backoff);
                    return _resolveBulkFile(item, attempt + 1);
                }
                throw e;
            }
        };

        // ── downloadBulkFile ──────────────────────────────────────────────────
        // GAP 5/8 fix: GM_download exposes no native `timeout` option, so the
        // prior comment's claim that "API_TIMEOUT covers each hop" was false —
        // gmFetch's timeout only bounds the 3-hop resolution, never the actual
        // file transfer. A stalled transfer previously held `running` open
        // forever, hanging processBulkQueue's completion-wait indefinitely.
        // We now race the transfer against an explicit setTimeout and abort()
        // the control handle if it fires (Gate 4.2). GAP 9 fix: the handle is
        // also registered in activeRequests so STOP can abort it directly.
        function downloadBulkFile(url, filename) {
            return new Promise((resolve, reject) => {
                let settled = false;
                const cleanup = () => {
                    clearTimeout(hardTimeout);
                    BulkState.activeRequests.delete(control);
                };
                const control = GM_download({
                    url,
                    name:   (filename || 'bunkr_file').replace(/[\\/:*?"<>|]/g, '_').substring(0, 200),
                    saveAs: false,
                    headers: { 'Referer': 'https://dl.bunkr.cr/' },
                    onerror(e) {
                        if (settled) return;
                        settled = true;
                        cleanup();
                        const reason = (e && (e.error || e.message)) ? (e.error || e.message) : 'unknown GM_download error';
                        reject(new Error(String(reason)));
                    },
                    onload() {
                        if (settled) return;
                        settled = true;
                        cleanup();
                        resolve();
                    },
                });
                BulkState.activeRequests.add(control);
                const hardTimeout = setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    try { control && typeof control.abort === 'function' && control.abort(); } catch (_) { /* EAFP */ }
                    cleanup();
                    reject(new Error('Download timeout (' + (BulkState.DOWNLOAD_TIMEOUT / 1000) + 's): ' + url));
                }, BulkState.DOWNLOAD_TIMEOUT);
            });
        }

        // ── processBulkQueue ──────────────────────────────────────────────────
        async function processBulkQueue() {
            while (BulkState.queue.length > 0 && !BulkState.aborted) {
                if (BulkState.paused)                        { await sleep(400); continue; }
                if (BulkState.running >= BulkState.MAX_CONCURRENT) { await sleep(200); continue; }

                const item = BulkState.queue.shift();
                BulkState.running++;

                (async () => {
                    try {
                        setBulkStatus(`⟳ Res: ${item.name}`);
                        logBulk(`→ Res: ${item.name}`, 'inf');
                        const { cdnURL, fname } = await resolveBulkFile(item);

                        setBulkStatus(`⟳ DL: ${fname}`);
                        logBulk(`↓ DL: ${fname}`, 'inf');
                        await downloadBulkFile(cdnURL, fname);

                        BulkState.done++;
                        logBulk(`✓ OK: ${fname}`, 'ok');
                    } catch (e) {
                        BulkState.failed++;
                        logBulk(`✗ ERR: ${item.name} — ${e.message}`, 'err');
                    } finally {
                        // GAP 10 fix: previously `running--` happened here and
                        // the DELAY_MS sleep ran *after*, outside the finally.
                        // That freed the concurrency slot immediately, so the
                        // outer while-loop admitted the next item before any
                        // delay elapsed — DELAY_MS traced through the code but
                        // never actually paced requests against the CDN. The
                        // sleep now runs while the slot is still held.
                        if (!BulkState.aborted && BulkState.queue.length > 0) {
                            await sleep(BulkState.DELAY_MS);
                        }
                        BulkState.running--;
                        updateBulkUI();
                    }
                })();
            }

            // Wait for all concurrent downloads to settle
            await new Promise(r => {
                const iv = setInterval(() => {
                    if (!BulkState.running) { clearInterval(iv); r(); }
                }, 300);
            });

            if (!BulkState.aborted) {
                setBulkStatus(`✅ Complete: ${BulkState.done} OK / ${BulkState.failed} ERR`);
                const bar = document.getElementById('psi-bulk-bar');
                if (bar) {
                    bar.style.background = '#4ade80';
                    bar.style.boxShadow  = '0 0 10px #4ade80';
                }
            }
            document.getElementById('btn-bulk-start').disabled = false;
            document.getElementById('btn-bulk-pause').disabled = true;
            document.getElementById('btn-bulk-stop').disabled  = true;
        }

        // ── Button event wiring ───────────────────────────────────────────────
        document.getElementById('btn-bulk-log-tog').onclick = () => {
            const l = document.getElementById('psi-bulk-log');
            l.style.display = l.style.display === 'block' ? 'none' : 'block';
        };

        document.getElementById('btn-bulk-start').onclick = async () => {
            const files = scanFiles();
            if (!files.length) { setBulkStatus('⚠ No files found!'); return; }

            Object.assign(BulkState, {
                queue:   [...files],
                total:   files.length,
                done:    0,
                failed:  0,
                running: 0,
                paused:  false,
                aborted: false,
            });

            const log = document.getElementById('psi-bulk-log');
            const bar = document.getElementById('psi-bulk-bar');
            if (log) log.innerHTML     = '';
            if (log) log.style.display = 'block';
            if (bar) {
                bar.style.background = 'var(--accent-cyan)';
                bar.style.boxShadow  = '0 0 8px var(--glow-cyan-active)';
            }
            document.getElementById('btn-bulk-start').disabled = true;
            document.getElementById('btn-bulk-pause').disabled = false;
            document.getElementById('btn-bulk-stop').disabled  = false;

            updateBulkUI();
            setBulkStatus('Initiating Pipeline…');
            logBulk(`Registered ${files.length} payload(s) from DOM matrix.`, 'inf');
            processBulkQueue();
        };

        document.getElementById('btn-bulk-pause').onclick = () => {
            BulkState.paused = !BulkState.paused;
            document.getElementById('btn-bulk-pause').textContent =
                BulkState.paused ? 'RESUME' : 'PAUSE';
            setBulkStatus(BulkState.paused ? '⏸ Pipeline Suspended' : '▶ Resuming Pipeline…');
        };

        document.getElementById('btn-bulk-stop').onclick = () => {
            BulkState.aborted = true;
            BulkState.queue   = [];
            // GAP 9 fix: previously left already-running GM_xmlhttpRequest /
            // GM_download calls to finish on their own — STOP only prevented
            // *new* items from starting. Now actively abort every live handle.
            for (const control of BulkState.activeRequests) {
                try { control && typeof control.abort === 'function' && control.abort(); } catch (_) { /* EAFP */ }
            }
            BulkState.activeRequests.clear();
            setBulkStatus('✕ Pipeline Cancelled');
            document.getElementById('btn-bulk-start').disabled = false;
            document.getElementById('btn-bulk-pause').disabled = true;
            document.getElementById('btn-bulk-stop').disabled  = true;
        };

        // Initial scan — polls until grid is populated
        // v7 GAP 18 fix: bounded polling (GUP B.1) — 60 attempts × 1.5s = a
        // 90s ceiling, then a terminal status message instead of an
        // infinite setTimeout chain that ticks forever on barren pages.
        let scanAttempts = 0;
        const scanAndShow = () => {
            const files    = scanFiles();
            const status   = document.getElementById('psi-bulk-status');
            const startBtn = document.getElementById('btn-bulk-start');
            if (files.length) {
                if (status)   status.textContent = `${files.length} grid files acquired.`;
                if (startBtn) startBtn.disabled  = false;
            } else if (++scanAttempts >= 60) {
                if (status) status.textContent = 'No grid files detected after 90s — START rescans on demand.';
            } else {
                if (status) status.textContent = 'Awaiting grid population…';
                setTimeout(scanAndShow, 1500);
            }
        };
        setTimeout(scanAndShow, 1000);
    }

    // =========================================================================
    // MODULE 10: DEFENSIVE ORCHESTRATION
    // =========================================================================
    function bootstrap() {
        if (!document.body) { setTimeout(bootstrap, 50); return; }
        console.log('[Ψ-4NDR0666] Intelligence baseline established. Injecting payloads.');

        // v7: new power-user surfaces come online before any acquisition
        // logic so every later module can rely on them — SPA nav events,
        // broken-image repair, and the V/B/U hotkeys.
        initSpaNavigationPatch();
        initBrokenLinkFixer();
        initHotkeys();

        initVisitedTracker();
        forceLargestFirst();
        autoEngageDownloadEndpoint();

        // initBulkEngine must run BEFORE injectCaptureVector so that
        // resolveBulkFile is populated when grid glyphs are injected
        initBulkEngine();
        setTimeout(injectCaptureVector, 800);

        const observer = new MutationObserver((mutations) => {
            const structural = mutations.some(m => m.addedNodes.length > 0);
            if (!structural) return;
            clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(() => { injectCaptureVector(); }, 400);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('beforeunload', () => observer.disconnect(), { once: true });

        // v7: debounced SPA re-init. The baseline bound only popstate +
        // hashchange, neither of which fires on Next.js pushState/replaceState
        // navigation (GAP 19); 'psi-spa-nav' from Module 10.7 closes that
        // hole, and the timer debounce collapses rapid-route burst re-arms.
        // The gateway re-engage is re-armed too — a client-side route into
        // /file/ gets the same bypass as a full page load.
        let _spaNavTimer = null;
        const onSpaNav = () => {
            observer.disconnect();
            _sortExecuted = false;
            clearTimeout(_spaNavTimer);
            _spaNavTimer = setTimeout(() => {
                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true });
                    initVisitedTracker();
                    forceLargestFirst();
                    autoEngageDownloadEndpoint();
                    if (!document.getElementById('psi-bulk-panel')) initBulkEngine();
                    injectCaptureVector();
                }
            }, 600);
        };
        window.addEventListener('popstate',    onSpaNav);
        window.addEventListener('hashchange',  onSpaNav);
        window.addEventListener('psi-spa-nav', onSpaNav);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();
