// Preflight tab: pick checks, send a run to Nayo, and show the results Nayo writes to
// .araniko/plugins/preflight/results.json (read with araniko.files.read, can: files: read).
// Opened in a plain browser it shows made-up sample results so the screen can be tried:
// ?state=empty for a first run, ?state=running for a run in progress.
(function () {
  "use strict";

  var A = window.araniko || null;
  var DEMO = !A;
  var POLL_MS = 15000;
  var RUN_MAX_MS = 3 * 60 * 60 * 1000;
  var REPORT = ".araniko/plugins/preflight/report.md";

  var CHECKS = [
    { id: "security", name: "Security", hint: "Keys, logins, who can see what" },
    { id: "database", name: "Database", hint: "Access rules, migrations, growth" },
    { id: "bugs", name: "Bugs", hint: "Build, tests and the main user flows" },
    { id: "tests", name: "Tests", hint: "Do the tests cover what matters" },
    { id: "reliability", name: "Reliability", hint: "When services fail, and would you know" },
    { id: "code", name: "Code quality", hint: "Structure, messy spots, old packages" },
    { id: "ux", name: "UI and UX", hint: "Empty, error and loading states, words" },
    { id: "accessibility", name: "Accessibility", hint: "Contrast, labels, keyboard use" },
    { id: "speed", name: "Speed", hint: "Heavy pages, big images, slow queries" },
    { id: "launch-basics", name: "Launch basics", hint: "Privacy page, error pages, docs, config" },
  ];
  var ALL = CHECKS.map(function (c) { return c.id; });
  var NAMES = {};
  CHECKS.forEach(function (c) { NAMES[c.id] = c.name; });
  var STATUS_WORD = { blocked: "Blocked", review: "Review", cleared: "Cleared", "could-not-check": "Couldn't check" };
  var EFFORT = { S: "under 2 hours", M: "half a day", L: "a day or more" };

  var s = {
    picked: ALL.slice(),
    runs: [],        // [{at, checks, done?}] newest first (storage "runs")
    fixes: {},       // finding id -> when a fix brief was sent (storage "fixes")
    decided: {},     // decision id -> option label sent (storage "decided")
    results: null,
    canRead: false,
    view: "findings",
    filter: null,
    open: {},        // finding id -> shown open (blocking ones start open)
    groups: {},      // check id -> review group open
    picker: false,
    moreDecisions: false,
    sending: false,
    progress: null,  // progress.json: the run as it happens (Nayo keeps it)
    steps: {},       // check id -> progress/<id>.json (each worker keeps its own)
  };

  var $ = function (id) { return document.getElementById(id); };
  var store = A && A.storage && typeof A.storage.get === "function" ? A.storage : null;

  // ---------- Helpers ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]);
    return parent;
  }
  function icon(name) {
    var p = window.PREFLIGHT_ICONS && window.PREFLIGHT_ICONS[name];
    if (!p) return null;
    var t = document.createElement("span");
    t.innerHTML = '<svg class="i" viewBox="0 0 24 24" fill="none" aria-hidden="true">' + p + "</svg>";
    return t.firstChild;
  }
  function button(cls, text, onClick) {
    var b = el("button", cls, text);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }
  function time(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
    return new Date().toDateString() === d.toDateString() ? "Today, " + t : d.toLocaleDateString([], { day: "numeric", month: "short" }) + ", " + t;
  }
  function ago(iso) {
    var m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.floor(m / 60), r = m % 60;
    return h + " h" + (r ? " " + r + " min" : "") + " ago";
  }
  function took(a, b) {
    var m = Math.round((new Date(b) - new Date(a)) / 60000);
    if (!(m >= 0)) return "";
    return m < 60 ? "took " + Math.max(1, m) + " min" : "took " + Math.floor(m / 60) + " h " + (m % 60) + " min";
  }
  function setStatus(text, bad) {
    var n = $("status");
    n.textContent = text || "";
    n.classList.toggle("bad", !!bad);
  }
  function save(key, value) { if (store) store.set(key, value).catch(function () {}); }
  // araniko.storage.get answers {value}.
  function load(key) {
    return store.get(key).then(function (r) {
      return r && typeof r === "object" && !Array.isArray(r) && "value" in r ? r.value : r;
    });
  }
  function errorText(e) {
    var m = (e && (e.message || e)) + "";
    if (/hour|limit/i.test(m)) return "Nayo has had 10 briefs from Preflight this hour. Try again a bit later.";
    return m && m !== "undefined" ? m : "That didn't reach Nayo. Try again.";
  }

  // ---------- Reading the results ----------
  var R = {
    findings: function () { return (s.results && s.results.findings) || []; },
    open: function () { return R.findings().filter(function (f) { return f.state !== "fixed"; }); },
    byId: function (id) { var l = R.findings(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; },
    check: function (id) { var l = (s.results && s.results.checks) || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; },
    quick: function () {
      var ids = s.results && Array.isArray(s.results.quick_wins) ? s.results.quick_wins : null;
      var open = R.open().filter(function (f) { return f.level !== "blocking"; });
      if (ids) return ids.map(R.byId).filter(function (f) { return f && f.state !== "fixed" && f.level !== "blocking"; });
      return open.filter(function (f) { return f.effort === "S"; }).slice(0, 8);
    },
    decisions: function () { return (s.results && s.results.decisions) || []; },
    list: function (k) { var v = s.results && s.results[k]; return Array.isArray(v) ? v : []; },
  };

  // ---------- The latest run ----------
  function lastRun() { return s.runs[0] || null; }
  // progress.json, when it belongs to the latest run.
  function live() {
    var r = lastRun(), p = s.progress;
    if (!r || !p || !Array.isArray(p.checks)) return null;
    if (r.id && p.run_id) return p.run_id === r.id ? p : null;
    return new Date(p.started_at || 0) >= new Date(new Date(r.at).getTime() - 2 * 60000) ? p : null;
  }
  function running() {
    var r = lastRun();
    if (!r || r.done) return false;
    if (Date.now() - new Date(r.at).getTime() > RUN_MAX_MS) return false;
    var p = live();
    if (p && (p.state === "done" || p.state === "stopped")) return false;
    var res = s.results;
    if (!res) return true;
    // Nayo marks a run as answered even when it decides not to re-run (a duplicate send).
    if (r.id && (res.run_id === r.id || (Array.isArray(res.answered) && res.answered.indexOf(r.id) !== -1))) return false;
    if (!res.finished_at) return true;
    return new Date(r.at) > new Date(res.finished_at);
  }
  // A run Nayo hasn't started after 10 minutes: busy with other work, or the brief was lost
  // (for example when Preflight was turned off and on, which clears its folder).
  function notStarted() {
    var r = lastRun();
    return running() && s.canRead && !live() && Date.now() - new Date(r.at).getTime() > 10 * 60000;
  }
  // "Forget this run" shows when the tab can't see the end of a run, Nayo hasn't started it, or it's taking long.
  function canMarkFinished() {
    var r = lastRun();
    return running() && (!s.canRead || notStarted() || Date.now() - new Date(r.at).getTime() > 45 * 60000);
  }

  // ---------- Head ----------
  function renderHead() {
    var h = $("headline"), p = $("summary"), meta = $("meta"), r = s.results, run = lastRun(), going = running();
    $("finish").hidden = DEMO || !canMarkFinished();
    meta.hidden = true;
    var stop = $("stop");
    stop.hidden = !going || !(s.canRead || DEMO);
    stop.disabled = !!(run && run.stopping);
    stop.textContent = run && run.stopping ? "Stopping…" : "Stop the run";
    if (going) {
      var pg = live();
      h.dataset.verdict = "running";
      h.textContent = "Checking " + run.checks.length + (run.checks.length === 1 ? " thing" : " things");
      if (pg) {
        var c = counts(pg);
        var bits2 = [c.done + " of " + pg.checks.length + " done", "started " + ago(pg.started_at || run.at)];
        var left = estimate(pg);
        if (left) bits2.push("about " + left + " left");
        p.textContent = bits2.join(" · ").replace(/^./, function (x) { return x.toUpperCase(); });
      } else {
        p.textContent = notStarted()
          ? "Sent " + ago(run.at) + ", but Nayo hasn't started it. It may be busy with other work. If it's been too long, forget this run and press Run again."
          : "Started " + ago(run.at) + ". " + (s.canRead || DEMO
            ? "Waiting for Nayo to hand out the checks."
            : "Nayo is working on it and replies in its tab with the verdict.");
      }
    } else if (r) {
      h.dataset.verdict = r.verdict || "none";
      h.textContent = r.headline || "Results";
      p.textContent = r.summary || "";
      var set = r.settings || {};
      var bits = [time(r.finished_at || r.started_at), took(r.started_at, r.finished_at), (r.checks || []).length + " checks"];
      if (set.audience) bits.push(set.audience === "The public" ? "for the public" : "for you and your team");
      if (set.depth) bits.push(set.depth.toLowerCase());
      meta.textContent = bits.filter(Boolean).join(" · ");
      meta.hidden = false;
    } else {
      h.dataset.verdict = "none";
      h.textContent = "Ready when you are";
      p.textContent = "Pick what to check, then press Run. Nayo does the work and Preflight reports back.";
    }
    var n = s.picked.length;
    $("runLabel").textContent = s.sending ? "Sending…" : going ? "Checks running" : !n ? "Pick a check" : r && !s.picker ? "Run again" : "Run " + n + (n === 1 ? " check" : " checks");
    $("run").disabled = s.sending || going || !n;
    var ch = $("choose");
    ch.hidden = !r || going;
    ch.textContent = s.picker ? "Hide checks" : "Choose checks";
    ch.setAttribute("aria-expanded", s.picker ? "true" : "false");
  }

  // ---------- Picking checks ----------
  function renderPicker() {
    var show = !running() && (!s.results || s.picker);
    $("picker").hidden = !show;
    if (!show) return;
    var box = $("pickList");
    box.textContent = "";
    CHECKS.forEach(function (c) {
      var label = el("label", "pick");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = s.picked.indexOf(c.id) !== -1;
      cb.addEventListener("change", function () {
        var set = cb.checked ? s.picked.concat(c.id) : s.picked.filter(function (x) { return x !== c.id; });
        s.picked = ALL.filter(function (x) { return set.indexOf(x) !== -1; });
        save("picked", s.picked);
        render();
      });
      var text = add(el("span", "pick-text"), el("span", "pick-name", c.name), el("span", "pick-sub", c.hint));
      add(label, cb, icon(c.id), text);
      box.appendChild(label);
    });
    $("toggleAll").textContent = s.picked.length === ALL.length ? "Clear all" : "Pick all";
  }

  // ---------- Summary ----------
  function renderStats() {
    var r = s.results;
    $("stats").hidden = !r || running();
    if (!r || running()) return;
    var open = R.open();
    var score = $("score");
    score.textContent = r.score == null ? "–" : String(r.score);
    if (r.score != null) score.appendChild(el("span", "of", " / 100"));
    $("blocking").textContent = String(open.filter(function (f) { return f.level === "blocking" && !s.fixes[f.id]; }).length);
    $("review").textContent = String(open.filter(function (f) { return f.level !== "blocking"; }).length);
    var q = $("quickCount");
    q.textContent = String(R.quick().length);
    q.appendChild(el("span", "of", " under 2 hours each"));
  }

  // ---------- Decisions ----------
  function decisionBlock(d, main) {
    var box = el("div");
    add(box, el("div", "d-question", d.question), d.detail ? el("p", "d-detail", d.detail) : null);
    if (s.decided[d.id]) {
      box.appendChild(el("p", "d-done", "Sent to Nayo: " + s.decided[d.id] + "."));
    } else if (main && d.options && d.options.length) {
      var row = el("div", "d-options");
      d.options.forEach(function (o, i) {
        row.appendChild(button("ghost big" + (i === 0 ? " solid" : ""), o.label, function (e) { decide(d, o, e.currentTarget); }));
      });
      box.appendChild(row);
    }
    if (main && d.findings && d.findings.length) {
      var titles = d.findings.map(R.byId).filter(Boolean).map(function (f) { return f.title; });
      if (titles.length) box.appendChild(el("p", "d-related", "Affects: " + titles.join("; ")));
    }
    return box;
  }
  function renderDecisions() {
    var list = running() ? [] : R.decisions();
    $("decide").hidden = !list.length;
    if (!list.length) return;
    var main = $("decideMain"), more = $("decideMore"), btn = $("moreDecisions");
    main.textContent = "";
    more.textContent = "";
    main.appendChild(decisionBlock(list[0], true));
    var rest = list.slice(1);
    btn.hidden = !rest.length;
    btn.textContent = s.moreDecisions ? "Hide the other decisions" : rest.length + (rest.length === 1 ? " more decision" : " more decisions") + " for you";
    btn.setAttribute("aria-expanded", s.moreDecisions ? "true" : "false");
    more.hidden = !s.moreDecisions || !rest.length;
    rest.forEach(function (d) { more.appendChild(decisionBlock(d, d.options && d.options.length)); });
  }

  // ---------- Views ----------
  function renderViews() {
    var has = !!s.results;
    if (running() && (s.canRead || DEMO)) {
      $("views").hidden = true;
      var lb = $("view");
      lb.textContent = "";
      lb.appendChild(liveView());
      return;
    }
    $("views").hidden = !has;
    ["findings", "plan", "about"].forEach(function (v) {
      var b = $("tab-" + v);
      b.setAttribute("aria-selected", s.view === v ? "true" : "false");
      b.tabIndex = s.view === v ? 0 : -1;
    });
    var box = $("view");
    box.textContent = "";
    if (!has) { box.appendChild(noResults()); return; }
    box.appendChild(s.view === "plan" ? planView() : s.view === "about" ? aboutView() : findingsView());
  }

  // ---------- The run as it happens ----------
  function counts(pg) {
    var c = { done: 0, running: 0, waiting: 0, blocking: 0, review: 0 };
    pg.checks.forEach(function (k) {
      if (k.state === "done" || k.state === "could-not-check") { c.done++; c.blocking += k.blocking || 0; c.review += k.review || 0; }
      else if (k.state === "running") c.running++;
      else if (k.state !== "stopped") c.waiting++;
    });
    return c;
  }
  function mins(a, b) { return Math.max(0, Math.round(((b ? new Date(b) : new Date()) - new Date(a)) / 60000)); }
  // A rough time left, from how long finished checks took. Only once one has finished.
  function estimate(pg) {
    var took = pg.checks.filter(function (k) { return k.state === "done" && k.started_at && k.finished_at; })
      .map(function (k) { return mins(k.started_at, k.finished_at); });
    if (!took.length) return "";
    var avg = Math.max(1, took.reduce(function (a, b) { return a + b; }, 0) / took.length);
    var workers = Math.max(1, pg.workers || 3);
    var waiting = pg.checks.filter(function (k) { return k.state === "waiting"; }).length;
    var runningLeft = pg.checks.filter(function (k) { return k.state === "running"; })
      .map(function (k) { return Math.max(1, avg - mins(k.started_at || pg.started_at)); });
    var m = Math.round(Math.max.apply(null, runningLeft.concat([0])) + Math.ceil(waiting / workers) * avg);
    return m < 1 ? "" : m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min";
  }
  function stepOf(id) {
    var f = s.steps[id], run = lastRun();
    if (!f || !Array.isArray(f.steps) || !f.steps.length) return null;
    if (run && run.id && f.run_id && f.run_id !== run.id) return null;
    var n = Math.min(f.steps.length, Math.max(1, f.step || 1));
    return { text: f.steps[n - 1], pct: Math.round(((n - 0.5) / f.steps.length) * 100), found: f.found || null };
  }

  function liveView() {
    var pg = live();
    var run = lastRun();
    var wrap = el("div", "live");
    var rows = pg ? pg.checks : run.checks.map(function (id) { return { id: id, state: "waiting" }; });
    var c = pg ? counts(pg) : { done: 0, running: 0, waiting: rows.length, blocking: 0, review: 0 };

    var bar = el("div", "live-bar");
    bar.setAttribute("aria-hidden", "true");
    rows.forEach(function (k) {
      var cls = k.state === "done" || k.state === "could-not-check" ? (k.blocking ? "blocked" : "done") : k.state === "running" ? "running" : "";
      bar.appendChild(el("span", cls));
    });
    wrap.appendChild(bar);

    var stats = el("div", "stats");
    [["Done", c.done, " of " + rows.length, ""], ["Running now", c.running, c.running === 1 ? " worker busy" : " workers busy", "run"],
     ["Blocking so far", c.blocking, "", "blocked"], ["To review so far", c.review, "", ""]].forEach(function (x) {
      var v = el("div", "stat-value " + x[3], String(x[1]));
      if (x[2]) v.appendChild(el("span", "of", x[2]));
      stats.appendChild(add(el("div", "stat"), el("div", "stat-label", x[0]), v));
    });
    wrap.appendChild(stats);

    var cols = el("div", "cols");
    var left = el("section", "live-checks");
    left.setAttribute("aria-label", "Checks");
    var list = el("div", "card");
    rows.forEach(function (k) {
      var row = el("div", "lrow " + (k.state || "waiting") + (k.blocking ? " blocked" : ""));
      var mark = el("span", "lmark");
      if (k.state === "running") mark.appendChild(el("span", "spin"));
      else if (k.state === "done" || k.state === "could-not-check") { var d = icon("done"); if (d) mark.appendChild(d); }
      else mark.appendChild(el("span", "dot"));
      var body = el("div", "lbody");
      var top = add(el("div", "ltop"), el("span", "lname", NAMES[k.id] || k.id));
      var sub, right = "", st = k.state === "running" ? stepOf(k.id) : null;
      if (k.state === "running") {
        var m0 = mins(k.started_at || pg.started_at);
        top.appendChild(el("span", "lwho", (k.worker ? k.worker + " · " : "") + (m0 < 1 ? "just started" : m0 + " min")));
        sub = st ? st.text + "…" : "Running";
        if (st) right = st.pct + "%";
      } else if (k.state === "done") {
        top.appendChild(el("span", "lwho", k.started_at && k.finished_at ? "took " + Math.max(1, mins(k.started_at, k.finished_at)) + " min" : ""));
        sub = (STATUS_WORD[k.status] || "Done") + (k.summary ? " · " + k.summary : "");
        right = k.score != null ? String(k.score) : "–";
      } else if (k.state === "could-not-check") {
        sub = "Couldn't check" + (k.summary ? " · " + k.summary : "");
        right = "–";
      } else if (k.state === "stopped") {
        sub = "Stopped";
      } else {
        sub = pg ? "Waiting for a free worker" : "Waiting for Nayo";
      }
      add(body, top, el("div", "lsub" + (k.status === "blocked" ? " blocked" : ""), sub));
      if (st) { var pb = el("div", "lprog"); var fill = el("span"); fill.style.width = st.pct + "%"; pb.appendChild(fill); body.appendChild(pb); }
      add(row, mark, icon(k.id), body, el("span", "lright", right));
      list.appendChild(row);
    });
    add(left, add(el("div", "col-head"), el("h2", null, "Checks")), list,
      el("p", "note", "Nayo runs up to " + ((pg && pg.workers) || 3) + " checks at once, one worker each. The others wait for a free worker."));

    var rightCol = el("section", "live-side");
    var found = [];
    rows.forEach(function (k) {
      (k.found || []).forEach(function (f) { found.push({ level: f.level, title: f.title, check: NAMES[k.id] || k.id, at: k.finished_at }); });
    });
    found.sort(function (a, b) { return (a.level === "blocking" ? 0 : 1) - (b.level === "blocking" ? 0 : 1) || new Date(b.at || 0) - new Date(a.at || 0); });
    var fl = el("div", "card list");
    if (!found.length) fl.appendChild(el("p", "lempty", "Findings appear here as each check finishes."));
    found.slice(0, 6).forEach(function (f) {
      fl.appendChild(add(el("div", "lfind"), el("div", "llevel " + (f.level === "blocking" ? "blocked" : "review"), f.level === "blocking" ? "Blocking launch" : "Review"),
        el("div", "ltitle", f.title), el("div", "lcheck", f.check + (f.at ? " · " + time(f.at).replace("Today, ", "") : ""))));
    });
    var fsec = add(el("div"), add(el("div", "col-head"), el("h2", null, "Found so far")), fl);
    if (c.blocking + c.review > Math.min(6, found.length)) fsec.appendChild(el("p", "note", (c.blocking + c.review - Math.min(6, found.length)) + " more so far. The full list opens when the run is done."));
    rightCol.appendChild(fsec);

    var log = (pg && Array.isArray(pg.log) ? pg.log : []).slice(-7).reverse();
    var ll = el("div", "card list");
    if (!log.length) ll.appendChild(el("p", "lempty", "Nayo hasn't started yet."));
    log.forEach(function (x) {
      ll.appendChild(add(el("div", "llog"), el("span", "lat", time(x.at).replace("Today, ", "")), el("span", null, x.text)));
    });
    rightCol.appendChild(add(el("div"), add(el("div", "col-head"), el("h2", null, "What Nayo is doing")), ll));

    add(cols, left, rightCol);
    wrap.appendChild(cols);
    wrap.appendChild(el("p", "note", "This updates on its own as Nayo's workers report in. You can leave the tab and come back."));
    return wrap;
  }

  function noResults() {
    var wrap = el("div", "card");
    var e = el("div", "empty");
    if (running()) {
      add(e, el("strong", null, "Checks are running"));
      e.appendChild(document.createTextNode(s.canRead || DEMO
        ? "Findings show up here as soon as Nayo finishes."
        : "Nayo replies in its tab with the verdict, and the full report is saved in "));
      if (!s.canRead && !DEMO) { e.appendChild(el("code", null, REPORT)); e.appendChild(document.createTextNode(".")); }
    } else if (!s.canRead && !DEMO && lastRun()) {
      add(e, el("strong", null, "Results are with Nayo"));
      e.appendChild(document.createTextNode("This version of Araniko can't show reports in the tab. Read Nayo's reply, or open "));
      e.appendChild(el("code", null, REPORT));
      e.appendChild(document.createTextNode("."));
    } else {
      add(e, el("strong", null, "No findings yet"));
      e.appendChild(document.createTextNode("Run Preflight and every problem it finds shows up here, with the file it's in, how to fix it and a button to send the fix to Nayo."));
    }
    return add(wrap, e);
  }

  function findingsView() {
    var cols = el("div", "cols");
    var going = running();
    var runIds = going ? lastRun().checks : [];

    // Checks column
    var left = el("section", "checks-col");
    left.setAttribute("aria-label", "Checks");
    var head = add(el("div", "col-head"), el("h2", null, "Checks"));
    if (s.filter) head.appendChild(button("link", "Show all", function () { s.filter = null; render(); }));
    var list = el("div", "card");
    CHECKS.forEach(function (c) {
      var res = R.check(c.id);
      var isRunning = runIds.indexOf(c.id) !== -1;
      if (!res && !isRunning) return;
      var b = button("check" + (res && res.status === "blocked" ? " blocked" : ""), null, function () {
        if (!res) return;
        s.filter = s.filter === c.id ? null : c.id;
        render();
      });
      b.setAttribute("aria-pressed", s.filter === c.id ? "true" : "false");
      var sub = isRunning ? "Running" : (STATUS_WORD[res.status] || "") + (res.summary ? " · " + res.summary : "");
      var score = isRunning ? "…" : res.score != null ? String(res.score) : "–";
      add(b, icon(c.id),
        add(el("span", "c-text"), el("span", "c-name", c.name), el("span", "c-sub", sub)),
        el("span", "c-score" + (isRunning ? " running" : res.score == null ? " none" : ""), score));
      list.appendChild(b);
    });
    add(left, head, list);

    // Findings column
    var right = el("section", "findings-col");
    right.setAttribute("aria-label", "Findings");
    var inFilter = function (f) { return !s.filter || f.check === s.filter; };
    var open = R.open();
    var blocking = open.filter(function (f) { return f.level === "blocking" && inFilter(f); });
    var quickAll = R.quick();
    var quickIds = quickAll.map(function (f) { return f.id; });
    var quick = quickAll.filter(inFilter);
    var rest = open.filter(function (f) { return f.level !== "blocking" && quickIds.indexOf(f.id) === -1; });
    var fixed = R.findings().filter(function (f) { return f.state === "fixed" && inFilter(f); });

    if (blocking.length) {
      var bl = el("div", "card list");
      blocking.forEach(function (f) { bl.appendChild(finding(f, true)); });
      add(right, add(el("div"), add(el("div", "col-head"), el("h2", "blocking", "Blocking launch")), bl));
    }
    if (quick.length) {
      var unsent = quick.filter(function (f) { return !s.fixes[f.id]; });
      var qh = add(el("div", "col-head"), add(el("h2", null, "Quick wins "), el("span", "soft", "· under 2 hours each")));
      var qb = button("ghost" + (unsent.length ? "" : " sent"), unsent.length ? (unsent.length === 1 ? "Fix it" : "Fix all " + unsent.length + " in one brief") : "Sent to Nayo", function (e) {
        if (unsent.length) fixMany(unsent, e.currentTarget);
      });
      qb.disabled = !unsent.length;
      qh.appendChild(qb);
      var ql = el("div", "card list");
      quick.forEach(function (f) { ql.appendChild(finding(f, false)); });
      add(right, add(el("div"), qh, ql));
    }
    var groups = CHECKS.map(function (c) {
      return { c: c, items: rest.filter(function (f) { return f.check === c.id && inFilter(f); }) };
    }).filter(function (g) { return g.items.length; });
    if (groups.length) {
      var total = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
      var rh = add(el("div", "col-head"), add(el("h2", "review", "Review before launch "), el("span", "soft", "· " + total + (quick.length ? " more" : ""))));
      var gl = el("div", "card");
      groups.forEach(function (g) {
        var isOpen = !!s.groups[g.c.id] || !!s.filter;
        var gb = button("g-head", null, function () { s.groups[g.c.id] = !isOpen; render(); });
        gb.setAttribute("aria-expanded", isOpen ? "true" : "false");
        add(gb, icon(g.c.id), el("span", "g-name", g.c.name), el("span", "g-count", g.items.length + (g.items.length === 1 ? " finding" : " findings")), add(el("span", "g-chev"), icon("chevron")));
        var wrap = add(el("div", "group"), gb);
        if (isOpen) {
          var inner = el("div", "list");
          g.items.forEach(function (f) { inner.appendChild(finding(f, false)); });
          wrap.appendChild(inner);
        }
        gl.appendChild(wrap);
      });
      add(right, add(el("div"), rh, gl));
    }
    if (fixed.length) {
      var fl = el("div", "card list");
      fixed.forEach(function (f) { fl.appendChild(finding(f, false)); });
      add(right, add(el("div"), add(el("div", "col-head"), el("h2", "fixed", "Fixed")), fl));
    }
    if (!blocking.length && !quick.length && !groups.length && !fixed.length) {
      var e = add(el("div", "card"), add(el("div", "empty"), el("strong", null, s.filter ? "Nothing found here" : "Nothing found"),
        document.createTextNode(s.filter ? "This check passed." : "Every check that ran passed.")));
      right.appendChild(e);
    }
    return add(cols, left, right);
  }

  function finding(f, big) {
    var row = el("div", "finding" + (big ? " big" : ""));
    var isOpen = s.open[f.id] != null ? s.open[f.id] : big;
    var main = el("div", "f-main");
    var t = button("f-title", f.title, function () { s.open[f.id] = !isOpen; render(); });
    t.setAttribute("aria-expanded", isOpen ? "true" : "false");
    var meta = [];
    if (!s.filter) meta.push(NAMES[f.check] || f.check);
    if (f.where) meta.push(f.where.split(" ")[0]);
    if (EFFORT[f.effort]) meta.push(EFFORT[f.effort]);
    if (f.confidence === "likely") meta.push("likely, not proven");
    add(main, t, el("div", "f-meta", meta.join(" · ")));
    if (isOpen) {
      if (f.detail) main.appendChild(el("p", "f-detail", f.detail));
      if (f.fix) { var fx = el("p", "f-fix"); add(fx, el("b", null, "Fix: "), document.createTextNode(f.fix)); main.appendChild(fx); }
      if (f.where) main.appendChild(el("div", "f-where", f.where));
      if (f.note) main.appendChild(el("div", "f-note", f.note));
    }
    row.appendChild(main);
    if (f.state !== "fixed") {
      var sent = !!s.fixes[f.id];
      var b = button("ghost" + (sent ? " sent" : ""), sent ? "Sent to Nayo" : "Fix this", function (e) { if (!sent) fixMany([f], e.currentTarget); });
      b.disabled = sent;
      row.appendChild(b);
    }
    return row;
  }

  function planView() {
    var two = el("div", "two");
    var order = R.list("order");
    var steps = el("section", "panel");
    steps.appendChild(el("h2", null, "Suggested order"));
    if (!order.length) steps.appendChild(el("div", "line", "Fix what's blocking launch first, then the quick wins, then the rest."));
    order.forEach(function (st, i) {
      var ids = (st.findings || []).map(R.byId).filter(function (f) { return f && f.state !== "fixed"; });
      var unsent = ids.filter(function (f) { return !s.fixes[f.id]; });
      var b;
      if (ids.length) {
        b = button("ghost" + (unsent.length ? "" : " sent"), unsent.length ? "Send to Nayo" : "Sent to Nayo", function (e) { if (unsent.length) fixMany(unsent, e.currentTarget); });
        b.disabled = !unsent.length;
      } else {
        b = button("ghost", "Show findings", function () { s.view = "findings"; render(); });
      }
      add(steps, add(el("div", "step"), el("span", "step-n", String(i + 1)), add(el("div", "step-text"), el("b", null, st.title), el("span", null, st.text)), b));
    });
    var side = el("div", "stack");
    var pats = R.list("patterns");
    if (pats.length) {
      var pp = add(el("section", "panel"), el("h2", null, "Patterns behind the findings"));
      pats.forEach(function (p) { pp.appendChild(add(el("div", "line"), el("b", null, p.title), el("span", null, p.text))); });
      side.appendChild(pp);
    }
    var skip = R.list("not_now");
    if (skip.length) {
      var sp = add(el("section", "panel"), el("h2", null, "Not worth fixing now"));
      skip.forEach(function (t) { sp.appendChild(el("div", "line", t)); });
      side.appendChild(sp);
    }
    return add(two, steps, side);
  }

  function aboutView() {
    var two = el("div", "two");
    var good = R.list("strengths");
    var gp = add(el("section", "panel"), el("h2", "good", "What " + (s.project || "this project") + " does well"));
    if (!good.length) gp.appendChild(el("div", "line", "The report doesn't list any."));
    good.forEach(function (t) { gp.appendChild(el("div", "line", t)); });
    var lim = R.list("limits");
    var lp = add(el("section", "panel"), el("h2", null, "What Preflight couldn't check"));
    if (!lim.length) lp.appendChild(el("div", "line", "Everything picked was checked."));
    lim.forEach(function (t) { lp.appendChild(el("div", "line", t)); });
    R.list("notes").forEach(function (t) { lp.appendChild(el("p", "note", t)); });
    var full = el("p", "note");
    add(full, document.createTextNode("Full report: "), el("code", null, REPORT));
    lp.appendChild(full);
    return add(two, gp, lp);
  }

  function render() {
    renderHead();
    renderPicker();
    renderStats();
    renderDecisions();
    renderViews();
  }

  // ---------- Sending to Nayo ----------
  function send(title, brief) {
    if (DEMO) return Promise.reject(new Error("Open Preflight in Araniko to send this to Nayo."));
    return A.sendBrief({ title: title.slice(0, 90), brief: brief });
  }
  function busy(b) { if (b) { b.disabled = true; b.textContent = "Sending…"; } }

  function run() {
    if (s.sending || !s.picked.length || running()) return;
    if (DEMO) { setStatus("Open Preflight in Araniko to run it."); return; }
    s.sending = true;
    setStatus("");
    render();
    var picked = s.picked.slice();
    var id = "run-" + new Date().toISOString().replace(/[-:]/g, "").replace(/\..*$/, "");
    Promise.resolve(typeof A.settings === "function" ? A.settings() : {}).catch(function () { return {}; }).then(function (set) {
      set = set || {};
      var brief = [
        "Run Preflight on this project with the `run-preflight` skill.",
        "",
        "Run id: `" + id + "`. Write it as `run_id` in results.json, and add it to `answered` there even if you don't re-run.",
        "Checks to run: " + picked.map(function (id) { return NAMES[id] + " (`" + id + "`)"; }).join(", ") + ".",
        "Settings: audience is \"" + (set.audience || "The public") + "\", depth is \"" + (set.depth || "Thorough") + "\".",
        "",
        "Give each check its own worker, as the skill says. Report only: don't fix anything.",
        "When every check is done, write .araniko/plugins/preflight/results.json (version 2) and report.md, then reply with the verdict.",
      ].join("\n");
      return send("Preflight: check " + picked.length + (picked.length === 1 ? " thing" : " things") + " before launch", brief);
    }).then(function () {
      s.runs = [{ id: id, at: new Date().toISOString(), checks: picked }].concat(s.runs).slice(0, 10);
      s.picker = false;
      save("runs", s.runs);
      setStatus("Sent to Nayo.");
      if (typeof A.toast === "function") A.toast("Preflight sent to Nayo");
    }, function (e) {
      setStatus(errorText(e), true);
    }).then(function () { s.sending = false; render(); });
  }

  function stopRun(b) {
    var r = lastRun();
    if (!r || r.stopping) return;
    if (DEMO) { setStatus("Open Preflight in Araniko to stop a run."); return; }
    if (!r.id) { r.done = true; save("runs", s.runs); render(); return; }
    busy(b);
    send("Preflight: stop the run", "Stop Preflight run `" + r.id + "` with the `run-preflight` skill's \"Stopping a run\" steps.").then(function () {
      r.stopping = true;
      save("runs", s.runs);
      setStatus("Asked Nayo to stop the run.");
      render();
    }, function (e) { setStatus(errorText(e), true); render(); });
  }

  function describe(f) {
    return [
      "- `" + f.id + "`: " + f.title,
      f.where ? "  Where: " + f.where : "",
      f.fix ? "  Suggested fix: " + f.fix : "",
    ].filter(Boolean).join("\n");
  }
  function fixMany(list, b) {
    if (!list.length) return;
    if (DEMO) { setStatus("Open Preflight in Araniko to send fixes."); return; }
    busy(b);
    var one = list.length === 1;
    var title = one ? "Preflight: fix " + list[0].title : "Preflight: fix " + list.length + " findings";
    var brief = [
      (one ? "Fix Preflight finding `" + list[0].id + "`" : "Fix Preflight findings " + list.map(function (f) { return "`" + f.id + "`"; }).join(", ")) + " with the `run-preflight` skill.",
      "",
      list.map(describe).join("\n"),
      "",
      one ? "Fix only this one thing, run the project's checks, then update results.json as the skill says."
          : "Fix them one at a time in this order, run the project's checks after each, then update results.json as the skill says.",
    ].join("\n");
    send(title, brief).then(function () {
      var now = new Date().toISOString();
      list.forEach(function (f) { s.fixes[f.id] = now; });
      save("fixes", s.fixes);
      setStatus(one ? "Sent the fix to Nayo." : "Sent " + list.length + " fixes to Nayo in one brief.");
      render();
    }, function (e) { setStatus(errorText(e), true); render(); });
  }

  function decide(d, o, b) {
    if (s.decided[d.id]) return;
    if (DEMO) { setStatus("Open Preflight in Araniko to send this to Nayo."); return; }
    busy(b);
    var brief = [
      "Preflight decision `" + d.id + "`: " + o.label,
      "",
      "The question was: " + d.question,
      "",
      o.brief || "",
      "",
      "Follow the `run-preflight` skill's \"Acting on a decision\" steps.",
    ].join("\n");
    send("Preflight: " + o.label, brief).then(function () {
      s.decided[d.id] = o.label;
      save("decided", s.decided);
      setStatus("Sent your decision to Nayo.");
      render();
    }, function (e) { setStatus(errorText(e), true); render(); });
  }

  // ---------- Loading results ----------
  function loadResults() {
    if (DEMO) return Promise.resolve(/[?&]state=(empty|running)\b/.test(location.search) ? null : SAMPLE);
    if (!s.canRead) return Promise.resolve(null);
    return A.files.read("results.json").then(function (text) {
      if (!text) return null;
      var r = typeof text === "string" ? JSON.parse(text) : text;
      return r && (r.version === 1 || r.version === 2) && Array.isArray(r.findings) ? r : null;
    }).catch(function (e) { readFailed("results.json", e); return null; });
  }
  function loadProgress() {
    if (DEMO) { s.progress = /[?&]state=running\b/.test(location.search) ? demoProgress() : null; return Promise.resolve(); }
    if (!s.canRead || !lastRun()) return Promise.resolve(null);
    return A.files.read("progress.json").then(function (text) {
      var p = text ? (typeof text === "string" ? JSON.parse(text) : text) : null;
      s.progress = p && p.version === 1 ? p : null;
      var pg = live();
      if (!pg) return null;
      var ids = pg.checks.filter(function (k) { return k.state === "running"; }).map(function (k) { return k.id; });
      return Promise.all(ids.map(function (id) {
        return A.files.read("progress/" + id + ".json").then(function (t) {
          s.steps[id] = t ? (typeof t === "string" ? JSON.parse(t) : t) : null;
        }, function () { s.steps[id] = null; });
      }));
    }).catch(function (e) { readFailed("progress.json", e); s.progress = null; });
  }
  // A read that fails is shown, not hidden, so a wrong setup can be seen and fixed.
  function readFailed(file, e) {
    var m = (e && (e.message || e)) + "";
    s.readError = file + ": " + (m && m !== "undefined" ? m : "unknown error");
    try { console.warn("[Preflight] couldn't read " + file, e); } catch (x) { /* no console */ }
  }
  var last = "";
  function refresh() {
    s.readError = "";
    return Promise.all([loadResults(), lastRun() && !lastRun().done ? loadProgress() : null]).then(function (both) {
      var r = both[0];
      var key = r ? (r.finished_at || "") + ":" + JSON.stringify(r).length : "";
      s.results = r;
      if (r && key !== last) {
        // New results: forget fix and decision marks for findings that are gone or fixed.
        var ids = {};
        r.findings.forEach(function (f) { if (f.state !== "fixed") ids[f.id] = 1; });
        Object.keys(s.fixes).forEach(function (id) { if (!ids[id]) delete s.fixes[id]; });
        var dec = {};
        (r.decisions || []).forEach(function (d) { dec[d.id] = 1; });
        Object.keys(s.decided).forEach(function (id) { if (!dec[id]) delete s.decided[id]; });
        if (last) { save("fixes", s.fixes); save("decided", s.decided); }
        last = key;
      }
      if (s.filter && !R.check(s.filter)) s.filter = null;
      render();
      if (s.readError) setStatus("Preflight couldn't read its reports in this project (" + s.readError + ").", true);
      else if ($("status").classList.contains("bad") && /couldn't read its reports/.test($("status").textContent)) setStatus("");
    }).catch(function (e) {
      setStatus("Preflight hit a problem showing this run: " + ((e && e.message) || e) + ".", true);
      try { console.error("[Preflight]", e); } catch (x) { /* no console */ }
    });
  }

  // ---------- Wiring ----------
  $("run").addEventListener("click", run);
  $("stop").addEventListener("click", function (e) { stopRun(e.currentTarget); });
  $("choose").addEventListener("click", function () { s.picker = !s.picker; render(); });
  $("toggleAll").addEventListener("click", function () {
    s.picked = s.picked.length === ALL.length ? [] : ALL.slice();
    save("picked", s.picked);
    render();
  });
  $("finish").addEventListener("click", function () {
    if (!lastRun()) return;
    s.runs[0].done = true;
    save("runs", s.runs);
    setStatus("");
    render();
  });
  $("moreDecisions").addEventListener("click", function () { s.moreDecisions = !s.moreDecisions; render(); });
  ["findings", "plan", "about"].forEach(function (v, i, all) {
    var b = $("tab-" + v);
    b.addEventListener("click", function () { s.view = v; render(); });
    b.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var next = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
      s.view = next;
      render();
      $("tab-" + next).focus();
    });
  });
  (function () {
    var b = $("run"), i = icon("send"), slot = b.querySelector("[data-icon]");
    if (i && slot) slot.replaceWith(i);
  })();
  setInterval(function () { if (lastRun() && !lastRun().done && !document.hidden) render(); }, 30000);

  function boot() {
    s.canRead = !!(A && A.files && typeof A.files.read === "function");
    var loads = [];
    if (A && typeof A.context === "function") {
      loads.push(A.context().then(function (c) { if (c && c.project && c.project.name) s.project = c.project.name; }, function () {}));
    } else if (DEMO) {
      s.project = "Ghar";
    }
    if (store) {
      loads.push(load("picked").then(function (v) { if (Array.isArray(v)) s.picked = v.filter(function (x) { return ALL.indexOf(x) !== -1; }); }, function () {}));
      loads.push(load("runs").then(function (v) { if (Array.isArray(v)) s.runs = v; }, function () {}));
      loads.push(load("fixes").then(function (v) { if (v && typeof v === "object" && !Array.isArray(v)) s.fixes = v; }, function () {}));
      loads.push(load("decided").then(function (v) { if (v && typeof v === "object" && !Array.isArray(v)) s.decided = v; }, function () {}));
    }
    if (DEMO && /[?&]state=running\b/.test(location.search)) {
      s.runs = [{ id: "run-demo", at: new Date(Date.now() - 7 * 60000).toISOString(), checks: ALL.slice() }];
      s.steps = { reliability: { run_id: "run-demo", steps: ["Listing outside services", "Checking timeouts and retries", "Looking for error pages", "Checking logs and alerts"], step: 1 },
        code: { run_id: "run-demo", steps: ["Measuring the longest functions", "Looking for type checks switched off", "Finding unused files"], step: 1 } };
    }
    render();
    Promise.all(loads).then(refresh).then(function () {
      if (!s.canRead) return;
      // Araniko pushes files.changed when Nayo writes the report; poll as a fallback.
      if (typeof A.on === "function") {
        try { A.on("files.changed", function () { refresh(); }); } catch (e) { /* older Araniko */ }
      }
      setInterval(function () { if (!document.hidden && running()) refresh(); }, POLL_MS);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
    });
  }

  function demoProgress() {
    var t0 = Date.now() - 7 * 60000, at = function (m) { return new Date(t0 + m * 60000).toISOString(); };
    var done = function (id, w, s0, e, status, summary, score, b, r, found) {
      return { id: id, state: "done", worker: w, started_at: at(s0), finished_at: at(e), status: status, summary: summary, score: score, blocking: b, review: r, found: found };
    };
    return {
      version: 1, run_id: "run-demo", state: "running", started_at: at(0), updated_at: at(7), workers: 3,
      checks: [
        done("security", "Worker 1", 0, 6, "review", "1 to review", 92, 0, 1, [{ level: "review", title: "Login has no limit on attempts" }]),
        done("database", "Worker 2", 0, 5, "blocked", "1 blocking", 75, 1, 0, [{ level: "blocking", title: "Anyone signed in can read every household" }]),
        { id: "bugs", state: "running", worker: "Worker 3", started_at: at(0) },
        { id: "tests", state: "done", worker: "Worker 2", started_at: at(5), finished_at: at(7), status: "review", summary: "1 to review", score: 92, blocking: 0, review: 1, found: [{ level: "review", title: "Every push deploys without running tests" }] },
        { id: "reliability", state: "running", worker: "Worker 1", started_at: at(6) },
        { id: "code", state: "running", worker: "Worker 2", started_at: at(7) },
        { id: "ux", state: "waiting" }, { id: "accessibility", state: "waiting" }, { id: "speed", state: "waiting" }, { id: "launch-basics", state: "waiting" },
      ],
      log: [
        { at: at(0), text: "Got the brief: 10 checks, for the public, thorough" },
        { at: at(0), text: "Security, Database and Bugs started" },
        { at: at(5), text: "Database finished: 1 blocking" },
        { at: at(5), text: "Tests started on Worker 2" },
        { at: at(6), text: "Security finished: 1 to review" },
        { at: at(6), text: "Reliability started on Worker 1" },
        { at: at(7), text: "Tests finished: 1 to review" },
        { at: at(7), text: "Code quality started on Worker 2" },
      ],
    };
  }

  // Made-up results for a plain browser, so the screen can be looked at outside Araniko.
  var SAMPLE = {
    version: 2,
    started_at: "2026-11-27T14:14:00+11:00",
    finished_at: "2026-11-27T14:41:00+11:00",
    settings: { audience: "The public", depth: "Thorough" },
    verdict: "blocked",
    headline: "Launch blocked",
    summary: "Fix the 2 blocking issues before opening the app to the public.",
    score: 71,
    checks: [
      { id: "security", status: "blocked", summary: "1 blocking, 1 to review", score: 67 },
      { id: "database", status: "blocked", summary: "1 blocking", score: 75 },
      { id: "bugs", status: "cleared", summary: "9 of 9 flows checked", score: 100 },
      { id: "tests", status: "review", summary: "1 to review", score: 92 },
      { id: "code", status: "review", summary: "1 to review", score: 92 },
      { id: "ux", status: "could-not-check", summary: "The app can't run here" },
      { id: "accessibility", status: "review", summary: "1 to review", score: 92 },
      { id: "launch-basics", status: "review", summary: "1 to review", score: 92 },
    ],
    findings: [
      { id: "security-1", check: "security", level: "blocking", title: "Payment secret key is sent to the browser", detail: "Anyone could read it from the app and charge cards.", fix: "Move the charge call into a server route and read the key from the server's environment only.", where: "src/lib/pay.ts:12", confidence: "sure", effort: "S", state: "open" },
      { id: "database-1", check: "database", level: "blocking", title: "Anyone signed in can read every household", detail: "Row rules are off on households, expenses and members.", fix: "Turn row rules on for the three tables and limit rows to members of the household.", where: "supabase/migrations/20261101_init.sql", confidence: "sure", effort: "M", state: "open" },
      { id: "security-2", check: "security", level: "review", title: "Login has no limit on attempts", detail: "Passwords can be guessed without slowing down.", fix: "Limit sign-in attempts per email and per address.", where: "src/app/api/auth/route.ts:40", confidence: "sure", effort: "S", state: "open" },
      { id: "tests-1", check: "tests", level: "review", title: "Every push deploys without running tests", detail: "A change that breaks the money maths can go live as long as it builds.", fix: "Run lint, typecheck and tests in CI and block the deploy when they fail.", where: "package.json:12", confidence: "sure", effort: "S", state: "open" },
      { id: "accessibility-1", check: "accessibility", level: "review", title: "Grey text is too faint on dark cards", detail: "4 screens fall below the readable contrast level.", fix: "Use the normal muted text colour instead of lowering its opacity.", where: "Home, Expenses, Settle up, Settings", confidence: "sure", effort: "S", state: "open" },
      { id: "code-1", check: "code", level: "review", title: "27 old TODO comments and 3 debug logs", detail: "Mostly in the expense editor and billing.", fix: "Remove the debug logs and turn the TODOs that matter into tasks.", where: "src/features/expenses/", confidence: "sure", effort: "M", state: "open" },
      { id: "launch-basics-1", check: "launch-basics", level: "review", title: "Public pages have no description or share image", detail: "Links shared in chat apps show a bare title.", fix: "Add a description and a share image to the root metadata.", where: "src/app/layout.tsx:12", confidence: "sure", effort: "S", state: "open" },
    ],
    decisions: [
      { id: "public", question: "Is Ghar really open to the public?", detail: "Anyone can create an account, but the app has no sign-up screen. The data rules finding only matters if strangers can get in.", findings: ["database-1"],
        options: [
          { label: "Open it to the public properly", brief: "Add a sign-up screen, then fix the blocking findings for public use." },
          { label: "Keep it private, turn sign-ups off", brief: "Turn hosted sign-ups off and note it in the README." },
        ] },
      { id: "backups", question: "Backups", detail: "Daily backups cost money on the hosting plan.", findings: [], options: [] },
    ],
    quick_wins: ["tests-1", "security-2", "accessibility-1", "launch-basics-1"],
    order: [
      { title: "Safety net first", text: "Run tests before every deploy.", findings: ["tests-1"] },
      { title: "The 2 blocking issues", text: "The payment key first, then the data rules once you've decided who can sign up.", findings: ["security-1", "database-1"] },
      { title: "The rest", text: "By check: security, then accessibility and code.", findings: [] },
    ],
    patterns: [
      { title: "Built for a few known users", text: "Sign-up, limits and data rules assume everyone is trusted." },
    ],
    not_now: ["The TODO comments: clean them up as you touch those files."],
    strengths: ["The money maths is careful, with exact decimals and good tests.", "Every outside call has a timeout."],
    limits: ["Nothing was run in a browser, so UI and accessibility were judged from the code."],
    notes: ["This is sample data, shown because Preflight is open outside Araniko."],
  };

  boot();
})();
