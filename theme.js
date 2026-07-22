/* Global light/dark theme toggle — persists across all pages via localStorage. */
(function () {
  var KEY = 'ne-theme';

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function apply(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // Applied immediately (script runs synchronously in <head>) to avoid a flash of the wrong theme.
  apply(localStorage.getItem(KEY));

  var SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function currentIsDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return systemPrefersDark();
  }

  function updateIcon(btn) {
    var dark = currentIsDark();
    btn.innerHTML = dark ? SUN : MOON;
    var label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }

  function init() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    updateIcon(btn);
    btn.addEventListener('click', function () {
      var next = currentIsDark() ? 'light' : 'dark';
      localStorage.setItem(KEY, next);
      apply(next);
      updateIcon(btn);
    });
    var slot = document.getElementById('theme-toggle-slot');
    if (slot) {
      slot.appendChild(btn);
    } else {
      btn.classList.add('tt-fixed');
      document.body.appendChild(btn);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
