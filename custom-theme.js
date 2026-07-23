/* Custom Theme — a 4th option alongside Light/Dark/Sync with Device (see theme.js).
   Lets the user pick a background (solid/gradient/soft diffused blobs), a
   transparency level for cards/menus, and a suggested palette (surface/text/
   accent) derived from their base color, each individually overridable.
   Persists to localStorage['ne-custom-theme']. Applied via CSS custom
   properties set directly on <html>.style, which beats the stylesheet's
   :root[data-theme] rules on specificity — no injected <style> tag needed. */
(function () {
  var KEY = 'ne-custom-theme';
  var THEME_KEY = 'ne-theme';
  var DEFAULT_BASE = '#3a6ea5';
  var CUSTOM_PROPS = ['--bg', '--custom-bg-image', '--surface', '--surface-s', '--text', '--text-s',
    '--text-t', '--border', '--border-m', '--info-text', '--info-bg', '--info-bdr', '--custom-blur', '--ct-picker-solid'];

  /* ---------- color math ---------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function hexToRgb(hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      v = clamp(Math.round(v), 0, 255);
      var s = v.toString(16);
      return s.length === 1 ? '0' + s : s;
    }).join('');
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }
  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360; h /= 360; s /= 100; l /= 100;
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      var hue2rgb = function (p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
  }
  function hslToHex(h, s, l) {
    var rgb = hslToRgb(h, s, l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }
  function withAlpha(hex, alpha) {
    var rgb = hexToRgb(hex);
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
  }
  // HSV (not HSL) is what the saturation/value picker square below renders —
  // it's the model where "drag right = more saturated, drag up = brighter"
  // maps directly onto a simple two-layer CSS gradient.
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var h, s = max === 0 ? 0 : d / max, v = max;
    if (d === 0) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, v: v * 100 };
  }
  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360; s /= 100; v /= 100;
    var c = v * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = v - c;
    var r1, g1, b1;
    if (h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
  }
  function hexToHsv(hex) {
    var rgb = hexToRgb(hex);
    return rgbToHsv(rgb.r, rgb.g, rgb.b);
  }
  function hsvToHex(h, s, v) {
    var rgb = hsvToRgb(h, s, v);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }
  // WCAG-style relative luminance (0 = black, 1 = white). Threshold 0.179 is
  // the standard cutover point for picking readable black-vs-white text —
  // more reliable than raw HSL lightness since it weighs green highest and
  // blue lowest, matching how the eye actually perceives brightness.
  function relativeLuminance(hex) {
    var rgb = hexToRgb(hex);
    function chan(c) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
  }

  /* ---------- palette suggestion ---------- */
  function suggestPalette(baseHex) {
    var rgb = hexToRgb(baseHex);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    var h = hsl.h, isDark = relativeLuminance(baseHex) < 0.179;

    // textS/textT are muted tiers of `text` (used for descriptions, hints,
    // placeholders). They used to target a fixed absolute lightness, which
    // could land close to the *background's* own lightness for saturated
    // dark-perceived colors (e.g. pure blue is only 7% luminance but 50%
    // HSL lightness) and go nearly invisible. Deriving them as small deltas
    // off `text`'s own lightness instead keeps them "ever so darker than
    // white" (or lighter than black) — always close to readable, never
    // close to the background.
    var textL = isDark ? 94 : 12;
    var text = hslToHex(h, isDark ? 15 : 25, textL);
    var textS = hslToHex(h, isDark ? 10 : 12, isDark ? textL - 12 : textL + 12);
    var textT = hslToHex(h, isDark ? 8 : 10, isDark ? textL - 22 : textL + 22);

    var surfL = clamp(hsl.l + (isDark ? 9 : -6), 6, 96);
    var surface = hslToHex(h, clamp(hsl.s * 0.28, 4, 18), surfL);

    var border = isDark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.09)';
    var borderM = isDark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.16)';

    // Analogous, not complementary: a neighboring hue (~30° away) reads as
    // "part of the same palette" instead of clashing across the color wheel.
    var accentH = (h - 30 + 360) % 360;
    var accentText = hslToHex(accentH, 62, isDark ? 72 : 40);
    var accentBg = hslToHex(accentH, isDark ? 38 : 62, isDark ? 16 : 93);
    var accentBdr = hslToHex(accentH, 48, isDark ? 34 : 76);

    return {
      text: text, textS: textS, textT: textT, surface: surface, border: border, borderM: borderM,
      accentBg: accentBg, accentText: accentText, accentBdr: accentBdr, isDark: isDark
    };
  }

  /* ---------- background image builder ---------- */
  function defaultBlobSeed() {
    return [
      { x: 15, y: 20, r: 55 }, { x: 85, y: 15, r: 50 }, { x: 75, y: 80, r: 60 },
      { x: 20, y: 85, r: 50 }, { x: 50, y: 50, r: 65 }
    ];
  }
  function randomBlobSeed() {
    var out = [];
    for (var i = 0; i < 5; i++) {
      out.push({ x: Math.round(10 + Math.random() * 80), y: Math.round(10 + Math.random() * 80), r: Math.round(40 + Math.random() * 30) });
    }
    return out;
  }
  function buildBgImage(cfg, accentHex) {
    if (cfg.bgType === 'gradient') {
      return 'linear-gradient(' + (cfg.angle || 135) + 'deg, ' + cfg.base + ', ' + accentHex + ')';
    }
    if (cfg.bgType === 'diffused') {
      var seed = (cfg.blobSeed && cfg.blobSeed.length) ? cfg.blobSeed : defaultBlobSeed();
      return seed.map(function (b, i) {
        var color = i % 2 === 0 ? cfg.base : accentHex;
        return 'radial-gradient(circle at ' + b.x + '% ' + b.y + '%, ' + withAlpha(color, 0.55) + ' 0%, transparent ' + b.r + '%)';
      }).join(', ');
    }
    return 'none';
  }

  /* ---------- config persistence ---------- */
  function defaultConfig() {
    return { bgType: 'solid', base: DEFAULT_BASE, angle: 135, transparency: 1, blobSeed: defaultBlobSeed(), overrides: {} };
  }
  function getConfig() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var cfg = JSON.parse(raw);
      if (!cfg || typeof cfg !== 'object') return null;
      if (!cfg.overrides) cfg.overrides = {};
      if (!cfg.blobSeed || !cfg.blobSeed.length) cfg.blobSeed = defaultBlobSeed();
      if (!cfg.base) cfg.base = DEFAULT_BASE;
      if (!cfg.bgType) cfg.bgType = 'solid';
      if (typeof cfg.transparency !== 'number') cfg.transparency = 1;
      if (typeof cfg.angle !== 'number') cfg.angle = 135;
      return cfg;
    } catch (e) { return null; }
  }
  function saveConfig(cfg) {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* storage unavailable */ }
  }

  /* ---------- apply ---------- */
  function applyCustomTheme(cfg) {
    var palette = suggestPalette(cfg.base);
    var surfaceHex = cfg.overrides.surface || palette.surface;
    var textHex = cfg.overrides.text || palette.text;
    var accentHex = cfg.overrides.accent || palette.accentText;
    var alpha = clamp(cfg.transparency, 0.3, 1);

    var root = document.documentElement.style;
    root.setProperty('--bg', cfg.base);
    root.setProperty('--custom-bg-image', buildBgImage(cfg, accentHex));
    root.setProperty('--surface', withAlpha(surfaceHex, alpha));
    root.setProperty('--surface-s', withAlpha(surfaceHex, clamp(alpha - 0.06, 0.2, 1)));
    root.setProperty('--text', textHex);
    root.setProperty('--text-s', palette.textS);
    root.setProperty('--text-t', palette.textT);
    root.setProperty('--border', palette.border);
    root.setProperty('--border-m', palette.borderM);
    root.setProperty('--info-text', accentHex);
    root.setProperty('--info-bg', withAlpha(accentHex, palette.isDark ? 0.22 : 0.14));
    root.setProperty('--info-bdr', withAlpha(accentHex, 0.55));
    root.setProperty('--custom-blur', alpha < 1 ? 'blur(' + Math.round((1 - alpha) * 18) + 'px)' : 'none');
    // The color picker popover always needs a fully opaque backdrop to stay
    // legible, regardless of the transparency slider — surfaceHex here is
    // the pre-alpha value, unlike --surface above.
    root.setProperty('--ct-picker-solid', surfaceHex);
  }
  function clearCustomVars() {
    var root = document.documentElement.style;
    CUSTOM_PROPS.forEach(function (p) { root.removeProperty(p); });
  }
  window.__neClearCustomVars = clearCustomVars;

  /* Applied immediately (synchronous, mirrors theme.js) to avoid a flash of
     the wrong theme when Custom is the active theme on load. */
  function activeTheme() { return localStorage.getItem(THEME_KEY) || 'system'; }
  var liveConfig = null;
  if (activeTheme() === 'custom') {
    liveConfig = getConfig() || defaultConfig();
    applyCustomTheme(liveConfig);
  }

  /* ---------- drawer UI ---------- */
  var els = {};

  function ensureConfig() {
    if (!liveConfig) liveConfig = getConfig() || defaultConfig();
    return liveConfig;
  }

  function commit(cfg) {
    liveConfig = cfg;
    applyCustomTheme(cfg);
    saveConfig(cfg);
  }

  function buildDrawer() {
    var backdrop = document.createElement('div');
    backdrop.className = 'ct-backdrop';
    backdrop.id = 'ct-backdrop';

    var drawer = document.createElement('div');
    drawer.className = 'ct-drawer';
    drawer.id = 'ct-drawer';
    drawer.innerHTML =
      '<div class="ct-drawer-hdr">' +
        '<div class="ct-drawer-title">Custom Theme</div>' +
        '<button type="button" class="ct-drawer-close" id="ct-close" aria-label="Close">' +
          '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="ct-drawer-body">' +
        '<div class="ct-section">' +
          '<div class="ct-label">Background</div>' +
          '<div class="ct-bgtype-row">' +
            '<button type="button" class="ct-bgtype-btn" data-bgtype="solid">Solid</button>' +
            '<button type="button" class="ct-bgtype-btn" data-bgtype="gradient">Gradient</button>' +
            '<button type="button" class="ct-bgtype-btn" data-bgtype="diffused">Diffused</button>' +
          '</div>' +
        '</div>' +
        '<div class="ct-section">' +
          '<div class="ct-label">Base Color</div>' +
          '<div class="ct-color-row">' +
            '<button type="button" class="ct-swatch-btn" id="ct-base" aria-label="Base color"></button>' +
            '<span class="ct-hex-label" id="ct-base-hex"></span>' +
          '</div>' +
        '</div>' +
        '<div class="ct-section" id="ct-angle-section">' +
          '<div class="ct-label">Gradient Angle <span id="ct-angle-val"></span></div>' +
          '<input type="range" id="ct-angle" class="ct-slider" min="0" max="360" step="5">' +
        '</div>' +
        '<div class="ct-section" id="ct-shuffle-section">' +
          '<div class="ct-shapes-actions">' +
            '<button type="button" class="btn btn-s" id="ct-shuffle">Shuffle Shapes</button>' +
            '<button type="button" class="btn btn-s" id="ct-customize">Customize Shapes</button>' +
          '</div>' +
          '<div class="ct-shapes-editor" id="ct-shapes-editor">' +
            '<div class="ct-shapes-canvas" id="ct-shapes-canvas"></div>' +
            '<div class="ct-shapes-hint">Click empty space to place a shape · drag a shape to move it · click a shape to select it</div>' +
            '<div class="ct-shapes-toolbar" id="ct-shapes-toolbar">' +
              '<span class="ct-shapes-toolbar-lbl">Size</span>' +
              '<input type="range" id="ct-shape-size" class="ct-slider" min="25" max="80" step="1">' +
              '<button type="button" class="ct-mini-btn ct-mini-btn-danger" id="ct-shape-remove">Remove</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ct-section">' +
          '<div class="ct-label">Menu &amp; Card Transparency <span id="ct-trans-val"></span></div>' +
          '<input type="range" id="ct-trans" class="ct-slider" min="30" max="100" step="1">' +
        '</div>' +
        '<div class="ct-section">' +
          '<div class="ct-label-row">' +
            '<div class="ct-label">Suggested Palette</div>' +
            '<button type="button" class="ct-mini-btn" id="ct-regen">Regenerate</button>' +
          '</div>' +
          swatchRow('surface', 'Surface') +
          swatchRow('text', 'Text') +
          swatchRow('accent', 'Accent') +
        '</div>' +
        '<button type="button" class="btn btn-d ct-reset-btn" id="ct-reset">Reset Custom Theme</button>' +
      '</div>' +
      '<div class="ct-picker-pop" id="ct-picker-pop">' +
        '<div class="ct-picker-sv" id="ct-picker-sv">' +
          '<div class="ct-picker-sv-cursor" id="ct-picker-cursor"></div>' +
        '</div>' +
        '<div class="ct-picker-hue" id="ct-picker-hue">' +
          '<div class="ct-picker-hue-handle" id="ct-picker-hue-handle"></div>' +
        '</div>' +
        '<div class="ct-picker-hex-row">' +
          '<span class="ct-picker-hash">#</span>' +
          '<input type="text" class="ct-picker-hex" id="ct-picker-hex" maxlength="6" spellcheck="false" autocomplete="off">' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    els.backdrop = backdrop;
    els.drawer = drawer;
    els.close = drawer.querySelector('#ct-close');
    els.bgtypeBtns = drawer.querySelectorAll('.ct-bgtype-btn');
    els.base = drawer.querySelector('#ct-base');
    els.baseHex = drawer.querySelector('#ct-base-hex');
    els.angleSection = drawer.querySelector('#ct-angle-section');
    els.angle = drawer.querySelector('#ct-angle');
    els.angleVal = drawer.querySelector('#ct-angle-val');
    els.shuffleSection = drawer.querySelector('#ct-shuffle-section');
    els.shuffle = drawer.querySelector('#ct-shuffle');
    els.customize = drawer.querySelector('#ct-customize');
    els.shapesEditor = drawer.querySelector('#ct-shapes-editor');
    els.shapesCanvas = drawer.querySelector('#ct-shapes-canvas');
    els.shapesToolbar = drawer.querySelector('#ct-shapes-toolbar');
    els.shapeSize = drawer.querySelector('#ct-shape-size');
    els.shapeRemove = drawer.querySelector('#ct-shape-remove');
    els.trans = drawer.querySelector('#ct-trans');
    els.transVal = drawer.querySelector('#ct-trans-val');
    els.regen = drawer.querySelector('#ct-regen');
    els.reset = drawer.querySelector('#ct-reset');
    els.swatches = {
      surface: drawer.querySelector('.ct-swatch-row[data-key="surface"]'),
      text: drawer.querySelector('.ct-swatch-row[data-key="text"]'),
      accent: drawer.querySelector('.ct-swatch-row[data-key="accent"]')
    };
    els.pickerPop = drawer.querySelector('#ct-picker-pop');
    els.pickerSv = drawer.querySelector('#ct-picker-sv');
    els.pickerCursor = drawer.querySelector('#ct-picker-cursor');
    els.pickerHue = drawer.querySelector('#ct-picker-hue');
    els.pickerHueHandle = drawer.querySelector('#ct-picker-hue-handle');
    els.pickerHex = drawer.querySelector('#ct-picker-hex');

    wireDrawer();
    wirePicker();
    wireShapesEditor();
  }

  function swatchRow(key, label) {
    return '<div class="ct-swatch-row" data-key="' + key + '">' +
      '<button type="button" class="ct-swatch-btn" aria-label="' + label + ' color"></button>' +
      '<span class="ct-swatch-label">' + label + '</span>' +
      '<span class="ct-hex-label"></span>' +
      '<span class="ct-auto-badge">auto</span>' +
      '</div>';
  }

  function refreshUI() {
    var cfg = ensureConfig();
    var palette = suggestPalette(cfg.base);

    els.bgtypeBtns.forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-bgtype') === cfg.bgType);
    });
    els.angleSection.style.display = cfg.bgType === 'gradient' ? '' : 'none';
    els.shuffleSection.style.display = cfg.bgType === 'diffused' ? '' : 'none';
    if (cfg.bgType !== 'diffused') closeShapesEditor();

    els.base.style.backgroundColor = cfg.base;
    els.baseHex.textContent = cfg.base.toUpperCase();
    els.angle.value = cfg.angle;
    els.angleVal.textContent = cfg.angle + '°';
    els.trans.value = Math.round(cfg.transparency * 100);
    els.transVal.textContent = Math.round(cfg.transparency * 100) + '%';

    var suggested = { surface: palette.surface, text: palette.text, accent: palette.accentText };
    ['surface', 'text', 'accent'].forEach(function (key) {
      var row = els.swatches[key];
      var hex = cfg.overrides[key] || suggested[key];
      var isAuto = !cfg.overrides[key];
      row.querySelector('.ct-swatch-btn').style.backgroundColor = hex;
      row.querySelector('.ct-hex-label').textContent = hex.toUpperCase();
      row.classList.toggle('auto', isAuto);
    });
  }

  function wireDrawer() {
    els.close.addEventListener('click', closeDrawer);
    els.backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && els.drawer.classList.contains('open')) closeDrawer();
    });

    els.bgtypeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cfg = ensureConfig();
        cfg.bgType = btn.getAttribute('data-bgtype');
        commit(cfg);
        refreshUI();
      });
    });

    els.base.addEventListener('click', function () {
      openPicker(els.base, ensureConfig().base, function (hex) {
        var cfg = ensureConfig();
        cfg.base = hex;
        commit(cfg);
        refreshUI();
      });
    });

    els.angle.addEventListener('input', function () {
      var cfg = ensureConfig();
      cfg.angle = parseInt(els.angle.value, 10);
      commit(cfg);
      els.angleVal.textContent = cfg.angle + '°';
    });

    els.shuffle.addEventListener('click', function () {
      var cfg = ensureConfig();
      cfg.blobSeed = randomBlobSeed();
      selectedShapeIndex = -1;
      commit(cfg);
      if (shapesEditorOpen) renderShapesCanvas();
    });

    els.customize.addEventListener('click', function () {
      if (shapesEditorOpen) closeShapesEditor();
      else openShapesEditor();
    });

    els.trans.addEventListener('input', function () {
      var cfg = ensureConfig();
      cfg.transparency = clamp(parseInt(els.trans.value, 10) / 100, 0.3, 1);
      commit(cfg);
      els.transVal.textContent = Math.round(cfg.transparency * 100) + '%';
    });

    ['surface', 'text', 'accent'].forEach(function (key) {
      var row = els.swatches[key];
      var btn = row.querySelector('.ct-swatch-btn');
      btn.addEventListener('click', function () {
        var cfg = ensureConfig();
        var palette = suggestPalette(cfg.base);
        var suggested = { surface: palette.surface, text: palette.text, accent: palette.accentText };
        var current = cfg.overrides[key] || suggested[key];
        openPicker(btn, current, function (hex) {
          var cfg2 = ensureConfig();
          cfg2.overrides[key] = hex;
          row.classList.remove('auto');
          commit(cfg2);
          btn.style.backgroundColor = hex;
          row.querySelector('.ct-hex-label').textContent = hex.toUpperCase();
        });
      });
    });

    els.regen.addEventListener('click', function () {
      var cfg = ensureConfig();
      cfg.overrides = {};
      commit(cfg);
      refreshUI();
    });

    els.reset.addEventListener('click', function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      liveConfig = null;
      if (window.__neSelectTheme) window.__neSelectTheme('system');
      closeDrawer();
    });
  }

  function openDrawer() {
    if (!els.drawer) buildDrawer();
    ensureConfig();
    // Every fresh open starts on the plain Shuffle/Customize buttons, not
    // mid-edit — shapes stay wherever they were left, only the *editor
    // panel* itself defaults to collapsed.
    shapesEditorOpen = false;
    selectedShapeIndex = -1;
    refreshUI();
    els.drawer.classList.add('open');
    els.backdrop.classList.add('open');
  }
  function closeDrawer() {
    if (!els.drawer) return;
    els.drawer.classList.remove('open');
    els.backdrop.classList.remove('open');
    closePicker();
  }

  /* ---------- diffused-shape editor ----------
     A small live mini-preview of the diffused background where each blob is
     a draggable dot: click empty space to place a new shape, drag a dot to
     reposition it, click one to select it (Size slider + Remove appear).
     Every change calls commit() immediately, same as the rest of the
     drawer, so the real page updates live as shapes are placed/moved. */
  var shapesEditorOpen = false;
  var selectedShapeIndex = -1;

  function openShapesEditor() {
    shapesEditorOpen = true;
    els.customize.classList.add('on');
    els.shapesEditor.classList.add('open');
    renderShapesCanvas();
  }
  function closeShapesEditor() {
    shapesEditorOpen = false;
    selectedShapeIndex = -1;
    if (els.customize) els.customize.classList.remove('on');
    if (els.shapesEditor) els.shapesEditor.classList.remove('open');
  }

  function renderShapesCanvas() {
    var cfg = ensureConfig();
    var palette = suggestPalette(cfg.base);
    var accentHex = cfg.overrides.accent || palette.accentText;
    if (!cfg.blobSeed) cfg.blobSeed = defaultBlobSeed();

    els.shapesCanvas.style.backgroundColor = cfg.base;
    els.shapesCanvas.style.backgroundImage = buildBgImage({ bgType: 'diffused', blobSeed: cfg.blobSeed }, accentHex);
    els.shapesCanvas.innerHTML = cfg.blobSeed.map(function (b, i) {
      var color = i % 2 === 0 ? cfg.base : accentHex;
      var size = clamp(b.r * 1.05, 22, 100);
      var sel = i === selectedShapeIndex ? ' selected' : '';
      return '<div class="ct-shape-dot' + sel + '" data-i="' + i + '" style="left:' + b.x + '%;top:' + b.y + '%;width:' + size + 'px;height:' + size + 'px;background:' + color + ';"></div>';
    }).join('');

    var hasSel = selectedShapeIndex !== -1 && cfg.blobSeed[selectedShapeIndex];
    els.shapesToolbar.style.display = hasSel ? 'flex' : 'none';
    if (hasSel) els.shapeSize.value = cfg.blobSeed[selectedShapeIndex].r;
  }

  function shapesCanvasPoint(e, rect) {
    return {
      x: clamp((e.clientX - rect.left) / rect.width * 100, 0, 100),
      y: clamp((e.clientY - rect.top) / rect.height * 100, 0, 100)
    };
  }

  function wireShapesEditor() {
    els.shapesCanvas.addEventListener('pointerdown', function (e) {
      var cfg = ensureConfig();
      if (!cfg.blobSeed) cfg.blobSeed = defaultBlobSeed();
      var rect = els.shapesCanvas.getBoundingClientRect();
      var dotEl = e.target.closest('.ct-shape-dot');

      if (dotEl) {
        var idx = parseInt(dotEl.getAttribute('data-i'), 10);
        selectedShapeIndex = idx;
        renderShapesCanvas();
        els.shapesCanvas.setPointerCapture(e.pointerId);
        var move = function (ev) {
          var pt = shapesCanvasPoint(ev, rect);
          cfg.blobSeed[idx].x = Math.round(pt.x);
          cfg.blobSeed[idx].y = Math.round(pt.y);
          commit(cfg);
          renderShapesCanvas();
        };
        var up = function () {
          els.shapesCanvas.removeEventListener('pointermove', move);
          els.shapesCanvas.removeEventListener('pointerup', up);
        };
        els.shapesCanvas.addEventListener('pointermove', move);
        els.shapesCanvas.addEventListener('pointerup', up);
      } else {
        if (cfg.blobSeed.length >= 10) return;
        var pt2 = shapesCanvasPoint(e, rect);
        cfg.blobSeed.push({ x: Math.round(pt2.x), y: Math.round(pt2.y), r: 45 });
        selectedShapeIndex = cfg.blobSeed.length - 1;
        commit(cfg);
        renderShapesCanvas();
      }
    });

    els.shapeSize.addEventListener('input', function () {
      if (selectedShapeIndex === -1) return;
      var cfg = ensureConfig();
      if (!cfg.blobSeed[selectedShapeIndex]) return;
      cfg.blobSeed[selectedShapeIndex].r = parseInt(els.shapeSize.value, 10);
      commit(cfg);
      renderShapesCanvas();
    });

    els.shapeRemove.addEventListener('click', function () {
      if (selectedShapeIndex === -1) return;
      var cfg = ensureConfig();
      cfg.blobSeed.splice(selectedShapeIndex, 1);
      selectedShapeIndex = -1;
      commit(cfg);
      renderShapesCanvas();
    });
  }

  /* ---------- color picker popover ----------
     A single shared SV-square + hue-slider + hex-input popover, reused for
     all 4 swatches (Base/Surface/Text/Accent) instead of the browser's own
     native <input type="color"> dialog. Opens anchored under whichever
     swatch button was clicked; `picker.onChange` is rebound per-open. */
  var picker = { open: false, hsv: { h: 0, s: 0, v: 0 }, onChange: null };

  function setPickerHsv(hsv, fromHexInput) {
    picker.hsv = hsv;
    els.pickerSv.style.setProperty('--ct-hue', hsv.h);
    els.pickerCursor.style.left = hsv.s + '%';
    els.pickerCursor.style.top = (100 - hsv.v) + '%';
    els.pickerHueHandle.style.left = (hsv.h / 360 * 100) + '%';
    if (!fromHexInput) {
      els.pickerHex.value = hsvToHex(hsv.h, hsv.s, hsv.v).replace('#', '').toUpperCase();
    }
  }
  function pickerEmit() {
    if (picker.onChange) picker.onChange(hsvToHex(picker.hsv.h, picker.hsv.s, picker.hsv.v));
  }

  function openPicker(anchorEl, hex, onChange) {
    picker.onChange = onChange;
    setPickerHsv(hexToHsv(hex), false);
    var drawerRect = els.drawer.getBoundingClientRect();
    var anchorRect = anchorEl.getBoundingClientRect();
    var top = anchorRect.bottom - drawerRect.top + 8;
    var left = clamp(anchorRect.left - drawerRect.left, 8, Math.max(8, els.drawer.clientWidth - 216));
    els.pickerPop.style.top = top + 'px';
    els.pickerPop.style.left = left + 'px';
    els.pickerPop.classList.add('open');
    picker.open = true;
  }
  function closePicker() {
    if (!els.pickerPop) return;
    els.pickerPop.classList.remove('open');
    picker.open = false;
    picker.onChange = null;
  }

  function svPointFromEvent(e) {
    var rect = els.pickerSv.getBoundingClientRect();
    var x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    var y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    return { s: x * 100, v: (1 - y) * 100 };
  }
  function huePointFromEvent(e) {
    var rect = els.pickerHue.getBoundingClientRect();
    var x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    return x * 360;
  }

  function wirePicker() {
    els.pickerSv.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      els.pickerSv.setPointerCapture(e.pointerId);
      function apply(ev) {
        var pt = svPointFromEvent(ev);
        setPickerHsv({ h: picker.hsv.h, s: pt.s, v: pt.v }, false);
        pickerEmit();
      }
      apply(e);
      function move(ev) { apply(ev); }
      function up() {
        els.pickerSv.removeEventListener('pointermove', move);
        els.pickerSv.removeEventListener('pointerup', up);
      }
      els.pickerSv.addEventListener('pointermove', move);
      els.pickerSv.addEventListener('pointerup', up);
    });

    els.pickerHue.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      els.pickerHue.setPointerCapture(e.pointerId);
      function apply(ev) {
        var h = huePointFromEvent(ev);
        setPickerHsv({ h: h, s: picker.hsv.s, v: picker.hsv.v }, false);
        pickerEmit();
      }
      apply(e);
      function move(ev) { apply(ev); }
      function up() {
        els.pickerHue.removeEventListener('pointermove', move);
        els.pickerHue.removeEventListener('pointerup', up);
      }
      els.pickerHue.addEventListener('pointermove', move);
      els.pickerHue.addEventListener('pointerup', up);
    });

    els.pickerHex.addEventListener('input', function () {
      var v = els.pickerHex.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
      if (v !== els.pickerHex.value) els.pickerHex.value = v;
      if (v.length === 6) {
        setPickerHsv(hexToHsv('#' + v), true);
        pickerEmit();
      }
    });

    document.addEventListener('pointerdown', function (e) {
      if (!picker.open) return;
      if (els.pickerPop.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.ct-swatch-btn')) return;
      closePicker();
    });
  }

  window.__neOpenCustomDrawer = openDrawer;
  window.__neOnCustomSelected = function () {
    // Selecting "Custom" from the dropdown only flips theme.js's data-theme
    // attribute — it doesn't touch our own CSS variables. Re-apply here
    // every time (not just when no config is saved yet), since this can
    // fire after the user switched away to Light/Dark/Sync earlier in the
    // same page session, which cleared those variables via clearCustomVars.
    var isNew = !getConfig();
    var cfg = ensureConfig();
    applyCustomTheme(cfg);
    if (isNew) saveConfig(cfg);
    openDrawer();
  };

  /* Expose for the Node test harness. */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      hexToRgb: hexToRgb, rgbToHsl: rgbToHsl, hslToRgb: hslToRgb, hslToHex: hslToHex,
      relativeLuminance: relativeLuminance, suggestPalette: suggestPalette,
      hexToHsv: hexToHsv, hsvToHex: hsvToHex, rgbToHsv: rgbToHsv, hsvToRgb: hsvToRgb
    };
  }
})();
