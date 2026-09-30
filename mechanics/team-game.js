/*
 * Mechanic: team-game
 * Optional teams with live scores (none = no scoreboard), and a caller feed: a hidden pool (teacher view only)
 * the caller reveals one item at a time into a "called" list everyone sees.
 * Calling can be handed to a named student for a second round (a label in teacher view).
 * Scores, the called list and the caller are live state, never saved. See MECHANICS.md.
 */
(function () {
  "use strict";

  var LL = window.LL;
  var h = LL.ui.h;

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  LL.registerMechanic({
    id: "team-game",
    description: "A caller feed, with optional team scores: the caller reveals items one at a time from a hidden pool into a called list everyone sees.",
    speaking:
      "Not whole-class simultaneous speaking. Speech comes from the caller's turn (teacher, then a student in round 2) " +
      "and from teams checking and challenging claims against the called list. Most students listen and react " +
      "most of the time — pair it with a stage where everyone speaks at once.",

    keys: [
      ["N", "Call the next item from the hidden pool"],
      ["B", "Take back the last call"],
      ["Shift+1 – 9", "+1 point for team 1 – 9 (when the stage has teams)"],
      ["K", "Hand calling to a student / back to the teacher"],
      ["O", "New round: clear the called list (scores stay)"],
      ["Click", "Teacher view: call a pool item · score buttons: + / −"]
    ],

    schema: {
      instructions: { type: "string", multiline: true, label: "Instructions", placeholder: "Listen. Cross out the letter you hear. First team with five shouts BINGO!", help: "Optional. One or two lines on screen." },
      teams: {
        type: "list", label: "Teams", itemLabel: "Team",
        help: "Optional. No teams = no scoreboard: only the called items show (e.g. bingo with paper cards).",
        item: {
          type: "object",
          fields: {
            name: { type: "string", required: true, label: "Name" },
            score: { type: "number", label: "Starting score", help: "Usually 0. Live points are added with keys and are not saved." }
          }
        }
      },
      pool: {
        type: "list", required: true, label: "Caller pool (hidden from students)", itemLabel: "Pool item",
        item: {
          type: "object",
          fields: {
            label: { type: "string", required: true, label: "Value" },
            picture: { type: "string", format: "image", label: "Picture", placeholder: "assets/…/file.svg", help: "Optional." }
          }
        }
      },
      shuffle: { type: "boolean", label: "Call in random order", help: "Off = in the order listed." },
      studentCaller: { type: "string", label: "Student caller (round 2)", placeholder: "e.g. Aziz", help: "Optional. Name shown in teacher view when K hands calling to a student. You can also type it live." }
    },

    css: [
      ".tg { display: flex; flex-direction: column; align-items: center; gap: 2vh; width: 100%; max-width: 1700px; }",
      ".tg-instr { margin: 0; font-size: clamp(1.1rem, min(1.9vw, 3.6vh), 2.4rem); font-weight: 800; text-align: center; color: var(--ink); white-space: pre-wrap; }",
      ".tg-mid { display: flex; align-items: center; justify-content: center; gap: 3vw; width: 100%; }",
      ".tg-last { flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1vh;",
      "  min-width: min(24vw, 30vh); min-height: min(22vw, 26vh); padding: 2vmin 3vmin; border-radius: 4vmin; background: #fff; color: #1d1435;",
      "  box-shadow: 0 1.6vmin 0 rgba(0,0,0,0.2), 0 3vmin 7vmin rgba(0,0,0,0.3); font-size: clamp(3rem, min(8vw, 17vh), 10rem); font-weight: 900; line-height: 1; }",
      ".tg-last.tg-new { animation: tg-call 0.6s cubic-bezier(0.2, 1.5, 0.4, 1) both; }",
      ".tg-last img { max-height: 16vh; max-width: 26vw; object-fit: contain; }",
      ".tg-last.tg-has-pic span { font-size: 0.45em; }",
      ".tg-last-empty { font-size: clamp(1.6rem, 3vw, 3.4rem); opacity: 0.55; }",
      ".tg-called { display: flex; flex-wrap: wrap; gap: 1vmin; align-content: center; max-width: 48vw; }",
      ".tg-chip { padding: 0.2em 0.6em; border-radius: 1.4vmin; background: rgba(0,0,0,0.25); color: var(--ink); font-weight: 900;",
      "  font-size: clamp(1.1rem, 2vw, 2.4rem); animation: tg-chip 0.4s cubic-bezier(0.2, 1.4, 0.4, 1) both; }",
      ".tg-chip.tg-latest { background: var(--accent); color: var(--accent-ink, #17122b); }",
      ".tg-count { font-size: clamp(0.9rem, 1.2vw, 1.2rem); font-weight: 800; color: var(--ink); opacity: 0.75; width: 100%; }",
      ".tg-teams { display: flex; gap: 1.4vw 2vw; justify-content: center; flex-wrap: wrap; width: 100%; }",
      ".tg-team { position: relative; display: flex; align-items: center; gap: 1vmin; padding: 0.6vmin 1vmin 0.6vmin 2vmin; border-radius: 99px;",
      "  background: var(--accent); color: var(--accent-ink, #17122b); box-shadow: 0 0.7vmin 0 rgba(0,0,0,0.2); }",
      ".tg-team:nth-child(2n) { background: #fff; color: #1d1435; }",
      ".tg-team-key { font-size: clamp(0.8rem, 1vw, 1rem); font-weight: 900; opacity: 0.55; }",
      ".tg-team-name { font-size: clamp(1.1rem, 1.7vw, 2.2rem); font-weight: 900; }",
      ".tg-score { min-width: 1.6em; text-align: center; font-size: clamp(1.8rem, min(3vw, 6vh), 4rem); font-weight: 900; font-variant-numeric: tabular-nums; }",
      ".tg-score.tg-bump { animation: tg-bump 0.5s cubic-bezier(0.2, 1.6, 0.4, 1); }",
      ".tg-pm { width: 2.2em; height: 2.2em; border-radius: 50%; border: 0; background: rgba(0,0,0,0.14); color: inherit; font-weight: 900; font-size: clamp(0.9rem, 1.2vw, 1.3rem); }",
      ".tg-feed { width: 100%; padding: 1.2vmin 1.6vmin; border-radius: 2vmin; border: 0.3vmin dashed var(--accent); background: rgba(0,0,0,0.35); color: #fff; }",
      ".tg-feed-head { display: flex; flex-wrap: wrap; gap: 0.6rem 1.4rem; align-items: center; margin-bottom: 0.8vh; font-weight: 800; font-size: 1.05rem; }",
      ".tg-feed-head b { color: var(--accent); }",
      ".tg-feed-note { opacity: 0.7; font-weight: 700; font-size: 0.9rem; }",
      ".tg-pool { display: flex; flex-wrap: wrap; gap: 0.5rem; }",
      ".tg-pool-item { padding: 0.2em 0.6em; border-radius: 0.6em; border: 0; background: rgba(255,255,255,0.14); color: #fff; font-weight: 800; font-size: 1.1rem; }",
      ".tg-pool-item.tg-next { background: var(--accent); color: var(--accent-ink, #17122b); }",
      ".tg-pool-item.tg-used { opacity: 0.3; text-decoration: line-through; }",
      ".tg-feed .btn { margin-left: auto; }",
      ".editing .tg-last, .editing .tg-chip { animation: none; }",
      ".tg-with-feed { gap: 1.4vh; } .tg-with-feed .tg-last { min-height: 18vh; min-width: 20vh; font-size: clamp(2.4rem, min(6vw, 12vh), 7rem); }",
      ".tg-with-feed .tg-feed-head .btn { padding: 0.2rem 0.7rem; }",
      "@keyframes tg-call { 0% { opacity: 0; transform: scale(0.2) rotate(-15deg); } 100% { opacity: 1; transform: none; } }",
      "@keyframes tg-chip { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: none; } }",
      "@keyframes tg-bump { 0% { transform: scale(1); } 40% { transform: scale(1.6); } 100% { transform: scale(1); } }"
    ].join("\n"),

    render: function (root, data, ctx) {
      var st = ctx.state;
      var teams = data.teams || [];
      var pool = data.pool || [];
      var poolIds = pool.map(function (p) { return p.id; });
      var byId = {};
      pool.forEach(function (p) { byId[p.id] = p; });

      // Live state; drop ids of items deleted in edit mode, add new ones.
      if (!Array.isArray(st.called)) st.called = [];
      st.called = st.called.filter(function (id) { return byId[id]; });
      if (!Array.isArray(st.order) || st.shuffled !== !!data.shuffle) {
        st.order = data.shuffle ? shuffle(poolIds) : poolIds.slice();
        st.shuffled = !!data.shuffle;
      }
      st.order = st.order.filter(function (id) { return byId[id]; });
      poolIds.forEach(function (id) { if (st.order.indexOf(id) === -1) st.order.push(id); });
      if (!data.shuffle) st.order = poolIds.slice();
      if (!st.scores) st.scores = {};
      teams.forEach(function (t) { if (typeof st.scores[t.id] !== "number") st.scores[t.id] = Number(t.score) || 0; });
      if (!st.caller) st.caller = "teacher";
      if (st.callerName === undefined) st.callerName = data.studentCaller || "";
      if (!st.round) st.round = 1;

      var showFeed = ctx.teacher || ctx.editing;
      var wrap = h("div", { class: "tg" + (showFeed ? " tg-with-feed" : "") });

      if (data.instructions || ctx.editing) {
        var instr = h("p", { class: "tg-instr" });
        ctx.bind(instr, "instructions", { multiline: true, placeholder: "Instructions (optional)" });
        wrap.appendChild(instr);
      }

      var mid = h("div", { class: "tg-mid" });
      var last = h("div", { class: "tg-last" });
      var called = h("div", { class: "tg-called", "aria-live": "polite" });
      mid.appendChild(last);
      mid.appendChild(called);
      wrap.appendChild(mid);

      var teamWrap = h("div", { class: "tg-teams" });
      var scoreEls = {};
      teams.forEach(function (t, i) {
        var name = h("span", { class: "tg-team-name" });
        ctx.bind(name, "teams." + i + ".name", { placeholder: "Team name" });
        var score = h("span", { class: "tg-score" });
        scoreEls[t.id] = score;
        teamWrap.appendChild(h("div", { class: "tg-team" },
          i < 9 ? h("span", { class: "tg-team-key", title: "Shift+" + (i + 1), text: "⇧" + (i + 1) }) : null,
          name,
          ctx.editing ? null : h("button", { class: "tg-pm", title: "−1", onclick: function () { addPoint(t.id, -1); } }, "−"),
          score,
          ctx.editing ? null : h("button", { class: "tg-pm", title: "+1 (Shift+" + (i + 1) + ")", onclick: function () { addPoint(t.id, 1); } }, "+")
        ));
      });
      if (teams.length) wrap.appendChild(teamWrap); // no teams: no scoreboard at all

      // Caller feed: hidden pool, teacher view (and edit mode) only.
      var feed = null;
      if (showFeed) {
        feed = h("div", { class: "tg-feed" });
        wrap.appendChild(feed);
      }
      root.appendChild(wrap);

      function nextId() {
        for (var i = 0; i < st.order.length; i++) if (st.called.indexOf(st.order[i]) === -1) return st.order[i];
        return null;
      }

      function callItem(id, animate) {
        if (!id || st.called.indexOf(id) !== -1) return;
        st.called.push(id);
        draw(animate);
      }

      function addPoint(id, d) {
        st.scores[id] = (st.scores[id] || 0) + d;
        drawScores(id);
      }

      function drawScores(bumped) {
        teams.forEach(function (t) {
          var el = scoreEls[t.id];
          el.textContent = ctx.editing ? String(Number(t.score) || 0) : String(st.scores[t.id]);
          if (t.id === bumped) { el.classList.remove("tg-bump"); void el.offsetWidth; el.classList.add("tg-bump"); }
        });
      }

      function draw(animate) {
        var lastId = st.called[st.called.length - 1];
        last.innerHTML = "";
        last.className = "tg-last" + (animate ? " tg-new" : "");
        if (lastId) {
          var it = byId[lastId];
          if (it.picture) {
            last.classList.add("tg-has-pic");
            var img = h("img", { src: it.picture, alt: "" });
            img.addEventListener("error", function () { img.remove(); last.classList.remove("tg-has-pic"); });
            last.appendChild(img);
          }
          last.appendChild(h("span", { text: it.label }));
        } else {
          last.appendChild(h("span", { class: "tg-last-empty", text: ctx.editing ? "Called items appear here" : "Ready?" }));
        }

        called.innerHTML = "";
        st.called.forEach(function (id, i) {
          called.appendChild(h("span", { class: "tg-chip" + (i === st.called.length - 1 ? " tg-latest" : ""), text: byId[id].label }));
        });
        if (st.called.length) called.appendChild(h("span", { class: "tg-count", text: st.called.length + " of " + pool.length + " called" }));

        drawScores();
        if (feed) drawFeed();
      }

      function drawFeed() {
        feed.innerHTML = "";
        var student = st.caller === "student";
        var next = nextId();
        feed.appendChild(h("div", { class: "tg-feed-head" },
          h("span", null, "Caller: ", h("b", { text: student ? (st.callerName || "a student") + " (student)" : "Teacher" })),
          h("span", null, "Round ", h("b", { text: String(st.round) })),
          h("span", null, "Next: ", h("b", { text: next ? byId[next].label : "— pool empty —" })),
          h("span", { class: "tg-feed-note", text: "Teacher view only · click an item to call it" }),
          ctx.editing || !teams.length ? null : h("button", { class: "btn", onclick: function () {
            teams.forEach(function (t) { st.scores[t.id] = Number(t.score) || 0; });
            drawScores();
          } }, "Reset scores")
        ));
        var list = h("div", { class: "tg-pool" });
        st.order.forEach(function (id) {
          var i = poolIds.indexOf(id);
          var used = st.called.indexOf(id) !== -1;
          var chip = h(ctx.editing ? "span" : "button", { class: "tg-pool-item" + (used ? " tg-used" : "") + (id === next ? " tg-next" : "") });
          if (ctx.editing) ctx.bind(chip, "pool." + i + ".label", { placeholder: "Value" });
          else {
            chip.textContent = byId[id].label;
            chip.disabled = used;
            chip.addEventListener("click", function () { chip.blur(); callItem(id, true); });
          }
          list.appendChild(chip);
        });
        feed.appendChild(list);
      }

      function toggleCaller() {
        if (st.caller === "teacher") {
          if (!st.callerName) {
            var name = null;
            try { name = window.prompt("Who calls this round? (student's name — shown in teacher view only)", ""); } catch (e) { /* prompts blocked */ }
            if (name) st.callerName = name.trim();
          }
          st.caller = "student";
          LL.toast && LL.toast("Calling handed to " + (st.callerName || "a student") + ".");
        } else {
          st.caller = "teacher";
          LL.toast && LL.toast("Teacher calls again.");
        }
      }

      draw(false);

      return {
        onKey: function (e) {
          if (e.shiftKey && /^Digit[1-9]$/.test(e.code || "")) {
            var t = teams[Number(e.code.slice(5)) - 1];
            if (!t) return true;
            addPoint(t.id, 1);
            return true;
          }
          switch (e.key.toLowerCase()) {
            case "n": callItem(nextId(), true); return true;
            case "b": st.called.pop(); draw(false); return true;
            case "k": toggleCaller(); draw(false); return true;
            case "o": st.called = []; st.round += 1; draw(false); return true;
          }
          return false;
        }
      };
    },

    editor: function (root, ctx) {
      root.appendChild(ctx.form());
    }
  });
})();
