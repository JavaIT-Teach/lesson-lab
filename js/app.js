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
    lastTextPath: null, // edit mode: lesson-path of the last on-scene text focused (target of align / text size; survives the node being replaced on rerender)
    showHidden: false, // home screen: list hidden lessons (with Unhide)
    undo: [],
    redo: [], // undone steps, for Ctrl+Y; cleared by any new edit
    sel: [], // edit mode: selected free elements ("shape:<id>" / "text:<key>"); memory only
    zoom: 1, // edit mode: view zoom / pan of the scene (never changes stored positions)
    panX: 0,
    panY: 0,
    spaceDown: false, // edit mode: Space held (Space + drag pans when zoomed)
    spacePanned: false,
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
    S.redo = [];
    S.sel = [];
    resetZoom();
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
    wireZoomPan(el.stageWrap);
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
    var decor = st && Array.isArray(st.decorations) && st.decorations.length ? decorLayers(st) : null;
    if (decor) scene.appendChild(decor.back);

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
    if (decor) scene.appendChild(decor.front);
    if (st) applyFreePositions(scene, st);

    var old = el.stageWrap.querySelectorAll(".scene");
    Array.prototype.forEach.call(old, function (o) {
      if (!dir) return o.remove();
      o.classList.add(dir < 0 ? "leave-back" : "leave-fwd");
      setTimeout(function () { o.remove(); }, 600);
    });
    el.stageWrap.insertBefore(scene, el.stageWrap.firstChild);
    // Needs real layout (computed sizes, getBoundingClientRect), so only once the scene is in the document.
    afterSceneInsert(scene, st);
  }

  /* ================= Canvas editing: shapes and freed text fields =================
   * A "free element" is a shape (stage.decorations[]) or a bound text field the teacher dragged out of
   * its mechanic's layout (stage.textStyle[key] with x / y). Both are addressed by one ref string:
   * "shape:<decoration id>" or "text:<textStyle key>" — the same strings stage.groups stores.
   * Selection (S.sel), zoom and pan are edit-mode view state: memory only, never saved.
   *
   * Paint order is a hard rule (css/app.css), never DOM order: back shapes < stage content <
   * front shapes < freed text. Freed text always paints above every shape, so a highlighter
   * shape placed behind a dragged phrase can never hide it.
   *
   * Colour is automatic (the scene's --accent / --accent-ink, from the hash of the stage id) unless the
   * teacher picked one of the curated LL.COLOR_ROLES. Never a free colour.
   */
  var DECO_HANDLES = {
    nw: { x: -1, y: -1 }, n: { x: 0, y: -1 }, ne: { x: 1, y: -1 }, e: { x: 1, y: 0 },
    se: { x: 1, y: 1 }, s: { x: 0, y: 1 }, sw: { x: -1, y: 1 }, w: { x: -1, y: 0 }
  };
  var SHAPE_DEFAULTS = { rectangle: { w: 20, h: 13 }, arrow: { w: 24, h: 6 }, line: { w: 24, h: 4 } };
  var SNAP = 1.5; // % of the scene: centre snapping distance while dragging
  var ANGLE_STEP = 15, ANGLE_SNAP = 4; // rotation snaps to multiples of 15° when within 4°
  var NUDGE = 0.5, NUDGE_BIG = 2; // % of the scene per arrow key (Shift: big)
  var ZOOM_MIN = 1, ZOOM_MAX = 4;

  // role -> { fill, ink } CSS values, from LL.COLOR_ROLES. Never arbitrary colour: a fixed lookup.
  var COLOR_ROLE_CSS = {
    accent: { fill: "var(--accent)", ink: "var(--accent-ink, #17122b)" },
    highlight: { fill: "var(--highlight)", ink: "var(--highlight-ink)" },
    paper: { fill: "var(--paper)", ink: "var(--paper-ink)" }
  };

  function isStroke(shape) { return LL.STROKE_SHAPES.indexOf(shape) !== -1; }
  function round1(v) { return Math.round(v * 10) / 10; }
  function clampPct(v) { return Math.max(0, Math.min(100, v)); }
  function normAngle(a) { a = Math.round(a) % 360; return a < 0 ? a + 360 : a; }
  function refKind(ref) { return ref.slice(0, ref.indexOf(":")); }
  function refId(ref) { return ref.slice(ref.indexOf(":") + 1); }
  function rotateCss(deg) { return deg ? "translate(-50%, -50%) rotate(" + deg + "deg)" : ""; }
  function rectRadius(d) { return (Math.min(d.w, d.h) * d.radius / 100) + "vmin"; }

  function liveScene() {
    return el.stageWrap ? el.stageWrap.querySelector(".scene:not(.leave-fwd):not(.leave-back)") : null;
  }

  /* The stored object behind a ref on stage `st`: a decoration, or a freed field's textStyle entry. */
  function elemData(st, ref) {
    if (!st) return null;
    var id = refId(ref);
    if (refKind(ref) === "shape") {
      var list = st.decorations || [];
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
      return null;
    }
    var e = st.textStyle && st.textStyle[id];
    return e && e.x !== undefined && e.y !== undefined ? e : null;
  }

  function elemNode(ref, scene) {
    scene = scene || liveScene();
    if (!scene) return null;
    var id = CSS.escape(refId(ref));
    return refKind(ref) === "shape" ? scene.querySelector('.deco[data-id="' + id + '"]')
      : scene.querySelector('.scene-freepos > [data-ll-key="' + id + '"]');
  }

  /* Every free element on the stage, back to front (the order they paint in). */
  function freeRefs(st) {
    var out = [];
    var list = (st && st.decorations) || [];
    list.forEach(function (d) { if (d && d.z !== "front") out.push("shape:" + d.id); });
    list.forEach(function (d) { if (d && d.z === "front") out.push("shape:" + d.id); });
    Object.keys((st && st.textStyle) || {}).forEach(function (k) { if (elemData(st, "text:" + k)) out.push("text:" + k); });
    return out;
  }

  function liveSel(st) {
    return S.sel.filter(function (r, i) { return S.sel.indexOf(r) === i && elemData(st, r); });
  }

  function groupOf(st, ref) {
    var gs = (st && st.groups) || [];
    for (var i = 0; i < gs.length; i++) if (gs[i] && Array.isArray(gs[i].members) && gs[i].members.indexOf(ref) !== -1) return gs[i];
    return null;
  }

  /* Drop dead refs from every group; a group left with fewer than 2 members dissolves. */
  function pruneGroups(st, dead) {
    if (!Array.isArray(st.groups)) return;
    st.groups.forEach(function (g) { g.members = (g.members || []).filter(function (m) { return dead.indexOf(m) === -1; }); });
    st.groups = st.groups.filter(function (g) { return g.members.length >= 2; });
    if (!st.groups.length) delete st.groups;
  }

  /* Scene geometry in screen pixels. vmin = screen pixels per 1vmin (shape sizes), zoom included. */
  function geo(scene) {
    var r = scene.getBoundingClientRect();
    return { left: r.left, top: r.top, W: r.width, H: r.height, vmin: Math.min(window.innerWidth, window.innerHeight) / 100 * S.zoom };
  }

  /* A node's box in % of the scene (axis-aligned, so it includes rotation). */
  function boxPct(node, g) {
    var r = node.getBoundingClientRect();
    return { l: (r.left - g.left) / g.W * 100, r: (r.right - g.left) / g.W * 100, t: (r.top - g.top) / g.H * 100, b: (r.bottom - g.top) / g.H * 100 };
  }

  function unionBox(boxes) {
    var u = null;
    boxes.forEach(function (b) {
      if (!b) return;
      if (!u) u = { l: b.l, r: b.r, t: b.t, b: b.b };
      else { u.l = Math.min(u.l, b.l); u.r = Math.max(u.r, b.r); u.t = Math.min(u.t, b.t); u.b = Math.max(u.b, b.b); }
    });
    return u;
  }

  /* Change stored fields of free elements (undefined deletes a field). One mutate = one undo step,
     or several coalesced when `key` repeats within 2 s (same rule as typing and every drag). */
  function patchElems(key, map) {
    mutate(key, function (l) {
      var st = l.stages[S.stage];
      Object.keys(map).forEach(function (ref) {
        var d = elemData(st, ref);
        if (!d && refKind(ref) === "text") { // freeing a text field: its textStyle entry gains x / y
          var ts = st.textStyle || (st.textStyle = {});
          d = ts[refId(ref)] = Object.assign({}, ts[refId(ref)]);
        }
        if (!d) return;
        var p = map[ref];
        Object.keys(p).forEach(function (k) { if (p[k] === undefined) delete d[k]; else d[k] = p[k]; });
      });
    });
  }

  /* ---------- Rendering ---------- */

  function decorLayers(st) {
    var back = h("div", { class: "scene-decor", "aria-hidden": S.editing ? null : "true" });
    var front = h("div", { class: "scene-decor scene-decor-front", "aria-hidden": S.editing ? null : "true" });
    st.decorations.forEach(function (d, j) {
      if (!d || LL.SHAPES.indexOf(d.shape) === -1) return;
      var node = h("div", { class: "deco deco-" + d.shape + (isStroke(d.shape) ? " deco-stroke" : "") + (S.editing && d.locked ? " locked" : ""), "data-id": d.id });
      node.style.left = d.x + "%";
      node.style.top = d.y + "%";
      node.style.setProperty("--deco-w", d.w);
      node.style.setProperty("--deco-h", d.h);
      if (d.rotation) node.style.transform = rotateCss(d.rotation);
      if (d.color && COLOR_ROLE_CSS[d.color]) {
        node.style.setProperty("--deco-fill", COLOR_ROLE_CSS[d.color].fill);
        node.style.setProperty("--deco-label-ink", COLOR_ROLE_CSS[d.color].ink);
      }
      node.style.animationDelay = -(hash(String(d.id)) % 6000) + "ms";
      if (isStroke(d.shape)) {
        node.appendChild(h("div", { class: "deco-shaft" }));
        if (d.shape === "arrow") node.appendChild(h("div", { class: "deco-head" }));
      } else {
        var fill = h("div", { class: "deco-fill" });
        if (d.shape === "rectangle" && typeof d.radius === "number") fill.style.borderRadius = rectRadius(d);
        node.appendChild(fill);
        if (d.label || S.editing) {
          var label = h("span", { class: "deco-label" });
          bindPath(label, ["stages", S.stage, "decorations", j, "label"], { placeholder: "Label" });
          node.appendChild(label);
        }
      }
      if (S.editing) {
        node.tabIndex = 0;
        node.setAttribute("title", d.locked ? "Locked — right-click or the tools to unlock" : "Drag to move · edges and corners resize · right-click for more");
        node.appendChild(h("button", { class: "deco-del", type: "button", title: "Remove shape", "aria-label": "Remove shape", onclick: function (e) { e.stopPropagation(); deleteRefs(["shape:" + d.id]); } }, "✕"));
        if (!d.locked) Object.keys(DECO_HANDLES).forEach(function (dir) {
          node.appendChild(h("span", { class: "deco-handle deco-handle-" + dir, "data-handle": dir, title: "Drag to resize", "aria-hidden": "true" }));
        });
        wireDecoration(node, d);
      }
      (d.z === "front" ? front : back).appendChild(node);
    });
    return { back: back, front: front };
  }

  /* After the mechanic has rendered, move any field with a stored position into the freeform layer. */
  function applyFreePositions(scene, st) {
    var ts = st && st.textStyle;
    if (!ts) return;
    Object.keys(ts).forEach(function (key) {
      var v = ts[key];
      if (v.x === undefined || v.y === undefined) return;
      var node = scene.querySelector('[data-ll-key="' + CSS.escape(key) + '"]');
      if (!node) return; // the field isn't on screen this render (e.g. an optional field left empty)
      freeTextNode(scene, node);
      node.style.left = v.x + "%";
      node.style.top = v.y + "%";
      node.style.transform = rotateCss(v.rotation);
      node.classList.toggle("locked", !!(S.editing && v.locked));
    });
  }

  function freeTextNode(scene, node) {
    var overlay = scene.querySelector(".scene-freepos") || scene.appendChild(h("div", { class: "scene-freepos" }));
    if (node.parentElement !== overlay) overlay.appendChild(node);
  }

  /* Text size: `scale` multiplies the field's own untouched rendered size, measured live (computed
     style with the override removed) — never a nominal constant, never the parent's size. Re-run
     whenever layout may change (render, window resize), since mechanic sizes follow the viewport. */
  function naturalFontPx(node) {
    var keep = node.style.fontSize;
    node.style.fontSize = "";
    var px = parseFloat(window.getComputedStyle(node).fontSize) || 16;
    node.style.fontSize = keep;
    return px;
  }

  function applyTextScales(scene) {
    var st = currentStage();
    var ts = st && st.textStyle;
    if (!ts || !scene) return;
    Array.prototype.forEach.call(scene.querySelectorAll("[data-ll-key]"), function (node) {
      var e = ts[node.getAttribute("data-ll-key")];
      if (!e || !e.scale) return;
      node.style.fontSize = "";
      node.style.fontSize = naturalFontPx(node) * e.scale + "px";
    });
  }

  /* Edit mode only: a drag handle over every bound text field (shape labels excluded — they move with
     their shape), a reset button on a freed field, and a lock badge on every locked element. */
  function attachDragHandles(scene) {
    var old = scene.querySelector(".scene-drag-handles");
    if (old) old.remove();
    var overlay = h("div", { class: "scene-drag-handles" });
    scene.appendChild(overlay);
    var g = geo(scene);
    var st = currentStage();
    function place(n, x, y) { n.style.left = x + "%"; n.style.top = y + "%"; overlay.appendChild(n); }
    Array.prototype.forEach.call(scene.querySelectorAll(".editable[data-ll-key]"), function (node) {
      if (node.closest(".deco")) return;
      var key = node.getAttribute("data-ll-key");
      var ref = "text:" + key;
      var d = elemData(st, ref);
      var b = boxPct(node, g);
      var cx = (b.l + b.r) / 2;
      var handle = h("button", { type: "button", class: "drag-handle", "data-key": key, title: "Drag to move this text (Shift-click: add to selection)", "aria-label": "Drag to move this text" });
      handle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 2v20 M2 12h20 M6 6l-4 6 4 6 M18 6l4 6-4 6 M6 18l6 4 6-4 M6 6l6-4 6 4"/></svg>';
      place(handle, cx, b.t);
      wireTextHandle(handle, node, scene, key);
      if (d) {
        place(h("button", {
          type: "button", class: "drag-reset", "data-key": key, title: "Reset position (back into the layout)", "aria-label": "Reset position",
          onclick: function () { clearTextPosition(key); }
        }, "⤺"), cx, b.t);
        if (d.locked) place(h("span", { class: "lock-badge", title: "Locked", text: "🔒" }), b.l, b.t);
      }
    });
    ((st && st.decorations) || []).forEach(function (d) {
      if (!d || !d.locked) return;
      var n = elemNode("shape:" + d.id, scene);
      if (!n) return;
      var b = boxPct(n, g);
      place(h("span", { class: "lock-badge", title: "Locked", text: "🔒" }), b.l, b.t);
    });
  }

  /* Everything that needs the scene in the document (real layout): called after every render. */
  function afterSceneInsert(scene, st) {
    applyTextScales(scene);
    applyZoom();
    if (st && S.editing) {
      attachDragHandles(scene);
      scene.addEventListener("pointerdown", onScenePointerDown);
      scene.addEventListener("contextmenu", onSceneContextMenu);
    }
    paintSelection();
  }

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var scene = liveScene();
      if (!scene || S.route.view !== "lesson") return;
      applyTextScales(scene);
      if (S.editing) { clampPan(scene); applyZoom(); attachDragHandles(scene); }
      paintSelection();
    }, 120);
  });

  /* ---------- Selection ---------- */

  function paintSelection() {
    var tools = el.stageWrap && el.stageWrap.querySelector(".sel-tools");
    if (tools) tools.remove();
    var scene = liveScene();
    if (!scene) return;
    Array.prototype.forEach.call(scene.querySelectorAll(".is-selected, .scene-selbox"), function (n) {
      if (n.classList.contains("scene-selbox")) n.remove();
      else n.classList.remove("is-selected");
    });
    var st = currentStage();
    if (!S.editing || !st) { S.sel = []; return; }
    S.sel = liveSel(st);
    S.sel.forEach(function (r) {
      var n = elemNode(r, scene);
      if (n) n.classList.add("is-selected");
      if (refKind(r) === "text") {
        var hd = scene.querySelector('.drag-handle[data-key="' + CSS.escape(refId(r)) + '"]');
        if (hd) hd.classList.add("is-selected");
      }
    });
    if (S.sel.length) renderSelTools(scene, st);
    if (S.pop === "layers") renderPop();
  }

  function setSel(refs) {
    S.sel = refs.slice();
    paintSelection();
  }

  function toggleSel(ref) {
    var i = S.sel.indexOf(ref);
    if (i === -1) S.sel.push(ref);
    else S.sel.splice(i, 1);
    paintSelection();
  }

  function selectGroupOf(ref) {
    var st = currentStage();
    var g = groupOf(st, ref);
    if (g) setSel(g.members.filter(function (m) { return elemData(st, m); }));
  }

  /* Floating tools for the selection: above it (below when there is no room), outside the zoomed scene. */
  function renderSelTools(scene, st) {
    var g = geo(scene);
    var boxes = S.sel.map(function (r) { var n = elemNode(r, scene); return n ? boxPct(n, g) : null; });
    var u = unionBox(boxes);
    if (!u) return;
    var single = S.sel.length === 1 ? S.sel[0] : null;
    var d = single ? elemData(st, single) : null;
    // Rotation handle (single, unlocked): above the element, inside the scene.
    if (single && !d.locked) {
      var selbox = h("div", { class: "scene-selbox" });
      var rh = h("button", { type: "button", class: "rot-handle", title: "Drag to rotate (snaps every 15°)", "aria-label": "Rotate" }, "↻");
      var above = u.t - 36 / g.H * 100;
      rh.style.left = (u.l + u.r) / 2 + "%";
      rh.style.top = (above < 1 ? u.b + 36 / g.H * 100 : above) + "%";
      rh.addEventListener("pointerdown", function (e) { startRotate(e, single); });
      selbox.appendChild(rh);
      scene.appendChild(selbox);
    }
    var panel = h("div", { class: "sel-tools", role: "toolbar", "aria-label": "Selection tools" }, single ? singleTools(st, single, d) : multiTools(st));
    el.stageWrap.appendChild(panel);
    var wrap = el.stageWrap.getBoundingClientRect();
    var tbH = el.toolbar ? el.toolbar.offsetHeight : 0;
    var pw = panel.offsetWidth, ph = panel.offsetHeight;
    var cx = g.left + (u.l + u.r) / 2 / 100 * g.W - wrap.left;
    var topPx = g.top + u.t / 100 * g.H - wrap.top - ph - 44;
    if (topPx < tbH + 6) topPx = g.top + u.b / 100 * g.H - wrap.top + 16;
    topPx = Math.max(tbH + 6, Math.min(wrap.height - ph - 6, topPx));
    panel.style.left = Math.max(6, Math.min(wrap.width - pw - 6, cx - pw / 2)) + "px";
    panel.style.top = topPx + "px";
  }

  var ALIGN_ICON = {
    left: '<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="8" height="4" rx="1"/>',
    hcenter: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
    right: '<path d="M20 3v18"/><rect x="5" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="8" height="4" rx="1"/>',
    top: '<path d="M3 4h18"/><rect x="6" y="7" width="4" height="12" rx="1"/><rect x="14" y="7" width="4" height="8" rx="1"/>',
    vcenter: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
    bottom: '<path d="M3 20h18"/><rect x="6" y="5" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="8" rx="1"/>'
  };
  var ALIGN_LABEL = { left: "left", hcenter: "centre (horizontally)", right: "right", top: "top", vcenter: "middle (vertically)", bottom: "bottom" };

  function stBtn(act, label, fn, opts) {
    opts = opts || {};
    var b = h("button", { type: "button", class: "st-btn" + (opts.active ? " active" : "") + (opts.cls ? " " + opts.cls : ""), "data-act": act, title: label, "aria-label": label, onclick: fn });
    if (opts.svg) b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + opts.svg + "</svg>";
    else b.textContent = opts.text || label;
    return b;
  }

  function alignButtons(toPage) {
    return Object.keys(ALIGN_ICON).map(function (m) {
      return stBtn((toPage ? "page-" : "align-") + m, (toPage ? "Align to page: " : "Align to each other: ") + ALIGN_LABEL[m], function () { alignSel(m, toPage); }, { svg: ALIGN_ICON[m] });
    });
  }

  function numInput(f, label, value, min, max, stepv, onSet) {
    var inp = h("input", { type: "number", class: "st-num", "data-f": f, "aria-label": label, title: label, min: String(min), max: String(max), step: String(stepv), value: String(value) });
    inp.addEventListener("change", function () {
      var v = parseFloat(inp.value);
      if (isNaN(v)) return paintSelection();
      onSet(v);
    });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") inp.blur(); });
    return h("label", { class: "st-field" }, h("span", { text: label.charAt(0) === "R" ? "↻" : label.charAt(0) }), inp);
  }

  function singleTools(st, ref, d) {
    var shape = refKind(ref) === "shape";
    var rows = [];
    if (shape) {
      var r1 = [
        swatchBtn(null, "Automatic colour", !d.color, function () { patchElems(null, oneMap(ref, { color: undefined })); })
      ].concat(LL.COLOR_ROLES.map(function (role) {
        return swatchBtn(role, role + " colour", d.color === role, function () { patchElems(null, oneMap(ref, { color: role })); });
      }));
      r1.push(stBtn("front", d.z === "front" ? "In front of the stage content — click to send behind" : "Behind the stage content — click to bring in front",
        function () { patchElems(null, oneMap(ref, { z: d.z === "front" ? undefined : "front" })); }, { text: d.z === "front" ? "▲ Front" : "▼ Back", active: d.z === "front" }));
      if (d.shape === "rectangle") {
        var rad = h("input", { type: "range", class: "st-radius", "data-f": "radius", min: "0", max: "50", step: "1", value: String(typeof d.radius === "number" ? d.radius : 0), title: "Rounded corners", "aria-label": "Rounded corners" });
        rad.addEventListener("input", function () {
          var n = elemNode(ref);
          var fill = n && n.querySelector(".deco-fill");
          if (fill) fill.style.borderRadius = rectRadius({ w: d.w, h: d.h, radius: Number(rad.value) });
        });
        rad.addEventListener("change", function () { patchElems("radius:" + ref, oneMap(ref, { radius: Number(rad.value) })); });
        r1.push(h("label", { class: "st-field st-radius-field", title: "Rounded corners" }, h("span", { text: "◜" }), rad));
      }
      rows.push(h("div", { class: "st-row" }, r1));
    }
    rows.push(h("div", { class: "st-row" },
      numInput("x", "X position (% of the stage)", d.x, 0, 100, 0.5, function (v) { patchElems("pos:" + ref, oneMap(ref, { x: round1(clampPct(v)) })); }),
      numInput("y", "Y position (% of the stage)", d.y, 0, 100, 0.5, function (v) { patchElems("pos:" + ref, oneMap(ref, { y: round1(clampPct(v)) })); }),
      numInput("rot", "Rotation (degrees)", d.rotation || 0, 0, 359, 1, function (v) { var a = normAngle(v); patchElems("rotate:" + ref, oneMap(ref, { rotation: a || undefined })); })
    ));
    rows.push(h("div", { class: "st-row" }, alignButtons(true)));
    var r3 = [stBtn("lock", d.locked ? "Unlock (allow moving again)" : "Lock (no moving, resizing or rotating)", function () { setLocked([ref], !d.locked); }, { text: d.locked ? "🔓 Unlock" : "🔒 Lock", active: !!d.locked })];
    if (shape) {
      r3.push(stBtn("dup", "Duplicate (Ctrl+D)", duplicateSel, { text: "⧉ Duplicate" }));
      r3.push(stBtn("del", "Delete (Delete)", function () { deleteRefs([ref]); }, { text: "✕", cls: "st-danger" }));
    } else {
      r3.push(stBtn("reset", "Reset position: back into the layout", function () { clearTextPosition(refId(ref)); }, { text: "⤺ Reset" }));
    }
    if (groupOf(st, ref)) r3.push(stBtn("select-group", "Select its whole group", function () { selectGroupOf(ref); }, { text: "Select group" }));
    rows.push(h("div", { class: "st-row" }, r3));
    return rows;
  }

  function multiTools(st) {
    var sel = S.sel;
    var anyShape = sel.some(function (r) { return refKind(r) === "shape"; });
    var anyGrouped = sel.some(function (r) { return groupOf(st, r); });
    var allLocked = sel.every(function (r) { var d = elemData(st, r); return d && d.locked; });
    var r2 = [
      stBtn("group", "Group (Ctrl+G)", groupSel, { text: "Group" }),
      anyGrouped ? stBtn("ungroup", "Ungroup (Ctrl+Shift+G)", ungroupSel, { text: "Ungroup" }) : null,
      stBtn("lock", allLocked ? "Unlock all" : "Lock all", function () { setLocked(sel, !allLocked); }, { text: allLocked ? "🔓 Unlock" : "🔒 Lock", active: allLocked }),
      anyShape ? stBtn("dup", "Duplicate the shapes (Ctrl+D)", duplicateSel, { text: "⧉" }) : null,
      anyShape ? stBtn("del", "Delete the shapes (Delete)", function () { deleteRefs(sel); }, { text: "✕", cls: "st-danger" }) : null
    ];
    return [
      h("div", { class: "st-row" }, h("span", { class: "st-label", text: sel.length + " selected · align" }), alignButtons(false)),
      h("div", { class: "st-row" }, h("span", { class: "st-label", text: "to page" }), alignButtons(true)),
      h("div", { class: "st-row" }, r2)
    ];
  }

  function swatchBtn(role, label, active, fn) {
    var btn = h("button", { type: "button", class: "deco-swatch" + (!role ? " deco-swatch-auto" : "") + (active ? " active" : ""), "data-role": role || "auto", title: label, "aria-label": label, onclick: fn });
    if (role) btn.style.setProperty("--sw", COLOR_ROLE_CSS[role].fill);
    return btn;
  }

  function oneMap(ref, patch) { var m = {}; m[ref] = patch; return m; }

  /* ---------- Pointer: move, resize, rotate, marquee, pan ---------- */

  var lastPointerDown = 0;
  document.addEventListener("pointerdown", function () { lastPointerDown = Date.now(); }, true);

  function wireDecoration(node, d) {
    var ref = "shape:" + d.id;
    node.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || e.target.closest(".deco-del") || S.spaceDown) return;
      var handleEl = e.target.closest(".deco-handle");
      var label = node.querySelector(".deco-label");
      if (!handleEl && label && e.target === label && document.activeElement === label) return; // typing in the label
      if (e.shiftKey) { e.preventDefault(); return toggleSel(ref); }
      if (S.sel.indexOf(ref) === -1) setSel([ref]);
      if (handleEl) return startResize(e, node, d, handleEl.getAttribute("data-handle"));
      startMove(e, ref, liveScene());
    });
    // Keyboard focus (Tab) selects the shape, so arrows / Delete / Ctrl+D act on it. Focus that follows a
    // pointer press is ignored: the pointer handler already chose (and Shift-click must not be undone).
    node.addEventListener("focus", function () {
      if (Date.now() - lastPointerDown > 600) { if (S.sel.indexOf(ref) === -1) setSel([ref]); }
    });
  }

  function wireTextHandle(handle, node, scene, key) {
    var ref = "text:" + key;
    handle.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || S.spaceDown) return;
      e.preventDefault();
      if (elemData(currentStage(), ref)) {
        if (e.shiftKey) return toggleSel(ref);
        if (S.sel.indexOf(ref) === -1) setSel([ref]);
        startMove(e, ref, scene);
      } else {
        if (S.sel.length) setSel([]);
        startMove(e, ref, scene, node); // first drag frees the field from the mechanic's layout
      }
    });
  }

  function snapTargets(st, moving) {
    var t = { x: [50], y: [50] };
    freeRefs(st).forEach(function (r) {
      if (moving.indexOf(r) !== -1) return;
      var d = elemData(st, r);
      t.x.push(d.x);
      t.y.push(d.y);
    });
    return t;
  }

  function nearest(list, v) {
    var best = null, bd = SNAP;
    list.forEach(function (t) { var dd = Math.abs(t - v); if (dd <= bd) { bd = dd; best = t; } });
    return best;
  }

  function showGuides(scene, x, y, angle) {
    var box = scene.querySelector(".scene-guides") || scene.appendChild(h("div", { class: "scene-guides", "aria-hidden": "true" }));
    box.innerHTML = "";
    if (x != null) { var v = h("i", { class: "guide guide-v" }); v.style.left = x + "%"; box.appendChild(v); }
    if (y != null) { var hz = h("i", { class: "guide guide-h" }); hz.style.top = y + "%"; box.appendChild(hz); }
    if (angle) {
      var a = h("i", { class: "guide guide-angle" });
      a.style.left = angle.x + "%";
      a.style.top = angle.y + "%";
      a.style.transform = "translate(-50%, -50%) rotate(" + angle.deg + "deg)";
      box.appendChild(a);
    }
  }

  function clearGuides(scene) {
    var box = scene && scene.querySelector(".scene-guides");
    if (box) box.remove();
  }

  /* Drag one element, or the whole selection when the grabbed element is part of it. `freeNode`:
     a text field still in its mechanic's layout — the first move frees it. Snaps the grabbed element's
     centre to the stage centre lines and to other elements' centres (thin guide lines while snapped). */
  function startMove(e, grabRef, scene, freeNode) {
    var st = currentStage();
    var grab = elemData(st, grabRef);
    if (grab && grab.locked) return;
    var g = geo(scene);
    var refs = freeNode ? [grabRef] : (S.sel.indexOf(grabRef) !== -1 ? S.sel : [grabRef]).filter(function (r) {
      var d = elemData(st, r);
      return d && !d.locked;
    });
    var starts = {};
    refs.forEach(function (r) { var d = elemData(st, r); if (d) starts[r] = { x: d.x, y: d.y }; });
    if (freeNode) {
      var b0 = boxPct(freeNode, g);
      starts[grabRef] = { x: round1((b0.l + b0.r) / 2), y: round1((b0.t + b0.b) / 2) };
    }
    if (!starts[grabRef]) return;
    var targets = snapTargets(st, refs);
    var start = { x: e.clientX, y: e.clientY };
    var moved = false, last = null;
    function move(ev) {
      if (!moved && Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) < 5) return;
      if (!moved) {
        moved = true;
        try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        window.getSelection().removeAllRanges();
        if (document.activeElement && scene.contains(document.activeElement) && document.activeElement.blur) document.activeElement.blur();
        scene.classList.add("dragging");
        var tools = el.stageWrap.querySelector(".sel-tools");
        if (tools) tools.hidden = true;
        if (freeNode) freeTextNode(scene, freeNode);
      }
      var dx = (ev.clientX - start.x) / g.W * 100, dy = (ev.clientY - start.y) / g.H * 100;
      var p = starts[grabRef];
      var sx = nearest(targets.x, p.x + dx), sy = nearest(targets.y, p.y + dy);
      if (sx !== null) dx = sx - p.x;
      if (sy !== null) dy = sy - p.y;
      showGuides(scene, sx, sy);
      last = {};
      refs.forEach(function (r) {
        var pos = { x: round1(clampPct(starts[r].x + dx)), y: round1(clampPct(starts[r].y + dy)) };
        last[r] = pos;
        var n = freeNode && r === grabRef ? freeNode : elemNode(r, scene);
        if (n) { n.style.left = pos.x + "%"; n.style.top = pos.y + "%"; }
      });
    }
    function up() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      clearGuides(scene);
      scene.classList.remove("dragging");
      if (!moved || !last) return;
      if (freeNode) S.sel = [grabRef];
      patchElems("move:" + refs.join(","), last);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  /* Resize from one of 8 handles, in the shape's own (rotated) frame: the opposite edge or corner stays
     put; an edge changes one dimension, a corner both. w / h stay independent. */
  function startResize(e, node, d, dir) {
    if (d.locked) return;
    e.preventDefault();
    var scene = liveScene();
    var g = geo(scene);
    var hd = DECO_HANDLES[dir];
    var th = (d.rotation || 0) * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
    var c = { x: g.left + d.x / 100 * g.W, y: g.top + d.y / 100 * g.H };
    var w = d.w * g.vmin, hh = d.h * g.vmin;
    var minPx = LL.DECO_MIN * g.vmin, maxPx = LL.DECO_MAX * g.vmin;
    var fixed = { x: -hd.x * w / 2, y: -hd.y * hh / 2 };
    var start = { x: e.clientX, y: e.clientY };
    var moved = false, pos = null;
    function clampLen(v) { return Math.max(minPx, Math.min(maxPx, v)); }
    function move(ev) {
      if (!moved && Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) < 3) return;
      if (!moved) {
        moved = true;
        try { node.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        scene.classList.add("dragging");
        var tools = el.stageWrap.querySelector(".sel-tools");
        if (tools) tools.hidden = true;
      }
      var px = ev.clientX - c.x, py = ev.clientY - c.y;
      var lx = px * cos + py * sin, ly = -px * sin + py * cos; // screen → the shape's frame
      var nw = w, nh = hh, cx = 0, cy = 0;
      if (hd.x) { nw = clampLen(hd.x * (lx - fixed.x)); cx = fixed.x + hd.x * nw / 2; }
      if (hd.y) { nh = clampLen(hd.y * (ly - fixed.y)); cy = fixed.y + hd.y * nh / 2; }
      var wx = c.x + cx * cos - cy * sin, wy = c.y + cx * sin + cy * cos; // back to screen
      pos = {
        x: round1(clampPct((wx - g.left) / g.W * 100)),
        y: round1(clampPct((wy - g.top) / g.H * 100)),
        w: Math.max(LL.DECO_MIN, Math.min(LL.DECO_MAX, Math.round(nw / g.vmin * 2) / 2)),
        h: Math.max(LL.DECO_MIN, Math.min(LL.DECO_MAX, Math.round(nh / g.vmin * 2) / 2))
      };
      node.style.left = pos.x + "%";
      node.style.top = pos.y + "%";
      node.style.setProperty("--deco-w", pos.w);
      node.style.setProperty("--deco-h", pos.h);
    }
    function up() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      scene.classList.remove("dragging");
      if (moved && pos) patchElems("resize:" + d.id, oneMap("shape:" + d.id, pos));
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  function snapAngle(a) {
    var s = Math.round(a / ANGLE_STEP) * ANGLE_STEP;
    return Math.abs(a - s) <= ANGLE_SNAP ? s % 360 : null;
  }

  /* Free rotation around the centre; snaps to multiples of 15° (0, 15, 45, 90 …) with a guide line. */
  function startRotate(e, ref) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    var scene = liveScene();
    var st = currentStage();
    var d = elemData(st, ref);
    if (!d || d.locked) return;
    var g = geo(scene);
    var c = { x: g.left + d.x / 100 * g.W, y: g.top + d.y / 100 * g.H };
    var node = elemNode(ref, scene);
    var rot = d.rotation || 0, moved = false;
    function move(ev) {
      if (!moved) {
        moved = true;
        scene.classList.add("dragging");
        var tools = el.stageWrap.querySelector(".sel-tools");
        if (tools) tools.hidden = true;
      }
      var a = normAngle(Math.atan2(ev.clientY - c.y, ev.clientX - c.x) * 180 / Math.PI + 90);
      var s = snapAngle(a);
      rot = s !== null ? s : a;
      if (node) node.style.transform = rotateCss(rot) || "translate(-50%, -50%)";
      showGuides(scene, null, null, s !== null ? { x: d.x, y: d.y, deg: s } : null);
    }
    function up() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      clearGuides(scene);
      scene.classList.remove("dragging");
      if (moved) patchElems("rotate:" + ref, oneMap(ref, { rotation: rot || undefined }));
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  /* Empty scene space: drag a marquee to select every shape / freed text it touches; a plain click clears. */
  function onScenePointerDown(e) {
    if (!S.editing || e.button !== 0 || S.spaceDown) return;
    if (e.target.closest(".editable, .deco, button, input, select, textarea, a, label, .rot-handle")) return;
    var scene = e.currentTarget;
    if (document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
    e.preventDefault();
    var g = geo(scene);
    var start = { x: e.clientX, y: e.clientY };
    var box = null, rect = null;
    function move(ev) {
      if (!box && Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) < 4) return;
      if (!box) box = scene.appendChild(h("div", { class: "marquee", "aria-hidden": "true" }));
      rect = { l: Math.min(start.x, ev.clientX), r: Math.max(start.x, ev.clientX), t: Math.min(start.y, ev.clientY), b: Math.max(start.y, ev.clientY) };
      box.style.left = (rect.l - g.left) / g.W * 100 + "%";
      box.style.top = (rect.t - g.top) / g.H * 100 + "%";
      box.style.width = (rect.r - rect.l) / g.W * 100 + "%";
      box.style.height = (rect.b - rect.t) / g.H * 100 + "%";
    }
    function up() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      if (box) box.remove();
      if (!rect) { if (!e.shiftKey) setSel([]); return; }
      var hits = freeRefs(currentStage()).filter(function (r) {
        var n = elemNode(r, scene);
        if (!n) return false;
        var b = n.getBoundingClientRect();
        return b.right >= rect.l && b.left <= rect.r && b.bottom >= rect.t && b.top <= rect.b;
      });
      setSel(e.shiftKey ? S.sel.concat(hits.filter(function (r) { return S.sel.indexOf(r) === -1; })) : hits);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  /* ---------- Commands on the selection ---------- */

  function nudge(dx, dy) {
    var st = currentStage();
    var map = {};
    liveSel(st).forEach(function (r) {
      var d = elemData(st, r);
      if (d.locked) return;
      map[r] = { x: round1(clampPct(d.x + dx)), y: round1(clampPct(d.y + dy)) };
    });
    var refs = Object.keys(map);
    if (!refs.length) return toast("Locked — unlock it to move it.");
    patchElems("nudge:" + refs.join(","), map); // repeats within 2 s = one undo step, like a drag
  }

  /* Align the selection's edges / centres to each other, or (toPage) move it as one block to the page. */
  function alignSel(mode, toPage) {
    var scene = liveScene(), st = currentStage();
    if (!scene) return;
    var g = geo(scene);
    var refs = liveSel(st);
    var boxes = {};
    refs.forEach(function (r) { var n = elemNode(r, scene); if (n) boxes[r] = boxPct(n, g); });
    var all = unionBox(refs.map(function (r) { return boxes[r]; }));
    if (!all) return;
    var tgt = toPage ? { l: 0, r: 100, t: 0, b: 100 } : all;
    var map = {};
    refs.forEach(function (r) {
      var d = elemData(st, r), b = boxes[r];
      if (!b || d.locked) return;
      var src = toPage ? all : b;
      var dx = 0, dy = 0;
      if (mode === "left") dx = tgt.l - src.l;
      else if (mode === "right") dx = tgt.r - src.r;
      else if (mode === "hcenter") dx = (tgt.l + tgt.r) / 2 - (src.l + src.r) / 2;
      else if (mode === "top") dy = tgt.t - src.t;
      else if (mode === "bottom") dy = tgt.b - src.b;
      else if (mode === "vcenter") dy = (tgt.t + tgt.b) / 2 - (src.t + src.b) / 2;
      map[r] = { x: round1(clampPct(d.x + dx)), y: round1(clampPct(d.y + dy)) };
    });
    if (Object.keys(map).length) patchElems(null, map);
  }

  function setLocked(refs, on) {
    var map = {};
    refs.forEach(function (r) { map[r] = { locked: on ? true : undefined }; });
    patchElems(null, map);
    toast(on ? "Locked: it can’t be moved, resized or rotated until unlocked." : "Unlocked.");
  }

  function duplicateSel() {
    var st = currentStage();
    var shapes = liveSel(st).filter(function (r) { return refKind(r) === "shape"; });
    if (!shapes.length) return toast("Duplicate works on shapes (text is part of the lesson content).");
    var copies = shapes.map(function (r) {
      var c = LL.clone(elemData(st, r));
      c.id = LL.uid("shape");
      delete c.locked;
      c.x = round1(c.x + 3 > 100 ? c.x - 3 : c.x + 3);
      c.y = round1(c.y + 3 > 100 ? c.y - 3 : c.y + 3);
      return c;
    });
    S.sel = copies.map(function (c) { return "shape:" + c.id; });
    mutate(null, function (l) {
      var s2 = l.stages[S.stage];
      s2.decorations = (s2.decorations || []).concat(copies);
    });
    toast(copies.length === 1 ? "Shape duplicated." : copies.length + " shapes duplicated.");
  }

  /* Delete shapes (text fields are lesson content: they are never deleted from the canvas). */
  function deleteRefs(refs) {
    var shapes = refs.filter(function (r) { return refKind(r) === "shape"; });
    if (!shapes.length) return toast("Text can’t be deleted here — it is lesson content. ⤺ puts it back in the layout.");
    S.sel = S.sel.filter(function (r) { return shapes.indexOf(r) === -1; });
    mutate(null, function (l) {
      var s2 = l.stages[S.stage];
      s2.decorations = (s2.decorations || []).filter(function (x) { return x && shapes.indexOf("shape:" + x.id) === -1; });
      if (!s2.decorations.length) delete s2.decorations;
      pruneGroups(s2, shapes);
    });
    toast((shapes.length === 1 ? "Shape removed." : shapes.length + " shapes removed.") + " Ctrl+Z brings it back.");
  }

  function groupSel() {
    var refs = liveSel(currentStage());
    if (refs.length < 2) return toast("Select 2 or more things first (drag a box around them, or Shift-click).");
    mutate(null, function (l) {
      var s2 = l.stages[S.stage];
      pruneGroups(s2, refs); // an element belongs to one group at most
      s2.groups = (s2.groups || []).concat({ id: LL.uid("group"), members: refs.slice() });
    });
    toast("Grouped. Click one member, then “Select group” to pick them all again.");
  }

  function ungroupSel() {
    var st = currentStage();
    var refs = liveSel(st);
    if (!refs.some(function (r) { return groupOf(st, r); })) return toast("Nothing selected is in a group.");
    mutate(null, function (l) {
      var s2 = l.stages[S.stage];
      s2.groups = (s2.groups || []).filter(function (g) { return !refs.some(function (r) { return (g.members || []).indexOf(r) !== -1; }); });
      if (!s2.groups.length) delete s2.groups;
    });
    toast("Ungrouped.");
  }

  /* Layer order for shapes: to front = in front of the content and on top of the other shapes; to back = the reverse. */
  function layerSel(toFront) {
    var st = currentStage();
    var shapes = liveSel(st).filter(function (r) { return refKind(r) === "shape"; });
    if (!shapes.length) return toast("Only shapes have a layer order — moved text always stays on top.");
    mutate(null, function (l) {
      var s2 = l.stages[S.stage];
      var picked = s2.decorations.filter(function (x) { return shapes.indexOf("shape:" + x.id) !== -1; });
      var rest = s2.decorations.filter(function (x) { return shapes.indexOf("shape:" + x.id) === -1; });
      picked.forEach(function (x) { if (toFront) x.z = "front"; else delete x.z; });
      s2.decorations = toFront ? rest.concat(picked) : picked.concat(rest);
    });
  }

  function clearTextPosition(key) {
    var ref = "text:" + key;
    S.sel = S.sel.filter(function (r) { return r !== ref; });
    mutate(null, function (l) { // always its own undo step, even right after a drag of the same field
      var st = l.stages[S.stage];
      if (!st.textStyle || !st.textStyle[key]) return;
      var entry = Object.assign({}, st.textStyle[key]);
      ["x", "y", "rotation", "locked"].forEach(function (k) { delete entry[k]; });
      if (Object.keys(entry).length) st.textStyle[key] = entry;
      else delete st.textStyle[key];
      if (!Object.keys(st.textStyle).length) delete st.textStyle;
      pruneGroups(st, [ref]);
    });
  }

  function viewCenterPct() {
    var scene = liveScene();
    var wrap = el.stageWrap.getBoundingClientRect();
    var tbH = el.toolbar ? el.toolbar.offsetHeight : 0;
    var g = geo(scene);
    return {
      x: round1(Math.max(5, Math.min(95, (wrap.left + wrap.width / 2 - g.left) / g.W * 100))),
      y: round1(Math.max(5, Math.min(95, (wrap.top + tbH + (wrap.height - tbH) / 2 - g.top) / g.H * 100)))
    };
  }

  function insertShape(shape, preset) {
    var st = currentStage();
    if (!st) return;
    var n = (st.decorations || []).length;
    var d = Object.assign({ id: LL.uid("shape"), shape: shape, x: 80 - (n % 3) * 9, y: 26 + (n % 3) * 12 },
      SHAPE_DEFAULTS[shape] || { w: 14, h: 14 }, preset || {});
    S.pop = null;
    S.sel = ["shape:" + d.id];
    mutate(null, function (l) {
      var s2 = l.stages[S.stage];
      s2.decorations = (s2.decorations || []).concat(d);
    });
    renderToolbar();
    if (!preset) toast("Shape added. Drag to move, drag any edge or corner to resize, ↻ to rotate. Right-click for more.");
    return d;
  }

  /* One click: a rectangle in the curated highlight colour, in front of the stage content, mid-view. */
  function insertHighlighter() {
    var c = viewCenterPct();
    insertShape("rectangle", { x: c.x, y: c.y, w: 30, h: 8, color: "highlight", z: "front" });
    toast("Highlighter added. Drag it behind a moved phrase (moved text always stays on top of shapes).");
  }

  /* ---------- Context menu ---------- */

  function refFromTarget(t) {
    var st = currentStage();
    var deco = t.closest(".deco");
    if (deco) return "shape:" + deco.getAttribute("data-id");
    var hd = t.closest(".drag-handle, .drag-reset");
    var key = hd ? hd.getAttribute("data-key") : null;
    if (!key) {
      var txt = t.closest(".scene-freepos > [data-ll-key]");
      key = txt ? txt.getAttribute("data-ll-key") : null;
    }
    return key && elemData(st, "text:" + key) ? "text:" + key : null;
  }

  function onSceneContextMenu(e) {
    if (!S.editing) return;
    var ref = refFromTarget(e.target);
    if (!ref) return;
    e.preventDefault();
    if (S.sel.indexOf(ref) === -1) setSel([ref]);
    openCtxMenu(e.clientX, e.clientY);
  }

  function closeCtxMenu() {
    var m = document.querySelector(".ctx-menu");
    if (m) { m.remove(); return true; }
    return false;
  }

  function openCtxMenu(x, y) {
    closeCtxMenu();
    var st = currentStage();
    var sel = liveSel(st);
    if (!sel.length) return;
    var anyShape = sel.some(function (r) { return refKind(r) === "shape"; });
    var allLocked = sel.every(function (r) { return elemData(st, r).locked; });
    var single = sel.length === 1 ? sel[0] : null;
    var items = [
      anyShape && ["dup", "Duplicate", "Ctrl+D", duplicateSel],
      anyShape && ["del", "Delete", "Delete", function () { deleteRefs(sel); }],
      anyShape && ["to-front", "Bring to front", "", function () { layerSel(true); }],
      anyShape && ["to-back", "Send to back", "", function () { layerSel(false); }],
      ["lock", allLocked ? "Unlock" : "Lock", "", function () { setLocked(sel, !allLocked); }],
      sel.length > 1 && ["group", "Group", "Ctrl+G", groupSel],
      sel.some(function (r) { return groupOf(st, r); }) && ["ungroup", "Ungroup", "Ctrl+Shift+G", ungroupSel],
      single && groupOf(st, single) && ["select-group", "Select group", "", function () { selectGroupOf(single); }],
      ["center", "Centre on page", "", function () { alignSel("hcenter", true); alignSel("vcenter", true); }],
      single && refKind(single) === "text" && ["reset", "Reset position", "", function () { clearTextPosition(refId(single)); }]
    ].filter(Boolean);
    var menu = h("div", { class: "ctx-menu", role: "menu" }, items.map(function (it) {
      return h("button", { type: "button", role: "menuitem", class: "ctx-item" + (it[0] === "del" ? " ctx-danger" : ""), "data-act": it[0],
        onclick: function () { closeCtxMenu(); it[3](); } }, h("span", { text: it[1] }), it[2] ? h("kbd", { text: it[2] }) : null);
    }));
    document.body.appendChild(menu);
    menu.style.left = Math.min(x, window.innerWidth - menu.offsetWidth - 6) + "px";
    menu.style.top = Math.min(y, window.innerHeight - menu.offsetHeight - 6) + "px";
  }

  document.addEventListener("pointerdown", function (e) {
    if (!e.target.closest(".ctx-menu")) closeCtxMenu();
  }, true);

  /* ---------- Zoom / pan (edit mode only; a view transform — stored x / y / w / h never change) ---------- */

  function resetZoom() {
    S.zoom = 1;
    S.panX = 0;
    S.panY = 0;
  }

  function clampPan(sc) {
    var W = sc.offsetWidth, H = sc.offsetHeight;
    S.panX = Math.min(0, Math.max(W - S.zoom * W, S.panX));
    S.panY = Math.min(0, Math.max(H - S.zoom * H, S.panY));
  }

  // `scale` / `translate` (not `transform`), so the scene's enter animation can't override it.
  function applyZoom() {
    var sc = liveScene();
    if (sc) {
      var on = S.editing && S.zoom !== 1;
      sc.style.transformOrigin = on ? "0 0" : "";
      sc.style.scale = on ? String(S.zoom) : "";
      sc.style.translate = on ? S.panX + "px " + S.panY + "px" : "";
      sc.classList.toggle("zoomed", on);
    }
    var lab = el.toolbar && el.toolbar.querySelector(".tb-zoom-val");
    if (lab) lab.textContent = Math.round(S.zoom * 100) + "%";
  }

  /* Zoom keeping the screen point (px, py) still (default: the middle of the scene). */
  function setZoom(z, px, py) {
    var sc = liveScene();
    if (!sc || !S.editing) return;
    z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 100) / 100));
    var wrap = el.stageWrap.getBoundingClientRect();
    var ox = wrap.left + sc.offsetLeft, oy = wrap.top + sc.offsetTop;
    if (px == null) { px = ox + sc.offsetWidth / 2; py = oy + sc.offsetHeight / 2; }
    var lx = (px - ox - S.panX) / S.zoom, ly = (py - oy - S.panY) / S.zoom;
    S.zoom = z;
    S.panX = px - ox - z * lx;
    S.panY = py - oy - z * ly;
    clampPan(sc);
    applyZoom();
    paintSelection();
  }

  function panBy(dx, dy) {
    var sc = liveScene();
    if (!sc || S.zoom === 1) return;
    S.panX += dx;
    S.panY += dy;
    clampPan(sc);
    applyZoom();
    paintSelection();
  }

  function wireZoomPan(wrap) {
    wrap.addEventListener("wheel", function (e) {
      if (!S.editing || !liveScene()) return;
      if (e.target.closest(".edit-pop, .edit-toolbar, .sel-tools")) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(S.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY);
      } else if (S.zoom !== 1) {
        e.preventDefault();
        panBy(-e.deltaX, -e.deltaY);
      }
    }, { passive: false });
    // Space + drag pans (capture phase: wins over shapes and handles while Space is held).
    wrap.addEventListener("pointerdown", function (e) {
      if (!S.editing || !S.spaceDown || S.zoom === 1 || !e.target.closest(".scene")) return;
      e.preventDefault();
      e.stopPropagation();
      S.spacePanned = true;
      var last = { x: e.clientX, y: e.clientY };
      function move(ev) { panBy(ev.clientX - last.x, ev.clientY - last.y); last = { x: ev.clientX, y: ev.clientY }; }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    }, true);
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

  /* Path of a bound field relative to its stage, e.g. ["stages", 2, "data", "mission"] -> "data.mission".
     A list item is named by its permanent id, never its position: ["stages", 2, "data", "items", 1, "text"]
     -> "data.items[q2].text", so a style follows its item through reorder / delete / base changes.
     Used as the key into stage.textStyle. */
  function textStyleKey(path) {
    if (path[0] !== "stages") return "";
    var node = S.lesson.stages[path[1]];
    var key = "";
    for (var i = 2; i < path.length; i++) {
      var seg = path[i];
      var item = Array.isArray(node) ? node[seg] : undefined;
      if (item && typeof item === "object" && typeof item.id === "string") key += "[" + item.id + "]";
      else key += (key ? "." : "") + seg;
      node = node == null ? undefined : node[seg];
    }
    return key;
  }

  /* Apply any teacher-set alignment / colour override for this field, and a legacy `size`. Never font.
     `scale` (the Text size control) needs the node in the document, so applyTextScales does it after
     render; position (x / y) and rotation are applied by applyFreePositions (it moves the node itself). */
  function applyTextStyle(node, path) {
    if (path[0] !== "stages") return;
    var st = S.lesson.stages[path[1]];
    var ts = st && st.textStyle && st.textStyle[textStyleKey(path)];
    node.style.textAlign = ts && ts.align ? ts.align : "";
    node.style.fontSize = ts && ts.size && !ts.scale ? ts.size + "em" : ""; // legacy: a multiple of the parent's size
    node.style.color = ts && ts.color && COLOR_ROLE_CSS[ts.color] ? COLOR_ROLE_CSS[ts.color].fill : "";
  }

  /* Show text from the lesson at `path`; in edit mode make it editable in place. */
  function bindPath(node, path, opts) {
    opts = opts || {};
    var v = LL.getAt(S.lesson, path);
    node.textContent = v == null ? "" : String(v);
    // Findable in both views (not just editing): a dragged field's position must still apply on the real scene.
    node.setAttribute("data-ll-key", textStyleKey(path));
    applyTextStyle(node, path);
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
      // Not renderPanel(): that calls renderToolbar(), which always rebuilds the open popover too —
      // if focus is moving into a toolbar/popover control (e.g. Align, Text size), that would tear the
      // control out from under the very click causing this blur. refreshPanelProblems() only rebuilds
      // the toolbar's own buttons (for the "!" badges), leaving an open popover alone.
      refreshPanelProblems();
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
    S.sel = [];
    resetZoom();
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
    S.sel = [];
    S.spaceDown = false;
    resetZoom();
    closeCtxMenu();
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
    S.redo = []; // a new edit ends the redo history
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

  function snapshot() {
    return JSON.stringify({ lesson: S.lesson, stage: S.stage });
  }

  function restore(json) {
    var snap = JSON.parse(json);
    var stageBefore = S.stage;
    S.lesson = snap.lesson;
    S.stage = Math.max(0, Math.min(snap.stage, stages().length - 1));
    if (S.stage !== stageBefore) { S.sel = []; resetZoom(); }
    S.lastKey = null;
    commit();
    revalidate();
    renderAll(0);
  }

  /* Undo / redo walk one history: undo moves the current state onto the redo stack, redo moves it back. */
  function undo() {
    if (!S.undo.length) return toast("Nothing to undo.");
    S.redo.push(snapshot());
    restore(S.undo.pop());
    toast("Undone. Ctrl+Y redoes.");
  }

  function redo() {
    if (!S.redo.length) return toast("Nothing to redo.");
    S.undo.push(snapshot());
    restore(S.redo.pop());
    toast("Redone.");
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
    redo: '<path d="M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3"/>',
    highlighter: '<path d="M4 21h16"/><path d="M8 17l-1.5-1.5 9-9 3 3-9 9z"/><path d="M6.5 15.5L4 18h4"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    zoomin: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8 M10.5 7.5v6 M7.5 10.5h6"/>',
    zoomout: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8 M7.5 10.5h6"/>',
    arrow: '<path d="M3 12h16 M14 6l6 6-6 6"/>',
    line: '<path d="M3 12h18"/>',
    bullets: '<circle cx="5" cy="7" r="1.6" fill="currentColor"/><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="5" cy="17" r="1.6" fill="currentColor"/><path d="M10 7h10 M10 12h10 M10 17h10"/>',
    numbers: '<path d="M4 5h2v5 M4 10h3 M4 14.5a1.5 1.5 0 1 1 2.6 1L4 19h3.2 M10 7h10 M10 12h10 M10 17h10"/>',
    align: '<path d="M4 6h16 M4 11h10 M4 16h16 M4 21h10"/>',
    textsize: '<path d="M4 19L9 5l5 14 M5.4 14.5h7.2"/><path d="M16 19l2.6-7 2.6 7 M16.6 17h4"/>',
    textcolor: '<path d="M4 20h16"/><path d="M6.5 16L11 4h2l4.5 12"/><path d="M8 12h8"/>',
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
      tbBtn("undo", "Undo (Ctrl+Z)", undo),
      tbBtn("redo", "Redo (Ctrl+Y)", redo)
    ));
    el.toolbar.appendChild(h("div", { class: "tb-group" },
      tbBtn("bullets", "Bulleted list: click in a text, then here (Ctrl+Shift+8)", function () { listFormat("bullet"); }, { keepFocus: true }),
      tbBtn("numbers", "Numbered list: click in a text, then here (Ctrl+Shift+7)", function () { listFormat("number"); }, { keepFocus: true }),
      tbBtn("align", "Text align: click in a text, then here", function () { togglePop("align"); }, { pop: "align", keepFocus: true }),
      tbBtn("textsize", "Text size: click in a text, then here", function () { togglePop("textsize"); }, { pop: "textsize", keepFocus: true }),
      tbBtn("textcolor", "Text colour: click in a text, then here", function () { togglePop("textcolor"); }, { pop: "textcolor", keepFocus: true })
    ));
    el.toolbar.appendChild(h("div", { class: "tb-group" },
      tbBtn("shape", "Insert a shape", function () { togglePop("shape"); }, { pop: "shape" }),
      tbBtn("highlighter", "Insert a highlighter (yellow bar, in front)", insertHighlighter),
      tbBtn("layers", "Layers: every shape and moved text on this stage", function () { togglePop("layers"); }, { pop: "layers" })
    ));
    el.toolbar.appendChild(h("div", { class: "tb-group tb-zoom" },
      tbBtn("zoomout", "Zoom out (Ctrl + -)", function () { setZoom(S.zoom / 1.25); }),
      h("button", { type: "button", class: "tb-zoom-val", title: "Zoom: click for 100% (Ctrl+0)", onclick: function () { setZoom(1); }, text: Math.round(S.zoom * 100) + "%" }),
      tbBtn("zoomin", "Zoom in (Ctrl + +) · Space + drag or scroll to pan", function () { setZoom(S.zoom * 1.25); })
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
          h("p", { class: "field-help", text: "Colour matches this stage automatically. Click a shape for its tools (colour, position, rotation, lock…); right-click for more." })
        );
      }
    },
    align: {
      title: "Text align",
      build: function () {
        var cur = currentStyleEntry();
        var active = cur ? cur.value.align : null;
        function pick(val, label) {
          return h("button", {
            type: "button", class: "align-pick" + (active === val ? " active" : ""),
            onclick: function () { setTextStyle({ align: val }); }
          }, label);
        }
        return h("div", { class: "pop-body" },
          h("div", { class: "align-picks" }, pick("left", "Left"), pick("center", "Center"), pick("right", "Right"), pick(undefined, "Auto")),
          h("p", { class: "field-help", text: cur ? "Applies to the text you last clicked on the stage." : "Click a text on the stage first, then choose here." })
        );
      }
    },
    textsize: {
      title: "Text size",
      /* 100% = the field's own untouched rendered size, measured now from its computed style (not a
         nominal constant). The slider is logarithmic, so it scales symmetrically: the same distance
         halves or doubles. Back at 100% the override is removed, so the field is exactly untouched. */
      build: function () {
        var cur = currentStyleEntry();
        var scene = liveScene();
        var node = cur && scene ? scene.querySelector('[data-ll-key="' + CSS.escape(cur.key) + '"]') : null;
        var natural = node ? naturalFontPx(node) : 0;
        var k = node && natural ? parseFloat(window.getComputedStyle(node).fontSize) / natural : 1;
        var lim = Math.round(Math.log(LL.TEXT_SCALE_MAX) / Math.LN2 * 100) / 100; // 1.32: 2^±1.32 ≈ 250% / 40%
        function toK(v) {
          var kk = Math.round(Math.pow(2, v) * 20) / 20; // whole 5% steps (50%, 150% … land exactly)
          return Math.max(LL.TEXT_SCALE_MIN, Math.min(LL.TEXT_SCALE_MAX, kk));
        }
        var slider = h("input", { type: "range", class: "size-slider", min: String(-lim), max: String(lim), step: "0.01", value: String(Math.log(k) / Math.LN2), disabled: node ? null : "disabled", "aria-label": "Text size" });
        var val = h("span", { class: "size-val", text: Math.round(k * 100) + "%" });
        slider.addEventListener("input", function () {
          var kk = toK(parseFloat(slider.value));
          val.textContent = Math.round(kk * 100) + "%";
          if (node) node.style.fontSize = natural * kk + "px"; // live preview; saved on release
        });
        slider.addEventListener("change", function () {
          var kk = toK(parseFloat(slider.value));
          setTextStyle({ scale: kk === 1 ? undefined : kk, size: undefined });
        });
        return h("div", { class: "pop-body" },
          h("div", { class: "size-row" }, slider, val),
          h("button", { type: "button", class: "btn", "data-act": "size-reset", onclick: function () { setTextStyle({ scale: undefined, size: undefined }); } }, "Reset to auto"),
          h("p", { class: "field-help", text: cur ? "100% = how this text looks untouched. Applies to the text you last clicked on the stage." : "Click a text on the stage first, then choose here." })
        );
      }
    },
    layers: {
      title: "Layers",
      build: function () {
        var st = currentStage();
        var scene = liveScene();
        var refs = freeRefs(st).slice().reverse(); // top of the pile first
        if (!refs.length) return h("div", { class: "pop-body" }, h("p", { class: "field-help", text: "No shapes or moved text on this stage yet. Insert a shape, or drag a text by its handle." }));
        return h("div", { class: "pop-body" },
          h("div", { class: "layer-list" }, refs.map(function (r) {
            var d = elemData(st, r);
            var shape = refKind(r) === "shape";
            var n = elemNode(r, scene);
            var name = shape ? (d.label ? "“" + d.label + "”" : d.shape.charAt(0).toUpperCase() + d.shape.slice(1)) : (n && n.textContent.trim() ? "“" + n.textContent.trim().slice(0, 32) + (n.textContent.trim().length > 32 ? "…" : "") + "”" : refId(r));
            return h("button", { type: "button", class: "layer-row" + (S.sel.indexOf(r) !== -1 ? " active" : ""), "data-ref": r,
              onclick: function (e) {
                if (e.shiftKey) toggleSel(r); else setSel([r]);
                var node = elemNode(r);
                if (node && shape) node.focus({ preventScroll: true });
              } },
              h("span", { class: "layer-kind", text: shape ? (d.z === "front" ? "Shape · front" : "Shape · back") : "Text" }),
              h("span", { class: "layer-name", text: name }),
              d.locked ? h("span", { class: "layer-tag", text: "🔒" }) : null,
              groupOf(st, r) ? h("span", { class: "layer-tag", text: "group" }) : null);
          })),
          h("p", { class: "field-help", text: "Top of the list paints on top. Moved text always stays above shapes. Shift-click adds to the selection." })
        );
      }
    },
    textcolor: {
      title: "Text colour",
      build: function () {
        var cur = currentStyleEntry();
        var active = cur ? cur.value.color : null;
        function swatch(role, label) {
          var btn = h("button", {
            type: "button", class: "deco-swatch" + (!role ? " deco-swatch-auto" : "") + (active === role ? " active" : ""),
            title: label, "aria-label": label,
            onclick: function () { setTextStyle({ color: role }); }
          });
          if (role) btn.style.setProperty("--sw", COLOR_ROLE_CSS[role].fill);
          return btn;
        }
        return h("div", { class: "pop-body" },
          h("div", { class: "deco-swatch-row" }, swatch(null, "Auto (stage ink)"), LL.COLOR_ROLES.map(function (role) { return swatch(role, role); })),
          h("p", { class: "field-help", text: cur ? "Applies to the text you last clicked on the stage." : "Click a text on the stage first, then choose here." })
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

  /* ---------- Text align / size: per-field layout override, stored in stage.textStyle ---------- */

  function currentStyleEntry() {
    var path = S.lastTextPath;
    if (!path) return null;
    var st = S.lesson.stages[path[1]];
    if (!st) return null;
    var key = textStyleKey(path);
    return { stageIndex: path[1], key: key, value: (st.textStyle && st.textStyle[key]) || {} };
  }

  function setTextStyle(patch) {
    var cur = currentStyleEntry();
    if (!cur) return toast("Click into a text on the stage first, then choose here.");
    mutate("textstyle:" + cur.key, function (l) {
      var st = l.stages[cur.stageIndex];
      var ts = st.textStyle || (st.textStyle = {});
      var entry = Object.assign({}, ts[cur.key], patch);
      Object.keys(entry).forEach(function (k) { if (entry[k] === undefined) delete entry[k]; });
      if (Object.keys(entry).length) ts[cur.key] = entry;
      else delete ts[cur.key];
      if (!Object.keys(ts).length) delete st.textStyle;
    }, { scene: true });
    renderPop();
  }

  // Remember the last text field the teacher clicked into (scene text or a popover field).
  document.addEventListener("focusin", function (e) {
    if (!S.editing) return;
    var t = e.target;
    if ((t.isContentEditable && t.classList.contains("editable")) ||
        (el.pop && el.pop.contains(t) && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t.type === "text")))) {
      S.lastEditable = t;
    }
    // Align / text size target the field's lesson path, not the DOM node, so it survives the rerender they cause.
    if (t.isContentEditable && t.classList.contains("editable") && t._llPath) S.lastTextPath = t._llPath;
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
      ["Ctrl+Y  (Ctrl+Shift+Z)", "Redo (after an undo)"],
      ["A", "Add a stage after this one"],
      ["Alt+↑ / Alt+↓", "Move this stage"],
      ["Delete", "Delete this stage (asks first) · with shapes selected: remove them"],
      ["Arrows / Shift+Arrows", "Nudge the selected shapes / moved text (0.5% / 2%)"],
      ["Ctrl+D", "Duplicate the selected shapes"],
      ["Ctrl+G / Ctrl+Shift+G", "Group / ungroup the selection"],
      ["Shift+click · drag on empty space", "Add to the selection · select with a box"],
      ["Right-click", "More actions on a shape or moved text"],
      ["Ctrl + + / Ctrl + - / Ctrl+0", "Zoom in / out / 100% (edit view only)"],
      ["Space + drag  ·  scroll", "Pan while zoomed (a Space tap still starts the timer)"],
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
    // Redo: Ctrl+Y (and Ctrl+Shift+Z), same history.
    if (inLesson && S.editing && (e.ctrlKey || e.metaKey) && ((!e.shiftKey && k.toLowerCase() === "y") || (e.shiftKey && k.toLowerCase() === "z"))) {
      e.preventDefault();
      redo();
      return;
    }
    // Canvas shortcuts (edit mode, not while typing): zoom, duplicate, group / ungroup.
    if (inLesson && S.editing && !typing && (e.ctrlKey || e.metaKey) && !e.altKey) {
      if (k === "=" || k === "+" || e.code === "NumpadAdd") { e.preventDefault(); return setZoom(S.zoom * 1.25); }
      if (k === "-" || k === "_" || e.code === "NumpadSubtract") { e.preventDefault(); return setZoom(S.zoom / 1.25); }
      if (k === "0") { e.preventDefault(); return setZoom(1); }
      if (!e.shiftKey && k.toLowerCase() === "d") { e.preventDefault(); return duplicateSel(); }
      if (k.toLowerCase() === "g") { e.preventDefault(); return e.shiftKey ? ungroupSel() : groupSel(); }
    }

    if (k === "Escape") {
      if (closeCtxMenu()) return;
      if (typing) return e.target.blur();
      if (S.help) return setHelp(false);
      if (inLesson && S.editing && closePop()) return;
      if (inLesson && S.editing && S.sel.length) return setSel([]);
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
    // Arrows nudge the selection (Shift: bigger step) instead of changing stage.
    if (inLesson && S.editing && S.sel.length && !e.ctrlKey && !e.metaKey && !e.altKey && /^Arrow/.test(k)) {
      e.preventDefault();
      var stepPct = e.shiftKey ? NUDGE_BIG : NUDGE;
      return nudge(k === "ArrowLeft" ? -stepPct : k === "ArrowRight" ? stepPct : 0, k === "ArrowUp" ? -stepPct : k === "ArrowDown" ? stepPct : 0);
    }
    // Space in edit mode: held = pan the zoomed scene with a drag; a tap still starts / pauses the timer.
    if (inLesson && S.editing && k === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (!e.repeat) { S.spaceDown = true; S.spacePanned = false; el.stageWrap.classList.add("space-pan"); }
      return;
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
        if (S.sel.length) return deleteRefs(S.sel);
        var focused = document.activeElement;
        if (focused && focused.classList && focused.classList.contains("deco")) return deleteRefs(["shape:" + focused.getAttribute("data-id")]);
        return askDeleteStage();
      }
    }
  });

  window.addEventListener("blur", function () { // Space released outside the window: never leave pan mode stuck
    S.spaceDown = false;
    if (el.stageWrap) el.stageWrap.classList.remove("space-pan");
  });

  document.addEventListener("keyup", function (e) {
    if (e.key !== " " || !S.spaceDown) return;
    S.spaceDown = false;
    if (el.stageWrap) el.stageWrap.classList.remove("space-pan");
    if (!S.spacePanned && S.route.view === "lesson" && S.lesson) toggleTimer();
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
