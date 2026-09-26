// ==UserScript==
// @name        YT: Bring back Youtube channel playlists
// @namespace   Violentmonkey Scripts
// @match       https://www.youtube.com/c/*
// @match       https://www.youtube.com/channel/*
// @match       https://www.youtube.com/user/*
// @match       https://www.youtube.com/@*
// @grant       none
// @run-at      document-start
// @version     0.7
// @author      The_Loko
// @license     MIT
// @icon        https://www.google.com/s2/favicons?domain=youtube.com
// @description Adds a "Play All" button redirecting to the channel's uploaded videos playlist on the "Videos" tab.
// @description:es Añade un botón para reproducir todo ("Play All") en la pestaña "Vídeos" que redirige a una lista de reproducción con todos los vídeos del canal.
// @downloadURL https://update.greasyfork.org/scripts/454215/Bring%20back%20Youtube%20channel%20playlists.user.js
// @updateURL https://update.greasyfork.org/scripts/454215/Bring%20back%20Youtube%20channel%20playlists.meta.js
// ==/UserScript==


(function() {
    function getPlayListID() {
        var metaEls = [...document.getElementsByTagName('meta')];
        var prop = metaEls.filter(x => x.getAttribute('itemprop') == 'identifier');
        if (prop.length === 0) return "";
        var channelID = prop[0]['content'];
        return 'UU' + channelID.substring(2);
    }

    function createPlayAllButton() {
        const wrapper = document.createElement("div");
        wrapper.className = "ytChipBarViewModelChipWrapper";
        wrapper.setAttribute("role", "presentation");

        const viewModel = document.createElement("chip-view-model");
        viewModel.className = "ytChipViewModelHost";

        const shapeHost = document.createElement("chip-shape");
        shapeHost.className = "ytChipShapeHost";

        const btn = document.createElement("button");
        // Añadimos una clase única para identificar nuestro botón
        btn.className = "ytChipShapeButtonReset play-all-custom-btn";
        btn.setAttribute("role", "tab");
        btn.style.cursor = "pointer";

        const chipDiv = document.createElement("div");
        chipDiv.className = "ytChipShapeChip ytChipShapeInactive ytChipShapeOnlyTextPadding";
        chipDiv.textContent = "Play All";

        btn.appendChild(chipDiv);
        shapeHost.appendChild(btn);
        viewModel.appendChild(shapeHost);
        wrapper.appendChild(viewModel);

        btn.onmousedown = (e) => {
            const listID = getPlayListID();
            if (!listID) return;
            if (e.which == 1) {
                window.location.replace("https://www.youtube.com/playlist?list=" + listID);
            } else if (e.which == 2) {
                window.open("https://www.youtube.com/playlist?list=" + listID);
            }
        };

        return wrapper;
    }

    waitForKeyElements(".ytChipBarViewModelChipBarScrollContainer", (container) => {
        // Ahora buscamos nuestra clase única, no una general
        if (!container.querySelector('.play-all-custom-btn')) {
            const btn = createPlayAllButton();
            container.appendChild(btn);
        }
    });
})();


/*
   UNABLE TO INCLUDE SCRIPT WHEN USING GREASYFORK SO DIRECTLY INCLUDING HERE.
   Credit to https://github.com/CoeJoder/waitForKeyElements.js
   v1.2
*/
function waitForKeyElements(selectorOrFunction, callback, waitOnce, interval, maxIntervals) {
  if (typeof waitOnce === 'undefined') {
    waitOnce = true;
  }
  if (typeof interval === 'undefined') {
    interval = 300;
  }
  if (typeof maxIntervals === 'undefined') {
    maxIntervals = -1;
  }
  var targetNodes =
    typeof selectorOrFunction === 'function'
      ? selectorOrFunction()
      : document.querySelectorAll(selectorOrFunction);

  var targetsFound = targetNodes && targetNodes.length > 0;
  if (targetsFound) {
    targetNodes.forEach(function (targetNode) {
      var attrAlreadyFound = 'data-userscript-alreadyFound';
      var alreadyFound = targetNode.getAttribute(attrAlreadyFound) || false;
      if (!alreadyFound) {
        var cancelFound = callback(targetNode);
        if (cancelFound) {
          targetsFound = false;
        } else {
          targetNode.setAttribute(attrAlreadyFound, true);
        }
      }
    });
  }

  if (maxIntervals !== 0 && !(targetsFound && waitOnce)) {
    maxIntervals -= 1;
    setTimeout(function () {
      waitForKeyElements(selectorOrFunction, callback, waitOnce, interval, maxIntervals);
    }, interval);
  }
}
