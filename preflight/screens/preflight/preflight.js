// Preflight tab: pick checks, send the run to Nayo, show the results.
// Uses window.araniko (araniko.js, given by Araniko). Opened in a plain browser,
// it shows sample results so the screen can be tried (?state=empty for a first run,
// ?state=running for a run in progress).
(function () {
  "use strict";

  var A = window.araniko || null;
  var DEMO = !A;
  var POLL_MS = 20000;
  var RUN_MAX_MS = 3 * 60 * 60 * 1000;

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
    { id: "launch-basics", name: "Launch basics", hint: "Privacy page, error pages, titles" },
  ];
  var NAMES = {};
  CHECKS.forEach(function (c) { NAMES[c.id] = c.name; });
  var STATUS_WORD = { blocked: "Blocked", review: "Review", cleared: "Cleared", "could-not-check": "Couldn't check" };

  var s = {
    project: "this project",
    picked: CHECKS.map(function (c) { return c.id; }),
    runs: [],          // [{at, checks}] newest first, kept in storage
    fixes: {},         // finding id -> time a fix brief was sent
    results: null,     // results.json, when Araniko lets the screen read it
    canRead: false,    // true when araniko.files.read exists (see docs/results-api.md)
    filter: null,      // a check id, to show only its findings
    sending: false,
  };

  var $ = function (id) { return document.getElementById(id); };
  var store = A && A.storage && typeof A.storage.get === "function" ? A.storage : null;

  // ---------- Small helpers ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(name) {
    var p = window.PREFLIGHT_ICONS && window.PREFLIGHT_ICONS[name];
    if (!p) return null;
    var span = document.createElement("span");
    span.innerHTML = '<svg class="i" viewBox="0 0 24 24" fill="none" aria-hidden="true">' + p + "</svg>";
    return span.firstChild;
  }
  function time(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var today = new Date().toDateString() === d.toDateString();
    var t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return today ? "Today, " + t : d.toLocaleDateString([], { day: "numeric", month: "short" }) + ", " + t;
  }
  function setStatus(text, bad) {
    var n = $("status");
    n.textContent = text || "";
    n.classList.toggle("bad", !!bad);
  }
  function save(key, value) {
    if (store) store.set(key, value).catch(function () {});
  }
  // araniko.storage.get answers {value}; take the value out (null when nothing is kept).
  function load(key) {
    return store.get(key).then(function (r) {
      return r && typeof r === "object" && !Array.isArray(r) && "value" in r ? r.value : r;
    });
  }
  function ago(iso) {
    var m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.floor(m / 60), r = m % 60;
    return h + " h" + (r ? " " + r + " min" : "") + " ago";
  }

  // ---------- State of the latest run ----------
  function lastRun() { return s.runs[0] || null; }
  function running() {
    var r = lastRun();
    if (!r || r.done) return false;
    // Without results to read, the tab can't see a run end: stop showing it after a while.
    if (!s.canRead && !DEMO && Date.now() - new Date(r.at).getTime() > RUN_MAX_MS) return false;
    if (!s.results || !s.results.started_at) return true;
    return new Date(r.at) > new Date(s.results.started_at);
  }
  function openFindings() {
    return ((s.results && s.results.findings) || []).filter(function (f) { return f.state !== "fixed"; });
  }

  // ---------- Header ----------
  function renderHead() {
    var h = $("headline"), p = $("summary"), r = s.results, run = lastRun();
    $("finish").hidden = !running() || s.canRead || DEMO;
    if (running()) {
      h.dataset.verdict = "running";
      h.textContent = "Checking " + run.checks.length + (run.checks.length === 1 ? " thing" : " things");
      p.textContent = "Started " + ago(run.at) + ". " + (s.canRead || DEMO
        ? "Results show here when Nayo is done."
        : "Nayo is working on it and replies in its tab with the verdict.");
    } else if (r) {
      h.dataset.verdict = r.verdict || "none";
      h.textContent = r.headline || "Results";
      p.textContent = r.summary || "";
    } else {
      h.dataset.verdict = "none";
      h.textContent = "Ready when you are";
      p.textContent = "Pick what to check, then press Run. Nayo does the work and Preflight reports back.";
    }
    var n = s.picked.length;
    $("runLabel").textContent = s.sending ? "Sending…" : running() ? "Checks running" : n ? "Run " + n + (n === 1 ? " check" : " checks") : "Pick a check";
    $("run").disabled = s.sending || running() || !n;
  }

  // ---------- Summary cards ----------
  function renderStats() {
    var r = s.results;
    $("stats").hidden = !r;
    if (!r) return;
    var open = openFindings();
    var score = $("score");
    score.textContent = r.score == null ? "–" : String(r.score);
    if (r.score != null) score.appendChild(el("span", "of", " / 100"));
    $("blocking").textContent = String(open.filter(function (f) { return f.level === "blocking"; }).length);
    $("review").textContent = String(open.filter(function (f) { return f.level === "review"; }).length);
    $("lastRun").textContent = time(r.finished_at || r.started_at);
  }

  // ---------- Checks ----------
  function checkResult(id) {
    var list = (s.results && s.results.checks) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function renderChecks() {
    var box = $("checks");
    box.textContent = "";
    var runningIds = running() ? lastRun().checks : [];
    CHECKS.forEach(function (c) {
      var res = checkResult(c.id);
      var isRunning = runningIds.indexOf(c.id) !== -1;
      var row = el("div", "row" + (s.filter === c.id ? " selected" : ""));

      var box2 = document.createElement("input");
      box2.type = "checkbox";
      box2.checked = s.picked.indexOf(c.id) !== -1;
      box2.setAttribute("aria-label", "Include " + c.name);
      box2.disabled = running();
      box2.addEventListener("change", function () {
        s.picked = box2.checked ? s.picked.concat(c.id) : s.picked.filter(function (x) { return x !== c.id; });
        s.picked = CHECKS.map(function (x) { return x.id; }).filter(function (x) { return s.picked.indexOf(x) !== -1; });
        save("picked", s.picked);
        render();
      });

      var main = el("button", "row-main");
      main.type = "button";
      main.setAttribute("aria-pressed", s.filter === c.id ? "true" : "false");
      main.title = res ? "Show only " + c.name + " findings" : c.hint;
      var text = el("span", "row-text");
      text.appendChild(el("span", "row-name", c.name));
      var sub = isRunning ? "Running" : running() ? "Not in this run" : res ? (STATUS_WORD[res.status] || "") + (res.summary ? " · " + res.summary : "") : s.results ? "Not run" : c.hint;
      text.appendChild(el("span", "row-sub", sub));
      main.appendChild(text);
      var score = isRunning ? "…" : res && res.score != null ? String(res.score) : "–";
      main.appendChild(el("span", "row-score" + (isRunning ? " running" : res && res.score != null ? "" : " none"), score));
      main.addEventListener("click", function () {
        if (!res) { box2.click(); return; }
        s.filter = s.filter === c.id ? null : c.id;
        render();
      });

      row.appendChild(box2);
      row.appendChild(main);
      box.appendChild(row);
    });
    var all = s.picked.length === CHECKS.length;
    $("toggleAll").textContent = all ? "Clear all" : "Pick all";
  }

  // ---------- Findings ----------
  function renderFindings() {
    var box = $("findings");
    box.textContent = "";
    $("findingsTitle").textContent = s.filter ? NAMES[s.filter] + " findings" : "Findings";
    $("showAll").hidden = !s.filter;

    if (!s.results) {
      var e = el("div", "empty");
      if (running()) {
        e.appendChild(el("strong", null, "Checks are running"));
        e.appendChild(document.createTextNode(s.canRead || DEMO
          ? "Findings show up here as soon as Nayo finishes."
          : "A full check can take a while. Nayo replies in its tab with the verdict, and the full report is saved in "));
        if (!s.canRead && !DEMO) { e.appendChild(el("code", null, ".araniko/plugins/preflight/report.md")); e.appendChild(document.createTextNode(".")); }
      } else if (!s.canRead && !DEMO && lastRun()) {
        e.appendChild(el("strong", null, "Results are with Nayo"));
        e.appendChild(document.createTextNode("This version of Araniko can't show reports inside the tab yet. Read Nayo's reply, or open "));
        e.appendChild(el("code", null, ".araniko/plugins/preflight/report.md"));
        e.appendChild(document.createTextNode("."));
      } else {
        e.appendChild(el("strong", null, "No findings yet"));
        e.appendChild(document.createTextNode("Run Preflight and every problem it finds shows up here, with the file it's in and a button to fix it."));
      }
      box.appendChild(e);
      return;
    }

    var list = (s.results.findings || []).filter(function (f) { return !s.filter || f.check === s.filter; });
    var groups = [
      { key: "blocking", title: "Blocking launch", items: list.filter(function (f) { return f.state !== "fixed" && f.level === "blocking"; }) },
      { key: "review", title: "Review before launch", items: list.filter(function (f) { return f.state !== "fixed" && f.level !== "blocking"; }) },
      { key: "fixed", title: "Fixed", items: list.filter(function (f) { return f.state === "fixed"; }) },
    ];
    var any = false;
    groups.forEach(function (g) {
      if (!g.items.length) return;
      any = true;
      box.appendChild(el("h3", "group " + g.key, g.title));
      g.items.forEach(function (f) { box.appendChild(finding(f)); });
    });
    if (!any) {
      var e2 = el("div", "empty");
      e2.appendChild(el("strong", null, s.filter ? "Nothing found here" : "Nothing found"));
      e2.appendChild(document.createTextNode(s.filter ? "This check passed, or hasn't run." : "Every check that ran passed."));
      box.appendChild(e2);
    }
  }
  function finding(f) {
    var row = el("div", "finding");
    var main = el("div", "f-main");
    main.appendChild(el("div", "f-title", f.title));
    if (f.detail) main.appendChild(el("div", "f-detail", f.detail));
    if (f.fix) main.appendChild(el("div", "f-detail", "Fix: " + f.fix));
    if (f.where) main.appendChild(el("div", "f-where", f.where));
    var meta = s.filter ? [] : [NAMES[f.check] || f.check];
    if (f.effort === "S") meta.push("Quick fix");
    if (f.confidence === "likely") meta.push("Likely, not proven");
    if (f.note) meta.push(f.note);
    if (meta.length) main.appendChild(el("div", "f-check", meta.join(" · ")));
    row.appendChild(main);
    if (f.state !== "fixed") {
      var sent = !!s.fixes[f.id];
      var b = el("button", "ghost" + (sent ? " sent" : ""), sent ? "Sent to Nayo" : "Fix this");
      b.type = "button";
      b.disabled = sent;
      b.addEventListener("click", function () { fix(f, b); });
      row.appendChild(b);
    }
    return row;
  }

  function render() {
    renderHead();
    renderStats();
    renderChecks();
    renderFindings();
  }

  // ---------- Sending to Nayo ----------
  function errorText(e) {
    var m = (e && (e.message || e)) + "";
    if (/hour|limit/i.test(m)) return "Nayo has had 10 briefs from Preflight this hour. Try again a bit later.";
    return m || "That didn't reach Nayo. Try again.";
  }

  function run() {
    if (s.sending || !s.picked.length) return;
    if (DEMO) { setStatus("Open Preflight in Araniko to run it."); return; }
    s.sending = true;
    setStatus("");
    render();
    var picked = s.picked.slice();
    var settings = Promise.resolve(typeof A.settings === "function" ? A.settings() : {}).catch(function () { return {}; });
    settings.then(function (set) {
      set = set || {};
      var names = picked.map(function (id) { return NAMES[id] + " (`" + id + "`)"; });
      var brief = [
        "Run Preflight on this project with the `run-preflight` skill.",
        "",
        "Checks to run: " + names.join(", ") + ".",
        "Settings: audience is \"" + (set.audience || "The public") + "\", depth is \"" + (set.depth || "Thorough") + "\".",
        "",
        "Give each check its own worker, as the skill says. Report only: don't fix anything.",
        "When every check is done, write .araniko/plugins/preflight/results.json and report.md, then reply with the verdict.",
      ].join("\n");
      return A.sendBrief({ title: "Preflight: check " + picked.length + (picked.length === 1 ? " thing" : " things") + " before launch", brief: brief });
    }).then(function () {
      s.runs = [{ at: new Date().toISOString(), checks: picked }].concat(s.runs).slice(0, 10);
      save("runs", s.runs);
      setStatus("Sent to Nayo.");
      if (typeof A.toast === "function") A.toast("Preflight sent to Nayo");
    }, function (e) {
      setStatus(errorText(e), true);
    }).then(function () {
      s.sending = false;
      render();
    });
  }

  function fix(f, button) {
    if (s.fixes[f.id]) return;
    if (DEMO) { setStatus("Open Preflight in Araniko to send fixes."); return; }
    button.disabled = true;
    button.textContent = "Sending…";
    var title = ("Preflight: fix " + f.title).slice(0, 90);
    var brief = [
      "Fix Preflight finding `" + f.id + "` with the `run-preflight` skill.",
      "",
      "What's wrong: " + f.title,
      f.detail ? "Why it matters: " + f.detail : "",
      f.where ? "Where: " + f.where : "",
      f.fix ? "Suggested fix: " + f.fix : "",
      "",
      "Fix only this one thing, run the project's checks, then update results.json as the skill says.",
    ].filter(function (x, i, a) { return x || (a[i - 1] && a[i - 1] !== ""); }).join("\n");
    A.sendBrief({ title: title, brief: brief }).then(function () {
      s.fixes[f.id] = new Date().toISOString();
      save("fixes", s.fixes);
      setStatus("Sent the fix to Nayo.");
      render();
    }, function (e) {
      setStatus(errorText(e), true);
      button.disabled = false;
      button.textContent = "Fix this";
    });
  }

  // ---------- Reading results ----------
  // Araniko doesn't let a screen read project files yet. docs/results-api.md proposes
  // araniko.files.read(name), limited to .araniko/plugins/<plugin>/. Until it exists the
  // tab launches runs and points to the report; when it does, results show up here.
  function loadResults() {
    if (DEMO) return Promise.resolve(/[?&]state=(empty|running)\b/.test(location.search) ? null : SAMPLE);
    if (!s.canRead) return Promise.resolve(null);
    return A.files.read("results.json").then(function (text) {
      if (!text) return null;
      var r = typeof text === "string" ? JSON.parse(text) : text;
      return r && r.version === 1 ? r : null;
    }).catch(function () { return null; });
  }
  function refresh() {
    return loadResults().then(function (r) {
      s.results = r;
      if (s.filter && !checkResult(s.filter)) s.filter = null;
      render();
    });
  }

  // ---------- Wiring ----------
  $("run").addEventListener("click", run);
  $("toggleAll").addEventListener("click", function () {
    s.picked = s.picked.length === CHECKS.length ? [] : CHECKS.map(function (c) { return c.id; });
    save("picked", s.picked);
    render();
  });
  $("showAll").addEventListener("click", function () { s.filter = null; render(); });
  $("finish").addEventListener("click", function () {
    if (!lastRun()) return;
    s.runs[0].done = true;
    save("runs", s.runs);
    setStatus("");
    render();
  });
  // Keeps "Started 12 min ago" fresh while a run is going.
  setInterval(function () { if (lastRun() && !lastRun().done && !document.hidden) render(); }, 30000);
  (function () {
    var b = $("run"), i = icon("send"), slot = b.querySelector("[data-icon]");
    if (i && slot) slot.replaceWith(i);
  })();

  function boot() {
    s.canRead = !!(A && A.files && typeof A.files.read === "function");
    var loads = [];
    if (A && typeof A.context === "function") {
      loads.push(A.context().then(function (c) {
        if (c && c.project && c.project.name) s.project = c.project.name;
      }, function () {}));
    }
    if (store) {
      loads.push(load("picked").then(function (v) { if (Array.isArray(v)) s.picked = v; }, function () {}));
      loads.push(load("runs").then(function (v) { if (Array.isArray(v)) s.runs = v; }, function () {}));
      loads.push(load("fixes").then(function (v) { if (v && typeof v === "object" && !Array.isArray(v)) s.fixes = v; }, function () {}));
    }
    if (DEMO && /[?&]state=running\b/.test(location.search)) {
      s.runs = [{ at: new Date(Date.now() - 12 * 60000).toISOString(), checks: s.picked.slice(0, 6) }];
    }
    render();
    Promise.all(loads).then(refresh);
    if (s.canRead) {
      setInterval(function () { if (running() && !document.hidden) refresh(); }, POLL_MS);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
    }
  }

  // Sample results for a plain browser, so the screen can be looked at outside Araniko.
  var SAMPLE = {
    version: 1,
    started_at: "2026-11-27T14:14:00+11:00",
    finished_at: "2026-11-27T14:41:00+11:00",
    verdict: "blocked",
    headline: "Launch blocked",
    summary: "Fix the 3 critical issues before continuing.",
    score: 80,
    checks: [
      { id: "security", status: "blocked", summary: "2 critical, 1 to review", score: 42 },
      { id: "database", status: "blocked", summary: "Anyone can read 3 tables", score: 75 },
      { id: "bugs", status: "cleared", summary: "9 of 9 flows checked", score: 100 },
      { id: "code", status: "review", summary: "Old TODOs and debug logs", score: 92 },
      { id: "ux", status: "could-not-check", summary: "The app can't run here" },
      { id: "accessibility", status: "review", summary: "Low contrast on 4 screens", score: 92 },
    ],
    findings: [
      { id: "security-1", check: "security", level: "blocking", title: "Payment secret key is sent to the browser", detail: "Anyone could read it from the app and charge cards.", fix: "Move the charge call into a server route and read the key from the server's environment only.", where: "src/lib/pay.ts:12", confidence: "sure", effort: "S", state: "open" },
      { id: "security-2", check: "security", level: "blocking", title: "Login has no limit on attempts", detail: "Passwords can be guessed without slowing down.", where: "src/app/api/auth/route.ts:40", confidence: "sure", state: "open" },
      { id: "database-1", check: "database", level: "blocking", title: "Anyone signed in can read every household", detail: "Row rules are off on households, expenses and members.", where: "supabase/migrations/20261101_init.sql", confidence: "sure", state: "open" },
      { id: "accessibility-1", check: "accessibility", level: "review", title: "Grey text is too faint on dark cards", detail: "4 screens fall below the readable contrast level.", where: "Home, Expenses, Settle up, Settings", confidence: "sure", state: "open" },
      { id: "code-1", check: "code", level: "review", title: "27 old TODO comments and 3 debug logs", detail: "Mostly in the expense editor and billing.", where: "src/features/expenses/", confidence: "sure", state: "open" },
      { id: "security-3", check: "security", level: "review", title: "Two packages have known security holes", detail: "Update next-auth and sharp to their latest versions.", where: "package.json", confidence: "likely", state: "open" },
    ],
  };

  boot();
})();
