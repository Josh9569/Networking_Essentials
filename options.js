/* Persists each page's Options-dropdown reference-tool toggles in localStorage,
   so turning a tool off stays off across visits — tracked independently per
   page since every trainer has a different set of tools. Every page's toggle
   checkboxes follow the same id convention: <input id="tog-<toolId>"> paired
   with a <div id="t-<toolId>"> block, so this works generically with no
   page-specific knowledge. */
(function () {
  function pageKey() {
    return 'ne-opts:' + location.pathname.split('/').pop();
  }

  function readSaved() {
    try {
      return JSON.parse(localStorage.getItem(pageKey())) || {};
    } catch (e) {
      return {};
    }
  }

  // Called by each page's own toggleTool()/applyTools() after a toggle changes.
  window.saveOptionsState = function () {
    var state = {};
    document.querySelectorAll('input[id^="tog-"]').forEach(function (cb) {
      state[cb.id.slice(4)] = cb.checked;
    });
    localStorage.setItem(pageKey(), JSON.stringify(state));
  };

  function restoreOptionsState() {
    var boxes = document.querySelectorAll('input[id^="tog-"]');
    if (!boxes.length) return;
    var saved = readSaved();
    boxes.forEach(function (cb) {
      var id = cb.id.slice(4);
      if (Object.prototype.hasOwnProperty.call(saved, id)) {
        cb.checked = saved[id];
      }
      var block = document.getElementById('t-' + id);
      if (block) block.style.display = cb.checked ? '' : 'none';
    });
    var toolsec = document.getElementById('toolsec');
    if (toolsec) {
      var any = Array.prototype.some.call(boxes, function (cb) { return cb.checked; });
      toolsec.style.display = any ? '' : 'none';
    }
  }

  /* ── Topic-preferred reference tool ──────────────────────────────────
     Pages whose topics each have an obviously most-relevant reference call
     this with that tool's id whenever the topic changes; the tool moves to
     the top of BOTH the Options menu and the #toolsec column, and every
     other tool keeps its usual relative order underneath.

     The canonical order is read from the DOM the first time this runs (the
     order the page's own markup lists them in), so a page never has to
     declare its tool order twice — and re-laying-out from that snapshot each
     time means the non-preferred tools can't drift as the topic changes.
     Passing a falsy id, or an id this page doesn't have, restores the plain
     canonical order — which is what topics with no obvious reference want.

     Only the .opt-row labels are moved, never the .opt-section-label above
     them, so the "Reference Tools" heading stays put. */
  var canonicalOrder = null;

  function readCanonicalOrder() {
    var boxes = document.querySelectorAll('#opt-menu input[id^="tog-"]');
    return Array.prototype.map.call(boxes, function (cb) { return cb.id.slice(4); });
  }

  window.setPreferredTool = function (id) {
    if (canonicalOrder === null) canonicalOrder = readCanonicalOrder();
    if (!canonicalOrder.length) return;
    var order = (id && canonicalOrder.indexOf(id) >= 0)
      ? [id].concat(canonicalOrder.filter(function (t) { return t !== id; }))
      : canonicalOrder;

    var menu = document.getElementById('opt-menu');
    var sec = document.getElementById('toolsec');
    order.forEach(function (t) {
      var cb = document.getElementById('tog-' + t);
      var row = cb && cb.closest('.opt-row');
      if (menu && row) menu.appendChild(row);
      var block = document.getElementById('t-' + t);
      if (sec && block) sec.appendChild(block);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreOptionsState);
  } else {
    restoreOptionsState();
  }
})();
