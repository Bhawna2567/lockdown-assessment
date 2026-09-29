// public/js/visuals.js — universal visual renderer.
// Used by teacher builder, student view, preview, and any other place
// where a question can carry a `visual` field.
(function () {
  function _sanitizeSvg(s) {
    if (typeof s !== 'string') return '';
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
    s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
    s = s.replace(/javascript:/gi, '');
    return s;
  }
  function _typesetMathJax(host) {
    if (window.MathJax && window.MathJax.typesetPromise) {
      try { window.MathJax.typesetPromise([host]).catch(function(){}); } catch(e){}
    }
  }
  window.ccRenderVisual = function (v, hostEl) {
    if (!hostEl) return;
    hostEl.innerHTML = '';
    if (!v || !v.type || !v.content) return;
    hostEl.setAttribute('data-visual-type', v.type);
    hostEl.style.margin = '10px 0';
    if (v.type === 'svg') {
      const wrap = document.createElement('div');
      wrap.className = 'cc-visual cc-visual-svg';
      wrap.style.maxWidth = '520px';
      wrap.setAttribute('role', 'img');
      if (v.altText) wrap.setAttribute('aria-label', v.altText);
      wrap.innerHTML = _sanitizeSvg(v.content);
      // Force responsive SVG sizing.
      const svg = wrap.querySelector('svg');
      if (svg) { svg.style.maxWidth = '100%'; svg.style.height = 'auto'; }
      hostEl.appendChild(wrap);
    } else if (v.type === 'latex') {
      const p = document.createElement('div');
      p.className = 'cc-visual cc-visual-latex';
      p.style.fontSize = '1.15em';
      p.style.padding = '8px 0';
      // Wrap in MathJax display delimiters.
      p.textContent = '\\[' + v.content + '\\]';
      hostEl.appendChild(p);
      _typesetMathJax(p);
    } else if (v.type === 'image') {
      const img = document.createElement('img');
      img.className = 'cc-visual cc-visual-image';
      img.src = v.content;
      img.alt = v.altText || '';
      img.style.maxWidth = '520px';
      img.style.height = 'auto';
      img.style.border = '1px solid #E5E7EB';
      img.style.borderRadius = '6px';
      hostEl.appendChild(img);
    } else if (v.type === 'image_description') {
      const box = document.createElement('div');
      box.className = 'cc-visual cc-visual-desc';
      box.style.cssText = 'padding:12px; background:#F3F4F6; border:1px dashed #9CA3AF; border-radius:6px; color:#374151; font-size:13px; max-width:520px;';
      box.textContent = '🖼️ Image placeholder: ' + v.content;
      hostEl.appendChild(box);
    }
  };
  // Convenience: render every [data-visual] element on the page from its
  // attached data.
  window.ccRenderAllVisuals = function (root) {
    root = root || document;
    root.querySelectorAll('[data-visual-host]').forEach(function (el) {
      try {
        const v = JSON.parse(el.getAttribute('data-visual-json') || 'null');
        if (v) window.ccRenderVisual(v, el);
      } catch(e){}
    });
  };
  document.addEventListener('DOMContentLoaded', function(){ window.ccRenderAllVisuals(); window.ccTypesetAll && window.ccTypesetAll(); });

  // Re-typeset MathJax across the whole page whenever new content appears.
  // This catches MCQ options that contain $...$ LaTeX.
  window.ccTypesetAll = function () {
    if (window.MathJax && window.MathJax.typesetPromise) {
      try { window.MathJax.typesetPromise().catch(function(){}); } catch(e){}
    }
  };
  // Typeset maths whenever new content appears. Starts only once <body>
  // exists (this file loads in <head>), ignores MathJax's own output, and
  // only runs when the new content actually contains maths.
  (function () {
    var busy = false, timer = null;
    var MATH_RE = /\\\(|\\\[|\$\$/;
    function run() {
      timer = null;
      if (busy) return;
      var MJ = window.MathJax;
      if (!MJ || !MJ.typesetPromise) { timer = setTimeout(run, 300); return; }
      busy = true;
      MJ.typesetPromise().catch(function () {}).then(function () { busy = false; });
    }
    function schedule() { if (!timer) timer = setTimeout(run, 120); }
    function relevant(muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 1 && /^mjx-/i.test(n.nodeName)) continue;
          if (n.nodeType === 1 && n.closest && n.closest('mjx-container')) continue;
          var t = n.textContent || '';
          if (MATH_RE.test(t)) return true;
        }
      }
      return false;
    }
    function start() {
      if (!document.body || !window.MutationObserver) return;
      new MutationObserver(function (muts) { if (!busy && relevant(muts)) schedule(); })
        .observe(document.body, { childList: true, subtree: true });
      schedule();
    }
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  })();
})();
