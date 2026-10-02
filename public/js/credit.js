// Developer credit bar — pinned to the top of every ClassCurio page, full
// width, centred. Hidden while a student is taking an exam, and on printouts.
(function () {
  if (window.__ccCredit) return; window.__ccCredit = true;
  function build() {
    if (document.getElementById('cc-credit')) return;
    const st = document.createElement('style');
    st.textContent = `
      #cc-credit{position:fixed;top:0;left:0;right:0;width:100%;box-sizing:border-box;z-index:2147483000;margin:0;
        background:#0f172a;color:#cbd5e1;text-align:center;padding:9px 20px 8px;
        font:400 13px/1.5 Georgia,"Times New Roman",serif;letter-spacing:.2px;
        border-bottom:1px solid transparent;
        border-image:linear-gradient(90deg,transparent,#c9a96e 20%,#e8d5a3 50%,#c9a96e 80%,transparent) 1;}
      #cc-credit .cc-cr-lbl{font:600 10.5px/1 "Segoe UI",system-ui,-apple-system,Arial,sans-serif;letter-spacing:1.6px;
        text-transform:uppercase;color:#94a3b8;margin:0 6px;white-space:nowrap;}
      #cc-credit .cc-cr-name{color:#e8d5a3;font-style:italic;font-size:14px;white-space:nowrap;}
      #cc-credit .cc-cr-dot{color:#c9a96e;margin:0 10px;}
      #cc-credit .cc-cr-school{color:#cbd5e1;white-space:nowrap;}
      #cc-credit .cc-cr-line{display:block;line-height:1.55;}
      #cc-credit .cc-cr-by{line-height:1.2;margin:1px 0;}
      #cc-credit .cc-cr-by .cc-cr-lbl{font-size:9.5px;color:#c9a96e;}
      @media (max-width:760px){#cc-credit{font-size:12px;padding:7px 12px;} #cc-credit .cc-cr-name{font-size:12.5px;} #cc-credit .cc-cr-dot{margin:0 6px;}}
      @media print{#cc-credit{display:none !important;} body{padding-top:0 !important;}}
      body.cc-in-exam #cc-credit{display:none !important;}`;
    document.head.appendChild(st);
    const bar = document.createElement('div');
    bar.id = 'cc-credit';
    bar.setAttribute('role', 'note');
    bar.innerHTML =
      '<div class="cc-cr-line"><span class="cc-cr-lbl">Developed under the guidance of</span> <span class="cc-cr-name">Fanda Salem Ahmed Helais Alkaabi</span></div>' +
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
