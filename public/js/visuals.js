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

  // ── Safety net: readable maths if the renderer can't load ─────────────
  (function () {
    var SUP = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','n':'ⁿ','x':'ˣ' };
    var SUB = { '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋' };
    var MAP = { times:'×', div:'÷', cdot:'·', pm:'±', mp:'∓', le:'≤', leq:'≤', ge:'≥', geq:'≥', ne:'≠', neq:'≠', approx:'≈', equiv:'≡', infty:'∞', circ:'°', degree:'°',
      pi:'π', theta:'θ', alpha:'α', beta:'β', gamma:'γ', delta:'δ', Delta:'Δ', lambda:'λ', mu:'μ', sigma:'σ', Sigma:'Σ', omega:'ω', Omega:'Ω', phi:'φ', rho:'ρ', tau:'τ', epsilon:'ε', varepsilon:'ε', eta:'η',
      nabla:'∇', partial:'∂', int:'∫', sum:'∑', prod:'∏', rightarrow:'→', to:'→', longrightarrow:'→', leftarrow:'←', Rightarrow:'⇒', leftrightarrow:'↔', rightleftharpoons:'⇌',
      angle:'∠', triangle:'△', perp:'⊥', parallel:'∥', 'in':'∈', cup:'∪', cap:'∩', subset:'⊂', therefore:'∴', ldots:'…', cdots:'⋯', dots:'…',
      sin:'sin', cos:'cos', tan:'tan', sec:'sec', csc:'csc', cot:'cot', log:'log', ln:'ln', lim:'lim', exp:'exp', left:'', right:'', quad:' ', qquad:'  ', displaystyle:'', textstyle:'' };
    function map(str, table) { var out = ''; for (var i = 0; i < str.length; i++) { if (!table[str[i]]) return null; out += table[str[i]]; } return out; }
    function plain(t) {
      t = t.replace(/\^\{?\\circ\}?/g, '°');
      for (var k = 0; k < 6; k++) {
        t = t.replace(/\\[dtc]?frac\{([^{}]*)\}\{([^{}]*)\}/g, function (m, a, b) { return (a.length > 1 ? '(' + a + ')' : a) + '/' + (b.length > 1 ? '(' + b + ')' : b); });
        t = t.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, '$1√($2)').replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
        t = t.replace(/\\(?:mathrm|text|textrm|mathbf|mathit|operatorname|boxed|ce)\{([^{}]*)\}/g, '$1');
        t = t.replace(/\\(?:vec|overrightarrow)\{([^{}]*)\}/g, '$1⃗').replace(/\\overline\{([^{}]*)\}/g, '$1̅');
        t = t.replace(/\^\{([^{}]*)\}/g, function (m, a) { var s = map(a, SUP); return s !== null ? s : '^(' + a + ')'; });
        t = t.replace(/_\{([^{}]*)\}/g, function (m, a) { var s = map(a, SUB); return s !== null ? s : '_' + a; });
      }
      t = t.replace(/\^([0-9nx+-])/g, function (m, a) { return SUP[a] || m; }).replace(/_([0-9])/g, function (m, a) { return SUB[a] || m; });
      t = t.replace(/\\([A-Za-z]+)\s?/g, function (m, n) { return MAP[n] !== undefined ? MAP[n] + (/^(sin|cos|tan|sec|csc|cot|log|ln|lim|exp)$/.test(n) ? ' ' : '') : n; });
      t = t.replace(/\b(sin|cos|tan|sec|csc|cot|log|ln|exp) \(/g, '$1(').replace(/lim _/g, 'lim ');
      return t.replace(/\\[,;:! ]/g, ' ').replace(/\\([{}%$])/g, '$1').replace(/[{}]/g, '').replace(/ {2,}/g, ' ');
    }
    var RE = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$/g;
    function convert(root) {
      var w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var p = n.parentNode;
          if (!p || /^(TEXTAREA|INPUT|SCRIPT|STYLE|CODE|PRE)$/.test(p.nodeName) || (p.closest && p.closest('mjx-container,[contenteditable="true"]'))) return NodeFilter.FILTER_REJECT;
          return /\\\(|\\\[|\$\$/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      var list = []; while (w.nextNode()) list.push(w.currentNode);
      list.forEach(function (n) { n.nodeValue = n.nodeValue.replace(RE, function (m, a, b, c) { return plain(a || b || c || ''); }); });
    }
    window.ccMathFallback = convert;
    var started = Date.now();
    function check() {
      if (window.MathJax && window.MathJax.typesetPromise) return;          // real renderer is fine
      if (Date.now() - started < 8000) return setTimeout(check, 500);
      console.warn('[ClassCurio] Maths renderer unavailable — showing readable maths instead.');
      convert(document.body);
      if (window.MutationObserver && document.body) {
        new MutationObserver(function () { if (!(window.MathJax && window.MathJax.typesetPromise)) convert(document.body); })
          .observe(document.body, { childList: true, subtree: true });
      }
    }
    if (document.body) check(); else document.addEventListener('DOMContentLoaded', check);
  })();
})();
