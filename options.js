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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreOptionsState);
  } else {
    restoreOptionsState();
  }
})();
