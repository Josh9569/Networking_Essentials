/* Shared packet-tracer-style lab canvas code, used by both switching_lab.html
   and routing_game.html's IP Routing topic. Holds only the generic mechanics
   that don't depend on either page's network model (VLANs/trunks vs L3
   routing): dragging devices around the canvas, the ping input/output
   animation loop, the requirements checklist renderer, and a couple of tiny
   pure helpers (isValidIP) both pages needed identically. Each page wires
   this up with its own device list / geometry / reachability callbacks —
   this file has no opinion about what a "device" is beyond {id,x,y}.
   Adding a feature here (e.g. a better ping animation) automatically reaches
   both labs instead of needing the same fix copied twice. */
(function (window) {
  'use strict';

  function isValidIP(ip) {
    if (typeof ip !== 'string') return false;
    var p = ip.split('.');
    return p.length === 4 && p.every(function (s) { return /^\d+$/.test(s) && +s >= 0 && +s <= 255; });
  }

  /* ---------- drag-and-drop ----------
     opts:
       layer      - element that receives mousedown for devices/ports (their common container)
       canvas     - the .lab-canvas element whose clientWidth/clientHeight bound movement
       zoomWrap   - optional element to apply a CSS scale transform to (omit to disable zoom)
       getZoom/setZoom - optional accessors for a page-level zoom number (required together with zoomWrap)
       getDevice(id)   - returns the device object for a dev element's data-did
       devSize(d)      - returns [w,h] for a device, matching whatever the page just rendered
       onRender()      - called after the device's x/y changes, to redraw
       onDevClick(id)  - called when a mousedown+mouseup on a .dev happens without crossing
                         the drag threshold (i.e. a plain click)
       onPortClick(id,i) - called immediately on mousedown over a .port (ports never drag)
     Returns a controller {getZoom} in case the caller wants to read the current zoom back. */
  function attachCanvasDrag(opts) {
    var drag = null;
    var zoomOf = opts.getZoom || function () { return 1; };

    opts.layer.addEventListener('mousedown', function (e) {
      var pEl = e.target.closest('.port');
      if (pEl) { opts.onPortClick(+pEl.dataset.did, +pEl.dataset.pi); e.preventDefault(); return; }
      var dEl = e.target.closest('.dev');
      if (!dEl) return;
      var d = opts.getDevice(+dEl.dataset.did);
      if (!d) return;
      drag = { d: d, sx: e.clientX, sy: e.clientY, ox: d.x, oy: d.y, moved: false };
      e.preventDefault();
    });

    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var z = zoomOf();
      var dx = (e.clientX - drag.sx) / z, dy = (e.clientY - drag.sy) / z;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) drag.moved = true;
      if (drag.moved) {
        var cw = opts.canvas.clientWidth / z, ch = opts.canvas.clientHeight / z;
        var size = opts.devSize(drag.d), w = size[0], h = size[1];
        drag.d.x = Math.max(0, Math.min(cw - w, drag.ox + dx));
        drag.d.y = Math.max(0, Math.min(ch - h - 8, drag.oy + dy));
        opts.onRender();
      }
    });

    if (opts.zoomWrap && opts.setZoom) {
      opts.canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        var f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        var next = Math.min(2, Math.max(0.4, zoomOf() * f));
        opts.setZoom(next);
        opts.zoomWrap.style.transform = 'scale(' + next + ')';
      }, { passive: false });
    }

    window.addEventListener('mouseup', function () {
      if (drag && !drag.moved) opts.onDevClick(drag.d.id);
      drag = null;
    });

    return { getZoom: zoomOf };
  }

  /* ---------- ping UI ----------
     Drives the "Pinging X with 32 bytes of data..." animated reveal against
     a <pre class="ping-out">, exactly the same probe-sequence choreography
     regardless of which page's topology decided reachability. Call this
     from the page's own ping button's onclick.
     cfg:
       inputId, btnId, outId - element ids for the destination field/button/output
       resolve(dst) -> one of:
         {msg: 'reason'}                  immediate validation error, no animation
         {ok:false}                       destination unreachable, all probes time out
         {ok:true, firstTime:bool}        reachable; firstTime adds one leading timeout
                                           (simulates ARP resolving, like a real host)
       stillActive() -> bool             polled between probes; animation stops
                                           silently (button re-enabled) once false,
                                           e.g. because the user selected a different device */
  function runPing(cfg) {
    var dst = document.getElementById(cfg.inputId).value.trim();
    var out = document.getElementById(cfg.outId);
    var btn = document.getElementById(cfg.btnId);
    var r = cfg.resolve(dst);
    if (r.msg) { out.textContent = '% ' + r.msg; out.className = 'ping-out perr'; return; }
    var seq = r.ok
      ? (r.firstTime ? ['.', '!', '!', '!'] : ['!', '!', '!', '!'])
      : ['.', '.', '.', '.'];
    out.className = 'ping-out';
    out.textContent = 'Pinging ' + dst + ' with 32 bytes of data:\n';
    if (btn) btn.disabled = true;
    var i = 0;
    var step = function () {
      if (!cfg.stillActive()) { if (btn) btn.disabled = false; return; }
      out.textContent += seq[i] === '!'
        ? 'Reply from ' + dst + ': bytes=32 time<1ms TTL=128\n'
        : 'Request timed out.\n';
      out.scrollTop = out.scrollHeight;
      i++;
      if (i < seq.length) { setTimeout(step, 260); return; }
      var got = seq.filter(function (c) { return c === '!'; }).length;
      var sent = seq.length;
      out.textContent += '\nPing statistics for ' + dst + ':\n    Packets: Sent = ' + sent + ', Received = ' + got + ', Lost = ' + (sent - got) + ' (' + Math.round((sent - got) / sent * 100) + '% loss)';
      out.className = 'ping-out ' + (r.ok ? 'pok' : 'perr');
      if (btn) btn.disabled = false;
    };
    setTimeout(step, 260);
  }

  /* ---------- requirements checklist ----------
     Renders a scenario's {desc, test} objectives plus their latest
     {ok, reason} results into a <div class="req-list">. Each row gets its
     own checkbox the learner can tick manually as a personal to-do tracker
     — it's not wired to the real grading, it's just memory-jogging while
     they work. Once Check Requirements actually runs, the real ✓/✗ verdict
     shows up under the checkbox regardless of what the learner ticked, so
     they can compare "what I thought I'd done" against "what's actually
     verified." Checked state persists across re-renders of the *same*
     requirement list (identified by reqs array identity — every page
     reuses one reqs array for a whole scenario) and resets automatically
     the moment a genuinely new scenario's reqs array comes in. */
  var reqCheckState = { reqs: null, checked: [] };
  function renderReqList(containerId, reqs, results, escapeFn) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var esc = escapeFn || function (s) { return s; };
    if (!reqs || !reqs.length) { el.innerHTML = ''; reqCheckState = { reqs: null, checked: [] }; return; }
    if (reqCheckState.reqs !== reqs) {
      reqCheckState = { reqs: reqs, checked: reqs.map(function () { return false; }) };
    }
    var checked = reqCheckState.checked;
    /* Rows are rendered in first-seen-group order rather than array order, so
       a page whose reqs[] interleaves groups (switching_lab's do — its
       arrays are written in the order the concepts are taught, not grouped)
       still gets each heading exactly once instead of the same heading
       repeating further down. Every row keeps its ORIGINAL index for
       results/checkbox state, so grading and tick state are untouched by the
       reordering; only the visual order changes. Reqs with no group all fall
       into one bucket and keep their array order, so an ungrouped list
       renders exactly as before. */
    var buckets = [], bucketOf = {};
    reqs.forEach(function (r, i) {
      var g = r.group || '';
      if (!(g in bucketOf)) { bucketOf[g] = buckets.length; buckets.push([]); }
      buckets[bucketOf[g]].push(i);
    });
    var order = [];
    buckets.forEach(function (idxs) { order = order.concat(idxs); });

    var lastGroup = null;
    el.innerHTML = order.map(function (i) {
      var r = reqs[i];
      var res = results ? results[i] : null;
      var cls = res ? (res.ok ? 'ok' : 'bad') : '';
      var reason = (res && !res.ok && res.reason) ? '<div class="req-reason">' + esc(res.reason) + '</div>' : '';
      var resultIc = res ? ('<span class="req-result-ic ' + (res.ok ? 'ok' : 'bad') + '">' + (res.ok ? '✓' : '✗') + '</span>') : '';
      /* Optional heading whenever a req names a different group than the one
         before it (Cabling / Addressing / …). Reqs with no group produce no
         headings at all, so a list that never sets one renders exactly as it
         did before this existed. .two-col-full keeps a heading spanning the
         whole width when the list is in two columns; it's inert otherwise. */
      var head = '';
      if (r.group && r.group !== lastGroup) {
        head = '<div class="qlbl req-group two-col-full">' + esc(r.group) + '</div>';
        lastGroup = r.group;
      }
      return head + '<div class="req-row ' + cls + '">' +
        '<span class="req-check-col">' +
          '<input type="checkbox" class="req-checkbox" data-i="' + i + '"' + (checked[i] ? ' checked' : '') + '>' +
          resultIc +
        '</span>' +
        '<div><div>' + r.desc + '</div>' + reason + '</div>' +
      '</div>';
    }).join('');
    Array.prototype.forEach.call(el.querySelectorAll('.req-checkbox'), function (cb) {
      cb.addEventListener('change', function () { checked[+cb.dataset.i] = cb.checked; });
    });
    // Clicking anywhere in a row (not just the checkbox itself) toggles it —
    // skip when the click landed on the checkbox directly, since its own
    // change listener above already handles that; toggling again on top
    // would flip it right back to where it started.
    Array.prototype.forEach.call(el.querySelectorAll('.req-row'), function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.tagName === 'INPUT') return;
        var cb = row.querySelector('.req-checkbox');
        if (cb) cb.click();
      });
    });
  }

  /* ---------- CLI tab-completion ----------
     Walks a nested keyword tree (each page defines its own — VLAN/trunk
     commands vs. IP-routing commands are completely different grammars)
     completing the last token, or listing candidates (via onAmbiguous)
     when more than one keyword matches. Returns the new input value;
     callers are expected to also preventDefault the Tab keypress
     themselves, since this only computes the replacement text. */
  function tabComplete(kwTree, val, onAmbiguous) {
    var endsSpace = /\s$/.test(val);
    var parts = val.trim().length ? val.trim().split(/\s+/) : [];
    var walk = endsSpace ? parts : parts.slice(0, -1);
    var node = kwTree, consumed = [];
    for (var i = 0; i < walk.length; i++) {
      var p = walk[i];
      var ks = Object.keys(node).filter(function (k) { return k.indexOf(p.toLowerCase()) === 0; });
      if (ks.length === 1) { node = node[ks[0]]; consumed.push(ks[0]); }
      else return val;
    }
    var partial = endsSpace ? '' : (parts[parts.length - 1] || '').toLowerCase();
    var cands = Object.keys(node).filter(function (k) { return k.indexOf(partial) === 0; });
    if (!cands.length) return val;
    var head = consumed.join(' ') + (consumed.length ? ' ' : '');
    if (cands.length === 1) return head + cands[0] + ' ';
    var cp = cands[0];
    cands.forEach(function (c) { while (c.indexOf(cp) !== 0) cp = cp.slice(0, -1); });
    if (onAmbiguous) onAmbiguous(cands);
    return head + cp;
  }

  /* ---------- instructions pop-out ----------
     Toggles the top instructions .qcard between its normal inline spot and
     a slim floating panel pinned to the left edge of the viewport, so a
     learner can keep the objectives/checklist in view while scrolling down
     to work the canvas/CLI. Purely a class toggle + icon swap — all the
     actual layout work is CSS (.qcard.popped in styles.css). */
  var POPOUT_SVG = '<svg viewBox="0 0 24 24"><path d="M11 4H4v16h7M15 8l-4 4 4 4"/></svg>';
  var DOCK_SVG = '<svg viewBox="0 0 24 24"><path d="M11 4H4v16h7M13 8l4 4-4 4"/></svg>';
  function toggleQcardPopout(qcardId, btnId) {
    var qcard = document.getElementById(qcardId);
    if (!qcard) return;
    var popped = qcard.classList.toggle('popped');
    var btn = document.getElementById(btnId);
    if (btn) {
      btn.innerHTML = popped ? DOCK_SVG : POPOUT_SVG;
      btn.title = popped ? 'Dock instructions back inline' : 'Pop out instructions to a floating panel';
      btn.setAttribute('aria-label', btn.title);
    }
  }
  /* Called when a page navigates away from a "packet tracer" context (e.g.
     routing_game.html switching to a non-lab topic) where popping out
     wouldn't mean anything — silently docks it back if it was popped, and
     resets the button icon so it isn't stuck showing "dock" next time this
     context becomes relevant again. */
  function dockQcardPopout(qcardId, btnId) {
    var qcard = document.getElementById(qcardId);
    if (qcard) qcard.classList.remove('popped');
    var btn = document.getElementById(btnId);
    if (btn) { btn.innerHTML = POPOUT_SVG; btn.title = 'Pop out instructions to a floating panel'; btn.setAttribute('aria-label', btn.title); }
  }

  /* ---------- styled dropdowns ----------
     A native <select>'s open list is painted by the browser (white in one,
     low-contrast grey in another, never translucent), so in every lab config
     panel a mouse press on a <select> opens .sel-menu instead. The <select>
     stays the source of truth: picking an item sets its value and fires a
     real "change", so the existing onchange handlers run unchanged, and the
     keyboard still drives the native control. One delegated listener, since
     the panels rebuild their selects on every render. */
  var selMenu = null;
  function closeSelMenu() { if (selMenu) { selMenu.remove(); selMenu = null; } }
  function openSelMenu(sel) {
    closeSelMenu();
    var r = sel.getBoundingClientRect();
    var m = document.createElement('div');
    m.className = 'sel-menu';
    Array.prototype.forEach.call(sel.options, function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sel-item' + (o.selected ? ' on' : '');
      b.textContent = o.textContent;
      if (o.title) b.title = o.title;
      b.disabled = o.disabled;
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () {
        closeSelMenu();
        if (sel.value === o.value) return;
        sel.value = o.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      m.appendChild(b);
    });
    m.style.left = r.left + 'px';
    m.style.top = (r.bottom + 4) + 'px';
    m.style.minWidth = r.width + 'px';
    document.body.appendChild(m);
    /* flip above when there is no room below */
    var mr = m.getBoundingClientRect();
    if (mr.bottom > window.innerHeight - 8) m.style.top = Math.max(8, r.top - mr.height - 4) + 'px';
    m._sel = sel;
    selMenu = m;
  }
  document.addEventListener('mousedown', function (e) {
    var sel = e.target.closest && e.target.closest('.cfg-panel select');
    if (sel && !sel.disabled) {
      e.preventDefault();
      sel.focus();
      if (selMenu && selMenu._sel === sel) closeSelMenu(); else openSelMenu(sel);
      return;
    }
    if (selMenu && !selMenu.contains(e.target)) closeSelMenu();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSelMenu(); });
  window.addEventListener('scroll', closeSelMenu, true);
  window.addEventListener('resize', closeSelMenu);

  /* ---------- multi-line paste into a lab CLI ----------
     A terminal box is a single-line <input>, so a pasted block would arrive
     as one line with its newlines stripped. Instead, every line that ends in
     a newline is run as its own command, through the lab's own Enter
     handling — so each is echoed with its prompt, history and errors work,
     and a two-line exchange (crypto key generate rsa / 1024, clear ip ospf
     process / yes) answers itself. A last line with no newline is left in
     the box unsent, as a real console would. The box is looked up by id
     before every line because three labs rebuild it after each command. */
  document.addEventListener('paste', function (e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('term-in')) return;
    var text = (e.clipboardData || window.clipboardData).getData('text') || '';
    if (!/[\r\n]/.test(text)) return;
    e.preventDefault();
    var lines = (t.value.slice(0, t.selectionStart) + text).replace(/\r\n?/g, '\n').split('\n');
    var rest = lines.pop() + t.value.slice(t.selectionEnd);
    var id = t.id;
    lines.forEach(function (line) {
      var inp = document.getElementById(id);
      if (!inp) return;
      inp.focus();
      inp.value = line;
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    var inp = document.getElementById(id);
    if (inp) { inp.value = rest; inp.focus(); }
  });

  window.LabShared = {
    isValidIP: isValidIP,
    toggleQcardPopout: toggleQcardPopout,
    dockQcardPopout: dockQcardPopout,
    attachCanvasDrag: attachCanvasDrag,
    runPing: runPing,
    tabComplete: tabComplete,
    renderReqList: renderReqList,
    /* Shared device-box geometry so both labs' switches/PCs render (and
       therefore dock ports) at identical sizes. Router geometry stays
       page-local: switching_lab's router is a single-port "router-on-a-stick"
       (shares the PC/router edge-slide port math), while routing_game's is a
       real multi-port L3 router with a fixed port row — different enough
       shapes that unifying them would be forcing two different devices to
       look like one. */
    SW_W: 150, SW_H: 58,
    PC_W: 90, PC_H: 52
  };
})(window);
