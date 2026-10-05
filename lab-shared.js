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
  /* The floating panel's left edge widens it by dragging, into whatever
     gutter is spare (up to 16px short of the viewport edge) and never below
     the width its content naturally takes. The width is a CSS variable
     (--pop-w, see .qcard.popped in styles.css) remembered per page, so the
     panel comes back at the learner's width next round and next visit. */
  var POP_EDGE = 8;
  function popWidthKey() { return 'ne-popout-w:' + location.pathname.split('/').pop(); }
  function bindPopoutResize(qcard) {
    if (qcard.dataset.popResize) return;
    qcard.dataset.popResize = '1';
    var drag = null;
    function floating() { return qcard.classList.contains('popped') && getComputedStyle(qcard).position === 'fixed'; }
    function onEdge(e) { return floating() && e.clientX <= qcard.getBoundingClientRect().left + POP_EDGE; }
    qcard.addEventListener('mousemove', function (e) { if (!drag) qcard.classList.toggle('pop-edge', onEdge(e)); });
    qcard.addEventListener('mouseleave', function () { if (!drag) qcard.classList.remove('pop-edge'); });
    qcard.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || !onEdge(e)) return;
      e.preventDefault();
      /* the content-sized width, measured without the learner's width */
      var had = qcard.style.getPropertyValue('--pop-w');
      qcard.style.removeProperty('--pop-w');
      var natural = qcard.getBoundingClientRect().width;
      if (had) qcard.style.setProperty('--pop-w', had);
      var r = qcard.getBoundingClientRect();
      drag = { x: e.clientX, w: r.width, min: natural, max: Math.max(natural, r.right - 16) };
      document.body.classList.add('pop-resizing');
    });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var w = Math.max(drag.min, Math.min(drag.max, drag.w + (drag.x - e.clientX)));
      qcard.style.setProperty('--pop-w', Math.round(w) + 'px');
    });
    window.addEventListener('mouseup', function () {
      if (!drag) return;
      drag = null;
      document.body.classList.remove('pop-resizing');
      qcard.classList.remove('pop-edge');
      try { localStorage.setItem(popWidthKey(), qcard.style.getPropertyValue('--pop-w')); } catch (err) {}
    });
  }
  function toggleQcardPopout(qcardId, btnId) {
    var qcard = document.getElementById(qcardId);
    if (!qcard) return;
    var popped = qcard.classList.toggle('popped');
    if (popped) {
      bindPopoutResize(qcard);
      var saved = null;
      try { saved = localStorage.getItem(popWidthKey()); } catch (err) {}
      if (saved && !qcard.style.getPropertyValue('--pop-w')) qcard.style.setProperty('--pop-w', saved);
    }
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

  /* ---------- command grammar ----------
     IOS answers a line it cannot parse with a caret under the first word it
     could not place, then "% Invalid input detected at '^' marker." A lab's
     handlers only look at the words they need, so without this a line with
     extra or misplaced words ("switchport mode access 80") ran silently.
     Each CLI lists the shapes of the commands it knows; a line that fits none
     of them is refused before any handler sees it. A line that merely stops
     short is passed through, so a handler's own usage message still answers
     "switchport access vlan" on its own.

     Pattern syntax, words separated by spaces:
       keyword      matched by abbreviation ("sh" fits "show")
       a|b          either word (or type)
       <type>       n, ip, v6, v6p (address/len), addr (ip or v6), word,
                    if (one or two words: "g0/1", "GigabitEthernet 0/1"),
                    mac, area (n or ip), vlist (the rest: a VLAN list),
                    line (the rest: free text), any (the rest: the handler
                    parses it, e.g. an ACE)
       [ ... ]      optional
       ( a b | c )  one of several sequences
     Shape only, never mode: the handlers already say "select an interface
     first" and the like, which helps a learner more than a caret would. */
  var IF_TYPES = ['fastethernet', 'gigabitethernet', 'ethernet', 'serial', 'loopback', 'port-channel', 'vlan'];
  var V6_RE = /^[0-9a-f]*:[0-9a-f:.]*$/i, IFNUM_RE = /^\d+(\/\d+)*(\.\d+)?$/;
  function ifWord(w) { w = w.toLowerCase(); return IF_TYPES.some(function (t) { return t.indexOf(w) === 0; }); }
  function cliCompile(src) {
    var toks = src.replace(/([\[\]()])/g, ' $1 ').trim().split(/\s+/), i = 0;
    function seq(stop) {
      var out = [];
      while (i < toks.length && stop.indexOf(toks[i]) < 0) {
        var t = toks[i++];
        if (t === '[') { out.push({ t: 'opt', seq: seq([']']) }); i++; }
        else if (t === '(') {
          var alts = [seq(['|', ')'])];
          while (toks[i] === '|') { i++; alts.push(seq(['|', ')'])); }
          i++; out.push({ t: 'alt', seqs: alts });
        } else if (t === '\\|') out.push({ t: 'el', alts: [{ kw: '|' }] });   /* a literal pipe */
        else out.push({ t: 'el', alts: t.split('|').map(function (a) {
          var m = /^<(\w+)>$/.exec(a); return m ? { ty: m[1] } : { kw: a.toLowerCase() };
        }) });
      }
      return out;
    }
    return seq([]);
  }
  function cliGrammar(patterns) { return patterns.map(cliCompile); }
  function typeEnds(ty, toks, i) {
    var t = toks[i], n = toks.length, m;
    switch (ty) {
      case 'n': return /^\d+$/.test(t) ? [i + 1] : [];
      case 'ip': return isValidIP(t) ? [i + 1] : [];
      case 'v6': return V6_RE.test(t) ? [i + 1] : [];
      case 'v6p': m = /^(.+)\/\d{1,3}$/.exec(t); return m && V6_RE.test(m[1]) ? [i + 1] : [];
      case 'addr': return isValidIP(t) || V6_RE.test(t) ? [i + 1] : [];
      case 'area': return /^\d+$/.test(t) || isValidIP(t) ? [i + 1] : [];
      case 'mac': return /^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i.test(t) ? [i + 1] : [];
      case 'word': return [i + 1];
      case 'if':
        var out = [];
        m = /^([a-z][a-z-]*)?(\d+(\/\d+)*(\.\d+)?)$/i.exec(t);
        if (m && (m[1] ? ifWord(m[1]) : t.indexOf('/') > 0)) out.push(i + 1);
        if (/^[a-z][a-z-]*$/i.test(t) && ifWord(t) && i + 1 < n && IFNUM_RE.test(toks[i + 1])) out.push(i + 2);
        return out;
      case 'vlist': return /^[\d,\-\s]+$/.test(toks.slice(i).join(' ')) ? [n] : [];
      default: return [n];
    }
  }
  function matchEl(node, i, ctx) {
    var toks = ctx.toks, out = [];
    if (i >= toks.length) { ctx.short = true; return out; }
    var tok = toks[i].toLowerCase();
    node.alts.forEach(function (a) {
      var ends = a.ty ? typeEnds(a.ty, toks, i)
        : (a.kw === tok || (a.kw !== '*' && a.kw.indexOf(tok) === 0)) ? [i + 1] : [];
      ends.forEach(function (e) { if (out.indexOf(e) < 0) out.push(e); });
    });
    if (!out.length && i > ctx.far) ctx.far = i;
    return out;
  }
  function matchSeq(seq, j, i, ctx) {
    if (j === seq.length) return [i];
    var node = seq[j], starts = [], out = [];
    if (node.t === 'opt') starts = [i].concat(matchSeq(node.seq, 0, i, ctx));
    else if (node.t === 'alt') node.seqs.forEach(function (s) { starts = starts.concat(matchSeq(s, 0, i, ctx)); });
    else starts = matchEl(node, i, ctx);
    starts.forEach(function (p) {
      matchSeq(seq, j + 1, p, ctx).forEach(function (e) { if (out.indexOf(e) < 0) out.push(e); });
    });
    return out;
  }
  /* null when the line fits (or only stops short); otherwise IOS's caret
     error. The caret lines up with the echo every lab prints, "<prompt>
     <line>", so pass the prompt that was shown. A leading "do" is skipped. */
  function cliCheck(grammar, prompt, line) {
    var raw = String(line == null ? '' : line), toks = raw.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) return null;
    var shift = toks.length > 1 && toks[0].toLowerCase() === 'do' ? 1 : 0;
    var t = toks.slice(shift), ctx = { toks: t, far: -1, short: false };
    for (var k = 0; k < grammar.length; k++) {
      var ends = matchSeq(grammar[k], 0, 0, ctx);
      if (ends.indexOf(t.length) >= 0) return null;
      ends.forEach(function (e) { if (e > ctx.far) ctx.far = e; });
    }
    if (ctx.short) return null;
    return cliCaretAt(prompt, raw, Math.max(0, ctx.far) + shift);
  }

  /* ---------- output filters: show ... | include|exclude|begin|section ----------
     cliPipe splits a piped show command into the command and its filter (or
     IOS's error for a malformed filter); cliFilter applies the filter to the
     command's output. A page's CLI entry runs the command on its own, so the
     grammar never sees the pipe:
       const pp=LabShared.cliPipe(prompt, line);
       if(pp) return pp.err || LabShared.cliFilter(run(pp.base), pp);
     Only show commands take a filter, as on IOS. */
  var PIPE_KINDS = ['include', 'exclude', 'begin', 'section'];
  function cliCaretAt(prompt, raw, at) {
    var re = /\S+/g, m, idx = 0, col = raw.length;
    while ((m = re.exec(raw))) { if (idx === at) { col = m.index; break; } idx++; }
    return new Array(String(prompt || '').length + 2 + col).join(' ') + "^\n% Invalid input detected at '^' marker.";
  }
  function cliPipe(prompt, line) {
    var raw = String(line == null ? '' : line), cut = raw.indexOf('|');
    if (cut < 0) return null;
    var toks = raw.trim().split(/\s+/), first = (toks[0] || '').toLowerCase();
    if (first === 'do' && toks[1]) first = toks[1].toLowerCase();
    if (first.length < 2 || 'show'.indexOf(first) !== 0) return null;
    var base = raw.slice(0, cut), after = raw.slice(cut + 1).trim().split(/\s+/).filter(Boolean);
    var at = base.trim().split(/\s+/).length + (raw.charAt(cut + 1) === ' ' || !after.length ? 1 : 0);
    if (!after.length) return { err: '% Incomplete command.' };
    var kind = PIPE_KINDS.filter(function (k) { return k.indexOf(after[0].toLowerCase()) === 0; })[0];
    if (!kind) return { err: cliCaretAt(prompt, raw, at) };
    if (after.length < 2) return { err: '% Incomplete command.' };
    return { base: base, kind: kind, pat: after.slice(1).join(' ') };
  }
  function cliFilter(out, p) {
    var text = String(out == null ? '' : out), lines = text.split('\n');
    if (lines.some(function (l) { return /^%|^\s*\^$/.test(l); })) return text;   /* an error passes through */
    var re; try { re = new RegExp(p.pat); } catch (e) { re = { test: function (s) { return s.indexOf(p.pat) >= 0; } }; }
    if (p.kind === 'include') return lines.filter(function (l) { return re.test(l); }).join('\n');
    if (p.kind === 'exclude') return lines.filter(function (l) { return !re.test(l); }).join('\n');
    if (p.kind === 'begin') { var i = 0; while (i < lines.length && !re.test(lines[i])) i++; return lines.slice(i).join('\n'); }
    /* section: a matching line and everything indented under it */
    var keep = [], depth = -1;
    lines.forEach(function (l) {
      var ind = l.length - l.replace(/^\s+/, '').length;
      if (depth >= 0 && ind > depth && l.trim()) { keep.push(l); return; }
      depth = -1;
      if (re.test(l)) { keep.push(l); depth = ind; }
    });
    return keep.join('\n');
  }

  window.LabShared = {
    cliGrammar: cliGrammar,
    cliCheck: cliCheck,
    cliPipe: cliPipe,
    cliFilter: cliFilter,
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
