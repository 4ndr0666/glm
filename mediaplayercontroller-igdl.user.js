// ==UserScript==
// @name         4ndr0tools - Media Player Controller-IGDL
// @namespace    https://github.com/4ndr0666/userscripts
// @version      6.0.1
// @author       4ndr0666 & gaston1799
// @description  Speed • Alt+Shift rAF Zoom/Pan • Rotation • Smart Maximize • PiP • Play/DblClick • Pause-on-Acquire • Virtual DOM Nodes • Cyan-Glass Scrub Bar • IG Story Nav & Repeat • Draggable HUD • Downloader (YT, IG, TikTok, Blobs) • Ad Skip
// @license      MIT
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @all_frames   true
// @run-at       document-end
// @icon         https://raw.githubusercontent.com/4ndr0666/4ndr0site/refs/heads/main/static/cyanglassarch.png
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // SINGLETON GUARD
    // ==========================================
    if (window.psiMediaGodmodeLoaded) return;
    window.psiMediaGodmodeLoaded = true;

    // ==========================================
    // CONSTANTS & PATHS
    // ==========================================
    const DownloaderTargetDomain = "https://onlymp3.app";

    // ==========================================
    // INTERNAL STATE & TARGETING
    // ==========================================
    let activeVideo = null;
    let activeImage = null;
    let targetSpeed = GM_getValue('media_speed', 1.0);
    let adMutedState = 0;

    const state = {
        rotation:    0,
        zoom:        1.0,
        panX:        50,
        panY:        50,
        isMaximized: false,
        isPlaying:   false,
        isScrubbing: false,
        isRepeating: false
    };

    function getActiveMedia() {
        return activeVideo || activeImage;
    }

    // ==========================================
    // SYSTEM STYLING & ISOLATION
    // ==========================================
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght=500;700&display=swap');

        :root {
            --bg-dark-base:          #050A0F;
            --bg-glass-panel:        rgba(10,19,26,0.85);
            --accent-cyan:           #00E5FF;
            --text-cyan-active:      #67E8F9;
            --accent-cyan-border:    rgba(0,229,255,0.4);
            --accent-cyan-bg-active: rgba(0,229,255,0.18);
            --glow-cyan-active:      rgba(0,229,255,0.35);
            --font-body:             'Roboto Mono', monospace;
        }

        .psi-media-maximized {
            position:    fixed      !important;
            inset:       0          !important;
            width:       100vw      !important;
            height:      100vh      !important;
            max-width:   none       !important;
            max-height:  none       !important;
            z-index:     2147483646 !important;
            background: #000       !important;
            object-fit: contain    !important;
        }
        body.psi-max-locked { overflow: hidden !important; }

        .psi-video-placeholder { cursor: pointer; }
        .psi-video-placeholder:hover { border-color: rgba(0,229,255,0.7) !important; }

        #media-godmode-ui {
            position:        fixed;
            z-index:         2147483647;
            padding:         12px 16px;
            background:      var(--bg-glass-panel);
            backdrop-filter: blur(16px);
            border:          1px solid var(--accent-cyan-border);
            border-radius:   6px;
            box-shadow:      0 8px 32px rgba(0,0,0,0.45);
            color:           #e0ffff;
            font-family:     var(--font-body);
            user-select:     none;
            font-size:       11px;
            transition:      opacity 0.2s ease;
            top: 40px;
            right: 40px;
        }
        #media-godmode-ui.dragging { box-shadow: 0 0 25px var(--glow-cyan-active); }

        #mg-title {
            font-size:     10px;
            font-weight:   700;
            margin-bottom: 10px;
            text-align:    center;
            letter-spacing: 1.5px;
            cursor:        grab;
            border-bottom: 1px solid rgba(0,229,255,0.2);
            padding-bottom: 6px;
            text-shadow:   0 0 6px var(--accent-cyan);
        }
        #mg-title:active { cursor: grabbing; }

        .mg-row {
            display:       flex;
            align-items:   center;
            gap:           8px;
            margin-bottom: 9px;
        }

        #media-godmode-ui button, .psi-btn-injected {
            background:   rgba(0,0,0,0.55);
            border:       1px solid rgba(0,229,255,0.35);
            color:        #e0ffff;
            padding:      5px 9px;
            border-radius: 3px;
            cursor:       pointer;
            transition:   all 0.2s;
            font-size:    10.5px;
            font-family:  var(--font-body);
            font-weight:  bold;
        }
        #media-godmode-ui button:hover, .psi-btn-injected:hover {
            border-color: var(--accent-cyan);
            background:   rgba(0,229,255,0.08);
            box-shadow:   0 0 8px var(--glow-cyan-active);
        }
        #media-godmode-ui button.active {
            color:        var(--text-cyan-active);
            background:   var(--accent-cyan-bg-active);
            border-color: var(--accent-cyan);
            box-shadow:   0 0 10px var(--glow-cyan-active);
        }

        .psi-btn-injected {
            margin: 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        input[type="range"] {
            accent-color: var(--accent-cyan);
            width:        130px;
            height:       4px;
            cursor:       pointer;
        }

        .mg-actions { display: flex; gap: 6px; }
        .mg-actions button { flex: 1; padding: 7px 0; font-size: 10px; letter-spacing: 0.5px; }

        .mg-icon-btn {
            padding:     5px 8px  !important;
            font-size:   11px     !important;
            line-height: 1        !important;
            flex-shrink: 0;
        }

        #mg-maximize.active {
            color:        #FF0055;
            border-color: #FF0055;
            box-shadow:   0 0 10px rgba(255,0,85,0.3);
        }

        #mg-play.active, #mg-repeat.active {
            color:        #00FF88;
            border-color: #00FF88;
            box-shadow:   0 0 10px rgba(0,255,136,0.35);
        }

        #mg-nav-prev, #mg-nav-next { font-size: 13px !important; }

        /* ── Cyan-Glass Scrub Bar ── */
        .psi-scrub-bar {
            position:        fixed;
            z-index:         2147483645;
            display:         flex;
            align-items:     center;
            gap:             8px;
            padding:         6px 10px;
            background:      var(--bg-glass-panel);
            backdrop-filter: blur(14px);
            border:          1px solid var(--accent-cyan-border);
            border-radius:   5px;
            box-shadow:      0 4px 18px rgba(0,0,0,0.4);
            font-family:     var(--font-body);
            font-size:       10px;
            color:           #e0ffff;
            user-select:     none;
            opacity:         0;
            pointer-events:  none;
            transition:      opacity 0.15s ease;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 60%;
            min-width: 320px;
        }
        .psi-scrub-bar.psi-scrub-visible {
            opacity:         1;
            pointer-events: auto;
        }
        .psi-scrub-time {
            flex-shrink:  0;
            white-space:  nowrap;
            letter-spacing: 0.3px;
            min-width:    78px;
            text-align:   center;
        }
        .psi-scrub-track {
            position:     relative;
            flex:         1;
            height:       4px;
            min-width:    80px;
            background:   rgba(0,229,255,0.15);
            border-radius: 2px;
            cursor:       pointer;
        }
        .psi-scrub-fill {
            position:      absolute;
            top: 0; left: 0; bottom: 0;
            width:         0%;
            background:    var(--accent-cyan);
            border-radius: 2px;
            box-shadow:    0 0 6px var(--glow-cyan-active);
            pointer-events: none;
        }
        .psi-scrub-handle {
            position:        absolute;
            top:             50%;
            left:            0%;
            width:           10px;
            height:          10px;
            border-radius:   50%;
            background:      var(--text-cyan-active);
            box-shadow:      0 0 8px var(--glow-cyan-active);
            transform:       translate(-50%, -50%);
            pointer-events:  none;
        }

        /* ── Download Button ── */
        .psi-dl-btn {
            position:        fixed;
            z-index:         2147483645;
            width:           34px;
            height:          34px;
            padding:         0;
            display:         flex;
            align-items:     center;
            justify-content: center;
            background:      var(--bg-glass-panel);
            backdrop-filter: blur(14px);
            border:          1px solid var(--accent-cyan-border);
            border-radius:   50%;
            box-shadow:      0 4px 14px rgba(0,0,0,0.4);
            color:           var(--text-cyan-active);
            font-size:       16px;
            cursor:          pointer;
            opacity:         0;
            pointer-events:  none;
            transition:      opacity 0.15s ease, transform 0.15s ease;
            top: 20px;
            left: 20px;
        }
        .psi-dl-btn.psi-dl-visible { opacity: 1; pointer-events: auto; }
        .psi-dl-btn:hover {
            border-color: var(--accent-cyan);
            box-shadow:   0 0 12px var(--glow-cyan-active);
            transform:    scale(1.08);
        }
        .psi-dl-btn.psi-dl-busy {
            color:   #FFD600;
            opacity: 0.7 !important;
            cursor:  wait;
        }
    `);

    // ==========================================
    // DOM UTILITIES
    // ==========================================
    const $ = {
        get: (sel, ctx = document) => ctx.querySelector(sel),
        all: (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel)),
        create: (tag, attrs = {}, styles = {}) => {
            const el = document.createElement(tag);
            Object.assign(el, attrs);
            Object.assign(el.style, styles);
            return el;
        }
    };

    // ==========================================
    // VIRTUAL DOM / PLACEMENT REGISTRY
    // ==========================================
    const VNODE_PREFIX = 'psi_vnode_';
    const VNODE_MARGIN = 200;

    function getStableId(video) {
        const src = video.currentSrc || video.src || '';
        if (src) {
            try {
                const u = new URL(src);
                return 'src_' + (u.pathname + u.search).slice(0, 80).replace(/[^a-zA-Z0-9_-]/g, '_');
            } catch (_) {
                return 'raw_' + src.slice(0, 80).replace(/[^a-zA-Z0-9_-]/g, '_');
            }
        }
        const all = $.all('video');
        return 'idx_' + all.indexOf(video);
    }

    function persistVNode(video) {
        const id = getStableId(video);
        const rect = video.getBoundingClientRect();
        const record = {
            stableId:    id,
            src:         video.currentSrc || video.src || '',
            currentTime: isFinite(video.currentTime) ? video.currentTime : 0,
            muted:       video.muted,
            volume:      video.volume,
            loop:        video.loop,
            rect: {
                top:    rect.top  + window.scrollY,
                left:   rect.left + window.scrollX,
                width:  rect.width,
                height: rect.height
            }
        };
        try { localStorage.setItem(VNODE_PREFIX + id, JSON.stringify(record)); } catch (_) {}
    }

    function loadVNode(id) {
        try {
            const raw = localStorage.getItem(VNODE_PREFIX + id);
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    }

    function pruneToPlaceholder(video) {
        if (video.dataset.psiPruned === 'true') return;
        persistVNode(video);
        const id = getStableId(video);
        const rect = video.getBoundingClientRect();
        const ph = $.create('div', { className: 'psi-video-placeholder', id: video.id || '' }, {
            display: 'inline-block',
            width: `${rect.width || video.offsetWidth}px`,
            height: `${rect.height || video.offsetHeight}px`,
            background: '#000',
            border: '1px dashed rgba(0,229,255,0.3)',
            boxSizing: 'border-box',
            position: 'relative'
        });
        ph.dataset.psiStableId = id;
        const label = $.create('span', { textContent: '[psi-node]' }, {
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            color: 'rgba(0,229,255,0.4)', fontSize: '11px',
            fontFamily: 'monospace', pointerEvents: 'none'
        });
        ph.appendChild(label);
        if (video.className) ph.dataset.psiOrigClass = video.className;
        video.dataset.psiPruned = 'true';
        video.replaceWith(ph);
    }

    function rehydratePlaceholder(ph) {
        const id = ph.dataset.psiStableId;
        if (!id) return;
        const record = loadVNode(id);
        if (!record || !record.src) return;
        const video = $.create('video', {
            src: record.src,
            currentTime: record.currentTime || 0,
            muted: record.muted !== undefined ? record.muted : false,
            volume: record.volume !== undefined ? record.volume : 1.0,
            loop: record.loop || false,
            controls: true
        }, { width: ph.style.width, height: ph.style.height });
        if (ph.id) video.id = ph.id;
        if (ph.dataset.psiOrigClass) video.className = ph.dataset.psiOrigClass;
        video.pause();
        ph.replaceWith(video);
        video.playbackRate = targetSpeed;
        bindMediaEvents(video);
    }

    function runVirtualizationSweep() {
        const vpTop = window.scrollY, vpBottom = vpTop + window.innerHeight;
        $.all('video').forEach(video => {
            if (video === activeVideo) return;
            const rect = video.getBoundingClientRect();
            const absTop = rect.top + window.scrollY;
            const absBottom = absTop + rect.height;
            if ((absBottom < (vpTop - VNODE_MARGIN) || absTop > (vpBottom + VNODE_MARGIN)) && !video.dataset.psiPruned) pruneToPlaceholder(video);
        });
        $.all('.psi-video-placeholder').forEach(ph => {
            const rect = ph.getBoundingClientRect();
            const absTop = rect.top + window.scrollY;
            const absBottom = absTop + rect.height;
            if (absBottom > (vpTop - VNODE_MARGIN) && absTop < (vpBottom + VNODE_MARGIN)) rehydratePlaceholder(ph);
        });
    }

    let sweepScheduled = false;
    function scheduleSweep() {
        if (sweepScheduled) return;
        sweepScheduled = true;
        requestAnimationFrame(() => { runVirtualizationSweep(); sweepScheduled = false; });
    }

    window.addEventListener('scroll', scheduleSweep, { passive: true });
    window.addEventListener('resize', scheduleSweep, { passive: true });

    // ==========================================
    // CORE SYNC & TARGET ACQUISITION
    // ==========================================
    let applyMediaState = () => {
        $.all('video').forEach(v => { if (v.playbackRate !== targetSpeed) v.playbackRate = targetSpeed; });
        const media = getActiveMedia();
        if (media) {
            media.style.transform = `rotate(${state.rotation}deg) scale(${state.zoom})`;
            media.style.transformOrigin = `${state.panX}% ${state.panY}%`;
            if (media.tagName === 'VIDEO') {
                media.style.objectPosition = `${state.panX}% ${state.panY}%`;
            }
        }
    };

    function formatTime(secs) {
        if (!isFinite(secs) || secs < 0) return "00:00";
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // Dynamic UI References
    let dlBtn, scrubBar, scrubFill, scrubHandle, scrubTime;

    function updateScrubUI() {
        if (!activeVideo || !scrubBar) return;
        const cur = activeVideo.currentTime || 0;
        const dur = activeVideo.duration || 0;
        scrubTime.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
        if (dur > 0 && !state.isScrubbing) {
            const pct = (cur / dur) * 100;
            scrubFill.style.width = `${pct}%`;
            scrubHandle.style.left = `${pct}%`;
        }
    }

    function acquireTarget(video, autoPlay = false) {
        if (!video || video === activeVideo) return;
        activeVideo = video;
        activeImage = null;
        $.all('video').forEach(v => { if (v !== video && !v.paused) { v.pause(); } });
        applyMediaState();
        if (autoPlay) video.play().catch(() => {});

        if (scrubBar) scrubBar.classList.add('psi-scrub-visible');
        if (dlBtn) dlBtn.classList.add('psi-dl-visible');

        const playBtn = document.getElementById('mg-play');
        if (playBtn) {
            if (!video.paused) playBtn.classList.add('active');
            else playBtn.classList.remove('active');
        }
    }

    function acquireImage(img) {
        if (!img || img === activeImage) return;
        activeImage = img;
        activeVideo = null;
        applyMediaState();
        if (scrubBar) scrubBar.classList.remove('psi-scrub-visible');
        if (dlBtn) dlBtn.classList.add('psi-dl-visible');
    }

    function isTrackableImage(el) {
        if (!el || el.tagName !== 'IMG') return false;
        const rect = el.getBoundingClientRect();
        return rect.width >= 150 && rect.height >= 150;
    }

    function bindMediaEvents(video) {
        video.addEventListener('play', () => {
            if (activeVideo === video) {
                const btn = document.getElementById('mg-play');
                if (btn) btn.classList.add('active');
            }
        });
        video.addEventListener('pause', () => {
            if (activeVideo === video) {
                const btn = document.getElementById('mg-play');
                if (btn) btn.classList.remove('active');
            }
        });
        video.addEventListener('timeupdate', () => {
            if (activeVideo === video) updateScrubUI();
        });
        video.addEventListener('loadedmetadata', () => {
            if (activeVideo === video) updateScrubUI();
        });
    }

    // ==========================================
    // STREAM DOWNLOAD PROTOCOLS
    // ==========================================
    function downloadVideoFromBlob(video, filename) {
        try {
            const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
            const recorder = new MediaRecorder(stream);
            const chunks = [];
            recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: "video/mp4" });
                const url = URL.createObjectURL(blob);
                const a = $.create('a', { href: url, download: filename + ".mp4" });
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            };
            recorder.start();
            setTimeout(() => { recorder.stop(); }, Math.min(1000 * (video.duration || 10), 30000));
        } catch (e) { console.error("[4NDR0666OS] Stream capture error: ", e); }
    }

    async function downloadActiveMedia() {
        const m = getActiveMedia();
        if (!m) return;
        const url = m.currentSrc || m.src;
        if (!url) return;

        if (url.startsWith('blob:') && m.tagName === 'VIDEO') {
            downloadVideoFromBlob(m, document.title || 'media_capture');
            return;
        }
        if (dlBtn) dlBtn.classList.add('psi-dl-busy');
        try {
            const res = await fetch(url, { credentials: 'omit' });
            const blob = await res.blob();
            const ext = blob.type.includes('video') ? 'mp4' : 'jpg';
            const a = $.create('a', { href: URL.createObjectURL(blob), download: `media_${Date.now()}.${ext}` });
            document.body.appendChild(a); a.click(); a.remove();
        } catch { window.open(url, '_blank'); } finally { if (dlBtn) dlBtn.classList.remove('psi-dl-busy'); }
    }

    // ==========================================
    // INTERACTION MECHANICS (ZOOM/PAN/DRAG)
    // ==========================================
    let isTrackingMouse = false;
    window.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey) isTrackingMouse = true;
    });
    window.addEventListener('keyup', () => { isTrackingMouse = false; });

    window.addEventListener('mousemove', (e) => {
        const media = getActiveMedia();
        if (isTrackingMouse && media) {
            const rect = media.getBoundingClientRect();
            state.panX = Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 0), 100);
            state.panY = Math.min(Math.max(((e.clientY - rect.top) / rect.height) * 100, 0), 100);
            requestAnimationFrame(applyMediaState);
        }
    });

    window.addEventListener('wheel', (e) => {
        if (isTrackingMouse && getActiveMedia()) {
            e.preventDefault();
            state.zoom = Math.min(Math.max(state.zoom + (e.deltaY < 0 ? 0.1 : -0.1), 0.5), 8.0);
            requestAnimationFrame(applyMediaState);
        }
    }, { passive: false });

    // ==========================================
    // AD-SKIP HIGH FREQUENCY POLLEB
    // ==========================================
    setInterval(() => {
        const skipBtn = $.get('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern');
        if (skipBtn) skipBtn.click();

        const adVideo = $.get('.html5-video-player.ad-showing video');
        if (adVideo) {
            adVideo.currentTime = adVideo.duration || 0;
            adVideo.playbackRate = 16.0;
        }
    }, 400);

    // ==========================================
    // UI BUILD & LIFECYCLE
    // ==========================================
    if (window === window.top) {
        // Build Primary HUD Panel
        const ui = $.create('div', { id: 'media-godmode-ui' });
        ui.innerHTML = `
            <div id="mg-title">4NDR0666OS // Media Controller</div>
            <div class="mg-row speed-row">
                <button data-speed="0.25">0.25</button><button data-speed="0.50">0.50</button>
                <button data-speed="0.75">0.75</button><button data-speed="1.00">1.00</button>
                <button data-speed="1.50">1.50</button><button data-speed="2.00">2.00</button>
                <button data-speed="3.00">3.00</button>
            </div>
            <div class="mg-row">
                <span style="font-weight:bold;color:#00E5FF;">Rotate</span>
                <input type="range" id="rotate-slider" min="0" max="360" value="0" step="1">
                <span id="rotate-val" style="width:35px;text-align:right;">0°</span>
                <button id="rotate-reset" class="mg-icon-btn">↺</button>
                <button id="mg-view-reset" class="mg-icon-btn">↩</button>
                <button id="mg-maximize" class="mg-icon-btn">⤢</button>
            </div>
            <div class="mg-actions">
                <button id="mg-play">PLAY</button>
                <button id="mg-nav-prev">&lt;</button>
                <button id="mg-nav-next">&gt;</button>
                <button id="mg-repeat">○ REPEAT</button>
            </div>
        `;
        document.body.appendChild(ui);

        // Build Scrub Bar Architecture
        scrubBar = $.create('div', { className: 'psi-scrub-bar' });
        scrubBar.innerHTML = `
            <div class="psi-scrub-time" id="psi-scrub-time-display">00:00 / 00:00</div>
            <div class="psi-scrub-track" id="psi-scrub-track-target">
                <div class="psi-scrub-fill" id="psi-scrub-fill-display"></div>
                <div class="psi-scrub-handle" id="psi-scrub-handle-display"></div>
            </div>
        `;
        document.body.appendChild(scrubBar);

        scrubFill = $.get('#psi-scrub-fill-display', scrubBar);
        scrubHandle = $.get('#psi-scrub-handle-display', scrubBar);
        scrubTime = $.get('#psi-scrub-time-display', scrubBar);
        const track = $.get('#psi-scrub-track-target', scrubBar);

        // Build Standalone Download Trigger
        dlBtn = $.create('button', { className: 'psi-dl-btn', innerHTML: '⭳', title: 'Download Active Content' });
        document.body.appendChild(dlBtn);
        dlBtn.addEventListener('click', downloadActiveMedia);

        // HUD Drag Action Handler
        const titleBar = $.get('#mg-title', ui);
        let activeDrag = false, startOffsetX = 0, startOffsetY = 0;

        titleBar.addEventListener('mousedown', (e) => {
            activeDrag = true;
            ui.classList.add('dragging');
            startOffsetX = e.clientX - ui.offsetLeft;
            startOffsetY = e.clientY - ui.offsetTop;
        });

        window.addEventListener('mousemove', (e) => {
            if (!activeDrag) return;
            ui.style.left = `${e.clientX - startOffsetX}px`;
            ui.style.top = `${e.clientY - startOffsetY}px`;
            ui.style.right = 'auto';
        });

        window.addEventListener('mouseup', () => {
            if (activeDrag) {
                activeDrag = false;
                ui.classList.remove('dragging');
            }
        });

        // Scrub Bar Positioning Hooks
        const processScrubInteraction = (clientX) => {
            if (!activeVideo || !track) return;
            const r = track.getBoundingClientRect();
            const pct = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
            scrubFill.style.width = `${pct * 100}%`;
            scrubHandle.style.left = `${pct * 100}%`;
            activeVideo.currentTime = pct * (activeVideo.duration || 0);
        };

        track.addEventListener('mousedown', (e) => {
            state.isScrubbing = true;
            processScrubInteraction(e.clientX);
        });

        window.addEventListener('mousemove', (e) => {
            if (state.isScrubbing) processScrubInteraction(e.clientX);
        });

        window.addEventListener('mouseup', () => {
            state.isScrubbing = false;
        });

        // HUD Interactive Layout Map Hook
        ui.addEventListener('click', (e) => {
            const tgt = e.target;
            if (tgt.dataset.speed) {
                targetSpeed = parseFloat(tgt.dataset.speed);
                GM_setValue('media_speed', targetSpeed);
                $.all('.speed-row button').forEach(b => b.classList.remove('active'));
                tgt.classList.add('active');
                applyMediaState();
            }
        });

        const rSlider = $.get('#rotate-slider', ui);
        const rVal = $.get('#rotate-val', ui);

        rSlider.addEventListener('input', (e) => {
            state.rotation = parseInt(e.target.value);
            rVal.textContent = `${state.rotation}°`;
            applyMediaState();
        });

        $.get('#rotate-reset', ui).addEventListener('click', () => {
            state.rotation = 0;
            rSlider.value = 0;
            rVal.textContent = '0°';
            applyMediaState();
        });

        $.get('#mg-view-reset', ui).addEventListener('click', () => {
            state.zoom = 1.0;
            state.panX = 50;
            state.panY = 50;
            applyMediaState();
        });

        $.get('#mg-maximize', ui).addEventListener('click', (e) => {
            const m = getActiveMedia();
            if (!m) return;
            state.isMaximized = !state.isMaximized;
            if (state.isMaximized) {
                m.classList.add('psi-media-maximized');
                document.body.classList.add('psi-max-locked');
                e.target.classList.add('active');
            } else {
                m.classList.remove('psi-media-maximized');
                document.body.classList.remove('psi-max-locked');
                e.target.classList.remove('active');
            }
        });

        $.get('#mg-play', ui).addEventListener('click', () => {
            if (!activeVideo) return;
            if (activeVideo.paused) activeVideo.play().catch(() => {});
            else activeVideo.pause();
        });

        $.get('#mg-repeat', ui).addEventListener('click', (e) => {
            if (!activeVideo) return;
            state.isRepeating = !state.isRepeating;
            activeVideo.loop = state.isRepeating;
            if (state.isRepeating) e.target.classList.add('active');
            else e.target.classList.remove('active');
        });

        // Smart Discovery Sweep Initialization Trigger
        setInterval(() => {
            $.all('video').forEach(v => {
                if (!v.dataset.psiTracked) {
                    v.dataset.psiTracked = 'true';
                    bindMediaEvents(v);
                    v.addEventListener('mouseenter', () => acquireTarget(v));
                }
            });
            $.all('img').forEach(i => {
                if (!i.dataset.psiTracked && isTrackableImage(i)) {
                    i.dataset.psiTracked = 'true';
                    i.addEventListener('mouseenter', () => acquireImage(i));
                }
            });
        }, 1000);

        // Highlight active speed on HUD mount
        setTimeout(() => {
            const savedSpeedBtn = $.get(`.speed-row button[data-speed="${targetSpeed.toFixed(2)}"]`, ui) ||
                                 $.get(`.speed-row button[data-speed="${targetSpeed}"]`, ui);
            if (savedSpeedBtn) savedSpeedBtn.classList.add('active');
        }, 200);
    }

    console.log('[4NDR0666OS] Unified Media Player, Downloader, & Ad-Skip Engine v6.0.1-Ψ successfully initiated.');
})();
