// Block 4 (ICTPRG535) - customisation & personalisation.
// Persists theme (light/dark/system) and accent colour in localStorage.
(function () {
  var KEY = 'lpa-prefs';
  var ACCENTS = {
    green:   { brand: '#0e8a5f', dark: '#0a6b49' },
    blue:    { brand: '#2467c9', dark: '#1b4e9c' },
    purple:  { brand: '#7048b6', dark: '#553690' },
    teal:    { brand: '#0d8a8a', dark: '#0a6a6a' },
    crimson: { brand: '#b3324b', dark: '#8a2439' },
  };
  function read()  { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function write(p){ localStorage.setItem(KEY, JSON.stringify(p)); }
  function apply(p) {
    var r = document.documentElement, t = p.theme || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme:dark)').matches);
    r.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (p.brand) r.style.setProperty('--brand', p.brand);
    if (p.dark)  r.style.setProperty('--brand-dark', p.dark);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var prefs = read();
    // Header theme toggle (light <-> dark)
    var toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.addEventListener('click', function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      prefs.theme = isDark ? 'light' : 'dark';
      write(prefs); apply(prefs);
    });

    // Settings page controls
    var themeRadios = document.querySelectorAll('input[name="pref-theme"]');
    if (themeRadios.length) {
      var cur = prefs.theme || 'system';
      themeRadios.forEach(function (r) {
        r.checked = (r.value === cur);
        r.addEventListener('change', function () { prefs.theme = r.value; write(prefs); apply(prefs); });
      });
    }
    var swatches = document.querySelectorAll('#swatches .swatch');
    if (swatches.length) {
      var curBrand = prefs.brand || ACCENTS.green.brand;
      swatches.forEach(function (s) {
        var a = ACCENTS[s.getAttribute('data-accent')];
        if (a && a.brand === curBrand) s.classList.add('active');
        s.addEventListener('click', function () {
          var acc = ACCENTS[s.getAttribute('data-accent')];
          prefs.brand = acc.brand; prefs.dark = acc.dark; prefs.soft = acc.soft;
          write(prefs); apply(prefs);
          swatches.forEach(function (x) { x.classList.remove('active'); });
          s.classList.add('active');
        });
      });
    }
  });
})();
