/*
 * Lesson Lab — app shell.
 * Home (level → lesson), lesson player (scenes, rail, timer), teacher view,
 * edit mode (inline + panel, undo, backup), settings (GitHub sync), keyboard map.
 *
 * The lesson on screen is always: newest base file + the teacher's overrides.
 * Edits never touch the base; they are recorded as overrides (js/overrides.js).
 */
(function () {
  "use strict";

  var LL = window.LL;
  var h = LL.ui.h;
  var root = document.getElementById("app");

  var S = {
    route: { view: "home" },
    lessonId: null,
    lesson: null, // working copy = base + overrides
    derived: null, // the overrides doc `lesson` was built from
    valid: null, // result of LL.validateLesson
    stage: 0,
    editing: false,
    teacher: false,
    help: false,
    timers: {},
    undo: [],
    lastKey: null,
    lastTime: 0,
    sceneHandle: null,
    prefs: LL.store.prefs()
  };

  var el = {}; // live references into the player DOM

  /* ================= Routing ================= */

  function parseHash() {
    var parts = (location.hash || "").replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    if (parts[0] === "level" && LL.levelById(parts[1])) return { view: "level", level: parts[1] };
    if (parts[0] === "settings") return { view: "settings" };
    if (parts[0] === "lesson" && parts[1]) return { view: "lesson", id: parts[1], stage: Math.max(0, (parseInt(parts[2], 10) || 1) - 1) };
    return { view: "home" };
  }

  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  function route() {
    var r = parseHash();
    if (r.view === "lesson" && S.route.view === "lesson" && S.lessonId === r.id) {
      goTo(r.stage);
      return;
    }
    S.route = r;
    S.help = false;
    if (r.view !== "lesson") {
      stopTicking();
      S.editing = false;
      S.teacher = false;
      S.lessonId = null;
      S.lesson = null;
      S.derived = null;
      if (r.view === "settings") renderSettings();
      else renderHome();
    } else {
      openLesson(r.id, r.stage);
    }
  }

  /* ================= Home ================= */

  function lessonsForLevel(levelId) {
    return Object.keys(LL.lessons)
      .map(function (id) {
        var lesson = LL.store.effectiveLesson(id);
        return { id: id, lesson: lesson, path: LL.lessons[id].path, valid: LL.validateLesson(lesson, LL.lessons[id].path) };
      })
      .filter(function (x) { return x.lesson.level === levelId || x.path.split("/")[0] === levelId; })
      .sort(function (a, b) {
        return String(a.lesson.unit).localeCompare(String(b.lesson.unit), undefined, { numeric: true }) ||
          String(a.lesson.title).localeCompare(String(b.lesson.title));
      });
  }

  function problemsBox() {
    var items = [];
    LL.mechanicErrors.forEach(function (m) {
      items.push(h("li", null, h("b", null, "Mechanic " + m.id + ": "), m.problems.join(" ")));
    });
    LL.loadErrors.forEach(function (e) {
      items.push(h("li", null, h("b", null, "lessons/" + e.path + ": "), e.problems.join(" ")));
    });
    if (!items.length) return null;
    return h("section", { class: "load-errors", role: "alert" }, h("h2", null, "Some files could not be loaded"), h("ul", null, items));
  }

  function renderHome() {
    root.innerHTML = "";
    var r = S.route;
    var screen = h("div", { class: "home" + (r.view === "level" ? " home-level" : "") });
    screen.appendChild(h("div", { class: "home-bg", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i"), h("i")));

    var header = h(
      "header",
      { class: "brand" },
      h("h1", { class: "brand-title" }, h("span", null, "Lesson"), " ", h("span", null, "Lab")),
      h("p", { class: "brand-sub", text: "Cambridge Learning Centre" })
    );
    screen.appendChild(header);
    screen.appendChild(
      h("div", { class: "home-tools" },
        syncPill(),
        h("button", { class: "btn", onclick: function () { go("#/settings"); }, title: "Settings (S)" }, "⚙ Settings")
      )
    );

    if (r.view === "home") {
      var grid = h("nav", { class: "tiles levels", "aria-label": "Levels" });
      LL.levels.forEach(function (lvl, i) {
        var count = lessonsForLevel(lvl.id).length;
        grid.appendChild(
          h(
            "button",
            { class: "tile level-tile lvl-" + i, onclick: function () { go("#/level/" + lvl.id); } },
            h("span", { class: "tile-key", text: i + 1 }),
            h("span", { class: "tile-title", text: lvl.name }),
            h("span", { class: "tile-meta", text: count === 1 ? "1 lesson" : count + " lessons" })
          )
        );
      });
      screen.appendChild(grid);
    } else {
      var level = LL.levelById(r.level);
      var li = LL.levels.indexOf(level);
      screen.appendChild(
        h("div", { class: "crumb" },
          h("button", { class: "back", onclick: function () { go("#/"); }, title: "Back (Esc)" }, "←"),
          h("h2", { class: "crumb-title lvl-text-" + li, text: level.name })
        )
      );
      var list = lessonsForLevel(level.id);
      var tiles = h("nav", { class: "tiles lessons", "aria-label": "Lessons" });
      if (!list.length) tiles.appendChild(h("p", { class: "empty", text: "No lessons at this level yet." }));
      list.forEach(function (x, i) {
        var mins = (x.lesson.stages || []).reduce(function (a, s) { return a + (Number(s.minutes) || 0); }, 0);
        tiles.appendChild(
          h(
            "button",
            { class: "tile lesson-tile lvl-" + li, onclick: function () { go("#/lesson/" + encodeURIComponent(x.id)); } },
            i < 9 ? h("span", { class: "tile-key", text: i + 1 }) : null,
            h("span", { class: "tile-unit", text: "Unit " + x.lesson.unit }),
            h("span", { class: "tile-title", text: x.lesson.title }),
            h("span", { class: "tile-aim", text: x.lesson.mainAim || "" }),
            h("span", { class: "tile-meta" },
              (x.lesson.stages || []).length + " stages · " + mins + " min",
              LL.store.hasEdits(x.id) ? h("em", { class: "badge badge-edit", text: "Has teacher edits" }) : null,
              x.valid.count ? h("em", { class: "badge badge-warn", text: "⚠ " + x.valid.count + (x.valid.count === 1 ? " problem" : " problems") }) : null
            )
          )
        );
      });
      screen.appendChild(tiles);
    }

    var probs = problemsBox();
    if (probs) screen.appendChild(probs);
    screen.appendChild(h("p", { class: "home-hint" }, "Arrow keys to move · Enter to open · ", h("kbd", null, "S"), " settings · ", h("kbd", null, "?"), " for all keys"));
    root.appendChild(screen);
    renderHelp();

    var first = screen.querySelector(".tile");
    if (first) first.focus({ preventScroll: true });
  }

  function moveHomeFocus(dx, dy) {
    var tiles = Array.prototype.slice.call(root.querySelectorAll(".tile"));
    if (!tiles.length) return;
    var i = tiles.indexOf(document.activeElement);
    if (i < 0) return tiles[0].focus();
    if (dy) {
      // Find the nearest tile in the row above/below.
      var r = tiles[i].getBoundingClientRect();
      var best = null, bestD = Infinity;
      tiles.forEach(function (t, j) {
        var q = t.getBoundingClientRect();
        if (dy > 0 ? q.top <= r.top + 4 : q.top >= r.top - 4) return;
        var d = Math.abs(q.top - r.top) * 4 + Math.abs(q.left - r.left);
        if (d < bestD) { bestD = d; best = j; }
      });
      if (best !== null) tiles[best].focus();
    } else {
      tiles[Math.max(0, Math.min(tiles.length - 1, i + dx))].focus();
    }
  }

  /* ================= Lesson player ================= */

  function openLesson(id, stageIndex) {
    stopTicking();
    S.lessonId = id;
    S.derived = LL.clone(LL.store.doc(id));
    S.lesson = LL.store.effectiveLesson(id);
    S.undo = [];
    S.lastKey = null;
    root.innerHTML = "";
    if (!S.lesson) {
      root.appendChild(
        h("div", { class: "fatal" },
          h("h1", null, "Lesson not found"),
          h("p", null, "No lesson has the id “" + id + "”. It may have been removed from lessons/manifest.js."),
          h("button", { class: "btn", onclick: function () { go("#/"); } }, "Back to levels")
        )
      );
      return;
    }
    revalidate();
    var n = (S.lesson.stages || []).length;
    S.stage = Math.max(0, Math.min(stageIndex || 0, Math.max(0, n - 1)));
    buildPlayer();
    renderAll(1);
    startTicking();
    LL.sync.pullOne(id); // newest teacher edits from the repo; onRemoteChange refreshes

  }

  function revalidate() {
    S.valid = LL.validateLesson(S.lesson, LL.lessons[S.lessonId] && LL.lessons[S.lessonId].path);
  }

  function stages() {
    return Array.isArray(S.lesson.stages) ? S.lesson.stages : [];
  }

  function currentStage() {
    return stages()[S.stage];
  }

  function buildPlayer() {
    el.player = h("div", { class: "player" });
    el.rail = h("nav", { class: "rail", "aria-label": "Stages" });
    el.stageWrap = h("main", { class: "stagewrap" });
    el.panel = h("aside", { class: "panel", "aria-label": "Side panel" });
    el.hud = h("div", { class: "hud" });
    el.timer = h("button", { class: "timer", title: "Start / pause (Space) · Reset (X) · Hide (C)", onclick: toggleTimer });
    el.timer.innerHTML =
      '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="t-track" cx="50" cy="50" r="44"/>' +
      '<circle class="t-fill" cx="50" cy="50" r="44" pathLength="100"/></svg><span class="t-text"></span>';
    el.lessonWarn = h("button", { class: "hud-warn", title: "This lesson has problems (open teacher view)", onclick: function () { setTeacher(true); } });
    el.hud.appendChild(el.lessonWarn);
    el.hud.appendChild(syncPill("hud-sync"));
    el.hud.appendChild(el.timer);
    el.hudButtons = h(
      "div",
      { class: "hud-buttons" },
      hudBtn("◷", "Show / hide timer (C)", toggleTimerFold, "b-clock"),
      hudBtn("T", "Teacher view (T)", function () { setTeacher(!S.teacher); }, "b-teacher"),
      hudBtn("✎", "Edit mode (E)", function () { setEditing(!S.editing); }, "b-edit"),
      hudBtn("?", "Keys (?)", function () { setHelp(!S.help); }),
      hudBtn("⌂", "Back to lessons (H)", goLevel)
    );
    el.hud.appendChild(el.hudButtons);
    el.prev = h("button", { class: "edge edge-prev", title: "Previous stage (←)", onclick: function () { step(-1); } }, "‹");
    el.next = h("button", { class: "edge edge-next", title: "Next stage (→)", onclick: function () { step(1); } }, "›");
    el.stageWrap.appendChild(el.prev);
    el.stageWrap.appendChild(el.next);
    el.stageWrap.appendChild(el.hud);
    el.player.appendChild(el.rail);
    el.player.appendChild(el.stageWrap);
    el.player.appendChild(el.panel);
    root.appendChild(el.player);
  }

  function hudBtn(label, title, fn, cls) {
    return h("button", { class: "hud-btn " + (cls || ""), title: title, "aria-label": title, onclick: fn }, label);
  }

  function syncHash() {
    if (S.route.view !== "lesson" || !S.lessonId) return;
    history.replaceState(null, "", "#/lesson/" + encodeURIComponent(S.lessonId) + "/" + (S.stage + 1));
  }

  function renderAll(dir) {
    syncHash();
    applyPlayerClasses();
    renderRail();
    renderScene(dir);
    renderPanel();
    renderTimer();
    renderHelp();
  }

  function applyPlayerClasses() {
    if (!el.player) return;
    el.player.classList.toggle("editing", S.editing);
    el.player.classList.toggle("teacher", S.teacher && !S.editing);
    el.player.classList.toggle("panel-open", S.editing || S.teacher);
    el.player.classList.toggle("rail-folded", !!S.prefs.railFolded);
    el.player.classList.toggle("timer-folded", !!S.prefs.timerFolded);
    el.lessonWarn.hidden = !S.valid.lesson.length;
    el.lessonWarn.textContent = "⚠ Lesson has " + S.valid.lesson.length + (S.valid.lesson.length === 1 ? " problem" : " problems");
  }

  /* ---------- Rail ---------- */

  function renderRail() {
    var list = h("ol", { class: "rail-list" });
    stages().forEach(function (st, i) {
      var bad = S.valid.stages[i] && S.valid.stages[i].length;
      list.appendChild(
        h("li", null,
          h("button", {
            class: "rail-item" + (i === S.stage ? " current" : "") + (i < S.stage ? " done" : "") + (bad ? " invalid" : ""),
            onclick: function () { goTo(i); },
            title: bad ? "This stage has problems" : ""
          },
            h("span", { class: "rail-dot", "aria-hidden": "true" }),
            h("span", { class: "rail-title", text: (st && st.title) || "Untitled" }),
            bad ? h("span", { class: "rail-bad", text: "⚠" }) : null
          )
        )
      );
    });
    el.rail.innerHTML = "";
    el.rail.appendChild(h("div", { class: "rail-head" },
      h("span", { class: "rail-lesson", text: S.lesson.title || "" })
    ));
    el.rail.appendChild(list);
    if (S.editing) {
      el.rail.appendChild(h("button", { class: "rail-add", onclick: function () { addStage(); } }, "+ Add stage"));
    }
    var cur = el.rail.querySelector(".current");
    if (cur) cur.scrollIntoView({ block: "nearest" });
  }

  /* ---------- Scene ---------- */

  var PALETTES = 8;
  var MOTIFS = ["orbs", "rings", "stripes", "dots", "waves"];

  function hash(str) {
    var x = 0;
    for (var i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0;
    return x;
  }

  function renderScene(dir) {
    if (S.sceneHandle && typeof S.sceneHandle.destroy === "function") {
      try { S.sceneHandle.destroy(); } catch (e) { /* ignore */ }
    }
    S.sceneHandle = null;

    var st = currentStage();
    var seed = hash(String((st && st.id) || S.stage));
    var scene = h("section", {
      class: "scene pal-" + (seed % PALETTES) + " motif-" + MOTIFS[(seed >>> 3) % MOTIFS.length] +
        (dir > 0 ? " enter-fwd" : dir < 0 ? " enter-back" : "")
    });
    var bg = h("div", { class: "scene-bg", "aria-hidden": "true" });
    for (var i = 0; i < 6; i++) bg.appendChild(h("i"));
    scene.appendChild(bg);

    var content = h("div", { class: "scene-content" });

    if (!st) {
      errorScene(content, "This lesson has no stages", S.valid.lesson);
    } else {
      var tag = h("div", { class: "scene-tag" });
      bindPath(tag, ["stages", S.stage, "title"], { placeholder: "Stage title" });
      scene.appendChild(tag);

      var problems = S.valid.stages[S.stage] || [];
      var mech = LL.mechanics[st.mechanic];
      if (problems.length || !mech) {
        errorScene(content, "This stage can’t run yet", problems);
      } else {
        try {
          S.sceneHandle = mech.render(content, st.data, renderCtx(st, mech)) || null;
        } catch (e) {
          content.innerHTML = "";
          errorScene(content, "The “" + st.mechanic + "” mechanic crashed", [String(e && e.message ? e.message : e)]);
        }
      }
    }
    scene.appendChild(content);

    var old = el.stageWrap.querySelectorAll(".scene");
    Array.prototype.forEach.call(old, function (o) {
      if (!dir) return o.remove();
      o.classList.add(dir < 0 ? "leave-back" : "leave-fwd");
      setTimeout(function () { o.remove(); }, 600);
    });
    el.stageWrap.insertBefore(scene, el.stageWrap.firstChild);
  }

  function errorScene(content, title, problems) {
    content.appendChild(
      h("div", { class: "scene-error", role: "alert" },
        h("div", { class: "scene-error-icon", text: "⚠" }),
        h("h2", { text: title }),
        h("ul", null, (problems || []).map(function (p) { return h("li", { text: p }); })),
        h("p", { class: "scene-error-hint" }, "Press ", h("kbd", null, "E"), " to fix it in edit mode.")
      )
    );
  }

  function renderCtx(st, mech) {
    var base = ["stages", S.stage, "data"];
    return {
      editing: S.editing,
      teacher: S.teacher,
      stage: st,
      lesson: S.lesson,
      stageIndex: S.stage,
      bind: function (node, key, opts) {
        bindPath(node, base.concat(String(key).split(".").map(function (k) { return /^\d+$/.test(k) ? Number(k) : k; })), opts);
      },
      form: function () {
        return LL.ui.schemaForm(mech.schema, base, editApi);
      },
      set: function (key, value) {
        editApi.set(base.concat(key), value);
      }
    };
  }

  /* Show text from the lesson at `path`; in edit mode make it editable in place. */
  function bindPath(node, path, opts) {
    opts = opts || {};
    var v = LL.getAt(S.lesson, path);
    node.textContent = v == null ? "" : String(v);
    if (!S.editing) return;
    node.classList.add("editable");
    if (opts.placeholder) node.setAttribute("data-placeholder", opts.placeholder);
    node.contentEditable = "plaintext-only";
    if (node.contentEditable !== "plaintext-only") node.contentEditable = "true";
    node.spellcheck = false;
    node.addEventListener("paste", function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData("text");
      if (!opts.multiline) text = text.replace(/\s*\n\s*/g, " ");
      document.execCommand("insertText", false, text);
    });
    node.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !opts.multiline) {
        e.preventDefault();
        node.blur();
      }
    });
    node.addEventListener("input", function () {
      var text = node.innerText.replace(/\n$/, "");
      mutate("set:" + path.join("."), function (l) { LL.setAt(l, path, text); }, { scene: false });
    });
    node.addEventListener("blur", function () {
      renderPanel();
    });
  }

  /* ---------- Navigation ---------- */

  function goTo(i) {
    var n = stages().length;
    if (!n) return;
    i = Math.max(0, Math.min(n - 1, i));
    if (i === S.stage && el.stageWrap.querySelector(".scene")) return;
    var dir = i > S.stage ? 1 : -1;
    pauseTimer();
    S.stage = i;
    syncHash();
    renderRail();
    renderScene(dir);
    renderPanel();
    renderTimer();
  }

  function step(d) {
    var n = stages().length;
    var target = S.stage + d;
    if (target < 0 || target >= n) {
      var sc = el.stageWrap.querySelector(".scene");
      if (sc) {
        sc.classList.remove("bump");
        void sc.offsetWidth;
        sc.classList.add("bump");
      }
      return;
    }
    goTo(target);
  }

  function goLevel() {
    var lvl = S.lesson && LL.levelById(S.lesson.level) ? S.lesson.level : LL.lessons[S.lessonId] ? LL.lessons[S.lessonId].path.split("/")[0] : null;
    go(lvl ? "#/level/" + lvl : "#/");
  }

  /* ================= Timer ================= */

  function timerFor(st) {
    if (!st) return null;
    var key = S.lessonId + "::" + st.id;
    var total = Math.max(0, Number(st.minutes) || 0) * 60000;
    var t = S.timers[key];
    if (!t) t = S.timers[key] = { total: total, remaining: total, running: false, last: 0, touched: false };
    if (!t.touched && !t.running && t.total !== total) t.total = t.remaining = total;
    return t;
  }

  function toggleTimer() {
    var t = timerFor(currentStage());
    if (!t) return;
    t.running = !t.running;
    t.touched = true;
    t.last = Date.now();
    renderTimer();
  }

  function resetTimer() {
    var t = timerFor(currentStage());
    if (!t) return;
    t.running = false;
    t.touched = false;
    t.remaining = t.total;
    renderTimer();
  }

  function pauseTimer() {
    var t = timerFor(currentStage());
    if (t && t.running) {
      tickTimer(t);
      t.running = false;
    }
  }

  function toggleTimerFold() {
    S.prefs.timerFolded = !S.prefs.timerFolded;
    LL.store.setPref("timerFolded", S.prefs.timerFolded);
    applyPlayerClasses();
  }

  function tickTimer(t) {
    var now = Date.now();
    if (t.running) t.remaining -= now - t.last;
    t.last = now;
  }

  function fmt(ms) {
    var s = Math.ceil(Math.abs(ms) / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function renderTimer() {
    if (!el.timer) return;
    var t = timerFor(currentStage());
    if (!t) {
      el.timer.hidden = true;
      return;
    }
    el.timer.hidden = false;
    tickTimer(t);
    var over = t.remaining < 0;
    var frac = t.total ? Math.max(0, t.remaining) / t.total : 0;
    el.timer.classList.toggle("running", t.running);
    el.timer.classList.toggle("over", over);
    el.timer.classList.toggle("low", !over && t.total > 0 && frac <= 0.2);
    el.timer.querySelector(".t-fill").style.strokeDashoffset = String(100 - frac * 100);
    el.timer.querySelector(".t-text").textContent = (over ? "+" : "") + fmt(t.remaining);
  }

  var ticker = null;
  function startTicking() {
    stopTicking();
    ticker = setInterval(renderTimer, 250);
  }
  function stopTicking() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  /* ================= Teacher view / side panel ================= */

  function setTeacher(on) {
    S.teacher = on;
    if (on) S.editing = false;
    renderAll(0);
  }

  function setEditing(on, quiet) {
    if (!S.lesson) return;
    if (on && !LL.store.canEdit()) {
      toast("View only on this device. To edit, add a GitHub token in Settings (S on the home screen).", true);
      return;
    }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    S.editing = on;
    S.lastKey = null;
    renderAll(0);
    if (on && !quiet) toast("Edit mode — changes save to GitHub a few seconds after each edit. Ctrl+Z undoes.");
  }

  function renderPanel() {
    if (!el.panel) return;
    var scroll = el.panel.scrollTop;
    el.panel.innerHTML = "";
    if (S.editing) el.panel.appendChild(editPanel());
    else if (S.teacher) el.panel.appendChild(teacherPanel());
    el.panel.scrollTop = scroll;
  }

  function problemList(title, problems) {
    if (!problems || !problems.length) return null;
    return h("div", { class: "panel-problems", role: "alert" },
      h("b", { text: title }),
      h("ul", null, problems.map(function (p) { return h("li", { text: p }); }))
    );
  }

  function teacherPanel() {
    var st = currentStage() || {};
    var mech = LL.mechanics[st.mechanic];
    var r = st.rationale || {};
    return h("div", { class: "panel-inner teacher-panel" },
      h("p", { class: "panel-kicker", text: "Teacher view · only you should look here" }),
      problemList("Lesson problems", S.valid.lesson),
      problemList("Stage problems", S.valid.stages[S.stage]),
      h("h2", { class: "panel-title", text: st.title || "Untitled stage" }),
      h("p", { class: "panel-meta", text: (st.minutes || "?") + " min · " + (st.mechanic || "no mechanic") }),
      h("dl", { class: "rationale" },
        h("dt", null, "Language it forces"), h("dd", { text: r.language || "— missing —" }),
        h("dt", null, "Students produce"), h("dd", { text: r.output || "— missing —" })
      ),
      st.teacherNotes ? h("section", { class: "notes" }, h("h3", null, "Notes"), h("p", { text: st.teacherNotes })) : null,
      mech ? h("section", { class: "notes" }, h("h3", null, "Keeps everyone speaking"), h("p", { text: mech.speaking })) : null,
      h("section", { class: "notes lesson-aims" },
        h("h3", null, "Lesson aims"),
        h("p", null, h("b", null, "Main: "), S.lesson.mainAim || "—"),
        Array.isArray(S.lesson.subAims) && S.lesson.subAims.length
          ? h("ul", null, S.lesson.subAims.map(function (a) { return h("li", { text: a }); }))
          : null
      )
    );
  }

  /* ================= Edit mode ================= */

  /*
   * Record the working lesson as overrides, then rebuild the working lesson from
   * the stored doc (it may include edits merged in from another device).
   */
  function commit() {
    var doc = LL.store.recordEdit(S.lessonId, LL.clone(S.lesson), S.derived);
    if (!doc) return toast(LL.store.lastError || "Could not save this edit.", true);
    S.derived = LL.clone(doc);
    var stageId = currentStage() && currentStage().id;
    S.lesson = LL.store.effectiveLesson(S.lessonId);
    keepStage(stageId);
    announceConflicts();
  }

  function keepStage(stageId) {
    var i = stages().map(function (x) { return x.id; }).indexOf(stageId);
    if (i !== -1) S.stage = i;
    S.stage = Math.max(0, Math.min(S.stage, stages().length - 1));
  }

  function announceConflicts() {
    var n = LL.store.newConflicts || 0;
    if (!n) return;
    LL.store.newConflicts = 0;
    toast(n + (n === 1 ? " edit clashed" : " edits clashed") + " with another device. The later save was kept; the other is in the backup file’s conflict log.");
  }

  function pushUndo() {
    S.undo.push(JSON.stringify({ lesson: S.lesson, stage: S.stage }));
    if (S.undo.length > 200) S.undo.shift();
  }

  /*
   * Every change goes through here. Consecutive changes to the same field
   * within 2 seconds share one undo step; structural changes (key null) always get their own.
   */
  function mutate(key, fn, opts) {
    opts = opts || {};
    var now = Date.now();
    if (key === null || key !== S.lastKey || now - S.lastTime > 2000) pushUndo();
    S.lastKey = key;
    S.lastTime = now;
    fn(S.lesson);
    commit();
    revalidate();
    applyPlayerClasses();
    renderRail();
    if (opts.scene !== false) renderScene(0);
    if (opts.panel) renderPanel();
    else refreshPanelProblems();
    renderTimer();
  }

  var editApi = {
    lesson: function () { return S.lesson; },
    set: function (path, value) {
      mutate("set:" + path.join("."), function (l) { LL.setAt(l, path, value); });
    },
    update: function (key, fn) {
      mutate(null, fn);
    },
    refresh: function () {
      renderPanel();
    },
    /* Upload / replace a picture; the new path is stored as an override. */
    uploadImage: function (path, current, done) {
      var st = currentStage();
      LL.images.choose({ name: S.lessonId + "-" + (st ? st.id : "lesson"), current: current }, function (newPath) {
        editApi.set(path, newPath);
        done(newPath);
        toast("Picture saved on this device" + (LL.store.canEdit() ? "; uploading to GitHub." : "."));
      });
    }
  };

  function undo() {
    if (!S.undo.length) return toast("Nothing to undo.");
    var snap = JSON.parse(S.undo.pop());
    S.lesson = snap.lesson;
    S.stage = Math.max(0, Math.min(snap.stage, stages().length - 1));
    S.lastKey = null;
    commit();
    revalidate();
    renderAll(0);
    toast("Undone.");
  }

  function newStage() {
    var mech = LL.mechanics["prompt-card"] || LL.mechanics[Object.keys(LL.mechanics)[0]];
    return {
      id: LL.uid("stage"),
      title: "New stage",
      minutes: 5,
      mechanic: mech ? mech.id : "",
      data: mech ? LL.defaultsFor(mech.schema) : {},
      rationale: { language: "", output: "" },
      teacherNotes: ""
    };
  }

  function addStage() {
    var at = stages().length ? S.stage + 1 : 0;
    mutate(null, function (l) {
      if (!Array.isArray(l.stages)) l.stages = [];
      l.stages.splice(at, 0, newStage());
    }, { scene: false });
    S.stage = at;
    renderAll(1);
    toast("Stage added. Fill in its rationale — it is required.");
  }

  function duplicateStage() {
    var st = currentStage();
    if (!st) return;
    var copy = LL.clone(st);
    copy.id = LL.uid("stage");
    copy.title = (st.title || "Stage") + " (copy)";
    mutate(null, function (l) { l.stages.splice(S.stage + 1, 0, copy); }, { scene: false });
    S.stage += 1;
    renderAll(1);
  }

  function deleteStage() {
    var st = currentStage();
    if (!st) return;
    if (stages().length === 1) return toast("A lesson needs at least one stage.", true);
    if (!window.confirm("Delete the stage “" + (st.title || "Untitled") + "”? (You can undo.)")) return;
    mutate(null, function (l) { l.stages.splice(S.stage, 1); }, { scene: false });
    S.stage = Math.min(S.stage, stages().length - 1);
    renderAll(0);
  }

  function moveStage(d) {
    var i = S.stage, j = i + d;
    if (!currentStage() || j < 0 || j >= stages().length) return;
    mutate(null, function (l) {
      var t = l.stages[i];
      l.stages[i] = l.stages[j];
      l.stages[j] = t;
    }, { scene: false });
    S.stage = j;
    renderAll(0);
  }

  function changeMechanic(id) {
    var mech = LL.mechanics[id];
    if (!mech) return;
    mutate(null, function (l) {
      var st = l.stages[S.stage];
      st.mechanic = id;
      st.data = LL.defaultsFor(mech.schema, st.data || {});
    }, { panel: true });
  }

  var STAGE_FIELDS = {
    title: { type: "string", required: true, label: "Stage title" },
    minutes: { type: "number", required: true, label: "Minutes", min: 1 },
    rationale: {
      type: "object",
      label: "Rationale (required)",
      fields: {
        language: { type: "string", required: true, multiline: true, label: "Language it forces" },
        output: { type: "string", required: true, multiline: true, label: "What students produce" }
      }
    },
    teacherNotes: { type: "string", multiline: true, label: "Teacher notes (teacher view only)" }
  };

  var LESSON_FIELDS = {
    title: { type: "string", required: true, label: "Lesson title" },
    unit: { type: "string", required: true, label: "Unit" },
    mainAim: { type: "string", required: true, multiline: true, label: "Main aim" },
    subAims: { type: "list", label: "Sub-aims", itemLabel: "Sub-aim", item: { type: "string" } }
  };

  function editPanel() {
    var st = currentStage();
    var box = h("div", { class: "panel-inner edit-panel" });

    box.appendChild(
      h("div", { class: "edit-bar" },
        h("b", { class: "edit-badge", text: "EDIT MODE" }),
        h("button", { class: "btn", onclick: undo, title: "Undo (Ctrl+Z)" }, "↶ Undo"),
        h("button", { class: "btn btn-primary", onclick: function () { setEditing(false); }, title: "Done (E or Esc)" }, "Done")
      )
    );

    box.appendChild(h("p", { class: "edit-status" }, "GitHub: ", syncPill("edit-sync")));

    el.panelProblems = h("div", { class: "panel-problem-slot" });
    box.appendChild(el.panelProblems);
    refreshPanelProblems();

    if (st) {
      var mechSelect = h("select", { class: "editable-outline", onchange: function () { changeMechanic(mechSelect.value); } });
      Object.keys(LL.mechanics).forEach(function (id) {
        mechSelect.appendChild(h("option", { value: id, text: id }));
      });
      if (!LL.mechanics[st.mechanic]) mechSelect.insertBefore(h("option", { value: st.mechanic || "", text: (st.mechanic || "none") + " (not registered)" }), mechSelect.firstChild);
      mechSelect.value = st.mechanic || "";

      var mech = LL.mechanics[st.mechanic];
      var mechBox = h("div", { class: "mech-editor" });
      if (mech) {
        try {
          mech.editor(mechBox, renderCtx(st, mech));
        } catch (e) {
          mechBox.appendChild(h("p", { class: "panel-problems", text: "This mechanic’s editor crashed: " + e.message }));
        }
      }

      box.appendChild(
        h("section", { class: "edit-section" },
          h("h3", null, "This stage"),
          h("div", { class: "stage-ops" },
            h("button", { class: "btn", onclick: function () { moveStage(-1); }, title: "Alt+↑" }, "↑ Move up"),
            h("button", { class: "btn", onclick: function () { moveStage(1); }, title: "Alt+↓" }, "↓ Move down"),
            h("button", { class: "btn", onclick: duplicateStage }, "Duplicate"),
            h("button", { class: "btn", onclick: addStage, title: "A" }, "+ New after"),
            h("button", { class: "btn btn-danger", onclick: deleteStage, title: "Delete" }, "Delete")
          ),
          LL.ui.schemaForm(STAGE_FIELDS, ["stages", S.stage], editApi),
          h("label", { class: "field" }, h("span", { class: "field-label", text: "Mechanic" }), mechSelect,
            mech ? h("small", { class: "field-help", text: mech.description }) : null),
          h("h4", { class: "sub", text: "Content" }),
          mechBox
        )
      );
    } else {
      box.appendChild(h("section", { class: "edit-section" },
        h("p", null, "This lesson has no stages."),
        h("button", { class: "btn btn-primary", onclick: addStage }, "+ Add first stage")));
    }

    box.appendChild(
      h("section", { class: "edit-section" },
        h("h3", null, "Lesson"),
        h("p", { class: "field-help", text: "Id: " + S.lesson.id + " · Level: " + ((LL.levelById(S.lesson.level) || {}).name || S.lesson.level) }),
        LL.ui.schemaForm(LESSON_FIELDS, [], editApi)
      )
    );

    var fileInput = h("input", { type: "file", accept: ".json,application/json", hidden: true });
    fileInput.addEventListener("change", function () {
      var f = fileInput.files[0];
      if (!f) return;
      LL.store.importBackup(f, function (err, res) {
        if (err) return toast(err, true);
        var msg = "Imported " + res.count + (res.count === 1 ? " lesson." : " lessons.");
        if (res.unknown.length) msg += " Not on this app (kept, hidden): " + res.unknown.join(", ") + ".";
        openLesson(S.lessonId, S.stage);
        setEditing(true, true);
        toast(msg);
      });
    });

    box.appendChild(
      h("section", { class: "edit-section" },
        h("h3", null, "Teacher edits & backup"),
        h("p", { class: "field-help" },
          LL.store.hasEdits(S.lessonId)
            ? "This lesson has teacher edits (kept separately from the lesson file, in data/overrides/" + S.lessonId + ".js)."
            : "This lesson has no teacher edits: it shows the lesson file as written."),
        h("div", { class: "stage-ops" },
          h("button", { class: "btn", onclick: function () {
            var n = LL.store.exportBackup();
            toast(n ? "Backup downloaded (" + n + (n === 1 ? " edited lesson)." : " edited lessons).") : "Backup downloaded (no edits yet).");
          } }, "Export backup"),
          h("button", { class: "btn", onclick: function () { fileInput.click(); } }, "Import backup"),
          h("button", { class: "btn btn-danger", onclick: resetToOriginal, title: "Clears this lesson’s teacher edits" }, "Reset lesson to original")
        ),
        fileInput
      )
    );

    return box;
  }

  function refreshPanelProblems() {
    if (!S.editing || !el.panelProblems) return;
    el.panelProblems.innerHTML = "";
    var a = problemList("Lesson problems", S.valid.lesson);
    var b = problemList("This stage can’t run yet", S.valid.stages[S.stage]);
    if (a) el.panelProblems.appendChild(a);
    if (b) el.panelProblems.appendChild(b);
  }

  function resetToOriginal() {
    if (!window.confirm("Clear all teacher edits to this lesson (on every device, once saved) and go back to the lesson file? Export a backup first if unsure.")) return;
    LL.store.resetLesson(S.lessonId);
    var stage = S.stage;
    openLesson(S.lessonId, stage);
    setEditing(true, true);
    toast("Teacher edits cleared. The lesson shows its file again.");
  }

  /* ================= Sync status ================= */

  function syncPill(extra) {
    var pill = h("span", { class: "sync-pill " + (extra || ""), role: "status" });
    paintPill(pill);
    return pill;
  }

  function paintPill(pill) {
    var st = LL.sync.state.status;
    pill.textContent = LL.sync.label();
    pill.className = pill.className.replace(/\bsync-(saved|saving|offline|error|view-only)\b/g, "").trim() + " sync-" + st;
    pill.title = st === "error" ? LL.sync.state.message : st === "view-only" ? "Add a GitHub token in Settings to edit on this device." : "";
  }

  LL.sync.onStatus(function () {
    Array.prototype.forEach.call(document.querySelectorAll(".sync-pill"), paintPill);
    announceConflicts();
  });

  /* Another device's edits arrived (pull, or merged during a save). */
  LL.sync.onRemoteChange(function (id) {
    announceConflicts();
    if (S.route.view === "level" || S.route.view === "home") return renderHome();
    if (S.route.view !== "lesson" || S.lessonId !== id || !S.lesson) return;
    var stageId = currentStage() && currentStage().id;
    S.derived = LL.clone(LL.store.doc(id));
    S.lesson = LL.store.effectiveLesson(id);
    keepStage(stageId);
    revalidate();
    var active = document.activeElement;
    if (isTyping(active)) {
      // Don't yank the field the teacher is typing in.
      applyPlayerClasses();
      renderRail();
      if (!el.stageWrap.contains(active)) renderScene(0);
      refreshPanelProblems();
    } else {
      renderAll(0);
    }
  });

  /* ================= Settings ================= */

  function renderSettings() {
    root.innerHTML = "";
    var g = LL.store.github();
    var screen = h("div", { class: "home settings" });
    screen.appendChild(h("div", { class: "home-bg", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i"), h("i")));
    screen.appendChild(
      h("div", { class: "crumb" },
        h("button", { class: "back", onclick: function () { go("#/"); }, title: "Back (Esc)" }, "←"),
        h("h2", { class: "crumb-title", text: "Settings" }),
        syncPill()
      )
    );

    var repoIn = h("input", { type: "text", value: g.repo, placeholder: "owner/repo", spellcheck: "false", autocomplete: "off" });
    var branchIn = h("input", { type: "text", value: g.branch, placeholder: "main", spellcheck: "false", autocomplete: "off" });
    var tokenIn = h("input", { type: "password", value: "", placeholder: g.token ? "Saved on this device — paste a new one to replace it" : "github_pat_…", autocomplete: "off", spellcheck: "false" });
    var result = h("p", { class: "settings-result", role: "status" });

    function showResult(msg, ok) {
      result.textContent = msg;
      result.className = "settings-result " + (ok ? "ok" : "bad");
    }

    function save() {
      var repo = repoIn.value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/+$/, "");
      if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo)) return showResult("Repository must look like owner/name, e.g. JavaIT-Teach/lesson-lab.", false);
      var patch = { repo: repo, branch: branchIn.value.trim() || "main" };
      var tok = tokenIn.value.trim();
      if (tok) patch.token = tok;
      var before = LL.store.github();
      LL.store.setGithub(patch);
      showResult("Checking with GitHub…", true);
      LL.sync.testToken().then(function (d) {
        tokenIn.value = "";
        showResult("Connected. This device can save edits to " + d.full_name + ".", true);
        LL.sync.init();
        LL.sync.pullAll();
        LL.sync.flush();
        renderSettingsStatus();
      }, function (e) {
        if (tok) LL.store.setGithub({ token: before.token || null }); // keep the old, working token
        showResult(e.message, false);
      });
    }

    function forget() {
      if (!window.confirm("Remove the GitHub token from this device? It becomes view only. Unsaved edits stay here and save when a token is added again.")) return;
      LL.store.setGithub({ token: null });
      LL.sync.init();
      showResult("Token removed. This device is view only.", true);
      renderSettingsStatus();
    }

    var owner = (g.repo || "JavaIT-Teach/lesson-lab").split("/");
    screen.appendChild(
      h("section", { class: "settings-card" },
        h("h3", null, "Save edits to GitHub"),
        h("p", { class: "settings-lead" },
          LL.store.canEdit()
            ? "This device has a token. Edits save to the repo a few seconds after each change."
            : "This device is view only. Paste a GitHub token once to edit on this device."),
        h("ol", { class: "steps" },
          h("li", null, "On this computer, sign in to GitHub with the account that can change the repo ", h("b", null, g.repo || "owner/repo"), "."),
          h("li", null, "Open ", h("b", null, "github.com/settings/personal-access-tokens/new"),
            " (GitHub → your picture → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token)."),
          h("li", null, "Token name: ", h("b", null, "Lesson Lab – " + (navigator.platform || "this computer")), ". Expiration: up to 1 year. When it expires, edits stop saving and this page tells you."),
          h("li", null, "Resource owner: ", h("b", null, owner[0]), ". (If it is an organisation, an owner may have to approve the token.)"),
          h("li", null, "Repository access: ", h("b", null, "Only select repositories"), " → ", h("b", null, owner[1] || "lesson-lab"), ". Nothing else."),
          h("li", null, "Permissions → Repository permissions → ", h("b", null, "Contents: Read and write"), ". Leave everything else as “No access” (Metadata: Read-only is added automatically)."),
          h("li", null, "Click ", h("b", null, "Generate token"), ", copy it (starts with github_pat_), paste it below, and press ", h("b", null, "Save and test"), ".")
        ),
        h("div", { class: "settings-warn" },
          h("b", null, "The repo is public. "),
          "Everything saved — lesson edits and uploaded pictures — can be seen by anyone. ",
          h("b", null, "Never upload photos of students"), " or personal details. ",
          "The token stays on this device only: it is never saved to the repo or put in backup files. ",
          "Treat it like a password; on a shared computer, press “Forget token” when you finish."
        ),
        h("div", { class: "form settings-form" },
          h("label", { class: "field" }, h("span", { class: "field-label", text: "Repository (owner/name)" }), repoIn),
          h("label", { class: "field" }, h("span", { class: "field-label", text: "Branch" }), branchIn),
          h("label", { class: "field" }, h("span", { class: "field-label", text: "Fine-grained token" }), tokenIn)
        ),
        h("div", { class: "stage-ops" },
          h("button", { class: "btn btn-primary", onclick: save }, "Save and test"),
          g.token ? h("button", { class: "btn btn-danger", onclick: forget }, "Forget token") : null
        ),
        result
      )
    );

    el.settingsStatus = h("section", { class: "settings-card" });
    screen.appendChild(el.settingsStatus);
    renderSettingsStatus();

    var fileInput = h("input", { type: "file", accept: ".json,application/json", hidden: true });
    fileInput.addEventListener("change", function () {
      var f = fileInput.files[0];
      if (!f) return;
      LL.store.importBackup(f, function (err, res) {
        if (err) return toast(err, true);
        var msg = "Imported " + res.count + (res.count === 1 ? " lesson." : " lessons.");
        if (res.unknown.length) msg += " Not on this app (kept, hidden): " + res.unknown.join(", ") + ".";
        if (!LL.store.canEdit()) msg += " View only: they show here but will not save to GitHub until a token is added.";
        toast(msg);
        renderSettingsStatus();
      });
    });
    screen.appendChild(
      h("section", { class: "settings-card" },
        h("h3", null, "Backup"),
        h("p", { class: "field-help" }, "A backup file holds every lesson’s teacher edits and the conflict log. It never contains the token."),
        h("div", { class: "stage-ops" },
          h("button", { class: "btn", onclick: function () {
            var n = LL.store.exportBackup();
            toast("Backup downloaded (" + n + (n === 1 ? " lesson with edits)." : " lessons with edits)."));
          } }, "Export backup"),
          h("button", { class: "btn", onclick: function () { fileInput.click(); } }, "Import backup")
        ),
        fileInput
      )
    );

    root.appendChild(screen);
    renderHelp();
  }

  function renderSettingsStatus() {
    if (!el.settingsStatus || !document.body.contains(el.settingsStatus)) return;
    var pending = LL.sync.pendingCount();
    var conflicts = LL.store.conflicts().length;
    el.settingsStatus.innerHTML = "";
    el.settingsStatus.appendChild(h("h3", null, "Sync"));
    el.settingsStatus.appendChild(h("p", null, syncPill(),
      " ", pending ? pending + (pending === 1 ? " change waiting to be saved." : " changes waiting to be saved.") : "Nothing waiting."));
    el.settingsStatus.appendChild(h("p", { class: "field-help" },
      conflicts + (conflicts === 1 ? " conflict" : " conflicts") + " logged (when two devices changed the same thing, the later save wins; the other value is kept in the backup file)."));
    if (LL.store.canEdit()) {
      el.settingsStatus.appendChild(h("div", { class: "stage-ops" },
        h("button", { class: "btn", onclick: function () { LL.sync.flush().then(renderSettingsStatus); } }, "Save now"),
        h("button", { class: "btn", onclick: function () { LL.sync.pullAll().then(function (ids) { toast(ids.length ? "Loaded newer edits for " + ids.length + " lesson(s)." : "Already up to date."); renderSettingsStatus(); }); } }, "Load latest from GitHub")
      ));
    }
  }

  /* ================= Help & toast ================= */

  var KEYS = [
    ["Lesson", [
      ["→  PageDown", "Next stage"],
      ["←  PageUp", "Previous stage"],
      ["1 – 9", "Jump to stage"],
      ["Home / End", "First / last stage"],
      ["Space", "Start / pause timer"],
      ["X", "Reset timer"],
      ["C", "Hide / show timer"],
      ["R", "Hide / show stage rail"],
      ["T", "Teacher view (notes, rationale)"],
      ["H", "Back to lesson list"]
    ]],
    ["Edit mode", [
      ["E", "Edit mode on / off"],
      ["Ctrl+Z  or  U", "Undo"],
      ["A", "Add a stage after this one"],
      ["Alt+↑ / Alt+↓", "Move this stage"],
      ["Delete", "Delete this stage"],
      ["Esc", "Stop typing / leave edit mode"]
    ]],
    ["Home screen", [
      ["S", "Settings (GitHub sync, backup)"]
    ]],
    ["Anywhere", [
      ["?", "Show / hide keys"],
      ["F", "Full screen"],
      ["Arrows + Enter", "Choose level and lesson"],
      ["Esc  Backspace", "Go back"]
    ]]
  ];

  function setHelp(on) {
    S.help = on;
    renderHelp();
  }

  function renderHelp() {
    var old = document.querySelector(".help");
    if (old) old.remove();
    if (!S.help) return;
    var box = h("div", { class: "help", role: "dialog", "aria-label": "Keyboard keys", onclick: function (e) { if (e.target === box) setHelp(false); } },
      h("div", { class: "help-card" },
        h("h2", null, "Keys"),
        h("div", { class: "help-cols" },
          KEYS.map(function (g) {
            return h("section", null, h("h3", { text: g[0] }),
              h("dl", null, g[1].map(function (k) {
                return [h("dt", null, h("kbd", { text: k[0] })), h("dd", { text: k[1] })];
              })));
          })
        ),
        h("p", { class: "help-foot" }, "Press ", h("kbd", null, "?"), " or ", h("kbd", null, "Esc"), " to close")
      )
    );
    document.body.appendChild(box);
  }

  var toastTimer = null;
  LL.toast = toast;
  function toast(msg, isError) {
    var t = document.querySelector(".toast");
    if (!t) {
      t = h("div", { class: "toast", role: "status" });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.toggle("toast-error", !!isError);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, isError ? 6000 : 2800);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  }

  /* ================= Keyboard ================= */

  function isTyping(t) {
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  document.addEventListener("keydown", function (e) {
    var typing = isTyping(e.target);
    var inLesson = S.route.view === "lesson" && S.lesson;
    var k = e.key;

    // Undo is ours in edit mode, even while typing (keeps one undo history).
    if (inLesson && S.editing && (e.ctrlKey || e.metaKey) && !e.shiftKey && k.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }

    if (k === "Escape") {
      if (typing) return e.target.blur();
      if (S.help) return setHelp(false);
      if (inLesson && S.editing) return setEditing(false);
      if (inLesson && S.teacher) return setTeacher(false);
      if (inLesson) return goLevel();
      if (S.route.view === "level" || S.route.view === "settings") return go("#/");
      return;
    }
    if (typing) return;

    if (inLesson && S.editing && e.altKey && (k === "ArrowUp" || k === "ArrowDown")) {
      e.preventDefault();
      return moveStage(k === "ArrowUp" ? -1 : 1);
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (k === "?" || (k === "/" && e.shiftKey)) { e.preventDefault(); return setHelp(!S.help); }
    if (k === "f" || k === "F") return toggleFullscreen();
    if (S.help) return;

    if (!inLesson) {
      if (k === "ArrowRight") { e.preventDefault(); return moveHomeFocus(1, 0); }
      if (k === "ArrowLeft") { e.preventDefault(); return moveHomeFocus(-1, 0); }
      if (k === "ArrowDown") { e.preventDefault(); return moveHomeFocus(0, 1); }
      if (k === "ArrowUp") { e.preventDefault(); return moveHomeFocus(0, -1); }
      if (S.route.view === "settings") {
        if (k === "Backspace") { e.preventDefault(); go("#/"); }
        return;
      }
      if (k === "Backspace" && S.route.view === "level") { e.preventDefault(); return go("#/"); }
      if (k === "s" || k === "S") return go("#/settings");
      if (/^[1-9]$/.test(k)) {
        var tiles = root.querySelectorAll(".tile");
        var t = tiles[Number(k) - 1];
        if (t) t.click();
      }
      return;
    }

    // Let the current mechanic claim a key first (for in-stage actions).
    if (!S.editing && S.sceneHandle && typeof S.sceneHandle.onKey === "function") {
      try {
        if (S.sceneHandle.onKey(e) === true) { e.preventDefault(); return; }
      } catch (err) { /* a broken mechanic must not break navigation */ }
    }

    switch (k) {
      case "ArrowRight": case "PageDown": e.preventDefault(); return step(1);
      case "ArrowLeft": case "PageUp": e.preventDefault(); return step(-1);
      case "Home": e.preventDefault(); return goTo(0);
      case "End": e.preventDefault(); return goTo(stages().length - 1);
      case " ": e.preventDefault(); return toggleTimer();
      case "x": case "X": return resetTimer();
      case "c": case "C": return toggleTimerFold();
      case "r": case "R":
        S.prefs.railFolded = !S.prefs.railFolded;
        LL.store.setPref("railFolded", S.prefs.railFolded);
        return applyPlayerClasses();
      case "t": case "T": return setTeacher(!S.teacher);
      case "e": case "E": return setEditing(!S.editing);
      case "h": case "H": case "Backspace": e.preventDefault(); return goLevel();
    }
    if (/^[1-9]$/.test(k)) return goTo(Number(k) - 1);
    if (S.editing) {
      if (k === "u" || k === "U") return undo();
      if (k === "a" || k === "A") return addStage();
      if (k === "Delete") return deleteStage();
    }
  });

  /* ================= Boot ================= */

  LL.loadLessons(function () {
    var migrated = LL.store.migrateOldEdits(); // one-off: old full-copy edits → overrides
    LL.store.mergeFileOverrides(); // data/overrides/*.js as loaded with the page
    LL.images.watch();
    LL.images.boot(function () {
      LL.sync.init();
      window.addEventListener("hashchange", route);
      route();
      if (migrated) toast("Earlier edits on this device were converted to teacher edits (overrides).");
      LL.sync.pullAll(); // newest edits from GitHub, if online
    });
  });
})();
