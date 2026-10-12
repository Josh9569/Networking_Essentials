/* qcard-back.js — the "Back to the question" pill, shared by every trainer
   page.

   Every page puts its round in one .qcard near the top: the question on the
   drills, the brief and checklist on the labs, the card on the exam page.
   Below it sit the answer fields, a canvas, a CLI, reference tools, the
   exam's dictionary — so the card is regularly scrolled away while you
   work. Whenever it has gone off the top of the window, a pill floats at
   the foot of the window and takes you back to it.

     · Shown when the card's bottom is above OFF px, however it got there
       (scrolled by hand, a dictionary jump on the exam page, a long lab).
       Not shown while the card is hidden (vlsm_game's custom setup), and
       never for a popped-out card, which is fixed in view by definition.
     · Hidden while it would sit on the round's own buttons (the row
       holding Next), so a tap meant for Next or Reset reaches them.
     · Hidden while you type in a field on screen, so it never covers a CLI
       line or an answer box near the bottom of the window — or, on a
       phone, sits on top of the keyboard.
     · Clicked, it hides at once rather than lingering for the whole scroll
       up, and comes back only once that scroll has landed.
     · Focus goes to Next when the round is graded, so Enter carries on as
       answer-keys.js expects. A mouse press never takes focus, so an
       answer box keeps its caret; reached by keyboard, the pill gives focus
       up, since a focused hidden button would swallow the next Enter.
     · Labelled for what the card holds: "instructions" on a lab topic
       (the card shows the instructions pop-out button), "question"
       everywhere else.

   Pages need no code for it: loading this file is the whole wiring. It
   builds the button itself, as a child of <body> — inside a blurred or
   transformed ancestor a fixed box would be placed against that ancestor
   rather than the window. Layout changes (a new round, a topic switch, a
   pop-out docking) are picked up by observers rather than by calls from
   each page. window.QcardBack.sync() re-checks on demand. */
(function () {
  'use strict';

  var OFF = 60;
  var btn = null, card = null, raf = 0, returning = 0;

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  /* A text entry has focus and is on screen. Buttons, checkboxes and the
     like are not typing. A focused field scrolled out of view doesn't count:
     a new round puts the caret in its first answer box without scrolling
     (answer-keys.js), and that box sits in or under the card being asked
     for. */
  function typing() {
    var el = document.activeElement;
    if (!el || el === btn) return false;
    var t = el.tagName, text;
    if (t === 'INPUT') text = !/^(button|submit|reset|checkbox|radio|range|color|file|image|hidden)$/i.test(el.type || '');
    else text = t === 'TEXTAREA' || t === 'SELECT' || !!el.isContentEditable;
    if (!text) return false;
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight && (r.width > 0 || r.height > 0);
  }
  /* Read the button's own inline display, which is how each page turns the
     pop-out on and off per topic — not whether it is rendered, because
     styles.css hides it at every width below 1600px. */
  function label() {
    var pop = card.querySelector('.qcard-pop-btn');
    return pop && pop.style.display !== 'none' ? 'instructions' : 'question';
  }

  /* The round's own buttons (the row holding #nxtbtn) are under the pill.
     On a phone the keyboard flow often leaves Submit / Next / Reset in the
     bottom band of the window; the pill must not take the tap meant for
     them. The pill's box is measured where it rests, plus the 10px it
     slides up by when it appears. */
  function coversRound() {
    var next = document.getElementById('nxtbtn');
    var row = next && next.parentElement;
    if (!row) return false;
    var p = btn.getBoundingClientRect();
    if (!p.width) return false;
    var bs = row.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {
      if (!bs[i].getClientRects().length) continue;
      var r = bs[i].getBoundingClientRect();
      if (r.right > p.left && r.left < p.right && r.bottom > p.top - 10 && r.top < p.bottom) return true;
    }
    return false;
  }

  function sync() {
    raf = 0;
    if (!btn || !card) return;
    var r = card.getBoundingClientRect();
    var on = !returning && !typing() && (r.width > 0 || r.height > 0) && r.bottom < OFF && !coversRound();
    if (on) {
      var text = '↑ Back to the ' + label();
      if (btn.textContent !== text) btn.textContent = text;
    }
    btn.classList.toggle('on', on);
  }
  function queue() { if (!raf) raf = requestAnimationFrame(sync); }

  /* The scroll back has landed: the card is on screen and the page has been
     still for four frames, capped at 1.5s in case the reader takes over. */
  function afterLanding(fn) {
    var tok = returning, t0 = performance.now(), y = NaN, still = 0;
    (function tick() {
      if (tok !== returning) return;
      var r = card.getBoundingClientRect(), ny = window.pageYOffset;
      still = ny === y ? still + 1 : 0; y = ny;
      if ((still >= 4 && r.top < window.innerHeight && r.bottom > 0) || performance.now() - t0 > 1500) fn();
      else requestAnimationFrame(tick);
    })();
  }

  function back() {
    if (!card) return;
    card.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    returning++;
    sync();
    afterLanding(function () { returning = 0; sync(); });
    var next = document.getElementById('nxtbtn');
    if (next && next.style.display !== 'none' && next.getClientRects().length) {
      try { next.focus({ preventScroll: true }); } catch (e) { next.focus(); }
    } else if (document.activeElement === btn) {
      btn.blur();
    }
  }

  function init() {
    card = document.querySelector('.qcard');
    if (!card || btn) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'qcard-back';
    btn.className = 'btn btn-p qback';
    btn.textContent = '↑ Back to the question';
    btn.addEventListener('click', back);
    /* Never take focus on a press: an answer box keeps its caret, so an
       unanswered round can be typed into as soon as the scroll lands. */
    btn.addEventListener('mousedown', function (e) { e.preventDefault(); });
    /* Kept display:none until styles.css proves it knows .qback. A stale
       cached stylesheet would otherwise leave a bare button at the foot of
       the page. */
    btn.style.display = 'none';
    document.body.appendChild(btn);
    function reveal() {
      if (getComputedStyle(btn).position !== 'fixed') return false;
      btn.style.display = '';
      queue();
      return true;
    }
    if (!reveal()) window.addEventListener('load', reveal);

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    document.addEventListener('focusin', queue);
    document.addEventListener('focusout', queue);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(queue);
      ro.observe(card);
      ro.observe(document.body);
    }
    if (window.MutationObserver) {
      new MutationObserver(queue).observe(card, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.QcardBack = { sync: queue, back: back };
})();
