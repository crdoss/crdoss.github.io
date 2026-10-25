// Small site-wide helpers (no dependencies).
document.addEventListener("DOMContentLoaded", function () {
  // Assemble the e-mail address in the browser so that address scrapers do not see it.
  document.querySelectorAll("a.email[data-u]").forEach(function (a) {
    var addr = a.dataset.u + "@" + a.dataset.d;
    a.href = "mailto:" + addr;
    a.childNodes.forEach(function (n) {
      if (n.nodeType === 3 && n.textContent.indexOf("[at]") >= 0) n.textContent = " " + addr;
    });
  });
  // Open PDFs (CV, syllabi) in a new tab so the reader keeps their place on the site.
  document.querySelectorAll('a[href$=".pdf"]').forEach(function (a) {
    a.target = "_blank";
    a.rel = "noopener";
  });
});
