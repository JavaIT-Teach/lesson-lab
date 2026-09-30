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
    runtime: {}, // live in-stage state per lesson::stage (ctx.state); memory only, never saved
    lastStage: {}, // lessonId -> index of the stage last shown (lesson menu: "Continue")
    visited: {}, // lessonId -> { stageId: true } stages shown this session
    homeEdit: false, // home screen: E shows the Hide control on lesson tiles
    pop: null, // edit mode: which toolbar popover is open (null = none)
    lastEditable: null, // edit mode: last text field focused (target of the list buttons)
    showHidden: false, // home screen: list hidden lessons (with Unhide)
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
    // #/lesson/<id> = the lesson menu; #/lesson/<id>/<n> = stage n.
    if (parts[0] === "lesson" && parts[1] && !parts[2]) return { view: "menu", id: parts[1] };
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
    if (r.view !== "home" && r.view !== "level") S.homeEdit = false;
    S.route = r;
    S.help = false;
    if (r.view === "menu") {
      renderMenu(r.id);
    } else if (r.view !== "lesson") {
      stopTicking();
      destroyScene();
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
        return { id: id, lesson: lesson, path: LL.lessons[id].path, valid: LL.validateLesson(lesson, LL.lessons[id].path), hidden: lesson.hidden === true };
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
        var count = lessonsForLevel(lvl.id).filter(function (x) { return !x.hidden; }).length;
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
      var all = lessonsForLevel(level.id);
      var list = all.filter(function (x) { return !x.hidden; });
      var hiddenList = all.filter(function (x) { return x.hidden; });
      if (S.homeEdit) {
        screen.appendChild(h("div", { class: "home-edit-bar" },
          h("b", { class: "edit-badge", text: "EDIT" }),
          " Hide takes a lesson off this list on every device. Nothing is deleted: “Show hidden” brings it back. ",
          h("button", { class: "btn", onclick: function () { setHomeEdit(false); } }, "Done (E)")
        ));
      }
      var tiles = h("nav", { class: "tiles lessons" + (S.homeEdit ? " home-editing" : ""), "aria-label": "Lessons" });
      if (!list.length) tiles.appendChild(h("p", { class: "empty", text: hiddenList.length ? "No visible lessons at this level." : "No lessons at this level yet." }));
      list.forEach(function (x, i) {
        var mins = (x.lesson.stages || []).reduce(function (a, s) { return a + (Number(s.minutes) || 0); }, 0);
        var wrap = h("div", { class: "tile-wrap" });
        tiles.appendChild(wrap);
        if (S.homeEdit) {
          wrap.appendChild(h("button", {
            class: "tile-hide", title: "Hide this lesson (reversible)",
            onclick: function () { hideLesson(x.id, true); }
          }, "Hide"));
        }
        wrap.insertBefore(
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
          ),
          wrap.firstChild
        );
      });
      screen.appendChild(tiles);

      // Hidden lessons stay reachable: a small toggle lists them, each with Open and Unhide.
      if (hiddenList.length) {
        var box = h("section", { class: "hidden-box" },
          h("button", { class: "btn hidden-toggle", onclick: function () { S.showHidden = !S.showHidden; renderHome(); } },
            (S.showHidden ? "Hide the hidden list" : "Show hidden") + " (" + hiddenList.length + ")"));
        if (S.showHidden) {
          box.appendChild(h("ul", { class: "hidden-list" }, hiddenList.map(function (x) {
            return h("li", null,
              h("span", { class: "hidden-title", text: "Unit " + x.lesson.unit + " · " + x.lesson.title }),
              x.valid.count ? h("em", { class: "badge badge-warn", text: "⚠ " + x.valid.count }) : null,
              h("button", { class: "btn", onclick: function () { go("#/lesson/" + encodeURIComponent(x.id)); } }, "Open"),
              h("button", { class: "btn btn-primary", onclick: function () { hideLesson(x.id, false); } }, "Unhide")
            );
          })));
        }
        screen.appendChild(box);
      }
    }

    var probs = problemsBox();
    if (probs) screen.appendChild(probs);
    screen.appendChild(h("p", { class: "home-hint" }, "Arrow keys to move · Enter to open · ", h("kbd", null, "S"), " settings · ", h("kbd", null, "E"), " hide lessons · ", h("kbd", null, "?"), " for all keys"));
    root.appendChild(screen);
    renderHelp();

    var first = screen.querySelector(".tile");
    if (first) first.focus({ preventScroll: true });
  }

  /* Home edit (E): shows Hide on lesson tiles. Gated like every other write. */
  function setHomeEdit(on) {
    if (on && !LL.store.canEdit()) {
      toast("View only on this device. To hide lessons, add a GitHub token in Settings (S).", true);
      return;
    }
    S.homeEdit = on;
    renderHome();
  }

  function hideLesson(id, on) {
    if (!LL.store.canEdit()) {
      toast("View only on this device. To " + (on ? "hide" : "unhide") + " lessons, add a GitHub token in Settings (S).", true);
      return;
    }
    var lesson = LL.store.effectiveLesson(id);
    if (!LL.store.setHidden(id, on)) return toast(LL.store.lastError || "Could not save this change.", true);
    renderHome();
    toast((on ? "Hidden: " : "Back on the list: ") + ((lesson && lesson.title) || id) + (on ? ". “Show hidden” brings it back." : "."));
  }

  function moveHomeFocus(dx, dy) {
    var tiles = Array.prototype.slice.call(root.querySelectorAll(".tile, .menu-row"));
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

  /* ================= Lesson menu ================= */

  /* Every stage of a lesson, in order. Home → lesson menu → stage. */
  function renderMenu(id, noPull) {
    stopTicking();
    destroyScene();
    S.editing = false;
    S.teacher = false;
    S.lessonId = id;
    S.derived = LL.clone(LL.store.doc(id));
    S.lesson = LL.store.effectiveLesson(id);
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
    var lvl = LL.levelById(S.lesson.level);
    var li = Math.max(0, LL.levels.indexOf(lvl));
    var list = stages();
    var mins = list.reduce(function (a, st) { return a + (Number(st && st.minutes) || 0); }, 0);
    var last = S.lastStage[id];
    var seen = S.visited[id] || {};

    var screen = h("div", { class: "home lesson-menu" });
    screen.appendChild(h("div", { class: "home-bg", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i"), h("i")));
    screen.appendChild(
      h("div", { class: "crumb" },
        h("button", { class: "back", onclick: goLevel, title: "Back to lessons (H)" }, "←"),
        h("div", { class: "menu-head" },
          h("span", { class: "tile-unit", text: (lvl ? lvl.name + " · " : "") + "Unit " + S.lesson.unit }),
          h("h2", { class: "crumb-title lvl-text-" + li, text: S.lesson.title || "Untitled lesson" })
        )
      )
    );
    screen.appendChild(
      h("p", { class: "menu-meta" },
        list.length + (list.length === 1 ? " stage" : " stages") + " · " + mins + " min",
        LL.store.hasEdits(id) ? h("em", { class: "badge badge-edit", text: "Has teacher edits" }) : null,
        S.valid.count ? h("em", { class: "badge badge-warn", text: "⚠ " + S.valid.count + (S.valid.count === 1 ? " problem" : " problems") }) : null
      )
    );

    var ol = h("ol", { class: "menu-list", "aria-label": "Stages" });
    if (!list.length) ol.appendChild(h("li", { class: "empty", text: "This lesson has no stages." }));
    list.forEach(function (st, i) {
      st = st || {};
      var bad = S.valid.stages[i] && S.valid.stages[i].length;
      ol.appendChild(h("li", null,
        h("button", {
          class: "menu-row lvl-" + li + (i === last ? " current" : "") + (seen[st.id] ? " seen" : "") + (bad ? " invalid" : ""),
          style: { animationDelay: Math.min(i * 35, 500) + "ms" },
          onclick: function () { go("#/lesson/" + encodeURIComponent(id) + "/" + (i + 1)); },
          title: bad ? "This stage has problems" : ""
        },
          h("span", { class: "menu-num", text: String(i + 1) }),
          h("span", { class: "menu-title", text: st.title || "Untitled" }),
          st.worksheetLabel ? h("span", { class: "menu-ws", title: "Paired worksheet" }, h("span", { "aria-hidden": "true", text: "📝" }), " ", st.worksheetLabel) : null,
          bad ? h("span", { class: "menu-bad", text: "⚠" }) : null,
          i === last ? h("span", { class: "menu-here", text: "▶ Continue" }) : null,
          h("span", { class: "menu-min", text: (st.minutes || "?") + " min" })
        )
      ));
    });
    screen.appendChild(ol);
    screen.appendChild(h("p", { class: "home-hint" }, "↑ ↓ + Enter or ", h("kbd", null, "1–9"), " open a stage · ", h("kbd", null, "L"), " in a stage comes back here · ", h("kbd", null, "H"), " lesson list · ", h("kbd", null, "?"), " keys"));
    root.appendChild(screen);
    renderHelp();

    var rows = screen.querySelectorAll(".menu-row");
    var target = rows[last !== undefined && rows[last] ? last : 0];
    if (target) target.focus({ preventScroll: false });
    if (!noPull) LL.sync.pullOne(id); // newest teacher edits from the repo; onRemoteChange refreshes
  }

  function openMenu() {
    if (S.lessonId) go("#/lesson/" + encodeURIComponent(S.lessonId));
  }

  /* Remember where the teacher is, for the lesson menu. */
  function markVisited() {
    var st = currentStage();
    if (!S.lessonId || !st) return;
    S.lastStage[S.lessonId] = S.stage;
    (S.visited[S.lessonId] = S.visited[S.lessonId] || {})[st.id] = true;
  }

  function destroyScene() {
    if (S.sceneHandle && typeof S.sceneHandle.destroy === "function") {
      try { S.sceneHandle.destroy(); } catch (e) { /* ignore */ }
    }
    S.sceneHandle = null;
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
      hudBtn("☰", "Lesson menu: all stages (L)", openMenu, "b-menu"),
      hudBtn("⌂", "Back to lessons (H)", goLevel)
    );
    el.hud.appendChild(el.hudButtons);
    el.prev = h("button", { class: "edge edge-prev", title: "Previous stage (←)", onclick: function () { step(-1); } }, "‹");
    el.next = h("button", { class: "edge edge-next", title: "Next stage (→)", onclick: function () { step(1); } }, "›");
    el.stageWrap.appendChild(el.prev);
    el.stageWrap.appendChild(el.next);
    el.stageWrap.appendChild(el.hud);
    // Edit mode: icon toolbar + one popover at a time (replaces the old side panel).
    el.toolbar = h("div", { class: "edit-toolbar", role: "toolbar", "aria-label": "Edit tools", hidden: true });
    el.pop = h("div", { class: "edit-pop", role: "dialog", hidden: true });
    el.stageWrap.appendChild(el.toolbar);
    el.stageWrap.appendChild(el.pop);
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
    markVisited();
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
    el.player.classList.toggle("panel-open", S.teacher && !S.editing);
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
        h("li", { class: S.editing ? "rail-row" : null },
          S.editing ? h("span", { class: "grip rail-grip", title: "Drag to reorder", "aria-hidden": "true", text: "⠿" }) : null,
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
      // Drag to reorder stages: only the order changes; stage ids stay the same.
      LL.ui.sortable(list, { item: "li", handle: ".rail-grip", onDrop: moveStageTo });
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
    destroyScene();

    var st = currentStage();
    var seed = hash(String((st && st.id) || S.stage));
    var scene = h("section", {
      class: "scene pal-" + (seed % PALETTES) + " motif-" + MOTIFS[(seed >>> 3) % MOTIFS.length] +
        (dir > 0 ? " enter-fwd" : dir < 0 ? " enter-back" : "")
    });
    var bg = h("div", { class: "scene-bg", "aria-hidden": "true" });
    for (var i = 0; i < 6; i++) bg.appendChild(h("i"));
    scene.appendChild(bg);
    if (st && Array.isArray(st.decorations) && st.decorations.length) scene.appendChild(decorLayer(st));

    var content = h("div", { class: "scene-content" });

    if (!st) {
      errorScene(content, "This lesson has no stages", S.valid.lesson);
    } else {
      var head = h("div", { class: "scene-head" });
      var tag = h("div", { class: "scene-tag" });
      bindPath(tag, ["stages", S.stage, "title"], { placeholder: "Stage title" });
      head.appendChild(tag);
      // Optional audio cue (metadata only: the app plays no audio). Shown to students and teacher.
      if (st.audioCue || S.editing) {
        var cueText = h("span", { class: "scene-audio-text" });
        bindPath(cueText, ["stages", S.stage, "audioCue"], { placeholder: "Audio cue (optional)" });
        head.appendChild(h("div", { class: "scene-audio", title: "Audio cue" }, audioIcon(), cueText));
      }
      scene.appendChild(head);

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

  /* ---------- Decorations (shapes) ----------
   * Colour is never stored or chosen: shapes use the scene's palette variables
   * (--accent / --accent-ink), which come from the same hash of the stage id as the background.
   */
  function decorLayer(st) {
    var layer = h("div", { class: "scene-decor", "aria-hidden": S.editing ? null : "true" });
    st.decorations.forEach(function (d, j) {
      if (!d || LL.SHAPES.indexOf(d.shape) === -1) return;
      var node = h("div", { class: "deco deco-" + d.shape, "data-id": d.id });
      node.style.left = d.x + "%";
      node.style.top = d.y + "%";
      node.style.setProperty("--deco-size", d.size);
      node.style.animationDelay = -(hash(String(d.id)) % 6000) + "ms";
      node.appendChild(h("div", { class: "deco-fill" }));
      if (d.label || S.editing) {
        var label = h("span", { class: "deco-label" });
        bindPath(label, ["stages", S.stage, "decorations", j, "label"], { placeholder: "Label" });
        node.appendChild(label);
      }
      if (S.editing) {
        node.tabIndex = 0;
        node.setAttribute("title", "Drag to move · corner to resize · ✕ or Delete removes");
        node.appendChild(h("button", { class: "deco-del", type: "button", title: "Remove shape", "aria-label": "Remove shape", onclick: function (e) { e.stopPropagation(); removeDecoration(d.id); } }, "✕"));
        node.appendChild(h("span", { class: "deco-resize", title: "Drag to resize", "aria-hidden": "true" }));
        wireDecoration(node, layer, d);
      }
      layer.appendChild(node);
    });
    return layer;
  }

  function wireDecoration(node, layer, d) {
    node.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || e.target.closest(".deco-del")) return;
      var resizing = !!e.target.closest(".deco-resize");
      var label = node.querySelector(".deco-label");
      if (!resizing && label && e.target === label && document.activeElement === label) return; // typing in the label
      var box = layer.getBoundingClientRect();
      var start = { x: e.clientX, y: e.clientY };
      var moved = false;
      var pos = { x: d.x, y: d.y, size: d.size };
      var vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
      if (resizing) e.preventDefault();
      function move(ev) {
        if (!moved && Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) < 5) return;
        if (!moved) {
          moved = true;
          try { node.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
          window.getSelection().removeAllRanges();
          node.classList.add("moving");
        }
        if (resizing) {
          var r = node.getBoundingClientRect();
          var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          var half = Math.max(Math.abs(ev.clientX - cx), Math.abs(ev.clientY - cy) * (d.shape === "rectangle" ? 1.5 : 1));
          pos.size = Math.round(Math.max(3, Math.min(60, (half * 2) / vmin)) * 2) / 2;
          node.style.setProperty("--deco-size", pos.size);
        } else {
          pos.x = Math.round(Math.max(0, Math.min(100, ((ev.clientX - box.left) / box.width) * 100)) * 10) / 10;
          pos.y = Math.round(Math.max(0, Math.min(100, ((ev.clientY - box.top) / box.height) * 100)) * 10) / 10;
          node.style.left = pos.x + "%";
          node.style.top = pos.y + "%";
        }
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        if (!moved) return;
        node.classList.remove("moving");
        updateDecoration(d.id, resizing ? { size: pos.size } : { x: pos.x, y: pos.y });
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    });
  }

  function decoIndex(l, id) {
    var list = l.stages[S.stage].decorations || [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return i;
    return -1;
  }

  function insertShape(shape) {
    var st = currentStage();
    if (!st) return;
    var n = (st.decorations || []).length;
    var d = { id: LL.uid("shape"), shape: shape, x: 80 - (n % 3) * 9, y: 26 + (n % 3) * 12, size: 14 };
    S.pop = null;
    mutate(null, function (l) {
      var s2 = l.stages[S.stage];
      s2.decorations = (s2.decorations || []).concat(d);
    });
    renderToolbar();
    focusDecoration(d.id);
    toast("Shape added. Drag it to move, drag its corner to resize. Its colour follows this stage.");
  }

  function updateDecoration(id, patch) {
    mutate("deco:" + id + ":" + Object.keys(patch).join(","), function (l) {
      var i = decoIndex(l, id);
      if (i !== -1) Object.keys(patch).forEach(function (k) { l.stages[S.stage].decorations[i][k] = patch[k]; });
    });
    focusDecoration(id);
  }

  function removeDecoration(id) {
    mutate(null, function (l) {
      var s2 = l.stages[S.stage];
      s2.decorations = (s2.decorations || []).filter(function (x) { return x && x.id !== id; });
      if (!s2.decorations.length) delete s2.decorations;
    });
    toast("Shape removed. Ctrl+Z brings it back.");
  }

  function focusDecoration(id) {
    var node = el.stageWrap && el.stageWrap.querySelector('.scene:not(.leave-fwd):not(.leave-back) .deco[data-id="' + id + '"]');
    if (node) node.focus({ preventScroll: true });
  }

  function audioIcon() {
    var i = h("span", { class: "scene-audio-icon", "aria-hidden": "true" });
    i.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
      '<rect x="3" y="13" width="5" height="8" rx="2" fill="currentColor"/><rect x="16" y="13" width="5" height="8" rx="2" fill="currentColor"/></svg>';
    return i;
  }

  /* Live in-stage state for a mechanic (e.g. what is revealed, scores). Survives re-renders
     (teacher view, edits, leaving and coming back); lost on page reload. Never saved. */
  function runtimeState(st) {
    var key = S.lessonId + "::" + st.id;
    return S.runtime[key] || (S.runtime[key] = {});
  }

  function errorScene(content, title, problems) {
    content.appendChild(
      h("div", { class: "scene-error", role: "alert" },
        h("div", { class: "scene-error-icon", text: "⚠" }),
        h("h2", { text: title }),
        h("ul", null, (problems || []).map(function (p) { return h("li", { text: p }); })),
        S.editing
          ? h("p", { class: "scene-error-hint" }, "Fix it from the toolbar above (⚠ lists what is missing).")
          : h("p", { class: "scene-error-hint" }, "Press ", h("kbd", null, "E"), " to fix it in edit mode.")
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
      state: runtimeState(st),
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
    node._llPath = path;
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
    S.pop = null;
    S.lastEditable = null;
    renderAll(0);
    if (on && !quiet) toast("Edit mode — click any text to change it. Tools are the icons at the top. Ctrl+Z undoes.");
  }

  function renderPanel() {
    if (!el.panel) return;
    var scroll = el.panel.scrollTop;
    el.panel.innerHTML = "";
    if (S.teacher && !S.editing) el.panel.appendChild(teacherPanel());
    el.panel.scrollTop = scroll;
    renderToolbar();
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
      st.audioCue ? h("p", { class: "panel-audio" }, audioIcon(), h("span", { text: st.audioCue })) : null,
      st.worksheetLabel ? h("p", { class: "panel-audio" }, h("span", { "aria-hidden": "true", text: "📝" }), h("span", { text: st.worksheetLabel })) : null,
      h("dl", { class: "rationale" },
        h("dt", null, "Language it forces"), h("dd", { text: r.language || "— missing —" }),
        h("dt", null, "Students produce"), h("dd", { text: r.output || "— missing —" })
      ),
      st.teacherNotes ? h("section", { class: "notes" }, h("h3", null, "Notes"), h("p", { text: st.teacherNotes })) : null,
      mech ? h("section", { class: "notes" }, h("h3", null, "Keeps everyone speaking"), h("p", { text: mech.speaking })) : null,
      mech && mech.keys && mech.keys.length
        ? h("section", { class: "notes" }, h("h3", null, "Keys in this stage"),
          h("dl", { class: "stage-keys" }, mech.keys.map(function (k) {
            return [h("dt", null, h("kbd", { text: k[0] })), h("dd", { text: k[1] })];
          })))
        : null,
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

  /* Delete asks first: the toolbar's Delete (or the Delete key) opens a confirm popover. */
  function askDeleteStage() {
    if (!currentStage()) return;
    if (stages().length === 1) return toast("A lesson needs at least one stage.", true);
    S.pop = "delete";
    renderToolbar();
    var yes = el.pop.querySelector(".btn-danger");
    if (yes) yes.focus();
  }

  function deleteStage() {
    var st = currentStage();
    if (!st) return;
    if (stages().length === 1) return toast("A lesson needs at least one stage.", true);
    S.pop = null;
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

  /* Drag-reorder on the rail: array order only, ids unchanged (an "order" override). */
  function moveStageTo(from, to) {
    var cur = currentStage() && currentStage().id;
    mutate(null, function (l) { l.stages.splice(to, 0, l.stages.splice(from, 1)[0]); }, { scene: false });
    keepStage(cur);
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
    audioCue: { type: "string", label: "Audio cue", placeholder: "Listen: Track 3", help: "Optional. Shown as a badge next to the stage title. The app plays no audio." },
    worksheetLabel: { type: "string", label: "Worksheet", placeholder: "Worksheet Part 2", help: "Optional. The paired printed worksheet, if any. Shown with 📝 in the lesson menu and teacher view." },
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

  /* ================= Edit toolbar + popovers ================= */

  var ICON = {
    add: '<path d="M4 6h10v12H4z M18 9v6 M15 12h6"/>',
    trash: '<path d="M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6"/>',
    undo: '<path d="M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3"/>',
    bullets: '<circle cx="5" cy="7" r="1.6" fill="currentColor"/><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="5" cy="17" r="1.6" fill="currentColor"/><path d="M10 7h10 M10 12h10 M10 17h10"/>',
    numbers: '<path d="M4 5h2v5 M4 10h3 M4 14.5a1.5 1.5 0 1 1 2.6 1L4 19h3.2 M10 7h10 M10 12h10 M10 17h10"/>',
    shape: '<circle cx="7.5" cy="8" r="3.5"/><path d="M16.5 4l4 7h-8z"/><rect x="10" y="14" width="10" height="6" rx="1"/>',
    stage: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2 M9 3h6"/>',
    why: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
    notes: '<path d="M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h5"/>',
    content: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    lesson: '<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>',
    warn: '<path d="M12 3l10 18H2z M12 10v5 M12 18v.5"/>',
    done: '<path d="M4 12l5 5L20 6"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    rectangle: '<rect x="3" y="7" width="18" height="11" rx="2"/>',
    triangle: '<path d="M12 4l9 16H3z"/>'
  };

  function icon(name) {
    var span = h("span", { class: "tb-icon", "aria-hidden": "true" });
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON[name] + "</svg>";
    return span;
  }

  function tbBtn(name, label, fn, opts) {
    opts = opts || {};
    var b = h("button", {
      type: "button",
      class: "tb-btn" + (opts.cls ? " " + opts.cls : "") + (opts.pop && S.pop === opts.pop ? " active" : ""),
      title: label,
      "aria-label": label,
      "data-pop": opts.pop || null,
      "aria-expanded": opts.pop ? String(S.pop === opts.pop) : null
    }, icon(name), opts.badge ? h("span", { class: "tb-badge" + (opts.badgeCls ? " " + opts.badgeCls : ""), text: opts.badge }) : null);
    // Text tools must not steal focus from the text being formatted.
    if (opts.keepFocus) b.addEventListener("mousedown", function (e) { e.preventDefault(); });
    b.addEventListener("click", fn);
    return b;
  }

  function togglePop(name) {
    S.pop = S.pop === name ? null : name;
    renderToolbar();
  }

  function closePop() {
    if (!S.pop) return false;
    S.pop = null;
    renderToolbar();
    return true;
  }

  function stageProblemsOf(prefix) {
    return (S.valid.stages[S.stage] || []).filter(function (p) { return p.indexOf(prefix) === 0; });
  }

  function renderToolbar() {
    if (!el.toolbar) return;
    if (!S.editing) {
      el.toolbar.hidden = true;
      el.toolbar.innerHTML = "";
      el.pop.hidden = true;
      el.pop.innerHTML = "";
      return;
    }
    renderToolbarButtons();
    renderPop();
  }

  function renderToolbarButtons() {
    if (!el.toolbar || !S.editing) return;
    var nProblems = S.valid.lesson.length + (S.valid.stages[S.stage] || []).length;
    var whyMissing = stageProblemsOf("Rationale").length > 0;
    var st = currentStage();
    el.toolbar.innerHTML = "";
    el.toolbar.hidden = false;
    el.toolbar.appendChild(h("div", { class: "tb-group" },
      tbBtn("add", "Add a stage after this one (A)", addStage),
      tbBtn("trash", "Delete this stage (Delete) — asks first", askDeleteStage, { pop: "delete", cls: "tb-danger" }),
      tbBtn("undo", "Undo (Ctrl+Z)", undo)
    ));
    el.toolbar.appendChild(h("div", { class: "tb-group" },
      tbBtn("bullets", "Bulleted list: click in a text, then here (Ctrl+Shift+8)", function () { listFormat("bullet"); }, { keepFocus: true }),
      tbBtn("numbers", "Numbered list: click in a text, then here (Ctrl+Shift+7)", function () { listFormat("number"); }, { keepFocus: true })
    ));
    el.toolbar.appendChild(h("div", { class: "tb-group" },
      tbBtn("shape", "Insert a shape", function () { togglePop("shape"); }, { pop: "shape" })
    ));
    el.toolbar.appendChild(h("div", { class: "tb-group" },
      tbBtn("stage", "This stage: title, minutes, audio, worksheet, mechanic", function () { togglePop("stage"); }, { pop: "stage" }),
      tbBtn("why", "Why this stage (rationale, required)", function () { togglePop("why"); }, { pop: "why", badge: whyMissing ? "!" : null, badgeCls: "tb-badge-bad" }),
      tbBtn("notes", "Teacher notes", function () { togglePop("notes"); }, { pop: "notes", badge: st && st.teacherNotes ? "•" : null }),
      tbBtn("content", "Content: lists and items of this stage", function () { togglePop("content"); }, { pop: "content" }),
      tbBtn("lesson", "Lesson: title, aims, backup, reset", function () { togglePop("lesson"); }, { pop: "lesson" })
    ));
    el.toolbar.appendChild(h("div", { class: "tb-spacer" }));
    if (nProblems) {
      el.toolbar.appendChild(tbBtn("warn", nProblems + (nProblems === 1 ? " problem" : " problems") + " — click to see", function () { togglePop("problems"); },
        { pop: "problems", cls: "tb-warn", badge: String(nProblems), badgeCls: "tb-badge-bad" }));
    }
    el.toolbar.appendChild(tbBtn("done", "Done (E or Esc)", function () { setEditing(false); }, { cls: "tb-done" }));
  }

  function renderPop() {
    var pop = el.pop;
    if (!pop) return;
    if (!S.editing || !S.pop || !POPS[S.pop]) {
      pop.hidden = true;
      pop.innerHTML = "";
      return;
    }
    var scroll = pop.scrollTop;
    var def = POPS[S.pop];
    pop.innerHTML = "";
    pop.className = "edit-pop pop-" + S.pop;
    pop.setAttribute("aria-label", def.title);
    pop.appendChild(h("div", { class: "pop-head" },
      h("b", { text: def.title }),
      h("button", { type: "button", class: "pop-close", "aria-label": "Close (Esc)", title: "Close (Esc)", onclick: closePop }, "✕")
    ));
    pop.appendChild(def.build());
    pop.hidden = false;
    // Anchor under its toolbar button, kept inside the stage area.
    var btn = el.toolbar.querySelector('[data-pop="' + S.pop + '"]');
    var wrapW = el.stageWrap.clientWidth;
    var w = pop.offsetWidth;
    var left = btn ? btn.offsetLeft + btn.offsetWidth / 2 - w / 2 : wrapW - w - 12;
    pop.style.left = Math.max(12, Math.min(wrapW - w - 12, left)) + "px";
    pop.scrollTop = scroll;
  }

  var STAGE_BASIC = { title: STAGE_FIELDS.title, minutes: STAGE_FIELDS.minutes, audioCue: STAGE_FIELDS.audioCue, worksheetLabel: STAGE_FIELDS.worksheetLabel };

  var POPS = {
    "delete": {
      title: "Delete this stage?",
      build: function () {
        var st = currentStage() || {};
        return h("div", { class: "pop-body" },
          h("p", null, "“" + (st.title || "Untitled") + "” will be removed from this lesson. Ctrl+Z brings it back."),
          h("div", { class: "stage-ops" },
            h("button", { type: "button", class: "btn btn-danger", onclick: deleteStage }, "Delete stage"),
            h("button", { type: "button", class: "btn", onclick: closePop }, "Cancel")
          )
        );
      }
    },
    shape: {
      title: "Insert a shape",
      build: function () {
        return h("div", { class: "pop-body" },
          h("div", { class: "shape-picks" }, LL.SHAPES.map(function (sh) {
            return h("button", { type: "button", class: "shape-pick", title: sh, "aria-label": "Insert " + sh, onclick: function () { insertShape(sh); } },
              icon(sh), h("span", { text: sh.charAt(0).toUpperCase() + sh.slice(1) }));
          })),
          h("p", { class: "field-help", text: "Colour matches this stage automatically. Drag to move, drag the corner to resize, ✕ removes." })
        );
      }
    },
    stage: {
      title: "This stage",
      build: function () {
        var st = currentStage();
        if (!st) return h("div", { class: "pop-body" }, h("button", { class: "btn btn-primary", onclick: addStage }, "+ Add first stage"));
        var mechSelect = h("select", { class: "editable-outline", onchange: function () { changeMechanic(mechSelect.value); } });
        Object.keys(LL.mechanics).forEach(function (id) { mechSelect.appendChild(h("option", { value: id, text: id })); });
        if (!LL.mechanics[st.mechanic]) mechSelect.insertBefore(h("option", { value: st.mechanic || "", text: (st.mechanic || "none") + " (not registered)" }), mechSelect.firstChild);
        mechSelect.value = st.mechanic || "";
        var mech = LL.mechanics[st.mechanic];
        return h("div", { class: "pop-body" },
          LL.ui.schemaForm(STAGE_BASIC, ["stages", S.stage], editApi),
          h("label", { class: "field" }, h("span", { class: "field-label", text: "Mechanic" }), mechSelect,
            mech ? h("small", { class: "field-help", text: mech.description }) : null),
          h("div", { class: "stage-ops" },
            h("button", { type: "button", class: "btn", onclick: function () { moveStage(-1); }, title: "Alt+↑" }, "↑ Earlier"),
            h("button", { type: "button", class: "btn", onclick: function () { moveStage(1); }, title: "Alt+↓" }, "↓ Later"),
            h("button", { type: "button", class: "btn", onclick: duplicateStage }, "Duplicate")
          )
        );
      }
    },
    why: {
      title: "Why this stage (required)",
      build: function () {
        return h("div", { class: "pop-body" },
          problemList("Missing", stageProblemsOf("Rationale")),
          LL.ui.schemaForm({ rationale: STAGE_FIELDS.rationale }, ["stages", S.stage], editApi));
      }
    },
    notes: {
      title: "Teacher notes",
      build: function () {
        return h("div", { class: "pop-body" }, LL.ui.schemaForm({ teacherNotes: STAGE_FIELDS.teacherNotes }, ["stages", S.stage], editApi));
      }
    },
    content: {
      title: "Content",
      build: function () {
        var st = currentStage();
        var mech = st && LL.mechanics[st.mechanic];
        var box = h("div", { class: "pop-body mech-editor" });
        if (!mech) {
          box.appendChild(h("p", { class: "field-help", text: "Choose a mechanic first (clock icon)." }));
          return box;
        }
        var fix = problemList("To fix", stageProblemsOf("Data"));
        if (fix) box.appendChild(fix);
        try {
          mech.editor(box, renderCtx(st, mech));
        } catch (e) {
          box.appendChild(h("p", { class: "panel-problems", text: "This mechanic’s editor crashed: " + e.message }));
        }
        return box;
      }
    },
    lesson: {
      title: "Lesson",
      build: function () {
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
        return h("div", { class: "pop-body" },
          LL.ui.schemaForm(LESSON_FIELDS, [], editApi),
          h("p", { class: "field-help" }, "GitHub: ", syncPill("edit-sync"),
            LL.store.hasEdits(S.lessonId) ? " · This lesson has teacher edits." : " · No teacher edits yet."),
          h("div", { class: "stage-ops" },
            h("button", { type: "button", class: "btn", onclick: function () {
              var n = LL.store.exportBackup();
              toast(n ? "Backup downloaded (" + n + (n === 1 ? " edited lesson)." : " edited lessons).") : "Backup downloaded (no edits yet).");
            } }, "Export backup"),
            h("button", { type: "button", class: "btn", onclick: function () { fileInput.click(); } }, "Import backup"),
            h("button", { type: "button", class: "btn btn-danger", onclick: resetToOriginal, title: "Clears this lesson’s teacher edits" }, "Reset lesson")
          ),
          fileInput
        );
      }
    },
    problems: {
      title: "Problems",
      build: function () {
        var a = problemList("Lesson", S.valid.lesson);
        var b = problemList("This stage can’t run yet", S.valid.stages[S.stage]);
        return h("div", { class: "pop-body" }, a, b, !a && !b ? h("p", { class: "field-help", text: "No problems." }) : null);
      }
    }
  };

  /* ---------- Bulleted / numbered lists: plain "• " and "1. " characters in the text itself ---------- */

  var LIST_PREFIX = /^(• |\d+\. )/;

  /* Toggle a list on the lines touched by [s, e). Returns { text, s, e }. */
  function formatLines(text, s, e, kind) {
    var ls = text.lastIndexOf("\n", s - 1) + 1;
    var endPos = e > s && text.charAt(e - 1) === "\n" ? e - 1 : e;
    var le = text.indexOf("\n", endPos);
    if (le === -1) le = text.length;
    var lines = text.slice(ls, le).split("\n");
    var want = kind === "bullet" ? /^• / : /^\d+\. /;
    var filled = lines.filter(function (l) { return l.replace(LIST_PREFIX, "").trim(); });
    var off = filled.length > 0 && filled.every(function (l) { return want.test(l); });
    var n = 0;
    if (kind === "number" && !off && ls > 0) {
      // Continue the numbering of the line just above, if it is numbered.
      var above = text.slice(0, ls - 1);
      var m = /^(\d+)\. /.exec(above.slice(above.lastIndexOf("\n") + 1));
      if (m) n = Number(m[1]);
    }
    var out;
    if (!filled.length) out = [kind === "bullet" ? "• " : n + 1 + ". "]; // empty line: start a list
    else out = lines.map(function (l) {
      var bare = l.replace(LIST_PREFIX, "");
      if (off || !bare.trim()) return bare;
      n += 1;
      return (kind === "bullet" ? "• " : n + ". ") + bare;
    });
    var block = out.join("\n");
    return { text: text.slice(0, ls) + block + text.slice(le), s: filled.length ? ls : ls + block.length, e: ls + block.length };
  }

  /* Text and selection of a contentEditable field (line breaks as "\n"). */
  function editableModel(node) {
    var sel = window.getSelection();
    var r = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (r && !node.contains(r.startContainer)) r = null;
    var text = "", s = null, e = null;
    function at(container, offset) {
      if (r && container === r.startContainer && offset === r.startOffset && s === null) s = text.length;
      if (r && container === r.endContainer && offset === r.endOffset && e === null) e = text.length;
    }
    (function walk(n) {
      if (n.nodeType === 3) {
        if (r && n === r.startContainer) s = text.length + r.startOffset;
        if (r && n === r.endContainer) e = text.length + r.endOffset;
        text += n.data;
        return;
      }
      if (n.nodeName === "BR") { text += "\n"; return; }
      for (var i = 0; i < n.childNodes.length; i++) { at(n, i); walk(n.childNodes[i]); }
      at(n, n.childNodes.length);
    })(node);
    if (/\n$/.test(text) && node.lastChild && node.lastChild.nodeName === "BR") text = text.slice(0, -1); // trailing <br> quirk
    if (s === null) s = text.length;
    if (e === null) e = s;
    return { text: text, s: Math.min(s, text.length), e: Math.min(e, text.length) };
  }

  function listFormat(kind) {
    if (!S.editing) return;
    var t = S.lastEditable;
    if (!t || !document.body.contains(t)) return toast("Click into a text first, then choose the list button.");
    if (t.isContentEditable) {
      var m = editableModel(t);
      var res = formatLines(m.text, m.s, m.e, kind);
      t.textContent = res.text;
      t.focus();
      var range = document.createRange();
      var tn = t.firstChild;
      if (tn) {
        range.setStart(tn, res.s);
        range.setEnd(tn, res.e);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      var path = t._llPath;
      if (path) mutate("set:" + path.join("."), function (l) { LL.setAt(l, path, res.text); }, { scene: false });
    } else {
      var r2 = formatLines(t.value, t.selectionStart, t.selectionEnd, kind);
      t.value = r2.text;
      t.focus();
      t.setSelectionRange(r2.s, r2.e);
      t.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // Remember the last text field the teacher clicked into (scene text or a popover field).
  document.addEventListener("focusin", function (e) {
    if (!S.editing) return;
    var t = e.target;
    if ((t.isContentEditable && t.classList.contains("editable")) ||
        (el.pop && el.pop.contains(t) && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t.type === "text")))) {
      S.lastEditable = t;
    }
  });

  // A click outside the toolbar and the open popover closes the popover.
  document.addEventListener("pointerdown", function (e) {
    if (!S.editing || !S.pop || !el.pop) return;
    var t = e.target;
    if (el.pop.contains(t) || el.toolbar.contains(t) || t.closest(".modal") || t.closest(".toast")) return;
    closePop();
  }, true);

  /* After each edit: refresh the toolbar badges (problem count, missing rationale) without rebuilding the open popover. */
  function refreshPanelProblems() {
    if (!S.editing) return;
    renderToolbarButtons();
    if (S.pop === "problems") renderPop();
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
    if (S.route.view === "menu") return S.lessonId === id ? renderMenu(id, true) : undefined;
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
      ["L", "Lesson menu (all stages)"],
      ["H", "Back to lesson list"]
    ]],
    ["Lesson menu", [
      ["↑ ↓  Enter", "Choose a stage and open it"],
      ["1 – 9", "Open that stage"],
      ["H  Esc  Backspace", "Back to lesson list"]
    ]],
    ["Edit mode", [
      ["E", "Edit mode on / off"],
      ["Ctrl+Z  or  U", "Undo"],
      ["A", "Add a stage after this one"],
      ["Alt+↑ / Alt+↓", "Move this stage"],
      ["Delete", "Delete this stage (asks first) · a selected shape: remove it"],
      ["Ctrl+Shift+8 / 7", "Bulleted / numbered list on the current line(s)"],
      ["Esc", "Stop typing / close the open tool / leave edit mode"]
    ]],
    ["Home screen", [
      ["S", "Settings (GitHub sync, backup)"],
      ["E", "Edit: show Hide on lesson tiles (hidden lessons: “Show hidden”)"]
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
    // The current stage's mechanic keys come first (they only work outside edit mode).
    var groups = KEYS;
    var st = S.route.view === "lesson" && S.lesson ? currentStage() : null;
    var mech = st && LL.mechanics[st.mechanic];
    if (mech && mech.keys && mech.keys.length) groups = [["This stage (" + mech.id + ")", mech.keys]].concat(KEYS);
    var box = h("div", { class: "help", role: "dialog", "aria-label": "Keyboard keys", onclick: function (e) { if (e.target === box) setHelp(false); } },
      h("div", { class: "help-card" },
        h("h2", null, "Keys"),
        h("div", { class: "help-cols" },
          groups.map(function (g) {
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

    // Lists while typing: Ctrl+Shift+8 bullets, Ctrl+Shift+7 numbers.
    if (inLesson && S.editing && (e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === "Digit8" || e.code === "Digit7")) {
      e.preventDefault();
      listFormat(e.code === "Digit8" ? "bullet" : "number");
      return;
    }

    // Undo is ours in edit mode, even while typing (keeps one undo history).
    if (inLesson && S.editing && (e.ctrlKey || e.metaKey) && !e.shiftKey && k.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }

    if (k === "Escape") {
      if (typing) return e.target.blur();
      if (S.help) return setHelp(false);
      if (inLesson && S.editing && closePop()) return;
      if (inLesson && S.editing) return setEditing(false);
      if (inLesson && S.teacher) return setTeacher(false);
      if (inLesson) return goLevel();
      if (S.homeEdit && (S.route.view === "level" || S.route.view === "home")) return setHomeEdit(false);
      if (S.route.view === "menu") return goLevel();
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
      if (S.route.view === "menu") {
        if (k === "Backspace" || k === "h" || k === "H") { e.preventDefault(); return goLevel(); }
        if (/^[1-9]$/.test(k)) {
          var row = root.querySelectorAll(".menu-row")[Number(k) - 1];
          if (row) row.click();
        }
        return;
      }
      if (k === "Backspace" && S.route.view === "level") { e.preventDefault(); return go("#/"); }
      if (k === "s" || k === "S") return go("#/settings");
      if (k === "e" || k === "E") return setHomeEdit(!S.homeEdit);
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
      case "l": case "L": return openMenu();
      case "e": case "E": return setEditing(!S.editing);
      case "h": case "H": case "Backspace": e.preventDefault(); return goLevel();
    }
    if (/^[1-9]$/.test(k)) return goTo(Number(k) - 1);
    if (S.editing) {
      if (k === "u" || k === "U") return undo();
      if (k === "a" || k === "A") return addStage();
      if (k === "Delete") {
        var focused = document.activeElement;
        if (focused && focused.classList && focused.classList.contains("deco")) return removeDecoration(focused.getAttribute("data-id"));
        return askDeleteStage();
      }
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
