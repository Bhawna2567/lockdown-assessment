// Developer credit bar — pinned to the top of every ClassCurio page, full
// width, centred. Hidden while a student is taking an exam, and on printouts.
(function () {
  if (window.__ccCredit) return; window.__ccCredit = true;
  function build() {
    if (document.getElementById('cc-credit')) return;
    const st = document.createElement('style');
    st.textContent = `
      #cc-credit{position:fixed;top:0;left:0;right:0;width:100%;box-sizing:border-box;z-index:2147483000;margin:0;
        background:#121826;color:#f1f5f9;text-align:center;padding:12px 20px 12px;
        font:400 18px/1.4 Georgia,"Times New Roman",serif;box-shadow:0 2px 12px rgba(0,0,0,.35);}
      #cc-credit .cc-cr-line{display:block;}
      #cc-credit .cc-cr-lbl{font:700 13px/1.6 "Segoe UI",system-ui,-apple-system,Arial,sans-serif;letter-spacing:3px;
        text-transform:uppercase;color:#9ca3af;}
      #cc-credit .cc-cr-name{color:#e3c88a;font-style:italic;font-size:21px;line-height:1.45;white-space:nowrap;}
      #cc-credit .cc-cr-by .cc-cr-lbl{color:#c9a45c;font-size:13px;letter-spacing:4px;}
      #cc-credit .cc-cr-dot{color:#c9a45c;margin:0 16px;font-size:16px;vertical-align:2px;}
      #cc-credit .cc-cr-school{color:#ffffff;font-size:19px;white-space:nowrap;}
      @media (max-width:760px){#cc-credit{padding:8px 12px;} #cc-credit .cc-cr-lbl{font-size:10.5px;letter-spacing:2px;}
        #cc-credit .cc-cr-name{font-size:16px;} #cc-credit .cc-cr-school{font-size:14px;white-space:normal;} #cc-credit .cc-cr-dot{margin:0 8px;}}
      @media print{#cc-credit{display:none !important;} body{padding-top:0 !important;}}
      body.cc-in-exam #cc-credit{display:none !important;}`;
    document.head.appendChild(st);
    const bar = document.createElement('div');
    bar.id = 'cc-credit';
    bar.setAttribute('role', 'note');
    bar.innerHTML =
      '<div class="cc-cr-line"><span class="cc-cr-lbl">Developed under the guidance of</span></div>' +
      '<div class="cc-cr-line"><span class="cc-cr-name">Fanda Salem Ahmed Helais Alkaabi</span></div>' +
      '<div class="cc-cr-line cc-cr-by"><span class="cc-cr-lbl">by</span></div>' +
      '<div class="cc-cr-line"><span class="cc-cr-name">Bhawna Sharma</span><span class="cc-cr-dot">◆</span><span class="cc-cr-school">Al Noaimiyah Girls School — Cycle 1, 2 &amp; 3</span></div>';
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
