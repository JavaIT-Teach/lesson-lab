/*
 * Mechanic: reveal-board
 * A grid of items (letters, numbers, words or pictures), all on screen for the whole stage.
 * Live teacher controls (keys, never baked into the data):
 *   - a highlight, stepped item by item or group by group (chorus by sound group);
 *   - missing-item mode: an ON/OFF toggle that blanks a chosen subset in place.
 * See MECHANICS.md.
 */
(function () {
  "use strict";

  var LL = window.LL;
  var h = LL.ui.h;

  /* textColor is one of nine colour words, each mapped to one fixed shade (the same as the colour swatches).
     No free colour input: the teacher picks a word, the app owns the colour. */
  var INK = {
    black: "#141414", blue: "#1f5fd6", brown: "#7b4a1e", green: "#1f9a45", grey: "#8c8c8c",
    orange: "#ff8a00", red: "#e0201b", white: "#ffffff", yellow: "#ffd400"
  };
  var INK_WORDS = Object.keys(INK);

  /* An item's group field may hold the group id or the group label (the edit form only shows labels). */
  function groupIndex(groups, ref) {
    if (!ref) return -1;
    var r = String(ref).trim().toLowerCase();
    for (var i = 0; i < groups.length; i++) {
      if (String(groups[i].id).toLowerCase() === r || String(groups[i].label || "").trim().toLowerCase() === r) return i;
    }
    return -1;
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Items missing-item mode may blank: the ones marked "can be blanked", or all if none are marked. */
  function eligible(items) {
    var marked = items.filter(function (it) { return it.blankable; });
    return (marked.length ? marked : items).map(function (it) { return it.id; });
  }

  /* A fresh blank set: `blankCount` random eligible items, or all eligible if no count is set. */
  function pickBlanks(data, reroll) {
    var pool = eligible(data.items);
    var n = Number(data.blankCount) || 0;
    if (reroll && (!n || n >= pool.length)) n = Math.max(1, Math.ceil(pool.length / 2));
    if (!n || n >= pool.length) return pool;
    return shuffle(pool).slice(0, n);
  }

  LL.registerMechanic({
    id: "reveal-board",
    description: "A grid of letters, numbers, words or pictures that stays on screen; the teacher highlights items or groups live and can blank a subset (missing-item mode) at any moment.",
    speaking:
      "The teacher sets pace and grouping live: the whole class choruses the highlighted item or group, " +
      "or names the blanked ones in pairs. The board itself does not force pairing — the stage's " +
      "rationale.output must say which choral or paired production is planned around it.",

    keys: [
      ["N / B", "Highlight next / previous item"],
      ["G", "Highlight next group (chorus by group)"],
      ["O", "Clear the highlight"],
      ["M", "Missing-item mode on / off"],
      ["V", "Blank a different set (turns missing-item mode on)"],
      ["Click an item", "Highlight it · in missing-item mode: blank / unblank it"]
    ],

    schema: {
      cue: { type: "string", label: "Cue", placeholder: "Listen and repeat.", help: "Optional. One short line above the board." },
      items: {
        type: "list", required: true, label: "Items", itemLabel: "Item",
        item: {
          type: "object",
          fields: {
            label: { type: "string", required: true, label: "Label", help: "A letter, number or word. With a picture it is the caption." },
            picture: { type: "string", format: "image", label: "Picture", placeholder: "assets/…/file.svg", help: "Optional." },
            group: { type: "string", label: "Group", help: "Optional. The name (or id) of one of the Groups below." },
            blankable: { type: "boolean", label: "Can be blanked in missing-item mode" },
            textColor: { type: "string", options: INK_WORDS, label: "Text colour", help: "Optional. Draws the label in this colour instead of the default ink (e.g. 'say the colour, not the word'). Only these nine colours." }
          }
        }
      },
      groups: {
        type: "list", label: "Groups (chorus by group)", itemLabel: "Group",
        item: { type: "object", fields: { label: { type: "string", required: true, label: "Name", placeholder: "/eɪ/ like 'say'" } } }
      },
      blankCount: {
        type: "number", label: "How many to blank", min: 0,
        help: "Optional. Empty or 0 = every item marked 'can be blanked' (or all items if none are marked). A number = that many, picked at random; V picks again."
      }
    },

    validate: function (data) {
      var p = [];
      var groups = data.groups || [];
      data.items.forEach(function (it, i) {
        if (it.group && groupIndex(groups, it.group) === -1)
          p.push("Item " + (i + 1) + " (“" + it.label + "”) is in group “" + it.group + "”, which is not in the Groups list.");
      });
      groups.forEach(function (g, i) {
        var used = data.items.some(function (it) { return groupIndex(groups, it.group) === i; });
        if (!used) p.push("Group “" + g.label + "” has no items.");
      });
      var n = Number(data.blankCount) || 0;
      if (n && n > eligible(data.items).length)
        p.push("How many to blank (" + n + ") is more than the items that can be blanked (" + eligible(data.items).length + ").");
      return p;
    },

    css: [
      ".rb { display: flex; flex-direction: column; align-items: center; gap: 2.2vh; width: 100%; max-width: 1700px; }",
      ".rb-top { min-height: 1.4em; display: flex; gap: 1rem; align-items: center; justify-content: center; flex-wrap: wrap;",
      "  font-size: clamp(1.3rem, 2.4vw, 2.6rem); font-weight: 900; color: var(--ink); text-align: center; }",
      ".rb-cue { margin: 0; }",
      ".rb-group { padding: 0.2em 0.9em; border-radius: 99px; background: var(--accent); color: var(--accent-ink, #17122b);",
      "  box-shadow: 0 0.15em 0 rgba(0,0,0,0.2); animation: rb-pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) both; }",
      ".rb-grid { display: grid; grid-template-columns: repeat(var(--rb-cols), minmax(0, 1fr)); gap: 1.4vmin; width: 100%; }",
      ".rb-tile { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3vh;",
      "  min-height: calc(58vh / var(--rb-rows)); padding: 0.6vmin; border-radius: 2.2vmin; cursor: pointer; user-select: none;",
      "  background: rgba(255,255,255,0.94); color: #1d1435; box-shadow: 0 0.8vmin 0 rgba(0,0,0,0.2);",
      "  font-size: calc(min(24vh / var(--rb-rows), 34vw / var(--rb-cols)) * var(--rb-scale)); font-weight: 900; line-height: 1;",
      "  transition: transform 0.3s cubic-bezier(0.2, 1.4, 0.4, 1), background 0.25s, box-shadow 0.25s, opacity 0.25s;",
      "  animation: rb-in 0.5s cubic-bezier(0.2, 1.3, 0.4, 1) both; }",
      ".rb-label { overflow-wrap: anywhere; text-align: center; }",
      ".rb-pic { width: 100%; flex: 1; min-height: 0; max-height: calc(40vh / var(--rb-rows)); object-fit: contain; }",
      ".rb-has-pic .rb-label { font-size: clamp(0.9rem, min(12vh / var(--rb-rows), 15vw / var(--rb-cols)), 2.6rem); } /* captions: readable, not tied to the longest label */",
      ".rb-dim .rb-tile:not(.rb-hl) { opacity: 0.55; transform: scale(0.94); }",
      ".rb-tile.rb-hl { background: var(--accent); color: var(--accent-ink, #17122b); transform: scale(1.1) rotate(-2deg); z-index: 1;",
      "  box-shadow: 0 0 0 0.7vmin rgba(255,255,255,0.85), 0 1.4vmin 3vmin rgba(0,0,0,0.35); animation: rb-hl 0.5s cubic-bezier(0.2, 1.4, 0.4, 1); }",
      ".rb-tile.rb-blank { background: rgba(0,0,0,0.18); color: transparent; box-shadow: inset 0 0 0 0.5vmin var(--shape), 0 0.8vmin 0 rgba(0,0,0,0.15);",
      "  animation: rb-flip 0.45s ease both; }",
      ".rb-tile.rb-blank > * { visibility: hidden; }",
      /* Coloured labels (textColor): a neutral tile and a dark outline keep every ink readable, white and yellow included;
         the highlight never changes the tile colour, so it cannot hide or change the ink. */
      ".rb-tile.rb-inked { background: #c9c9d1; }",
      ".rb-inked .rb-label { -webkit-text-stroke: 0.035em #1d1435; paint-order: stroke fill; text-shadow: 0 0.04em 0 rgba(0,0,0,0.25); }",
      ".rb-tile.rb-inked.rb-hl { background: #c9c9d1; box-shadow: 0 0 0 0.9vmin var(--accent), 0 1.4vmin 3vmin rgba(0,0,0,0.35); }",
      ".rb-tile.rb-hl, .rb-tile.rb-blank { animation-delay: 0s !important; } /* the entrance stagger must not delay live changes */",
      ".rb-tile.rb-blank::after { content: '?'; position: absolute; color: var(--ink); opacity: 0.75; }",
      ".rb-tile.rb-blank.rb-hl { background: var(--accent); }",
      ".rb-tile.rb-blank.rb-hl::after { color: var(--accent-ink, #17122b); opacity: 1; }",
      ".rb-mode { position: absolute; left: 3vw; bottom: 3vh; padding: 0.3em 0.8em; border-radius: 99px; font-weight: 900;",
      "  font-size: clamp(0.9rem, 1.2vw, 1.2rem); background: rgba(0,0,0,0.28); color: var(--ink); }",
      ".editing .rb-tile { cursor: text; animation: none; }",
      ".editing .rb-tile.rb-can-blank { box-shadow: inset 0 0 0 0.4vmin rgba(0,0,0,0.25), 0 0.8vmin 0 rgba(0,0,0,0.2); }",
      ".rb-edit-note { margin: 0; font-size: 1rem; font-weight: 700; color: var(--ink); opacity: 0.85; }",
      "@keyframes rb-in { from { opacity: 0; transform: translateY(2vh) scale(0.6); } to { opacity: 1; transform: none; } }",
      "@keyframes rb-hl { 0% { transform: scale(0.9); } 60% { transform: scale(1.18) rotate(-3deg); } 100% { transform: scale(1.1) rotate(-2deg); } }",
      "@keyframes rb-flip { from { transform: rotateY(90deg); } to { transform: none; } }",
      "@keyframes rb-pop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: none; } }"
    ].join("\n"),

    render: function (root, data, ctx) {
      var items = data.items || [];
      var groups = data.groups || [];
      var st = ctx.state;
      if (st.hl === undefined) st.hl = null; // { kind: "item" | "group", id }
      if (st.missing === undefined) st.missing = false;
      if (!Array.isArray(st.blanks)) st.blanks = pickBlanks(data, false);
      // Items deleted in edit mode drop out of the live state.
      var ids = items.map(function (it) { return it.id; });
      st.blanks = st.blanks.filter(function (id) { return ids.indexOf(id) !== -1; });

      var n = items.length;
      var cols = n <= 4 ? Math.max(1, n) : Math.ceil(Math.sqrt(n * 1.6));
      var rows = Math.max(1, Math.ceil(n / cols));
      var longest = items.reduce(function (m, it) { return Math.max(m, String(it.label || "").length); }, 1);

      var board = h("div", { class: "rb" });
      var top = h("div", { class: "rb-top" });
      var cueEl = null;
      if (data.cue || ctx.editing) {
        cueEl = h("p", { class: "rb-cue" });
        ctx.bind(cueEl, "cue", { placeholder: "Cue (optional)" });
      }
      var groupEl = h("span", { class: "rb-group" });
      var grid = h("div", { class: "rb-grid" });
      grid.style.setProperty("--rb-cols", cols);
      grid.style.setProperty("--rb-rows", rows);
      grid.style.setProperty("--rb-scale", Math.min(1, 2.4 / Math.max(1, longest - 0.5)));

      var tiles = items.map(function (it, i) {
        var tile = h("div", { class: "rb-tile" + (it.picture ? " rb-has-pic" : "") + (it.blankable ? " rb-can-blank" : ""), style: { animationDelay: Math.min(i * 25, 700) + "ms" } });
        if (it.picture) {
          var img = h("img", { class: "rb-pic", src: it.picture, alt: it.label || "" });
          img.addEventListener("error", function () { img.remove(); tile.classList.remove("rb-has-pic"); });
          tile.appendChild(img);
        }
        var label = h("span", { class: "rb-label" });
        ctx.bind(label, "items." + i + ".label", { placeholder: "Label" });
        if (INK[it.textColor]) {
          label.style.color = INK[it.textColor];
          tile.classList.add("rb-inked");
        }
        tile.appendChild(label);
        if (!ctx.editing) tile.addEventListener("click", function () { clickTile(it.id); });
        grid.appendChild(tile);
        return tile;
      });

      if (cueEl) top.appendChild(cueEl);
      top.appendChild(groupEl);
      board.appendChild(top);
      board.appendChild(grid);
      if (ctx.editing) board.appendChild(h("p", { class: "rb-edit-note", text: "Edit mode shows every item. Items with a dark inner edge can be blanked." }));
      root.appendChild(board);
      var modeEl = h("div", { class: "rb-mode", text: "Missing-item mode" });
      root.appendChild(modeEl);

      function hlGroupIndex() {
        return st.hl && st.hl.kind === "group" ? groups.map(function (g) { return g.id; }).indexOf(st.hl.id) : -1;
      }

      function update() {
        var gi = hlGroupIndex();
        items.forEach(function (it, i) {
          var on = !!st.hl && (st.hl.kind === "item" ? st.hl.id === it.id : gi !== -1 && groupIndex(groups, it.group) === gi);
          tiles[i].classList.toggle("rb-hl", on);
          tiles[i].classList.toggle("rb-blank", !ctx.editing && st.missing && st.blanks.indexOf(it.id) !== -1);
        });
        grid.classList.toggle("rb-dim", !!st.hl && !ctx.editing);
        groupEl.hidden = gi === -1;
        groupEl.textContent = gi === -1 ? "" : groups[gi].label;
        if (gi !== -1) { groupEl.style.animation = "none"; void groupEl.offsetWidth; groupEl.style.animation = ""; }
        modeEl.hidden = ctx.editing || !st.missing;
      }

      function stepItem(d) {
        if (!n) return;
        var i = st.hl && st.hl.kind === "item" ? items.map(function (x) { return x.id; }).indexOf(st.hl.id) : -1;
        i = i === -1 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n;
        st.hl = { kind: "item", id: items[i].id };
      }

      function stepGroup() {
        if (!groups.length) return;
        var i = hlGroupIndex() + 1;
        st.hl = i >= groups.length ? null : { kind: "group", id: groups[i].id };
      }

      function clickTile(id) {
        if (st.missing) {
          var k = st.blanks.indexOf(id);
          if (k === -1) st.blanks.push(id);
          else st.blanks.splice(k, 1);
        } else {
          st.hl = st.hl && st.hl.kind === "item" && st.hl.id === id ? null : { kind: "item", id: id };
        }
        update();
      }

      update();

      return {
        onKey: function (e) {
          switch (e.key.toLowerCase()) {
            case "n": stepItem(1); break;
            case "b": stepItem(-1); break;
            case "g": stepGroup(); break;
            case "o": st.hl = null; break;
            case "m": st.missing = !st.missing; break;
            case "v": st.blanks = pickBlanks(data, true); st.missing = true; break;
            default: return false;
          }
          update();
          return true;
        }
      };
    },

    editor: function (root, ctx) {
      root.appendChild(ctx.form());
    }
  });
})();
