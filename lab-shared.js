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

  /* Green / red / neutral on a .ping-out, leaving any other class it carries
     (the PC tool's scrolling .pt-out) alone. */
  function outState(out, st) {
    out.classList.remove('pok', 'perr');
    if (st) out.classList.add(st);
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
    if (r.msg) { out.textContent = '% ' + r.msg; outState(out, 'perr'); return; }
    var seq = r.ok
      ? (r.firstTime ? ['.', '!', '!', '!'] : ['!', '!', '!', '!'])
      : ['.', '.', '.', '.'];
    outState(out, '');
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
      outState(out, r.ok ? 'pok' : 'perr');
      if (btn) btn.disabled = false;
    };
    setTimeout(step, 260);
  }

  /* ---------- tracert ----------
     A PC's tracert, printed the way Windows prints it, over whatever
     forwarding model the page has. The page does not write a second walker:
     its own forwarder, handed an array, records each router a probe ARRIVES
     at ({dev, ip: the address it arrived on, ...}) and sets .fwd on the ones
     that got as far as forwarding it. That is the point where a real router
     decrements the TTL, so the .fwd routers are exactly the ones that answer
     a tracert hop with Time Exceeded — a router that drops the probe on the
     way in (an inbound ACL, no route) never appears as a hop of its own; it
     reports instead.

     traceHops(t) turns one recorded walk into the lines tracert prints:
       t.path   the recorded arrivals, in order
       t.res    the page's ping result for the same probe: ok (there and
                back), arrived (it got there, the reply did not), noRoute,
                blocked (an ACL), loop — anything else is a silent drop
       t.back(entry, type) -> bool   can that router's ICMP message
                ('time-exceeded' | 'unreachable') get back to the PC? A hop
                whose answer is lost prints "Request timed out." like real
                tracert, which is what NAT missing on the way out looks like.
       t.dst    the destination as it should print
     Returns up to TRACE_MAX entries: {ip} a hop that answered, {ip, note}
     a router reporting unreachable, {ip, done} the destination, null a
     timeout. Anything that does not end in a reply runs on to hop 30. */
  var TRACE_MAX = 30;
  function traceHops(t) {
    var res = t.res || {}, path = t.path || [], out = [];
    var back = t.back || function () { return true; };
    var hop = function (e) { return back(e, 'time-exceeded') ? { ip: e.ip } : null; };
    if (res.loop && path.length > 1) {
      /* A routing loop: from the router it came back to, the probe goes round
         the same routers again until its TTL runs out. The router it came back
         to forwards the same way it did the first time, so the loop is
         everything after its first visit. */
      var last = path[path.length - 1], j = -1, seq = path.slice();
      for (var k = 0; k < path.length - 1; k++) if (path[k].dev === last.dev) { j = k; break; }
      var cycle = j >= 0 ? path.slice(j + 1) : [];
      while (cycle.length && seq.length < TRACE_MAX) seq = seq.concat(cycle);
      return seq.slice(0, TRACE_MAX).map(hop);
    }
    path.forEach(function (e) { if (e.fwd) out.push(hop(e)); });
    var end = null;
    if (res.ok) end = { ip: t.dst, done: true };
    else if (!res.arrived) {
      var L = path[path.length - 1];
      if (L && (res.noRoute || res.blocked) && back(L, 'unreachable'))
        end = { ip: L.ip, note: res.noRoute ? 'Destination net unreachable.' : 'Destination host unreachable.' };
    }
    out.push(end);
    if (!end) while (out.length < TRACE_MAX) out.push(null);
    return out.slice(0, TRACE_MAX);
  }
  /* One line of tracert output, in Windows' columns: the hop number in 3,
     each probe's time in 9, two spaces, then who answered. */
  function traceLine(n, h) {
    var num = ('   ' + n).slice(-3);
    if (!h) return num + '     *        *        *     Request timed out.';
    if (h.note) return num + '  ' + h.ip + '  reports: ' + h.note;
    var col = function () {
      var ms = n === 1 ? '<1' : String(Math.max(1, n - 1 + Math.floor(Math.random() * 3) - 1));
      return ('      ' + ms).slice(-6) + ' ms';
    };
    return num + col() + col() + col() + '  ' + h.ip;
  }
  /* The animated reveal, the same choreography as runPing: one line per hop,
     slower while hops answer and quicker once it is plainly timing out to
     the end. cfg is runPing's, with trace(dst) in place of resolve(dst):
       {msg}                        validation error, no animation
       {path, res, back, dst}       see traceHops */
  function runTrace(cfg) {
    var dst = document.getElementById(cfg.inputId).value.trim();
    var out = document.getElementById(cfg.outId);
    var btn = document.getElementById(cfg.btnId);
    var r = cfg.trace(dst);
    if (r.msg) { out.textContent = '% ' + r.msg; outState(out, 'perr'); return; }
    var hops = traceHops({ path: r.path, res: r.res, back: r.back, dst: r.dst || dst });
    var reached = hops.some(function (h) { return h && h.done; });
    outState(out, '');
    out.textContent = 'Tracing route to ' + (r.dst || dst) + ' over a maximum of ' + TRACE_MAX + ' hops\n\n';
    if (btn) btn.disabled = true;
    var i = 0, quiet = 0;
    var step = function () {
      if (!cfg.stillActive()) { if (btn) btn.disabled = false; return; }
      out.textContent += traceLine(i + 1, hops[i]) + '\n';
      out.scrollTop = out.scrollHeight;
      i++;
      if (i < hops.length) { setTimeout(step, hops[i - 1] ? 300 : (++quiet <= 3 ? 450 : 110)); return; }
      out.textContent += '\nTrace complete.';
      outState(out, reached ? 'pok' : 'perr');
      if (btn) btn.disabled = false;
    };
    setTimeout(step, 300);
  }

  /* ---------- a PC's MAC address ----------
     One row of a PC panel's IP Configuration: the MAC in a box styled like
     the address fields beside it (.custom-ip-inp), not an inline code
     chip. Read-only, since it is burned into the NIC, but still selectable
     so it can be copied into a port-security command.
       pcMacHtml(mac, {id, style})  ->  a .pc-form row
         id     the box's id (default 'pc-mac')
         style  inline style for the row, e.g. the page's row spacing */
  function pcMacHtml(mac, o) {
    o = o || {};
    var id = o.id || 'pc-mac', v = String(mac || '').toUpperCase().replace(/[^0-9A-F.:-]/g, '');
    return '<div class="pc-form"' + (o.style ? ' style="' + o.style + '"' : '') + '>' +
      '<label class="pc-form-lbl" for="' + id + '">MAC Address</label>' +
      '<input class="custom-ip-inp" id="' + id + '" value="' + v + '" readonly spellcheck="false"' +
      ' title="Burned into the PC\'s NIC: read-only"></div>';
  }

  /* ---------- the PC's Ping | Tracert tool ----------
     Every lab PC panel has the same block: a Ping / Tracert pill where the
     "Ping" heading used to be, one target box, one button, one output. The
     page registers once, by an id prefix:
       pcTool('ac-ping', {pc, ping, trace})
         pc()            the PC whose panel is open, or null
         ping(pc, dst)   runPing's resolve
         trace(pc, dst)  runTrace's trace
     and renders the block wherever its panel is built with
       pcToolHtml('ac-ping', {label, placeholder, width})
     which makes ids <prefix>-ip / -btn / -out — the same ids every page used
     for its ping, so nothing else had to change. The chosen tool is held
     here per prefix, so it survives the panel being rebuilt and moving from
     one PC to another. A run is cancelled the moment its PC is no longer
     the open one, or the other tool is picked. */
  var pcTools = {};
  function pcToolState(key) { return pcTools[key] || (pcTools[key] = { mode: 'ping', gen: 0, cfg: null }); }
  function pcTool(key, cfg) { pcToolState(key).cfg = cfg; }
  function pcToolHtml(key, o) {
    o = o || {};
    var t = pcToolState(key), q = "'" + key + "'";
    var opt = function (m, label) {
      return '<button type="button" class="pt-opt' + (t.mode === m ? ' on' : '') + '" data-mode="' + m + '"' +
        ' aria-pressed="' + (t.mode === m) + '" onclick="LabShared.pcToolMode(' + q + ',\'' + m + '\')">' + label + '</button>';
    };
    return '<div class="pt-tog" id="' + key + '-tog" role="group" aria-label="PC network tool">' +
        opt('ping', 'Ping') + opt('tracert', 'Tracert') + '</div>' +
      '<div class="pc-form"><label class="pc-form-lbl" for="' + key + '-ip">' + (o.label || 'Target IP') + '</label>' +
        '<input class="custom-ip-inp" id="' + key + '-ip" placeholder="' + (o.placeholder || '') + '"' +
        (o.width ? ' style="width:' + o.width + '"' : '') + ' autocomplete="off" spellcheck="false"' +
        ' onkeydown="if(event.key===\'Enter\')LabShared.pcToolRun(' + q + ')">' +
        '<button class="rand-btn" id="' + key + '-btn" onclick="LabShared.pcToolRun(' + q + ')">' + (t.mode === 'ping' ? 'Ping' : 'Tracert') + '</button></div>' +
      '<pre class="ping-out pt-out" id="' + key + '-out"></pre>';
  }
  function pcToolMode(key, mode) {
    var t = pcToolState(key);
    if (t.mode === mode) return;
    t.mode = mode; t.gen++;
    var tog = document.getElementById(key + '-tog');
    if (tog) [].forEach.call(tog.querySelectorAll('.pt-opt'), function (b) {
      var on = b.getAttribute('data-mode') === mode;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
    var btn = document.getElementById(key + '-btn'), out = document.getElementById(key + '-out');
    if (btn) { btn.textContent = mode === 'ping' ? 'Ping' : 'Tracert'; btn.disabled = false; }
    if (out) { out.textContent = ''; outState(out, ''); }
  }
  /* The panel was rebuilt for a different state: drop the output and any run
     still animating into it. */
  function pcToolStop(key) {
    var t = pcToolState(key); t.gen++;
    var btn = document.getElementById(key + '-btn'), out = document.getElementById(key + '-out');
    if (btn) btn.disabled = false;
    if (out) { out.textContent = ''; outState(out, ''); }
  }
  function pcToolRun(key) {
    var t = pcToolState(key), cfg = t.cfg;
    var pc = cfg && cfg.pc();
    if (!pc) return;
    var my = ++t.gen;
    var o = {
      inputId: key + '-ip', btnId: key + '-btn', outId: key + '-out',
      stillActive: function () { return t.gen === my && cfg.pc() === pc; }
    };
    if (t.mode === 'tracert') { o.trace = function (dst) { return cfg.trace(pc, dst); }; runTrace(o); }
    else { o.resolve = function (dst) { return cfg.ping(pc, dst); }; runPing(o); }
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

  /* ---------- a lab Submit that hasn't passed yet ----------
     Every lab treats Submit as a check until all its requirements pass: the
     round stays open (no Next, no points, Skip still available) so the
     learner can fix what the ✗ rows name and Submit again. This is the
     banner for that in-between state, shared so the five labs say it the
     same way. The check count lives on the round's own data object, so a
     new round starts again at 1 without the page resetting anything, and
     the banner re-plays its entry animation — otherwise a second Submit
     with the same result looks like a click that did nothing. `o.summary`
     replaces the default "met/total requirements met" (the trainer counts
     tickets too); `o.tail` replaces the closing instruction (the trainer's
     checks show no reasons, so "each row says what is wrong" would be
     false there). */
  function labRecheck(fb, data, met, total, o) {
    o = o || {};
    data.checks = (data.checks || 0) + 1;
    fb.className = 'fbanner ' + (met >= Math.ceil(total * 0.6) ? 'warn' : 'err');
    fb.textContent = (o.summary || (met + '/' + total + ' requirements met')) +
      (data.checks > 1 ? ' (check ' + data.checks + ')' : '') +
      (o.tail || ' — each ✗ row says what is wrong. Fix it and Submit again.');
    fb.style.display = 'block';
    fb.style.animation = 'none';
    void fb.offsetWidth;
    fb.style.animation = 'slideIn .2s ease-out';
  }

  /* ---------- CLI tab-completion ----------
     Walks a nested keyword tree (each page defines its own — VLAN/trunk
     commands vs. IP-routing commands are completely different grammars)
     completing the last token, or listing candidates (via onAmbiguous)
     when more than one keyword matches. Returns the new input value;
     callers are expected to also preventDefault the Tab keypress
     themselves, since this only computes the replacement text. */
  /* allow(words), when given, keeps only completions that can begin a valid
     command in the console's current mode (cliCanStart) — Tab at # offers
     "show" but not "switchport", as on IOS. "do " in front completes the
     EXEC command after it. */
  function tabComplete(kwTree, val, onAmbiguous, allow) {
    var dm = allow ? /^(\s*do\s+)(.*)$/i.exec(val) : null;
    if (dm) return 'do ' + tabComplete(kwTree, dm[2], onAmbiguous, function (ws) { return allow(['do'].concat(ws)); });
    var ok = function (ws) { return !allow || allow(ws); };
    var endsSpace = /\s$/.test(val);
    var parts = val.trim().length ? val.trim().split(/\s+/) : [];
    var walk = endsSpace ? parts : parts.slice(0, -1);
    var node = kwTree, consumed = [];
    for (var i = 0; i < walk.length; i++) {
      var p = walk[i];
      var ks = Object.keys(node).filter(function (k) { return k.indexOf(p.toLowerCase()) === 0 && ok(consumed.concat([k])); });
      if (ks.length === 1) { node = node[ks[0]]; consumed.push(ks[0]); }
      else return val;
    }
    var partial = endsSpace ? '' : (parts[parts.length - 1] || '').toLowerCase();
    var cands = Object.keys(node).filter(function (k) { return k.indexOf(partial) === 0 && ok(consumed.concat([k])); });
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

     MODES. A grammar may be a plain list (every pattern fits in every mode —
     the OSPF Cost drill's read-only CLI) or an object whose keys are mode
     tags and whose values are lists: {'exec': [...], 'config': [...],
     'if': [...]}; a key may hold several tags ('cfg exec': ['exit']). A
     pattern fits where the current mode carries one of its tags:
       exec      privileged EXEC (#)            config  global configuration
       cfg       every configuration mode       any     everywhere (lab-only cls)
       if        any interface                  routed  a Layer 3 interface
       eth       a router's Ethernet port       ser     a serial interface
       sub       a sub-interface (g0/0.10)      lo      a loopback
       l2        a switch's Layer 2 interface   swport  a switch port or range
       po        a switch port-channel          svi     interface vlan N
       vlan      (config-vlan)    router  (config-router)    rtr  (config-rtr)
       line      (config-line)    nacl-std / nacl-ext / nacl6   the ACL modes
     cliCheck takes the mode as LEVELS: the current mode's tags first, then
     the mode IOS falls back to — a sub-mode's command list is searched,
     then global configuration's, so "hostname R2" typed in (config-if)
     runs and leaves you in (config). */
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
  function cliGrammar(spec) {
    if (Array.isArray(spec)) return spec.map(function (p) { return { tags: null, seq: cliCompile(p) }; });
    var out = [];
    Object.keys(spec).forEach(function (k) {
      var tags = k.split(/\s+/);
      spec[k].forEach(function (p) { out.push({ tags: tags, seq: cliCompile(p) }); });
    });
    return out;
  }
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
  function patFits(pat, level) {
    if (!pat.tags || !level) return true;
    for (var i = 0; i < pat.tags.length; i++) if (pat.tags[i] === 'any' || level.indexOf(pat.tags[i]) >= 0) return true;
    return false;
  }
  /* how far toks get against the patterns that fit level: full, short, far */
  function cliTry(grammar, toks, level) {
    var ctx = { toks: toks, far: -1, short: false }, full = false;
    for (var k = 0; k < grammar.length && !full; k++) {
      if (!patFits(grammar[k], level)) continue;
      var ends = matchSeq(grammar[k].seq, 0, 0, ctx);
      if (ends.indexOf(toks.length) >= 0) full = true;
      ends.forEach(function (e) { if (e > ctx.far) ctx.far = e; });
    }
    return { full: full, short: !full && ctx.short, far: ctx.far };
  }
  /* The tags of every pattern the line fits fully, wherever it belongs —
     what the learning labs' hint is built from — and the command's leading
     keywords as written in the pattern ("clock rate", "show"). */
  function cliWhere(grammar, toks) {
    var tags = {}, name = null;
    grammar.forEach(function (pat) {
      var ctx = { toks: toks, far: -1, short: false };
      if (matchSeq(pat.seq, 0, 0, ctx).indexOf(toks.length) < 0) return;
      (pat.tags || ['any']).forEach(function (t) { tags[t] = 1; });
      if (!name) {
        /* the leading keywords, spelled out ("sh ip ro" -> "show ip route"),
           walked against what was typed: past a leading "no" and an ACL
           sequence number, stopping at the first value */
        var kws = [], ti = 0, seq = pat.seq;
        for (var i = 0; i < seq.length && kws.length < 3 && ti < toks.length; i++) {
          var n = seq[i], tok = toks[ti].toLowerCase();
          if (n.t === 'opt') { if (/^\d+$/.test(tok) && !kws.length) ti++; continue; }
          if (n.t !== 'el') break;
          var hit = null;
          n.alts.forEach(function (a) { if (!hit && a.kw && a.kw.indexOf(tok) === 0) hit = a.kw; });
          if (!hit) break;
          ti++;
          if (hit === 'no' && !kws.length) continue;
          kws.push(hit);
        }
        name = kws.join(' ');
      }
    });
    return { tags: tags, name: name };
  }
  /* The learning labs' one-line hint under IOS's error: where the command
     WOULD have worked and how to get there. The trainer passes hint:false —
     the exam gives only the caret. Per tag: what the command is, how to get
     to where it belongs (go), and — for an interface or ACL of the wrong kind —
     what is wrong with the one the console is in. A page may override a
     tag's "go" (ctx.hints, e.g. "router rip" on a RIP round). */
  var CLI_HINTS = {
    ser: { what: 'a serial-interface command', go: 'select a serial interface ("interface s0/0/0")', wrong: 'this interface is not serial' },
    sub: { what: 'a sub-interface command', go: 'select a sub-interface ("interface g0/0.10")', wrong: 'it goes on a sub-interface ("interface g0/0.10"), not on this interface' },
    eth: { what: 'an Ethernet-interface command', go: 'select an Ethernet interface ("interface g0/0")', wrong: 'this interface is not Ethernet' },
    lo: { what: 'a loopback command', go: 'select a loopback ("interface loopback 0")', wrong: 'this interface is not a loopback' },
    svi: { what: 'an SVI command', go: 'select an SVI ("interface vlan 1")', wrong: 'it goes on an SVI ("interface vlan 1"), not on this interface' },
    l2: { what: 'a Layer 2 switch-port command', go: 'select a switch port ("interface fa0/1")', wrong: 'this interface is Layer 3 (switchport commands belong on a switch port)' },
    swport: { what: 'a switch-port command', go: 'select a switch port ("interface fa0/1")', wrong: 'it goes on a physical switch port (or a range of them), not on this interface' },
    routed: { what: 'a Layer 3 interface command', go: 'select an interface ("interface g0/1")', wrong: 'a switch port is Layer 2 (the address goes on an SVI, "interface vlan 1")' },
    if: { what: 'an interface command', go: 'select an interface ("interface g0/1")' },
    vlan: { what: 'a VLAN command', go: 'enter the VLAN ("vlan 10")' },
    rip: { what: 'a RIP command', go: 'enter the RIP process ("router rip")', wrong: 'this is not the RIP process (RIP commands go under "router rip")' },
    ospf: { what: 'an OSPF command', go: 'enter the OSPF process ("router ospf 1")', wrong: 'this is not an OSPFv2 process (they go under "router ospf 1")' },
    router: { what: 'a routing-process command', go: 'enter the routing process (e.g. "router ospf 1")' },
    rtr: { what: 'an OSPFv3 process command', go: 'enter the process ("ipv6 router ospf 1")', wrong: 'this is not the OSPFv3 process ("ipv6 router ospf 1")' },
    line: { what: 'a line command', go: 'enter the lines ("line vty 0 4")' },
    vty: { what: 'a vty-line command', go: 'enter the vty lines ("line vty 0 4")', wrong: 'it goes on the vty lines ("line vty 0 4"), not the console line' },
    'nacl-std': { what: 'a standard access-list entry', go: 'open the list ("ip access-list standard NAME")', wrong: 'this list is not a standard list' },
    'nacl-ext': { what: 'an extended access-list entry', go: 'open the list ("ip access-list extended NAME")', wrong: 'this list is not an extended list' },
    nacl6: { what: 'an IPv6 access-list entry', go: 'open the list ("ipv6 access-list NAME")', wrong: 'this is not an IPv6 list' }
  };
  var CLI_SWITCH_GO = { if: 'select an interface ("interface fa0/1")' };
  var CLI_IF_TAGS = ['if', 'routed', 'eth', 'ser', 'sub', 'lo', 'svi', 'l2', 'swport', 'po'];
  var CLI_ACL_TAGS = ['nacl-std', 'nacl-ext', 'nacl6'];
  var CLI_RT_TAGS = ['router', 'rip', 'ospf', 'rtr'];
  var CLI_LN_TAGS = ['line', 'vty', 'con'];
  var CLI_HINT_ORDER = ['ser', 'sub', 'eth', 'lo', 'svi', 'l2', 'swport', 'routed', 'if', 'nacl-std', 'nacl-ext', 'nacl6', 'vty', 'line', 'rip', 'ospf', 'router', 'rtr', 'vlan', 'config', 'cfg', 'exec'];
  /* Commands of the OTHER kind of device: refused everywhere here (this
     device's grammar has no mode for them), and worth saying why — typing
     "switchport" on a router port is the classic version of this mistake.
     ctx.device picks the list. */
  var CLI_FOREIGN = {
    router: {
      switchport: 'is a switch command \u2014 a router\u2019s interfaces are Layer 3 and have no switchport settings',
      'channel-group': 'is a switch command (EtherChannel) \u2014 it bundles switch ports, not router interfaces',
      'spanning-tree': 'is a switch command \u2014 routers do not run spanning tree',
      vlan: 'is a switch command \u2014 on a router a VLAN is a sub-interface ("interface g0/0.10" then "encapsulation dot1Q 10")'
    },
    switch: {
      router: 'is a router command \u2014 a Layer 2 switch does not run a routing protocol',
      encapsulation: 'is a router command \u2014 a switch port has no encapsulation to set (a trunk is "switchport mode trunk")',
      clock: 'is a router serial-interface command \u2014 a switch has no serial ports',
      ppp: 'is a router serial-interface command \u2014 a switch has no serial ports',
      network: 'is a routing-process command \u2014 a Layer 2 switch has no routing process'
    }
  };
  function cliForeign(toks, ctx) {
    var list = ctx.device && CLI_FOREIGN[ctx.device], t = toks[0] && toks[0].toLowerCase();
    if (!list || !t || t.length < 2) return '';
    var keys = Object.keys(list).filter(function (k) { return k.indexOf(t) === 0; });
    return keys.length === 1 ? '"' + keys[0] + '" ' + list[keys[0]] : '';
  }
  function cliHint(grammar, toks, levels, ctx, isDo) {
    var w = cliWhere(grammar, toks);
    if (!Object.keys(w.tags).length) return cliForeign(toks, ctx);   /* fits nowhere: the other device's, or just the caret */
    var here = levels[0], has = function (t) { return here.indexOf(t) >= 0; };
    var inCfg = has('cfg'), inIf = has('if'), inAcl = CLI_ACL_TAGS.some(has), inRt = CLI_RT_TAGS.some(has), inLn = CLI_LN_TAGS.some(has);
    var cmd = '"' + (w.name || toks.join(' ')) + '"';    /* "no 10" has no keyword of its own to name */
    if (isDo) return '"do" is only needed in configuration mode \u2014 at # just type ' + cmd;
    var over = ctx.hints || {};
    for (var i = 0; i < CLI_HINT_ORDER.length; i++) {
      var t = CLI_HINT_ORDER[i];
      if (!w.tags[t]) continue;
      if (t === 'exec') {
        if (!inCfg) continue;
        return cmd + ' is an EXEC command \u2014 from configuration mode type: do ' + toks.join(' ');
      }
      if (t === 'cfg') return cmd + ' only works in configuration mode \u2014 you are already at the privileged EXEC prompt (#)';
      if (t === 'config') return cmd + ' is a global configuration command \u2014 type "configure terminal" first';
      var isIf = CLI_IF_TAGS.indexOf(t) >= 0, isAcl = CLI_ACL_TAGS.indexOf(t) >= 0, isRt = CLI_RT_TAGS.indexOf(t) >= 0, isLn = CLI_LN_TAGS.indexOf(t) >= 0;
      if (isIf && !inIf) t = 'if';               /* outside an interface, which kind is detail */
      var h = CLI_HINTS[t], go = (over[t] && over[t].go) || (ctx.device === 'switch' && CLI_SWITCH_GO[t]) || h.go;
      if (!inCfg) return cmd + ' is a configuration command \u2014 first "configure terminal", then ' + go;
      if (h.wrong && ((isIf && inIf) || (isAcl && inAcl) || (isRt && inRt) || (isLn && inLn))) return cmd + ' is ' + h.what + ' \u2014 ' + h.wrong;
      return cmd + ' is ' + h.what + ' \u2014 first ' + go;
    }
    return '';
  }
  /* The result of checking a line:
       null         it fits the current mode (or only stops short of it, so a
                    handler's usage message can answer)
       {up: k}      it fits the k-th fallback level instead — the page moves
                    the device up to that mode, then runs it
       a string     IOS's error: the caret under the first word that fits no
                    pattern of the current mode or its fallbacks, then the
                    learning labs' hint
     The caret lines up with the echo every lab prints, "<prompt> <line>", so
     pass the prompt that was shown. Without ctx every pattern fits (the
     shape-only check). ctx.strict (the trainer) answers a line that only
     stops short with IOS's "% Incomplete command." instead of letting a
     handler's friendlier usage message through. A leading "do" is accepted only in a configuration
     mode, and what follows it is checked as an EXEC command. */
  function cliCheck(grammar, prompt, line, ctx) {
    var raw = String(line == null ? '' : line), toks = raw.trim().split(/\s+/).filter(Boolean);
    if (!toks.length) return null;
    var levels = ctx && ctx.levels ? ctx.levels : [null];
    var isDo = toks.length > 1 && toks[0].toLowerCase() === 'do';
    var hint = function (t, at, d) {
      var h = ctx && ctx.hint ? cliHint(grammar, t, levels, ctx, d) : '';
      return cliCaretAt(prompt, raw, at) + (h ? '\n\u2192 ' + h : '');
    };
    if (isDo) {
      var rest = toks.slice(1);
      if (levels[0] && levels[0].indexOf('cfg') < 0) return hint(rest, 0, true);
      var r = cliTry(grammar, rest, levels[0] ? ['exec'] : null);
      if (r.full || r.short) return null;
      return hint(rest, Math.max(0, r.far) + 1, false);
    }
    var far = -1, shortUp = false;
    for (var k = 0; k < levels.length; k++) {
      var res = cliTry(grammar, toks, levels[k]);
      if (res.full) return k ? { up: k } : null;
      if (res.short) {
        if (k) { shortUp = true; continue; }
        if (ctx && ctx.strict) return '% Incomplete command.';
        /* A line that only stops short here usually wants its handler's usage
           message — unless it is a complete command somewhere else ("ip nat
           inside" at (config)#, where only "ip nat inside source ..." lives):
           then it is in the wrong mode, and says so like any other. */
        var ws = ctx && ctx.levels ? cliWhere(grammar, toks) : null;
        if (!ws || !Object.keys(ws.tags).length) return null;
        /* the same kind of mode (RIP's "network 10.0.0.0" under OSPF, which
           is more likely an OSPF network missing its area) keeps the usage */
        var fam = function (t) {
          return CLI_IF_TAGS.indexOf(t) >= 0 ? 'if' : CLI_ACL_TAGS.indexOf(t) >= 0 ? 'acl'
            : CLI_RT_TAGS.indexOf(t) >= 0 ? 'rt' : CLI_LN_TAGS.indexOf(t) >= 0 ? 'ln' : t;
        };
        var hereFam = levels[0].map(fam);
        if (Object.keys(ws.tags).some(function (t) { return hereFam.indexOf(fam(t)) >= 0; })) return null;
        var hs = ctx.hint ? cliHint(grammar, toks, levels, ctx, false) : '';
        return '% Incomplete command.' + (hs ? '\n\u2192 ' + hs : '');
      }
      if (res.far > far) far = res.far;
    }
    if (shortUp) {
      var hs = ctx && ctx.hint ? cliHint(grammar, toks, levels, ctx, false) : '';
      return '% Incomplete command.' + (hs ? '\n→ ' + hs : '');
    }
    return hint(toks, Math.max(0, far), false);
  }

  /* Can these words begin a command valid in this mode (or one its
     sub-mode falls back to)? What Tab completion is filtered by. */
  function cliCanStart(grammar, line, levels) {
    var toks = String(line).trim().split(/\s+/).filter(Boolean);
    if (!toks.length) return true;
    if (toks[0].toLowerCase() === 'do' && toks.length > 1) {
      if (levels[0].indexOf('cfg') < 0) return false;
      var r = cliTry(grammar, toks.slice(1), ['exec']);
      return r.full || r.short;
    }
    for (var k = 0; k < levels.length; k++) {
      var r2 = cliTry(grammar, toks, levels[k]);
      if (r2.full || r2.short) return true;
    }
    return false;
  }

  /* What a configuration form types for the learner: its commands wrapped
     in "configure terminal" (when the console is at #) and "end", so they are
     valid in whatever mode the console was left in — a form's own leading
     "configure terminal" / trailing "end" are dropped and re-added. A form's
     "interface X" typed from another sub-mode falls back to (config) as on
     IOS, so no form needs to know where the console is. */
  function cliConfigSeq(inExec, cmds) {
    var body = cmds.filter(function (c) { return !/^\s*(conf(igure)?(\s+t(erminal)?)?|end)\s*$/i.test(c); });
    return (inExec ? ['configure terminal'] : []).concat(body, ['end']);
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

  /* ---------- the DCE end of a serial cable ----------
     Packet Tracer marks the DCE end of a serial cable (the end that has to
     supply the clock); every page with a serial link marks it the same way:
     a small "DCE" tag sitting on the cable a short way out from that end.
     Returned as markup so it suits both an SVG built from a string and one
     built node by node (svg.insertAdjacentHTML('beforeend', ...)).
       pts:  the cable as a polyline, STARTING at the DCE end — [[x,y], ...]
       dist: how far along the cable to centre the tag (default 30px; never
             past 40% of the cable, so it stays visibly at its own end)
       off:  optional [dx, dy] nudge off the cable, to clear a page's own
             port labels (put it on the far side of the cable from them)
     pathPoints turns one of cablePaths' path strings back into that polyline
     (its corner curves are a few px, so their end points are near enough). */
  function pathPoints(d) {
    var n = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number), cmds = d.match(/[MLQ]/g) || [], pts = [], k = 0;
    cmds.forEach(function (c) {
      if (c === 'Q') k += 2;
      pts.push([n[k], n[k + 1]]); k += 2;
    });
    return pts;
  }
  function dceTag(pts, dist, off) {
    var segs = [], total = 0;
    for (var i = 1; i < pts.length; i++) {
      var L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segs.push(L); total += L;
    }
    var want = Math.min(dist == null ? 30 : dist, total * 0.4), x = pts[0][0], y = pts[0][1];
    for (var j = 0; j < segs.length; j++) {
      if (want <= segs[j] || j === segs.length - 1) {
        var t = segs[j] ? Math.min(1, want / segs[j]) : 0;
        x = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t;
        y = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t;
        break;
      }
      want -= segs[j];
    }
    if (off) { x += off[0]; y += off[1]; }
    return '<g class="dce-tag" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')">' +
      '<title>DCE end of the serial cable: this interface supplies the clock (clock rate)</title>' +
      '<rect x="-14" y="-7.5" width="28" height="15" rx="4"></rect>' +
      '<text x="0" y="0.5" text-anchor="middle" dominant-baseline="middle">DCE</text></g>';
  }

  /* ---------- the port row ----------
     Router and switch ports sit along the bottom edge of the box, spread
     evenly with a 20px margin, in interface order: Gi0/0 leftmost, then
     Gi0/1, Gi0/2… on every lab. A lab chooses which interface each link
     uses so its port already faces the neighbour (a link to the left takes
     a lower number) — ports are never redrawn out of order to tidy cables.
       portRowPos(w, h, n, i) -> [x, y] of port i of n on a w×h box
     A port shows its number (portNum: 2 for Gi0/2, 1 for S0/0/1, 4 for
     Fa0/4) through a data-num attribute — on hover for a circle, which is
     too small to carry it all the time, and always on a serial square
     (styles.css, .port[data-num]). */
  var PORT_PAD = 20;
  function portRowPos(w, h, n, i) {
    return [n > 1 ? PORT_PAD + i * ((w - 2 * PORT_PAD) / (n - 1)) : w / 2, h];
  }
  function portNum(name) { var m = /(\d+)$/.exec(name || ''); return m ? m[1] : ''; }

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
       canStart(d, line)  can these words begin a command in d's current
                   mode? (LabShared.cliCanStart) — Tab completes only those
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
  /* Where each device's console log is scrolled, kept by device rather than
     by element because pages rebuild their panels. A console redrawn because
     something happened elsewhere stays where its reader left it; one already
     at the bottom keeps following. Only a command run on the device itself —
     typed into its console, or a page's form going through conRan(d) — takes
     it back to the bottom.
     The place is a LOG LINE, not a pixel offset: {line, off, end} is the
     d.log index of the line at the top of the view and how far into it the
     view starts. A console only draws its last cfg.logLines lines, so once
     the log is longer, every new line drops one off the top; a pixel offset
     would then show a line further down each time. log._first is the d.log
     index of the first line drawn. */
  var conView = new WeakMap(), conJump = new WeakSet();
  function conRan(d) { if (d) conJump.add(d); }
  /* a line's top in the log's own scroll coordinates */
  function conLineTop(log, el) { return el.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop; }
  function conViewOf(log) {
    var st = log.scrollTop, kids = log.children, lo = 0, hi = kids.length - 1;
    var v = { line: log._first || 0, off: st, end: log.scrollHeight - st - log.clientHeight <= 4 };
    if (!kids.length) return v;
    /* the first line whose bottom is below the top of the view */
    while (lo < hi) {
      var mid = (lo + hi) >> 1, el = kids[mid];
      if (conLineTop(log, el) + el.offsetHeight <= st) lo = mid + 1; else hi = mid;
    }
    v.line = (log._first || 0) + lo;
    v.off = st - conLineTop(log, kids[lo]);
    return v;
  }
  /* put a log where its device's view says, and remember where that is */
  function conAnchor(log, d) {
    var v = conView.get(d), kids = log.children;
    if (conJump.has(d) || !v || v.end) log.scrollTop = log.scrollHeight;
    else {
      var i = v.line - (log._first || 0);
      log.scrollTop = i < 0 ? 0 : i >= kids.length ? log.scrollHeight : conLineTop(log, kids[i]) + v.off;
    }
    /* a hidden console has no height to scroll in: leave what it was */
    if (log.clientHeight) { conJump.delete(d); conView.set(d, conViewOf(log)); }
  }
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
      if (anyPinned() && host) {
        if (host.classList.contains('floating') !== floating()) place(); else layout();
      }
      /* moving a pin between the page and the body resets its scroll, and a
         new width re-wraps the lines: put every console back on its line, or
         at the bottom if that is where it was */
      [].forEach.call(document.querySelectorAll('.term[data-con="' + cfg.id + '"]'), function (t) {
        var d = devOf(t), log = t.querySelector('.term-log');
        if (d && log) conAnchor(log, d);
      });
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
      var lines = (d.log || []).slice(-(cfg.logLines || 400));
      log._first = (d.log || []).length - lines.length;
      log.innerHTML = lines.map(function (l) {
        return '<div class="tl' + (isErr(l) ? ' terr' : l.charAt(0) === '→' ? ' thint' : '') + '">' + esc(l) + '</div>';
      }).join('');
      conAnchor(log, d);
      log.onscroll = function () { if (log.clientHeight) conView.set(d, conViewOf(log)); };
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
        conRan(d);
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
        inp.value = tabComplete(cfg.keywords(d), inp.value, function (c) { d.log.push(c.join('   ')); conRan(d); refresh(); },
          cfg.canStart ? function (ws) { return cfg.canStart(d, ws.join(' ')); } : null);
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
    pathPoints: pathPoints,
    dceTag: dceTag,
    portRowPos: portRowPos,
    portNum: portNum,
    createConsoles: createConsoles,
    cliGrammar: cliGrammar,
    cliCheck: cliCheck,
    cliConfigSeq: cliConfigSeq,
    cliCanStart: cliCanStart,
    cliPipe: cliPipe,
    cliFilter: cliFilter,
    isValidIP: isValidIP,
    toggleQcardPopout: toggleQcardPopout,
    dockQcardPopout: dockQcardPopout,
    attachCanvasDrag: attachCanvasDrag,
    runPing: runPing,
    runTrace: runTrace,
    traceHops: traceHops,
    pcTool: pcTool,
    pcMacHtml: pcMacHtml,
    conRan: conRan,
    pcToolHtml: pcToolHtml,
    pcToolMode: pcToolMode,
    pcToolRun: pcToolRun,
    pcToolStop: pcToolStop,
    tabComplete: tabComplete,
    renderReqList: renderReqList,
    labRecheck: labRecheck,
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
