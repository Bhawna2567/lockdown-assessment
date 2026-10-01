// Developer credit bar — pinned to the top of every ClassCurio page, full
// width, centred. Hidden while a student is taking an exam, and on printouts.
(function () {
  if (window.__ccCredit) return; window.__ccCredit = true;
  function build() {
    if (document.getElementById('cc-credit')) return;
    const st = document.createElement('style');
    st.textContent = `
      #cc-credit{position:fixed;top:0;left:0;right:0;width:100%;box-sizing:border-box;z-index:2147483000;
        display:block;text-align:center;margin:0;
        background:linear-gradient(90deg,#1e3a8a 0%,#4338ca 55%,#7c3aed 100%);color:#fff;
        padding:10px 16px;font:500 15px/1.45 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;
        box-shadow:0 2px 10px rgba(15,23,42,.35);border-bottom:1px solid rgba(255,255,255,.18);}
      #cc-credit strong{color:#fde68a;font-weight:700;}
      #cc-credit .cc-cr-school{white-space:nowrap;opacity:.95;}
      @media (max-width:700px){#cc-credit{font-size:13px;padding:8px 10px;}}
      @media print{#cc-credit{display:none !important;} body{padding-top:0 !important;}}
      body.cc-in-exam #cc-credit{display:none !important;}`;
    document.head.appendChild(st);
    const bar = document.createElement('div');
    bar.id = 'cc-credit';
    bar.setAttribute('role', 'note');
    bar.innerHTML = '🏅 Developed under the guidance of <strong>Fanda Salem Ahmed Helais Alkaabi</strong> by <strong>Bhawna Sharma</strong> <span class="cc-cr-school">(Al Noaimiyah Girls School – Cycle 1, 2 &amp; 3)</span>';
    document.body.insertBefore(bar, document.body.firstChild);
    // Push the page down by the bar's height so nothing is hidden under it.
    const basePad = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
    const fit = () => {
      const hidden = document.body.classList.contains('cc-in-exam');
      const h = hidden ? 0 : bar.offsetHeight;
      document.documentElement.style.setProperty('--cc-credit-h', h + 'px');
      document.body.style.paddingTop = (basePad + h) + 'px';
    };
    window.addEventListener('resize', fit);
    // Student page: hide during the exam so it never distracts.
    const exam = document.getElementById('assessment-view');
    if (exam) {
      const sync = () => {
        const on = (exam.style.display !== 'none' && exam.offsetParent !== null) || !!document.fullscreenElement;
        document.body.classList.toggle('cc-in-exam', on);
        fit();
      };
      new MutationObserver(sync).observe(exam, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
      document.addEventListener('fullscreenchange', sync);
      sync();
    }
    fit(); setTimeout(fit, 300);
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
