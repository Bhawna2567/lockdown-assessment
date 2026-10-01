// Developer credit bar — shown at the top of every ClassCurio page
// (hidden while a student is taking an exam, and on printouts).
(function () {
  if (window.__ccCredit) return; window.__ccCredit = true;
  function build() {
    if (document.getElementById('cc-credit')) return;
    const st = document.createElement('style');
    st.textContent = `
      #cc-credit{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;
        background:linear-gradient(90deg,#1e3a8a 0%,#4338ca 55%,#7c3aed 100%);color:#fff;
        padding:9px 16px;font:500 15px/1.4 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;text-align:center;
        box-shadow:0 2px 8px rgba(30,58,138,.25);position:relative;z-index:5;}
      #cc-credit .cc-cr-badge{font-size:18px;}
      #cc-credit strong{color:#fde68a;font-weight:700;}
      #cc-credit .cc-cr-school{opacity:.92;white-space:nowrap;}
      @media (max-width:640px){#cc-credit{font-size:13px;padding:8px 10px;}}
      @media print{#cc-credit{display:none !important;}}
      body.cc-in-exam #cc-credit{display:none !important;}`;
    document.head.appendChild(st);
    const bar = document.createElement('div');
    bar.id = 'cc-credit';
    bar.setAttribute('role', 'note');
    bar.innerHTML = '<span class="cc-cr-badge">🏅</span><span>Developed under the guidance of <strong>Fanda Salem Ahmed Helais Alkaabi</strong> by <strong>Bhawna Sharma</strong> <span class="cc-cr-school">(Al Noaimiyah Girls School – Cycle 1, 2 &amp; 3)</span></span>';
    document.body.insertBefore(bar, document.body.firstChild);
    // Student page: hide during the exam so it never distracts.
    const exam = document.getElementById('assessment-view');
    if (exam) {
      const sync = () => {
        const on = (exam.style.display !== 'none' && exam.offsetParent !== null) || !!document.fullscreenElement;
        document.body.classList.toggle('cc-in-exam', on);
      };
      new MutationObserver(sync).observe(exam, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
      document.addEventListener('fullscreenchange', sync);
      sync();
    }
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
