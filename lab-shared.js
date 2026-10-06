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

  /* ---------- routed cables ----------
     Switch and router ports sit on the bottom edge of the box, so a straight
     line between two of them lies along the port row (devices level) or cuts
     through a box (devices staggered). cablePaths routes such a cable the way
     a tidy rack is cabled: down from its port, across, and up into the other
     port from below. When the drop from the higher port would run through the
     lower box, the cable goes down the side of that box instead (a corridor
     14px clear of it). A cable from a bottom port to a free end ABOVE it (a PC
     sitting higher than its router) would cut straight up through its own
     box, so it drops, runs out to the nearer side and climbs that corridor.
     Horizontal runs that overlap step down one level each, narrowest first,
     so bundles nest instead of stacking and nested cables never cross. Any
     other cable with a free end (a PC below, a single-port router) stays a
     straight line.
       ends: [{ax, ay, bx, by, aDown, bDown, aBox, bBox}]  ->  path strings
       (a box is {l, t, r, b}: the down end's own box, for the corridors) */
  function roundedPath(pts, R) {
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i];
      if (i === pts.length - 1) { d += 'L' + p[0] + ' ' + p[1]; break; }
      var a = pts[i - 1], c = pts[i + 1];
      var l1 = Math.hypot(p[0] - a[0], p[1] - a[1]), l2 = Math.hypot(c[0] - p[0], c[1] - p[1]);
      var r = Math.min(R, l1 / 2, l2 / 2);
      if (r < 1) { d += 'L' + p[0] + ' ' + p[1]; continue; }
      var bx = p[0] - (p[0] - a[0]) / l1 * r, by = p[1] - (p[1] - a[1]) / l1 * r;
      var ex = p[0] + (c[0] - p[0]) / l2 * r, ey = p[1] + (c[1] - p[1]) / l2 * r;
      d += 'L' + bx + ' ' + by + 'Q' + p[0] + ' ' + p[1] + ' ' + ex + ' ' + ey;
    }
    return d;
  }
  function cablePaths(ends) {
    var BASE = 16, STEP = 11, GAP = 14, out = [], runs = [], routes = [];
    function run(base, x1, x2) { var h = { base: base, lo: Math.min(x1, x2), hi: Math.max(x1, x2) }; runs.push(h); return h; }
    ends.forEach(function (e, i) {
      var a = { x: e.ax, y: e.ay, box: e.aBox }, b = { x: e.bx, y: e.by, box: e.bBox };
      if (!(e.aDown && e.bDown)) {
        /* one bottom port, one free end */
        var dn = e.aDown ? a : e.bDown ? b : null, fr = dn === a ? b : a, bx = dn && dn.box;
        if (!bx || fr.y >= dn.y - 2) { out[i] = 'M' + e.ax + ' ' + e.ay + 'L' + e.bx + ' ' + e.by; return; }
        var cx = fr.x < (bx.l + bx.r) / 2 ? bx.l - GAP : bx.r + GAP;
        routes.push({ i: i, rev: dn !== a, h: [run(dn.y, dn.x, cx)], build: function (h) {
          var pts = [[dn.x, dn.y], [dn.x, h[0].y], [cx, h[0].y]];
          /* a free end over the box itself: climb past the top before turning in */
          if (fr.x > bx.l - GAP && fr.x < bx.r + GAP) pts.push([cx, Math.min(fr.y, bx.t - GAP)]);
          pts.push([fr.x, fr.y]);
          return pts;
        } });
        return;
      }
      /* hi = the higher port, lo = the lower */
      var aHi = a.y <= b.y, hi = aHi ? a : b, lo = aHi ? b : a, lb = lo.box;
      if (lo.y - hi.y >= 40 && lb && hi.x > lb.l - 8 && hi.x < lb.r + 8) {
        /* the drop would hit the lower box: across to its nearer side first */
        var sx = (hi.x - lb.l < lb.r - hi.x) ? lb.l - GAP : lb.r + GAP;
        routes.push({ i: i, rev: !aHi, h: [run(hi.y, hi.x, sx), run(lo.y, sx, lo.x)], build: function (h) {
          return [[hi.x, hi.y], [hi.x, h[0].y], [sx, h[0].y], [sx, h[1].y], [lo.x, h[1].y], [lo.x, lo.y]];
        } });
      } else {
        routes.push({ i: i, rev: !aHi, h: [run(Math.max(hi.y, lo.y), hi.x, lo.x)], build: function (h) {
          return [[hi.x, hi.y], [hi.x, h[0].y], [lo.x, h[0].y], [lo.x, lo.y]];
        } });
      }
    });
    /* levels: narrowest first, each one step below any overlapping run on its row */
    runs.sort(function (p, q) { return (p.hi - p.lo) - (q.hi - q.lo); });
    var placed = [];
    runs.forEach(function (h) {
      var lvl = 0;
      placed.forEach(function (o) { if (o.lo <= h.hi && h.lo <= o.hi && Math.abs(o.base - h.base) < 40) lvl = Math.max(lvl, o.lvl + 1); });
      h.lvl = lvl; h.y = h.base + BASE + lvl * STEP; placed.push(h);
    });
    routes.forEach(function (rt) {
      var pts = rt.build(rt.h);
      /* a route is built from its own natural end; put it back in a-to-b order */
      if (rt.rev) pts.reverse();
      out[rt.i] = roundedPath(pts, 8);
    });
    return out;
  }

  /* ---------- port slots ----------
     Which slot along a box's bottom edge each port is drawn in. A port keeps
     its name and number; only where its circle sits changes, so that every
     cable leaves on the side it is heading for and the cables out of one box
     don't cross each other. From each edge inwards: cables that climb the
     corridor beside the box (a free end above), then routed cables to other
     bottom ports — nearest far end at the edge, so cables to farther devices
     nest round them — then straight cables down to a free end below. Uncabled
     ports keep their own order in the slots left over in the middle.
     A page computes this once, when the round's cables exist, and keeps it,
     so ports never move while the learner is cabling.
       far: per port, null (uncabled) or {x, kind}: x is the far end's x;
            kind 'up' (free end above the port), 'u' (another bottom port)
            or 'down' (free end below)
       cx:  the box's own centre x            ->  slot index per port */
  function portSlots(far, cx) {
    var RANK = { up: 0, u: 1, down: 2 }, idx = far.map(function (_, i) { return i; });
    function side(left) {
      return idx.filter(function (i) { return far[i] && (far[i].x < cx) === left; })
        .sort(function (p, q) {
          var A = far[p], B = far[q], dA = Math.abs(A.x - cx), dB = Math.abs(B.x - cx);
          if (A.kind !== B.kind) return RANK[A.kind] - RANK[B.kind];
          return (A.kind === 'u' ? dA - dB : dB - dA) || p - q;
        });
    }
    var order = side(true).concat(idx.filter(function (i) { return !far[i]; }), side(false).reverse());
    var slot = [];
    order.forEach(function (p, k) { slot[p] = k; });
    return slot;
  }

  /* ---------- device consoles ----------
     Every lab CLI goes through one of these: a .term bound to a DEVICE
     (data-did on the .term), never to "whichever device is selected". That
     is what lets a page show more than one console at once — the main one
     in the device panel, plus pinned ones beside the page. A device carries
     its own log/hist/hi, so a console is only a view of it; that is also why
     a pinned device's main slot becomes a placeholder rather than a second
     copy of the same view.

     createConsoles(cfg) makes one page's manager. The page supplies only
     what differs between labs:
       id          short page key — element ids, storage, the registry
       mainIds     {input, log, prompt}: the main console's element ids
       device(id)  -> the device, or null
       hasCli(d)   -> true for devices with a CLI (only those get a console)
       prompt(d)   run(d, line) -> output     keywords(d) -> the Tab tree
       after(d)    the page's own refresh after a command (canvas, panel)
       dockAfter   id of the element the pins dock under when the window is
                   too narrow to float them beside the page
       isError(line), escape(s), btnClass, logLines   (optional)
       windows     how many pinned windows the right-hand gutter is split
                   into, top to bottom (default 2). Each is a snap zone: a
                   pin fills its own band of the screen and can't be dragged
                   past the band's edge. More windows later is this number.
     The page puts mainHtml(d) where its terminal goes and pinBtnHtml(d)
     beside its Close button, calls refresh() wherever it used to redraw
     its terminal, focusPinned(id) at the top of its device-click handler,
     and unpinAll() when a round starts. */
  var CON_REG = {}, CON_WIDE = 1600, CON_TOP = 84, CON_EDGE = 16, CON_GAP = 12, CON_MINW = 280, CON_MINH = 180;
  var CON_PIN_SVG = '<svg viewBox="0 0 24 24"><path d="M12 17v5"/><path d="M9 3h6l-1 6 4 4v2H6v-2l4-4z"/></svg>';
  var CON_MOVE_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>';
  function conEsc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function conId(v) { return isNaN(+v) ? v : +v; }
  /* which band of the screen window k (0-based) of n is: the bands are
     equal shares of the WINDOW's height — with two, the halfway line is the
     middle of the screen — less a gap between them, with the top one
     starting below the page header and the bottom one 16px off the edge */
  function conBand(k, n) {
    var H = window.innerHeight;
    var top = k ? Math.round(H * k / n) + CON_GAP / 2 : CON_TOP;
    var bottom = k < n - 1 ? Math.round(H * (k + 1) / n) - CON_GAP / 2 : H - CON_EDGE;
    return { top: top, max: Math.max(CON_MINH, bottom - top) };
  }
  function conWinIcon(k, n) {
    var h = 13 / n;
    return '<svg viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="13" height="13" rx="2"/>' +
      '<rect class="fill" x="1.5" y="' + (1.5 + h * k) + '" width="13" height="' + h + '" rx="1"/></svg>';
  }
  function conWinName(k, n) {
    return 'Window ' + (k + 1) + (n === 2 ? (k ? ' · bottom' : ' · top') : '');
  }
  var conMenu = null;
  function closeConMenu() { if (conMenu) { conMenu.remove(); conMenu = null; } }

  function createConsoles(cfg) {
    var N = cfg.windows || 2, slots = [], host = null, guides = [], snap = null, drag = null;
    for (var i = 0; i < N; i++) slots.push(null);
    var mq = window.matchMedia('(min-width: ' + CON_WIDE + 'px)');
    var esc = cfg.escape || conEsc;
    var isErr = cfg.isError || function (l) { return l.charAt(0) === '%'; };
    var btn = cfg.btnClass || 'btn btn-s';
    var sizeKey = 'ne-con-pin:' + cfg.id;

    function devOf(el) { return cfg.device(conId(el.getAttribute('data-did'))); }
    function anyPinned() { return slots.some(Boolean); }
    function slotOfId(id) {
      for (var k = 0; k < N; k++) if (slots[k] && String(slots[k].id) === String(id)) return k;
      return -1;
    }
    function floating() { return mq.matches; }
    function termHtml(d, ids) {
      return '<div class="term" data-con="' + cfg.id + '" data-did="' + esc(d.id) + '">' +
        '<div class="term-log" id="' + ids.log + '"></div>' +
        '<div class="term-inrow"><span class="term-prompt" id="' + ids.prompt + '"></span>' +
        '<input class="term-in" id="' + ids.input + '" autocomplete="off" spellcheck="false"></div></div>';
    }
    function pinIds(k) {
      return { input: cfg.id + '-term-in-pin' + k, log: cfg.id + '-term-log-pin' + k, prompt: cfg.id + '-term-prompt-pin' + k };
    }
    function mainState(d) { var k = slots.indexOf(d); return k < 0 ? 'term' : 'pin' + k; }
    function mainInner(d) {
      var k = slots.indexOf(d);
      return k >= 0
        ? '<div class="cli-note con-placeholder">' + esc(d.name) + '’s console is pinned to window ' + (k + 1) +
          '. Click another device to open a second console window.</div>'
        : termHtml(d, cfg.mainIds);
    }
    /* the main console slot for d, for the page's own panel template */
    function mainHtml(d) {
      return '<div class="con-slot" id="' + cfg.id + '-con-main" data-did="' + esc(d.id) + '" data-state="' + mainState(d) + '">' + mainInner(d) + '</div>';
    }
    /* the Pin button for the panel header; CSS shows it only where a pin can float */
    function pinBtnHtml(d) {
      if (!d || !cfg.hasCli(d)) return '';
      return '<button type="button" class="' + btn + ' con-pin-btn" data-con-act="pin" data-con="' + cfg.id + '" data-did="' + esc(d.id) +
        '" title="Pin this console beside the page, then open another device’s">' + CON_PIN_SVG + 'Pin</button>';
    }
    function panelHtml(d, k) {
      return '<div class="cfg-panel con-pin" data-con="' + cfg.id + '" data-slot="' + k + '">' +
        '<div class="cfg-hdr"><div class="cfg-name">' +
          '<span class="con-move" title="Drag to the other window">' + CON_MOVE_SVG + '</span>' + esc(d.name) +
          '<span class="con-pin-tag">Window ' + (k + 1) + '</span></div>' +
        '<button type="button" class="' + btn + ' con-close-btn" data-con-act="unpin" data-con="' + cfg.id + '" data-did="' + esc(d.id) + '">Close</button></div>' +
        termHtml(d, pinIds(k)) +
        '<span class="con-grip" title="Drag to resize"></span></div>';
    }
    /* a panel that changes window keeps its element (so its log, scroll and
       focus survive the move) and only takes the new window's ids and tag */
    function setSlot(p, k) {
      p.setAttribute('data-slot', k);
      var ids = pinIds(k);
      p.querySelector('.term-log').id = ids.log;
      p.querySelector('.term-prompt').id = ids.prompt;
      p.querySelector('.term-in').id = ids.input;
      p.querySelector('.con-pin-tag').textContent = 'Window ' + (k + 1);
    }
    function panelAt(k) { return host ? host.querySelector('.con-pin[data-slot="' + k + '"]') : null; }

    function sizes() { try { return JSON.parse(localStorage.getItem(sizeKey) || '{}') || {}; } catch (err) { return {}; } }
    /* w is null for a docked resize: there the pin is full width, which says
       nothing about how wide it should float */
    function saveSize(k, w, h) {
      var all = sizes(), was = all[k] || {};
      all[k] = { w: w == null ? was.w : Math.round(w), h: Math.round(h) };
      try { localStorage.setItem(sizeKey, JSON.stringify(all)); } catch (err) {}
    }

    /* Floating, the pins live on <body> (a blurred or transformed card would
       otherwise become their containing block), in a click-through layer the
       size of the window; docked, they stack in the page flow straight after
       cfg.dockAfter. */
    function ensureHost() {
      if (host) return;
      host = document.createElement('div');
      host.className = 'con-pins';
      for (var j = 1; j < N; j++) { var g = document.createElement('div'); g.className = 'con-guide'; host.appendChild(g); guides.push(g); }
      snap = document.createElement('div'); snap.className = 'con-snap'; host.appendChild(snap);
      host.addEventListener('mousedown', onHostDown);
    }
    function place() {
      if (!anyPinned()) {
        if (host && host.parentNode) host.parentNode.removeChild(host);
        return;
      }
      ensureHost();
      var wide = floating();
      host.classList.toggle('floating', wide);
      if (wide) {
        if (host.parentNode !== document.body) document.body.appendChild(host);
      } else {
        var a = cfg.dockAfter && document.getElementById(cfg.dockAfter);
        if (a && a.parentNode) { if (a.nextSibling !== host) a.parentNode.insertBefore(host, a.nextSibling); }
        else if (host.parentNode !== document.body) document.body.appendChild(host);
      }
      layout();
    }
    /* Each pin sits at the top of its own band and may not be taller than
       it; docked, the bands mean nothing and the pins just stack. */
    function layout() {
      if (!host) return;
      var wide = floating();
      [].forEach.call(host.querySelectorAll('.con-pin'), function (p) {
        if (!wide) { p.style.top = ''; p.style.maxHeight = ''; return; }
        var b = conBand(+p.getAttribute('data-slot'), N);
        p.style.top = b.top + 'px';
        p.style.maxHeight = b.max + 'px';
        if (p.offsetHeight > b.max) p.style.height = b.max + 'px';
      });
      guides.forEach(function (g, j) { g.style.top = Math.round(window.innerHeight * (j + 1) / N) + 'px'; });
    }
    function renderPins() {
      if (anyPinned()) ensureHost();
      for (var k = 0; k < N; k++) {
        var d = slots[k], el = panelAt(k);
        if (!d) { if (el) el.parentNode.removeChild(el); continue; }
        if (el && el._dev === d) continue;
        var tmp = document.createElement('div');
        tmp.innerHTML = panelHtml(d, k);
        var p = tmp.firstChild;
        p._dev = d;
        var sz = sizes()[k];
        if (sz && sz.w) p.style.width = sz.w + 'px';
        if (sz && sz.h) p.style.height = sz.h + 'px';
        /* placed before it is attached, so a new pin appears in its window
           rather than sliding there from the top one */
        if (floating()) { var bd = conBand(k, N); p.style.top = bd.top + 'px'; p.style.maxHeight = bd.max + 'px'; }
        if (el) host.replaceChild(p, el); else host.appendChild(p);
      }
      place();
    }
    function onWidth() {
      closeConMenu();
      if (!anyPinned() || !host) return;
      if (host.classList.contains('floating') !== floating()) place(); else layout();
    }
    mq.addEventListener('change', onWidth);
    window.addEventListener('resize', onWidth);

    /* ── dragging: the four-arrow handle moves a pin to another window,
       the corner grip resizes it within its own ── */
    function onHostDown(e) {
      if (e.button !== 0) return;
      var p = e.target.closest && e.target.closest('.con-pin');
      if (!p) return;
      if (e.target.closest('.con-grip')) startSize(e, p);
      else if (e.target.closest('.con-move') && floating()) startMove(e, p);
    }
    function bandAt(y) { return Math.max(0, Math.min(N - 1, Math.floor(y / (window.innerHeight / N)))); }
    function showSnap(k) {
      var b = conBand(k, N);
      snap.style.top = b.top + 'px';
      snap.style.height = b.max + 'px';
    }
    function startMove(e, p) {
      e.preventDefault();
      var k = +p.getAttribute('data-slot');
      drag = { kind: 'move', p: p, from: k, to: k, x: e.clientX, y: e.clientY, pushed: null };
      p.classList.add('con-dragging');
      host.classList.add('con-moving');
      document.body.classList.add('con-moving-body');
      showSnap(k);
    }
    function moveTo(e) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.p.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      var t = bandAt(e.clientY);
      if (t === drag.to) return;
      /* crossing into another window pushes whoever is in it into the one
         this pin came from; crossing back puts them home again */
      if (drag.pushed) {
        var home = conBand(+drag.pushed.getAttribute('data-slot'), N);
        drag.pushed.style.top = home.top + 'px';
        drag.pushed.style.maxHeight = home.max + 'px';
        drag.pushed = null;
      }
      if (t !== drag.from) {
        var other = panelAt(t);
        if (other) {
          var from = conBand(drag.from, N);
          other.style.top = from.top + 'px';
          other.style.maxHeight = from.max + 'px';
          drag.pushed = other;
        }
      }
      drag.to = t;
      showSnap(t);
    }
    function endMove() {
      var p = drag.p, from = drag.from, to = drag.to, pushed = drag.pushed;
      var before = p.getBoundingClientRect();
      if (to !== from) {
        var dv = slots[from];
        slots[from] = slots[to];
        slots[to] = dv;
        setSlot(p, to);
        if (pushed) setSlot(pushed, from);
      }
      p.classList.remove('con-dragging');
      p.style.transition = 'none';
      p.style.transform = '';
      layout();
      /* glide from where it was let go into its window */
      var after = p.getBoundingClientRect();
      p.style.transform = 'translate(' + (before.left - after.left) + 'px,' + (before.top - after.top) + 'px)';
      void p.offsetWidth;
      p.style.transition = '';
      p.style.transform = '';
      refresh();
    }
    /* A pin can be pulled a little past its edge, against resistance, and
       springs back when let go — the band's line is a wall, not a stop that
       silently eats the drag. */
    function band(v, min, max) {
      if (v < min) return min;
      return v > max ? max + Math.min(24, (v - max) * 0.25) : v;
    }
    function startSize(e, p) {
      e.preventDefault();
      var r = p.getBoundingClientRect(), k = +p.getAttribute('data-slot'), wide = floating();
      drag = { kind: 'size', p: p, k: k, x: e.clientX, y: e.clientY, w: r.width, h: r.height, wide: wide,
        maxH: wide ? conBand(k, N).max : 1200,
        maxW: wide ? Math.max(CON_MINW, document.documentElement.clientWidth - r.left - CON_EDGE) : r.width };
      p.classList.add('con-sizing');
      host.classList.add('con-sizing-host');
      document.body.classList.add(wide ? 'con-sizing-body' : 'con-sizing-v-body');
    }
    function sizeTo(e) {
      var w = band(drag.w + (drag.wide ? e.clientX - drag.x : 0), CON_MINW, drag.maxW);
      var h = band(drag.h + e.clientY - drag.y, CON_MINH, drag.maxH);
      if (drag.wide) drag.p.style.width = w + 'px';
      drag.p.style.height = h + 'px';
      drag.p.style.maxHeight = 'none';
      var hit = h > drag.maxH, g = guides[drag.k];
      if (g) g.classList.toggle('hit', hit);
      drag.over = hit || w > drag.maxW;
    }
    function endSize() {
      var p = drag.p, w = Math.min(p.offsetWidth, drag.maxW), h = Math.min(p.offsetHeight, drag.maxH);
      /* past the edge: spring back (an overshooting ease, so it visibly
         bounces off the line), and only re-clamp once it has settled */
      if (drag.over) {
        p.classList.add('con-bounce');
        void p.offsetWidth;
        setTimeout(function () { p.classList.remove('con-bounce'); layout(); }, 470);
      }
      if (drag.wide) p.style.width = w + 'px';
      p.style.height = h + 'px';
      p.classList.remove('con-sizing');
      guides.forEach(function (g) { g.classList.remove('hit'); });
      if (!drag.over) layout();
      saveSize(drag.k, drag.wide ? w : null, h);
    }
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      if (drag.kind === 'move') moveTo(e); else sizeTo(e);
    });
    window.addEventListener('mouseup', function () {
      if (!drag) return;
      if (drag.kind === 'move') endMove(); else endSize();
      if (host) host.classList.remove('con-moving', 'con-sizing-host');
      document.body.classList.remove('con-moving-body', 'con-sizing-body', 'con-sizing-v-body');
      drag = null;
    });

    function fill(term) {
      var d = devOf(term);
      if (!d) return;
      var log = term.querySelector('.term-log'), pr = term.querySelector('.term-prompt');
      log.innerHTML = (d.log || []).slice(-(cfg.logLines || 400)).map(function (l) {
        return '<div class="tl' + (isErr(l) ? ' terr' : '') + '">' + esc(l) + '</div>';
      }).join('');
      log.scrollTop = log.scrollHeight;
      if (pr) pr.textContent = cfg.prompt(d);
    }
    /* Redraw every console this page has open. Pins whose device no longer
       exists (a new round reuses ids) are dropped first. */
    function refresh() {
      var gone = false;
      for (var k = 0; k < N; k++) if (slots[k] && cfg.device(slots[k].id) !== slots[k]) { slots[k] = null; gone = true; }
      if (gone) renderPins();
      var slot = document.getElementById(cfg.id + '-con-main');
      if (slot) {
        var d = devOf(slot);
        if (d) {
          var want = mainState(d);
          if (slot.getAttribute('data-state') !== want) { slot.innerHTML = mainInner(d); slot.setAttribute('data-state', want); }
        }
      }
      [].forEach.call(document.querySelectorAll('.term[data-con="' + cfg.id + '"]'), fill);
    }
    function onKey(e, inp, term) {
      var d = devOf(term);
      if (!d || !cfg.hasCli(d)) return;
      d.log = d.log || []; d.hist = d.hist || [];
      if (d.hi == null) d.hi = d.hist.length;
      if (e.key === 'Enter') {
        var line = inp.value, id = inp.id;
        inp.value = '';
        if (line.trim()) d.hist.push(line);
        d.hi = d.hist.length;
        d.log.push(cfg.prompt(d) + ' ' + line);
        var out = cfg.run(d, line);
        if (out) String(out).split('\n').forEach(function (l) { d.log.push(l); });
        if (cfg.after) cfg.after(d);
        refresh();
        /* the page's refresh may have rebuilt the panel this input lived in */
        var again = document.getElementById(id);
        if (again && document.activeElement !== again) again.focus({ preventScroll: true });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (d.hi > 0) { d.hi--; inp.value = d.hist[d.hi] || ''; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (d.hi < d.hist.length - 1) { d.hi++; inp.value = d.hist[d.hi] || ''; }
        else { d.hi = d.hist.length; inp.value = ''; }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        inp.value = tabComplete(cfg.keywords(d), inp.value, function (c) { d.log.push(c.join('   ')); refresh(); });
      }
    }
    /* Clicking a pinned device on the canvas lands in its pinned console. */
    function focusPinned(id) {
      var k = slotOfId(id);
      if (k < 0 || cfg.device(slots[k].id) !== slots[k]) return false;
      var panel = panelAt(k);
      if (!panel) return false;
      if (!floating()) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      var inp = panel.querySelector('.term-in');
      if (inp) inp.focus({ preventScroll: true });
      panel.classList.remove('con-flash');
      void panel.offsetWidth;
      panel.classList.add('con-flash');
      return true;
    }
    /* Pin d into window k (replacing whoever is there). */
    function pin(id, k) {
      var d = cfg.device(id);
      if (!d || !cfg.hasCli(d)) return;
      if (slots.indexOf(d) >= 0) { focusPinned(id); return; }
      if (k == null || k < 0 || k >= N) { k = slots.indexOf(null); if (k < 0) k = 0; }
      slots[k] = d;
      renderPins();
      refresh();
      focusPinned(id);
    }
    /* The Pin button: straight into window 1 when nothing is pinned yet,
       otherwise a menu asking which window. */
    function requestPin(id, b) {
      var d = cfg.device(id);
      if (!d || !cfg.hasCli(d)) return;
      if (slots.indexOf(d) >= 0) { focusPinned(id); return; }
      if (conMenu && conMenu._btn === b) { closeConMenu(); return; }
      closeConMenu();
      if (N === 1 || !anyPinned() || !floating() || !b) { pin(id); return; }
      var m = document.createElement('div');
      m.className = 'sel-menu con-menu';
      var html = '<div class="con-menu-lbl">Pin ' + esc(d.name) + '’s console to</div>';
      for (var k = 0; k < N; k++) {
        html += '<button type="button" class="sel-item con-menu-opt" data-k="' + k + '">' + conWinIcon(k, N) +
          '<span>' + conWinName(k, N) + '</span><span class="con-menu-sub">' + (slots[k] ? esc(slots[k].name) : 'empty') + '</span></button>';
      }
      m.innerHTML = html;
      document.body.appendChild(m);
      var r = b.getBoundingClientRect(), mh = m.offsetHeight;
      m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
      m.style.top = (r.bottom + 6 + mh > window.innerHeight - 8 ? r.top - 6 - mh : r.bottom + 6) + 'px';
      m.addEventListener('click', function (e) {
        var o = e.target.closest && e.target.closest('[data-k]');
        if (!o) return;
        closeConMenu();
        pin(id, +o.getAttribute('data-k'));
      });
      m._btn = b;
      conMenu = m;
    }
    function unpin(id) {
      var k = slotOfId(id);
      if (k < 0) return;
      slots[k] = null;
      renderPins();
      refresh();
    }
    function unpinAll() {
      closeConMenu();
      if (!anyPinned()) return;
      for (var k = 0; k < N; k++) slots[k] = null;
      renderPins();
      refresh();
    }
    var api = {
      mainHtml: mainHtml, pinBtnHtml: pinBtnHtml, refresh: refresh,
      pin: pin, requestPin: requestPin, unpin: unpin, unpinAll: unpinAll, focusPinned: focusPinned,
      isPinned: function (id) { return slotOfId(id) >= 0; },
      pinned: function () { return slots.slice(); },
      _key: onKey
    };
    CON_REG[cfg.id] = api;
    return api;
  }
  /* One listener each for every page's consoles: keys typed into any
     console's input, and the Pin / Close buttons. A .term without data-con
     (the OSPF Cost drill's read-only CLI) is left to its own handler. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeConMenu();
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('term-in') || !t.closest) return;
    var term = t.closest('.term[data-con]');
    var c = term && CON_REG[term.getAttribute('data-con')];
    if (c) c._key(e, t, term);
  });
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-con-act]');
    var c = b && CON_REG[b.getAttribute('data-con')];
    if (!c) return;
    var id = conId(b.getAttribute('data-did'));
    if (b.getAttribute('data-con-act') === 'pin') c.requestPin(id, b); else c.unpin(id);
  });
  /* the window menu closes on a press anywhere else (its own button toggles it) */
  document.addEventListener('mousedown', function (e) {
    if (conMenu && !conMenu.contains(e.target) && !(conMenu._btn && conMenu._btn.contains(e.target))) closeConMenu();
  }, true);
  window.addEventListener('scroll', function () { closeConMenu(); }, true);

  window.LabShared = {
    cablePaths: cablePaths,
    portSlots: portSlots,
    createConsoles: createConsoles,
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
