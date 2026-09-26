// ==UserScript==
// @name         YT: YouTube Queue Button Restore
// @namespace    https://www.buhoho.net/
// @version      1.4
// @description:en  Restore "Add to queue" and "Watch later" buttons on YouTube thumbnail hover
// @author       buhoho
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/571443/YouTube%20Queue%20Button%20Restore.user.js
// @updateURL https://update.greasyfork.org/scripts/571443/YouTube%20Queue%20Button%20Restore.meta.js
// ==/UserScript==

(function () {
  'use strict';

  const CONTAINER_CLASS = 'ytqr-overlay';
  const BTN_CLASS = 'ytqr-btn';
  const HIDING_CLASS = 'ytqr-hiding-menu';
  const PROCESSED_ATTR = 'data-ytqr';

  // ã­ã¥ã¼ã«è¿½å ã®å¤è¨èªã­ã¼ã¯ã¼ãï¼ã¡ãã¥ã¼ãã­ã¹ãé¨åä¸è´ç¨ï¼
  const QUEUE_KEYWORDS = [
    'ã­ã¥ã¼ã«è¿½å ',                    // ja
    'Add to queue',                    // en
    'AÃ±adir a la cola',                // es
    "file d'attente",                  // fr
    'Warteschlange',                   // de
    'Adicionar Ã  fila',                // pt-BR
    'ëê¸°ì´ì ì¶ê°',                    // ko
    'æ·»å å°éå',                       // zh-CN
    'å å¥ä½å',                        // zh-TW
    'ÐÐ¾Ð±Ð°Ð²Ð¸ÑÑ Ð² Ð¾ÑÐµÑÐµÐ´Ñ',              // ru
    'Aggiungi alla coda',              // it
    'Aan wachtrij',                    // nl
    'Dodaj do kolejki',                // pl
    'SÄ±raya ekle',                     // tr
    'à¹à¸à¸´à¹à¸¡à¹à¸à¸à¸´à¸§',                       // th
    'Tambahkan ke antrean',            // id
    'ÐÐ¾Ð´Ð°ÑÐ¸ Ð´Ð¾ ÑÐµÑÐ³Ð¸',                 // uk
  ];

  // --- CSS ---
  const style = document.createElement('style');
  style.textContent = `
    yt-thumbnail-view-model,
    ytd-thumbnail {
      position: relative !important;
    }

    .${CONTAINER_CLASS} {
      position: absolute;
      top: 4px;
      right: 4px;
      z-index: 800;
      display: flex;
      flex-direction: column;
      gap: 2px;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
    }

    yt-thumbnail-view-model:hover .${CONTAINER_CLASS},
    ytd-thumbnail:hover .${CONTAINER_CLASS} {
      opacity: 1;
      pointer-events: auto;
    }

    .${BTN_CLASS} {
      width: 28px;
      height: 28px;
      border-radius: 2px;
      background: rgba(0, 0, 0, 0.7);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background 0.2s;
    }
    .${BTN_CLASS}:hover {
      background: rgba(0, 0, 0, 0.9);
    }
    .${BTN_CLASS} svg {
      width: 18px;
      height: 18px;
      fill: #fff;
      pointer-events: none;
    }
    .${BTN_CLASS}.ytqr-ok  { background: rgba(30,120,50,0.85); }
    .${BTN_CLASS}.ytqr-err { background: rgba(180,30,30,0.85); }

    /* ä¸ç¹ã¡ãã¥ã¼ãç»é¢å¤ã«é£ã°ãã¦ä¸å¯è¦ã«ãã */
    body.${HIDING_CLASS} tp-yt-iron-dropdown {
      position: fixed !important;
      left: -9999px !important;
      top: -9999px !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    body.${HIDING_CLASS} tp-yt-iron-overlay-backdrop {
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  // --- SVG (createElementNS ã§CSP Trusted Typeså¯¾ç­) ---
  function svg(pathD) {
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', pathD);
    s.appendChild(p);
    return s;
  }

  const ICON_QUEUE = 'M21 3H3v2h18V3zm0 4H3v2h18V7zM3 13h12v-2H3v2zm0 4h12v-2H3v2zm16-4v4h-2v-4h-4v-2h4V7h2v4h4v2h-4z';
  const ICON_WL = 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z';

  // --- ã¦ã¼ãã£ãªãã£ ---

  /** æå¯ãã®åç»ã¢ã¤ãã ã¬ã³ãã©ã¼ãåå¾ */
  function findVideoItem(el) {
    return el.closest(
      'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model'
    );
  }

  /** åç»ã¢ã¤ãã ããvideoIdãåå¾ */
  function getVideoId(videoItem) {
    const link = videoItem.querySelector('a[href*="/watch"]');
    if (!link) return null;
    try {
      return new URL(link.href).searchParams.get('v');
    } catch {
      return null;
    }
  }

  /** ä¸ç¹ã¡ãã¥ã¼ãã¿ã³ãåå¾ */
  function findMenuBtn(videoItem) {
    return (
      videoItem.querySelector('button[aria-label="ãã®ä»ã®æä½"]') ||
      videoItem.querySelector('button[aria-label="Action menu"]') ||
      videoItem.querySelector('button[aria-label="More actions"]') ||
      videoItem.querySelector('ytd-menu-renderer #button-shape button') ||
      videoItem.querySelector('ytd-menu-renderer yt-icon-button button') ||
      videoItem.querySelector('button-view-model button') ||
      videoItem.querySelector('yt-button-shape button[aria-haspopup="menu"]')
    );
  }

  /** è¦ç´ ã®åºç¾ãå¾ã¤ */
  function waitFor(selector, timeout = 2000) {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };

      const found = document.querySelector(selector);
      if (found) return done(found);

      const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { obs.disconnect(); done(el); }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
      setTimeout(() => { obs.disconnect(); done(null); }, timeout);
    });
  }

  /** ãã¿ã³ã®æå/å¤±æãã©ãã·ã¥ */
  function flash(btn, ok) {
    btn.classList.add(ok ? 'ytqr-ok' : 'ytqr-err');
    setTimeout(() => btn.classList.remove('ytqr-ok', 'ytqr-err'), 1200);
  }

  // --- ãå¾ã§è¦ããAPIç´æ¥å¼ã³åºãï¼è¨èªéä¾å­ï¼ ---

  /** SAPISIDHASHèªè¨¼ãããã¼ãçæ */
  async function generateSAPISIDHash() {
    const cookies = document.cookie.split('; ');
    let sapisid = null;
    for (const c of cookies) {
      if (c.startsWith('SAPISID=') || c.startsWith('__Secure-3PAPISID=')) {
        sapisid = c.split('=')[1];
        break;
      }
    }
    if (!sapisid) return null;
    const origin = 'https://www.youtube.com';
    const timestamp = Math.floor(Date.now() / 1000);
    const input = `${timestamp} ${sapisid} ${origin}`;
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `SAPISIDHASH ${timestamp}_${hash}`;
  }

  /** ãå¾ã§è¦ããã«è¿½å ï¼APIç´æ¥ï¼ */
  async function addToWatchLater(videoId) {
    try {
      const apiKey = ytcfg.get('INNERTUBE_API_KEY');
      const context = ytcfg.get('INNERTUBE_CONTEXT');
      const auth = await generateSAPISIDHash();
      if (!auth || !apiKey || !context) return false;

      const res = await fetch('/youtubei/v1/browse/edit_playlist?key=' + apiKey, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth,
          'X-Origin': 'https://www.youtube.com',
        },
        credentials: 'include',
        body: JSON.stringify({
          context,
          playlistId: 'WL',
          actions: [{ addedVideoId: videoId, action: 'ACTION_ADD_VIDEO' }],
        }),
      });
      const data = await res.json();
      return data.status === 'STATUS_SUCCEEDED';
    } catch {
      return false;
    }
  }

  // --- ãã­ã¥ã¼ã«è¿½å ãä¸ç¹ã¡ãã¥ã¼çµç±ï¼å¤è¨èªãã­ã¹ããããï¼ ---

  let busy = false;
  let busyTimer = null;

  function closeExistingPopups() {
    const open = document.querySelectorAll('tp-yt-iron-dropdown:not([aria-hidden="true"])');
    open.forEach((dd) => {
      dd.setAttribute('aria-hidden', 'true');
      dd.style.display = 'none';
    });
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** ä¸ç¹ã¡ãã¥ã¼çµç±ã§ã­ã¥ã¼ã«è¿½å  */
  async function addToQueueViaMenu(videoItem) {
    if (busy) return false;
    busy = true;
    if (busyTimer) clearTimeout(busyTimer);
    busyTimer = setTimeout(() => { busy = false; }, 5000);

    const menuBtn = findMenuBtn(videoItem);
    if (!menuBtn) { busy = false; return false; }

    document.body.classList.add(HIDING_CLASS);

    try {
      closeExistingPopups();
      await delay(50);

      menuBtn.click();

      const popupSel = [
        'tp-yt-iron-dropdown:not([aria-hidden="true"]) yt-list-item-view-model',
        'tp-yt-iron-dropdown:not([aria-hidden="true"]) ytd-menu-service-item-renderer',
      ].join(',');
      await waitFor(popupSel, 2000);
      await delay(50);

      const items = document.querySelectorAll(popupSel);
      const target = Array.from(items).find((el) =>
        QUEUE_KEYWORDS.some((kw) => el.textContent.includes(kw))
      );

      if (target) {
        target.click();
        return true;
      }
      document.body.click();
      return false;
    } finally {
      setTimeout(() => {
        document.body.classList.remove(HIDING_CLASS);
        busy = false;
        if (busyTimer) { clearTimeout(busyTimer); busyTimer = null; }
      }, 200);
    }
  }

  // --- Shortså¤å® ---
  function isShorts(thumbnail) {
    const link = thumbnail.querySelector('a[href*="/shorts/"]');
    if (link) return true;
    const item = findVideoItem(thumbnail);
    if (!item) return false;
    const anyLink = item.querySelector('a[href*="/shorts/"]');
    return !!anyLink;
  }

  // --- ãã¿ã³æ³¨å¥ ---
  function injectButtons(thumbnail) {
    if (thumbnail.hasAttribute(PROCESSED_ATTR)) return;
    thumbnail.setAttribute(PROCESSED_ATTR, '1');

    if (isShorts(thumbnail)) return;

    const container = document.createElement('div');
    container.className = CONTAINER_CLASS;

    const isJa = (document.documentElement.lang || '').startsWith('ja');

    // å¾ã§è¦ãï¼APIç´æ¥å¼ã³åºãï¼
    const wlBtn = document.createElement('button');
    wlBtn.className = BTN_CLASS;
    wlBtn.title = isJa ? 'å¾ã§è¦ã' : 'Watch later';
    wlBtn.appendChild(svg(ICON_WL));
    wlBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const item = findVideoItem(thumbnail);
      if (!item) return flash(wlBtn, false);
      const videoId = getVideoId(item);
      if (!videoId) return flash(wlBtn, false);
      const ok = await addToWatchLater(videoId);
      flash(wlBtn, ok);
    });

    // ã­ã¥ã¼ã«è¿½å ï¼ã¡ãã¥ã¼çµç±ï¼
    const qBtn = document.createElement('button');
    qBtn.className = BTN_CLASS;
    qBtn.title = isJa ? 'ã­ã¥ã¼ã«è¿½å ' : 'Add to queue';
    qBtn.appendChild(svg(ICON_QUEUE));
    qBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const item = findVideoItem(thumbnail);
      if (!item) return flash(qBtn, false);
      const ok = await addToQueueViaMenu(item);
      flash(qBtn, ok);
    });

    container.appendChild(wlBtn);
    container.appendChild(qBtn);
    thumbnail.appendChild(container);
  }

  // --- ãµã ãã¤ã«æ¤åº ---
  function processAll() {
    const sel = [
      `yt-thumbnail-view-model:not([${PROCESSED_ATTR}])`,
      `ytd-thumbnail:not([${PROCESSED_ATTR}])`,
    ].join(',');
    document.querySelectorAll(sel).forEach(injectButtons);
  }

  // ããã¦ã³ã¹ä»ãMutationObserver
  let timer = null;
  function scheduleProcess() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; processAll(); }, 400);
  }

  const observer = new MutationObserver(scheduleProcess);
  observer.observe(document.body, { childList: true, subtree: true });

  // ååå®è¡
  processAll();

  // SPAé·ç§»å¯¾å¿
  window.addEventListener('yt-navigate-finish', () => setTimeout(processAll, 600));
})();
