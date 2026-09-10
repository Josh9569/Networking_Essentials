/* answer-keys.js — keyboard flow for the answer/submit/next cycle, shared by
   every trainer page.

   Every page in this repo has the same three-button rhythm: answer, submit,
   move on. Doing that with the mouse breaks the flow of a drill, so Enter
   does both jobs:

     · Enter in an answer box submits the round. With several boxes it fills
       the blanks first — jumping to the next empty one — and only submits
       once they all have something in them, so a half-finished answer is
       never graded by accident.
     · Enter once the round is graded moves to the next question, and the
       caret lands back in the first answer box ready for it.

   The second half needs no page-specific code at all. "The round is graded"
   is simply "the Next button is visible", which is true on all ten pages,
   and when that button appears the module puts focus on it. That means
   Enter is then handled natively by the button rather than by this
   listener, so the two can never both fire and advance twice.

   What it must not hijack: the labs bind Enter on their CLI terminals and
   their ping/SSH boxes. Anything focused in a field, a button, or a
   contenteditable is therefore left entirely alone — the browser's own
   behaviour is already correct there.

   Pages with no typed answers (osi_game, switching_lab, dynamic_routing)
   just omit `answers` and get the Enter-to-continue half. */
(function () {
  'use strict';

  function isTyping(el) {
    if (!el) return false;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || t === 'BUTTON' || el.isContentEditable;
  }
  function call(fn) {
    if (typeof fn === 'function') { fn(); return true; }
    if (typeof fn === 'string' && typeof window[fn] === 'function') { window[fn](); return true; }
    return false;
  }

  function wire(opts) {
    opts = opts || {};
    var answerSel = opts.answers || null;
    var nextId = opts.nextBtn || 'nxtbtn';
    var submitFn = opts.submit || null;
    var nextFn = opts.next || 'nextQ';

    function nextBtn() { return document.getElementById(nextId); }
    /* One definition of "this round has been answered", valid everywhere:
       the Next button is on screen. No page needs to expose a flag. */
    function graded() {
      var b = nextBtn();
      return !!b && b.style.display !== 'none';
    }
    function boxes() {
      if (!answerSel) return [];
      var all = document.querySelectorAll(answerSel);
      var out = [];
      for (var i = 0; i < all.length; i++) {
        if (!all[i].disabled && all[i].offsetParent !== null) out.push(all[i]);
      }
      return out;
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      var el = document.activeElement;

      if (!graded() && answerSel && el && el.matches && el.matches(answerSel)) {
        e.preventDefault();
        var list = boxes(), empty = null;
        for (var i = 0; i < list.length; i++) {
          if (!list[i].value.trim()) { empty = list[i]; break; }
        }
        /* Still blanks to fill: move to the first one rather than grading a
           partial answer. If the empty box is the one already focused, stay
           put — that is its own feedback. */
        if (empty) { if (empty !== el) empty.focus(); return; }
        call(submitFn);
        return;
      }

      if (graded() && !isTyping(el)) {
        e.preventDefault();
        call(nextFn);
      }
    });

    function focusQuietly(el) {
      if (!el) return;
      try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }
    }

    /* The Next button appearing and disappearing is the whole round cycle, so
       one observer drives both halves of the keyboard flow.

       It APPEARS: the round has been graded. Focus it, because clicking Submit
       leaves focus on a button that is then hidden, and a focused hidden
       button swallows the next Enter — so without this the second Enter did
       nothing. Focusing Next also means Enter there is handled natively by the
       button, which is why the keydown listener above ignores BUTTON: the two
       can never both fire and skip two rounds.

       It DISAPPEARS: a new round has rendered. Put the caret in the first
       answer box. The rhythm is answer, submit, next, answer — and without
       this the third step strands focus on a button that has just been hidden,
       so continuing means reaching for the mouse. Only pages that actually
       have typed answers do this; the labs pass no `answers` selector and are
       left alone, as is any round within a page that happens to have no boxes
       (a lab topic, a click-only round). Nothing is focused on first load
       either — the button has to have been visible first — so arriving on a
       page never yanks the view or opens a phone keyboard.

       Both branches run from the observer rather than from the click, which
       means they fire after the page's own loadQ()/render() has finished; the
       new round's boxes exist by then whatever order a page renders its body
       and re-labels its buttons in. */
    var btn = nextBtn();
    if (btn && window.MutationObserver) {
      var wasVisible = btn.style.display !== 'none';
      new MutationObserver(function () {
        var vis = btn.style.display !== 'none';
        if (vis && !wasVisible) focusQuietly(btn);
        else if (!vis && wasVisible) focusQuietly(boxes()[0]);
        wasVisible = vis;
      }).observe(btn, { attributes: true, attributeFilter: ['style'] });
    }
  }

  window.AnswerKeys = { wire: wire };
})();
