/*
 * Mechanic: drill-check
 * Students commit to an answer (write it, or say it to a partner) before the teacher reveals it.
 * Two live modes (M switches): step (one item, prompt, then reveal) and all (every item on
 * screen; reveal any single item in any order — "collect everything, reveal only the disputed ones").
 * What is revealed is live state, never saved. See MECHANICS.md.
 */
(function () {
  "use strict";

  var LL = window.LL;
  var h = LL.ui.h;

  var MODES = ["step", "all"];

  LL.registerMechanic({
    id: "drill-check",
    description: "Students commit to an answer before the teacher reveals it: one item at a time, or all items on screen with any single answer revealed in any order.",
    speaking:
      "Every student commits before any answer is shown — writes it, or says it to a partner (the pair cue says which). " +
      "Nobody can wait for someone else's answer, because the reveal only comes after everyone has committed. " +
      "The stage's rationale.output must state what students commit to.",

    keys: [
      ["N / B", "Next / previous item"],
      ["V", "Reveal / hide this item's answer"],
      ["Shift+V", "Reveal all / hide all"],
      ["M", "Switch: one at a time ↔ all on screen"],
      ["O", "Hide every answer again"],
      ["Click an item", "(All on screen) reveal / hide that item's answer"]
    ],

    schema: {
      mode: { type: "string", label: "Start in", default: "step", placeholder: "step", help: "step = one item at a time · all = every item on screen, reveal any in any order. M switches live." },
      commitCue: { type: "string", label: "Commit cue", placeholder: "Write your answer. Show your partner.", help: "Optional. What students do before the reveal. Shown until the answer is revealed." },
      items: {
        type: "list", required: true, label: "Items", itemLabel: "Item",
        item: {
          type: "object",
          fields: {
            prompt: { type: "string", required: true, multiline: true, label: "Prompt" },
            answer: { type: "string", label: "Answer", help: "Optional. Without one, the reveal just marks the item as checked." },
            picture: { type: "string", format: "image", label: "Picture", placeholder: "assets/…/file.svg", help: "Optional." },
            pairCue: { type: "string", label: "Pair cue", placeholder: "A says it, B writes it.", help: "Optional. Who does what for this item." }
          }
        }
      }
    },

    validate: function (data) {
      if (data.mode && MODES.indexOf(String(data.mode).trim()) === -1)
        return ["Start in must be “step” or “all” (it is “" + data.mode + "”)."];
      return [];
    },

    css: [
      ".dc { display: flex; flex-direction: column; align-items: center; gap: 2.4vh; width: 100%; max-width: 1600px; }",
      ".dc-card { display: flex; align-items: center; justify-content: center; gap: 4vw; animation: dc-in 0.5s cubic-bezier(0.2, 1.3, 0.4, 1) both; }",
      ".dc-card-body { display: flex; flex-direction: column; align-items: center; gap: 3vh; text-align: center; min-width: 0; }",
      ".dc-prompt { margin: 0; font-size: clamp(2.4rem, 5.6vw, 7rem); font-weight: 900; line-height: 1.08; color: var(--ink);",
      "  text-shadow: 0 0.06em 0 rgba(0,0,0,0.18); white-space: pre-wrap; overflow-wrap: anywhere; }",
      ".dc-pic { width: min(30vw, 44vh); aspect-ratio: 1; object-fit: contain; padding: 1vmin; border-radius: 3vmin; background: #fff;",
      "  box-shadow: 0 1.6vmin 0 rgba(0,0,0,0.18); transform: rotate(-3deg); }",
      ".dc-pair { margin: 0; padding: 0.35em 0.9em; border-radius: 99px; background: rgba(0,0,0,0.22); color: var(--ink);",
      "  font-size: clamp(1.1rem, 1.9vw, 2rem); font-weight: 800; }",
      ".dc-answer { margin: 0; padding: 0.3em 0.9em; border-radius: 2vmin; background: var(--accent); color: var(--accent-ink, #17122b);",
      "  font-size: clamp(2rem, 4.4vw, 5.4rem); font-weight: 900; box-shadow: 0 0.12em 0 rgba(0,0,0,0.22); white-space: pre-wrap;",
      "  animation: dc-reveal 0.55s cubic-bezier(0.2, 1.5, 0.4, 1) both; }",
      ".dc-commit { margin: 0; padding: 0.4em 1em; border-radius: 99px; border: 0.2em dashed var(--accent); color: var(--ink);",
      "  font-size: clamp(1.2rem, 2.1vw, 2.2rem); font-weight: 900; animation: dc-pulse 2.2s ease-in-out infinite; }",
      ".dc-dots { display: flex; gap: 0.8vmin; }",
      ".dc-dot { width: 1.6vmin; height: 1.6vmin; border-radius: 50%; background: var(--shape); box-shadow: inset 0 0 0 0.25vmin var(--ink); opacity: 0.6; }",
      ".dc-dot.dc-seen { background: var(--accent); box-shadow: none; opacity: 0.9; }",
      ".dc-dot.dc-cur { transform: scale(1.5); opacity: 1; }",
      ".dc-grid { display: grid; grid-template-columns: repeat(var(--dc-cols), minmax(0, 1fr)); gap: 1.8vmin; width: 100%; }",
      ".dc-cell { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1vh;",
      "  min-height: calc(50vh / var(--dc-rows)); padding: 1.4vmin 1.6vmin; border-radius: 2.4vmin; cursor: pointer; text-align: center;",
      "  background: rgba(255,255,255,0.94); color: #1d1435; box-shadow: 0 0.8vmin 0 rgba(0,0,0,0.2);",
      "  transition: transform 0.25s cubic-bezier(0.2, 1.4, 0.4, 1), box-shadow 0.25s; animation: dc-in 0.45s cubic-bezier(0.2, 1.3, 0.4, 1) both; }",
      ".dc-cell.dc-cur { transform: scale(1.04); box-shadow: 0 0 0 0.6vmin var(--accent), 0 1.2vmin 2.4vmin rgba(0,0,0,0.3); }",
      ".dc-num { position: absolute; top: 0.8vmin; left: 1vmin; font-size: clamp(0.8rem, 1.1vw, 1.1rem); font-weight: 900; opacity: 0.45; }",
      ".dc-cell-prompt { font-size: calc(min(15vh / var(--dc-rows), 22vw / var(--dc-cols))); font-weight: 900; line-height: 1.1; white-space: pre-wrap; overflow-wrap: anywhere; }",
      ".dc-cell-pic { max-height: calc(22vh / var(--dc-rows)); max-width: 100%; object-fit: contain; }",
      ".dc-cell-answer { padding: 0.15em 0.6em; border-radius: 1.2vmin; font-weight: 900; font-size: calc(min(11vh / var(--dc-rows), 17vw / var(--dc-cols)));",
      "  background: #eee7fb; color: transparent; min-width: 3em; }",
      ".dc-cell-answer::before { content: '?'; color: #8f86a8; }",
      ".dc-cell.dc-open .dc-cell-answer { background: var(--accent); color: var(--accent-ink, #17122b); animation: dc-reveal 0.5s cubic-bezier(0.2, 1.5, 0.4, 1) both; }",
      ".dc-cell.dc-open .dc-cell-answer::before { content: none; }",
      ".dc-cell-pair { font-size: clamp(0.8rem, 1vw, 1.1rem); font-weight: 800; opacity: 0.7; }",
      ".editing .dc-cell, .editing .dc-card { animation: none; cursor: text; }",
      ".editing .dc-card { gap: 2.5vw; } .editing .dc-card-body { gap: 1.6vh; }",
      ".editing .dc-prompt { font-size: clamp(1.8rem, 3.4vw, 4.2rem); }",
      ".editing .dc-pic { width: min(18vw, 28vh); }",
      ".editing .dc-answer { font-size: clamp(1.3rem, 2.4vw, 3rem); }",
      ".editing .dc-pair, .editing .dc-commit { font-size: clamp(1rem, 1.5vw, 1.6rem); animation: none; }",
      ".editing .dc-cell-answer { color: inherit; } .editing .dc-cell-answer::before { content: none; }",
      "@keyframes dc-in { from { opacity: 0; transform: translateY(3vh) scale(0.9); } to { opacity: 1; transform: none; } }",
      "@keyframes dc-reveal { 0% { opacity: 0; transform: scale(0.3) rotate(-8deg); } 100% { opacity: 1; transform: none; } }",
      "@keyframes dc-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }",
      "@media (max-aspect-ratio: 1/1) { .dc-card { flex-direction: column; } }"
    ].join("\n"),

    render: function (root, data, ctx) {
      var items = data.items || [];
      var st = ctx.state;
      var ids = items.map(function (it) { return it.id; });
      if (MODES.indexOf(st.mode) === -1) st.mode = MODES.indexOf(String(data.mode || "").trim()) !== -1 ? String(data.mode).trim() : "step";
      if (!st.revealed) st.revealed = {};
      if (!st.seen) st.seen = {};
      if (ids.indexOf(st.cur) === -1) st.cur = ids[0];

      var wrap = h("div", { class: "dc" });
      root.appendChild(wrap);

      function idx() { return Math.max(0, ids.indexOf(st.cur)); }

      function draw() {
        wrap.innerHTML = "";
        if (!items.length) return;
        st.seen[st.cur] = true;
        if (st.mode === "step") drawStep();
        else drawAll();
      }

      function drawStep() {
        var i = idx(), it = items[i];
        var card = h("div", { class: "dc-card" });
        if (it.picture) {
          var img = h("img", { class: "dc-pic", src: it.picture, alt: "" });
          img.addEventListener("error", function () { img.remove(); });
          card.appendChild(img);
        }
        var body = h("div", { class: "dc-card-body" });
        var prompt = h("p", { class: "dc-prompt" });
        ctx.bind(prompt, "items." + i + ".prompt", { multiline: true, placeholder: "Prompt" });
        body.appendChild(prompt);
        if (it.pairCue || ctx.editing) {
          var pair = h("p", { class: "dc-pair" });
          ctx.bind(pair, "items." + i + ".pairCue", { placeholder: "Pair cue (optional)" });
          body.appendChild(pair);
        }
        if (ctx.editing) {
          var ans = h("p", { class: "dc-answer" });
          ctx.bind(ans, "items." + i + ".answer", { placeholder: "Answer (optional)" });
          body.appendChild(ans);
          var cc = h("p", { class: "dc-commit" });
          ctx.bind(cc, "commitCue", { placeholder: "Commit cue (optional)" });
          body.appendChild(cc);
        } else if (st.revealed[it.id]) {
          body.appendChild(h("p", { class: "dc-answer", text: it.answer || "✓ Checked" }));
        } else if (data.commitCue) {
          body.appendChild(h("p", { class: "dc-commit", text: data.commitCue }));
        }
        card.appendChild(body);
        wrap.appendChild(card);
        if (items.length > 1) {
          wrap.appendChild(h("div", { class: "dc-dots", "aria-hidden": "true" }, items.map(function (x) {
            return h("span", { class: "dc-dot" + (x.id === it.id ? " dc-cur" : "") + (st.seen[x.id] ? " dc-seen" : "") });
          })));
        }
      }

      function drawAll() {
        var n = items.length;
        var cols = n <= 3 ? n : Math.ceil(Math.sqrt(n * 1.4));
        var rows = Math.ceil(n / cols);
        var grid = h("div", { class: "dc-grid" });
        grid.style.setProperty("--dc-cols", cols);
        grid.style.setProperty("--dc-rows", rows);
        items.forEach(function (it, i) {
          var cell = h("div", {
            class: "dc-cell" + (it.id === st.cur && !ctx.editing ? " dc-cur" : "") + (st.revealed[it.id] ? " dc-open" : ""),
            style: { animationDelay: Math.min(i * 40, 600) + "ms" }
          });
          cell.appendChild(h("span", { class: "dc-num", text: String(i + 1) }));
          if (it.picture) {
            var img = h("img", { class: "dc-cell-pic", src: it.picture, alt: "" });
            img.addEventListener("error", function () { img.remove(); });
            cell.appendChild(img);
          }
          var prompt = h("div", { class: "dc-cell-prompt" });
          ctx.bind(prompt, "items." + i + ".prompt", { multiline: true, placeholder: "Prompt" });
          cell.appendChild(prompt);
          var ans = h("div", { class: "dc-cell-answer" });
          if (ctx.editing) ctx.bind(ans, "items." + i + ".answer", { placeholder: "Answer" });
          else if (st.revealed[it.id]) ans.textContent = it.answer || "✓";
          cell.appendChild(ans);
          if (it.pairCue) cell.appendChild(h("div", { class: "dc-cell-pair", text: it.pairCue }));
          if (!ctx.editing) {
            cell.addEventListener("click", function () {
              st.cur = it.id;
              st.revealed[it.id] = !st.revealed[it.id];
              draw();
            });
          }
          grid.appendChild(cell);
        });
        wrap.appendChild(grid);
        if (data.commitCue && !ctx.editing) wrap.appendChild(h("p", { class: "dc-commit", text: data.commitCue }));
      }

      draw();

      return {
        onKey: function (e) {
          if (!items.length) return false;
          var k = e.key.toLowerCase();
          if (k === "n" || k === "b") {
            st.cur = ids[(idx() + (k === "n" ? 1 : -1) + ids.length) % ids.length];
          } else if (k === "v" && e.shiftKey) {
            var allOpen = ids.every(function (id) { return st.revealed[id]; });
            ids.forEach(function (id) { st.revealed[id] = !allOpen; });
          } else if (k === "v") {
            st.revealed[st.cur] = !st.revealed[st.cur];
          } else if (k === "m") {
            st.mode = st.mode === "step" ? "all" : "step";
          } else if (k === "o") {
            st.revealed = {};
          } else {
            return false;
          }
          draw();
          return true;
        }
      };
    },

    editor: function (root, ctx) {
      root.appendChild(ctx.form());
    }
  });
})();
