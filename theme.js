/* Global theme dropdown — Light / Dark / Sync with Device — persists across
   all pages via localStorage. Absence of a stored value means "Sync with
   Device" (follow the OS setting), which is the default. */
(function () {
  var KEY = 'ne-theme';

  function getStored() {
    var v = localStorage.getItem(KEY);
    return (v === 'light' || v === 'dark') ? v : null;
  }

  function apply(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // Applied immediately (script runs synchronously in <head>) to avoid a flash of the wrong theme.
  apply(getStored());

  var CHEV = '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>';
  var CHECK = '<svg class="theme-dd-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  var OPTIONS = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'Sync with Device' }
  ];

  var wrapEl = null, btnEl = null, menuEl = null;

  function currentValue() {
    return getStored() || 'system';
  }

  function renderMenu() {
    var active = currentValue();
    var html = '<div class="theme-dd-label">Theme</div>';
    OPTIONS.forEach(function (o) {
      var on = o.value === active;
      html += '<button type="button" class="theme-dd-item' + (on ? ' on' : '') + '" data-value="' + o.value + '">' +
        '<span>' + o.label + '</span>' + (on ? CHECK : '') +
        '</button>';
    });
    menuEl.innerHTML = html;
  }

  function openMenu() { wrapEl.classList.add('open'); btnEl.setAttribute('aria-expanded', 'true'); }
  function closeMenu() { wrapEl.classList.remove('open'); btnEl.setAttribute('aria-expanded', 'false'); }
  function toggleMenu() { wrapEl.classList.contains('open') ? closeMenu() : openMenu(); }

  function selectValue(value) {
    if (value === 'system') {
      localStorage.removeItem(KEY);
      apply(null);
    } else {
      localStorage.setItem(KEY, value);
      apply(value);
    }
    renderMenu();
    closeMenu();
  }

  function init() {
    wrapEl = document.createElement('div');
    wrapEl.className = 'theme-dd';

    btnEl = document.createElement('button');
    btnEl.type = 'button';
    btnEl.className = 'theme-dd-btn';
    btnEl.setAttribute('aria-haspopup', 'true');
    btnEl.setAttribute('aria-expanded', 'false');
    btnEl.innerHTML = '<span>Theme</span>' + CHEV;
    // No stopPropagation here: the click-outside listener below already
    // ignores clicks inside wrapEl (which includes this button), so letting
    // the click keep bubbling lets other dropdowns on the page (e.g. a
    // trainer's own "Options" menu) see it and close themselves too.
    btnEl.addEventListener('click', function () {
      toggleMenu();
    });

    menuEl = document.createElement('div');
    menuEl.className = 'theme-dd-menu';
    menuEl.addEventListener('click', function (e) {
      var item = e.target.closest('.theme-dd-item');
      if (item) selectValue(item.getAttribute('data-value'));
    });

    wrapEl.appendChild(btnEl);
    wrapEl.appendChild(menuEl);
    renderMenu();

    var slot = document.getElementById('theme-toggle-slot');
    if (slot) {
      slot.appendChild(wrapEl);
    } else {
      wrapEl.classList.add('tt-fixed');
      document.body.appendChild(wrapEl);
    }

    document.addEventListener('click', function (e) {
      if (wrapEl && !wrapEl.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Bfcache fix: navigating with the browser/mouse back-forward buttons can
  // restore a page from the back-forward cache instead of re-running this
  // script, so a theme change made on another page while this one was cached
  // never gets picked up. `pageshow` fires on every render of the page
  // (including bfcache restores), so re-syncing there catches it — re-running
  // it on a normal load is harmless since it's just re-applying the same value.
  window.addEventListener('pageshow', function () {
    apply(getStored());
    if (menuEl) renderMenu();
  });
})();
