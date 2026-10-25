// Papers page: "Group by" (status / year / topic), topic filter, search.
// Every paper is already in the HTML; this script only re-orders, inserts
// headings and hides entries.  Without JavaScript the pre-rendered default
// grouping is shown.
//
// Topic view: a paper appears under every topic it is tagged with (the first
// occurrence is the original element, the others are clones without an id).
// Selecting a topic chip shows just that topic's heading, in the Topic view,
// and filters the Status and Year views.
(function () {
  "use strict";
  var list = document.getElementById("papers-list");
  var controls = document.getElementById("papers-controls");
  if (!list || !controls) return;

  var topics = JSON.parse(list.dataset.topics || "[]");          // [{slug, name}]
  var topicName = {};
  topics.forEach(function (t) { topicName[t.slug] = t.name; });
  var sectionLabels = JSON.parse(list.dataset.sectionLabels || "[]");
  var papers = Array.prototype.slice.call(list.querySelectorAll(".paper:not([data-clone])"));
  papers.forEach(function (p, i) { p.dataset.index = i; });
  var total = papers.length;
  var STATUS_RANK = { published: 0, accepted: 1, submitted: 2, preprint: 3, "in-prep": 4 };
  var GROUP_LABELS = { status: "Status", year: "Year", topic: "Topic" };

  var params = new URLSearchParams(location.search);
  var state = {
    group: params.get("group") || list.dataset.defaultGroup || "status",
    topic: params.get("topic") || "",
    q: params.get("search") || ""
  };
  if (!GROUP_LABELS[state.group]) state.group = "status";

  var counts = {};
  papers.forEach(function (p) {
    (p.dataset.topics || "").split("|").forEach(function (s) { if (s) counts[s] = (counts[s] || 0) + 1; });
  });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  controls.innerHTML =
    '<div class="pc-row">' +
    '<span class="pc-label">Group by</span>' +
    '<div class="seg" role="group" aria-label="Group papers by">' +
    ["status", "year", "topic"].map(function (g) {
      return '<button type="button" data-group="' + g + '"' + (g === state.group ? ' class="active"' : "") + ">" + GROUP_LABELS[g] + "</button>";
    }).join("") +
    "</div>" +
    '<input type="search" id="papers-search" placeholder="Search titles, authors, venues…" aria-label="Search papers" value="' + esc(state.q) + '">' +
    '<span id="papers-count" aria-live="polite"></span>' +
    "</div>" +
    '<div class="pc-row chips">' +
    topics.filter(function (t) { return counts[t.slug]; }).map(function (t) {
      return '<button type="button" class="chip' + (t.slug === state.topic ? " active" : "") + '" data-topic="' + t.slug + '">' +
        esc(t.name) + '<span class="n">' + counts[t.slug] + "</span></button>";
    }).join("") +
    '<a href="#" class="chip-clear" hidden>clear</a>' +
    "</div>";

  var search = document.getElementById("papers-search");
  var count = document.getElementById("papers-count");
  var clear = controls.querySelector(".chip-clear");

  controls.querySelectorAll(".seg button").forEach(function (b) {
    b.addEventListener("click", function () { state.group = b.dataset.group; render(); });
  });
  controls.querySelectorAll(".chip").forEach(function (b) {
    b.addEventListener("click", function () { state.topic = (state.topic === b.dataset.topic) ? "" : b.dataset.topic; render(); });
  });
  clear.addEventListener("click", function (e) { e.preventDefault(); state.topic = ""; state.q = ""; search.value = ""; render(); });
  search.addEventListener("input", function () { state.q = search.value; render(); });

  function statusSection(p) {
    if (p.dataset.group === "interdisciplinary") return 3;
    var s = p.dataset.status;
    if (s === "published" || s === "accepted") return 0;
    if (s === "submitted" || s === "preprint") return 1;
    return 2;
  }
  function cmp(a, b) {
    var ya = a.dataset.year ? +a.dataset.year : -1, yb = b.dataset.year ? +b.dataset.year : -1;
    if (ya !== yb) return yb - ya;
    var ra = STATUS_RANK[a.dataset.status], rb = STATUS_RANK[b.dataset.status];
    if (ra !== rb) return ra - rb;
    return (+a.dataset.index) - (+b.dataset.index);
  }

  function render() {
    var q = state.q.trim().toLowerCase();
    var visible = papers.filter(function (p) {
      if (state.topic && (p.dataset.topics || "").split("|").indexOf(state.topic) < 0) return false;
      if (q && (p.dataset.search || "").indexOf(q) < 0) return false;
      return true;
    });

    var groups = [];
    if (state.group === "year") {
      var byYear = {};
      visible.forEach(function (p) { var y = p.dataset.year || ""; (byYear[y] = byYear[y] || []).push(p); });
      Object.keys(byYear).sort(function (a, b) { return a === "" ? 1 : b === "" ? -1 : (+b) - (+a); })
        .forEach(function (y) { groups.push({ label: y || "In preparation", items: byYear[y] }); });
    } else if (state.group === "topic") {
      var byTopic = {};
      visible.forEach(function (p) {
        var ts = state.topic ? [state.topic] : (p.dataset.topics || "").split("|").filter(Boolean);
        if (!ts.length) ts = [""];
        ts.forEach(function (t) { (byTopic[t] = byTopic[t] || []).push(p); });
      });
      topics.forEach(function (t) { if (byTopic[t.slug]) groups.push({ label: t.name, items: byTopic[t.slug] }); });
      if (byTopic[""]) groups.push({ label: "Other", items: byTopic[""] });
    } else {
      var bySec = [[], [], [], []];
      visible.forEach(function (p) { bySec[statusSection(p)].push(p); });
      bySec.forEach(function (items, i) { if (items.length) groups.push({ label: sectionLabels[i] || "", items: items }); });
    }
    groups.forEach(function (g) { g.items.sort(cmp); });

    list.querySelectorAll("h2.papers-section, .paper[data-clone]").forEach(function (h) { h.remove(); });
    var frag = document.createDocumentFragment();
    var shown = {}, repeats = 0;
    groups.forEach(function (g) {
      var h = document.createElement("h2");
      h.className = "papers-section";
      h.textContent = g.label;
      frag.appendChild(h);
      g.items.forEach(function (p) {
        var node = p;
        if (shown[p.id]) {                      // already listed under an earlier topic
          node = p.cloneNode(true);
          node.removeAttribute("id");
          node.dataset.clone = "1";
          repeats++;
        } else {
          p.hidden = false;
          shown[p.id] = true;
        }
        frag.appendChild(node);
      });
    });
    papers.forEach(function (p) { if (!shown[p.id]) { p.hidden = true; frag.appendChild(p); } });
    list.appendChild(frag);

    count.textContent = (visible.length === total ? total + " papers" : visible.length + " of " + total + " papers") +
      (repeats ? " \u00b7 a paper with several topics is listed under each" : "");
    controls.querySelectorAll(".seg button").forEach(function (b) { b.classList.toggle("active", b.dataset.group === state.group); });
    controls.querySelectorAll(".chip").forEach(function (b) { b.classList.toggle("active", b.dataset.topic === state.topic); });
    clear.hidden = !(state.topic || q);

    var p = new URLSearchParams();
    if (state.group !== (list.dataset.defaultGroup || "status")) p.set("group", state.group);
    if (state.topic) p.set("topic", state.topic);
    if (q) p.set("search", state.q.trim());
    var qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }

  render();
  if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
  }
})();
