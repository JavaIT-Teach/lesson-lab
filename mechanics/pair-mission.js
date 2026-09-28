/*
 * Mechanic: pair-mission
 * A mission, a language frame, an optional bank students privately pick from, and a target
 * number of rounds / partners with a swap cue. The teacher advances rounds with a key.
 * Covers a fixed-partner drill (swap cue: "A moves one seat left") and a free mingle
 * (swap cue: "Find a new partner!"). The round count and round timer are live state. See MECHANICS.md.
 */
(function () {
  "use strict";

  var LL = window.LL;
  var h = LL.ui.h;

  function fmt(ms) {
    var s = Math.ceil(Math.max(0, ms) / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  LL.registerMechanic({
    id: "pair-mission",
    description: "A mission with a language frame and an optional private-pick bank, run over a set number of rounds or partners; the teacher calls each swap with a key.",
    speaking:
      "Every student is in a pair or moving to a new partner at the same time, in every round. " +
      "No one watches or waits: all pairs run the frame at once, then everyone swaps.",

    keys: [
      ["N", "Next round: show the swap cue (starts the round timer if set)"],
      ["B", "Back one round"],
      ["P", "Pause / restart the round timer"],
      ["W", "Show the swap cue again"],
      ["O", "Start again from round 1"]
    ],

    schema: {
      mission: { type: "string", required: true, multiline: true, label: "Mission", placeholder: "Find three people with the same letter as you." },
      frame: { type: "string", multiline: true, label: "Language frame", placeholder: "A: What's your letter?\nB: It's … . And you?", help: "Optional. The exact language pairs use. Each line on its own line." },
      bankCue: { type: "string", label: "Bank cue", placeholder: "Pick one. Keep it secret!", help: "Optional. Shown above the bank." },
      bank: {
        type: "list", label: "Bank (students privately pick one)", itemLabel: "Bank item",
        item: {
          type: "object",
          fields: {
            label: { type: "string", required: true, label: "Label" },
            picture: { type: "string", format: "image", label: "Picture", placeholder: "assets/…/file.svg", help: "Optional." }
          }
        }
      },
      rounds: { type: "number", required: true, min: 1, max: 20, default: 3, label: "Rounds / partners", help: "How many partners or rounds each student completes." },
      swapCue: { type: "string", label: "Swap cue", default: "Find a new partner!", placeholder: "Find a new partner! / A: move one seat left.", help: "Shown big when the teacher calls the next round." },
      roundMinutes: { type: "number", min: 0, label: "Minutes per round", help: "Optional. 0 or empty = no round timer (the stage timer still runs)." }
    },

    css: [
      ".pm { display: flex; flex-direction: column; align-items: center; gap: 2.6vh; width: 100%; max-width: 1600px; }",
      ".pm-mission { margin: 0; font-size: clamp(2rem, 4.4vw, 5.6rem); font-weight: 900; line-height: 1.08; text-align: center; color: var(--ink);",
      "  text-shadow: 0 0.06em 0 rgba(0,0,0,0.18); white-space: pre-wrap; animation: pm-in 0.55s cubic-bezier(0.2, 1.3, 0.4, 1) both; }",
      ".pm-mid { display: flex; gap: 3vw; align-items: stretch; justify-content: center; flex-wrap: wrap; width: 100%; }",
      ".pm-frame { position: relative; margin: 0; padding: 1.2em 1.6em; border-radius: 3vmin; background: #fff; color: #1d1435;",
      "  font-size: clamp(1.4rem, 2.6vw, 3rem); font-weight: 800; line-height: 1.35; white-space: pre-wrap; max-width: 46vw;",
      "  box-shadow: 0 1.2vmin 0 rgba(0,0,0,0.18); transform: rotate(-1.5deg); animation: pm-in 0.55s cubic-bezier(0.2, 1.3, 0.4, 1) both 0.15s; }",
      ".pm-frame::after { content: ''; position: absolute; left: 2.4em; bottom: -0.9em; border: 0.5em solid transparent; border-top: 0.6em solid #fff; }",
      ".pm-bankbox { display: flex; flex-direction: column; align-items: center; gap: 1.4vh; max-width: 50vw; animation: pm-in 0.55s cubic-bezier(0.2, 1.3, 0.4, 1) both 0.3s; }",
      ".pm-bankcue { margin: 0; font-size: clamp(1.1rem, 1.8vw, 2rem); font-weight: 900; color: var(--ink); }",
      ".pm-bank { display: flex; flex-wrap: wrap; gap: 1.2vmin; justify-content: center; }",
      ".pm-chip { display: flex; flex-direction: column; align-items: center; gap: 0.4vh; padding: 0.35em 0.8em; border-radius: 1.8vmin;",
      "  background: var(--accent); color: var(--accent-ink, #17122b); font-size: clamp(1.3rem, 2.4vw, 2.8rem); font-weight: 900;",
      "  box-shadow: 0 0.6vmin 0 rgba(0,0,0,0.2); }",
      ".pm-chip img { height: 9vh; max-width: 14vw; object-fit: contain; }",
      ".pm-chip:nth-child(3n+1) { transform: rotate(-2deg); } .pm-chip:nth-child(3n+2) { transform: rotate(1.5deg); }",
      ".pm-track { display: flex; align-items: center; gap: 1.4vmin; flex-wrap: wrap; justify-content: center; }",
      ".pm-round-label { font-size: clamp(1.1rem, 1.8vw, 2rem); font-weight: 900; color: var(--ink); margin-right: 1vmin; }",
      ".pm-token { width: 5vmin; height: 5vmin; border-radius: 50%; display: flex; align-items: center; justify-content: center;",
      "  font-weight: 900; font-size: 2.4vmin; color: var(--ink); box-shadow: inset 0 0 0 0.45vmin var(--ink); opacity: 0.55;",
      "  transition: transform 0.3s cubic-bezier(0.2, 1.4, 0.4, 1), background 0.3s, opacity 0.3s; }",
      ".pm-token.pm-done { background: var(--ink); color: var(--bg2, #222); opacity: 0.85; }",
      ".pm-token.pm-cur { background: var(--accent); color: var(--accent-ink, #17122b); box-shadow: none; opacity: 1; transform: scale(1.35); }",
      ".pm-rt { margin-left: 1.6vmin; padding: 0.2em 0.7em; border-radius: 99px; background: rgba(0,0,0,0.25); color: var(--ink);",
      "  font-size: clamp(1.1rem, 1.9vw, 2.1rem); font-weight: 900; font-variant-numeric: tabular-nums; }",
      ".pm-rt.pm-paused { opacity: 0.6; } .pm-rt.pm-up { background: #ff5a6e; color: #fff; animation: pm-throb 0.8s ease-in-out infinite; }",
      ".pm-swap { position: absolute; inset: 0; z-index: 3; display: flex; align-items: center; justify-content: center; pointer-events: none; }",
      ".pm-swap span { padding: 0.4em 1em; border-radius: 4vmin; background: var(--accent); color: var(--accent-ink, #17122b);",
      "  font-size: clamp(2.6rem, 7vw, 9rem); font-weight: 900; text-align: center; box-shadow: 0 2vmin 6vmin rgba(0,0,0,0.4);",
      "  animation: pm-swap 1.9s cubic-bezier(0.2, 1.3, 0.4, 1) both; }",
      ".pm-complete { padding: 0.3em 1em; border-radius: 99px; background: #fff; color: #1d1435; font-size: clamp(1.4rem, 2.6vw, 3rem); font-weight: 900;",
      "  animation: pm-in 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both; }",
      ".editing .pm-mission, .editing .pm-frame, .editing .pm-bankbox { animation: none; }",
      "@keyframes pm-in { from { opacity: 0; transform: translateY(3vh) scale(0.9); } to { opacity: 1; } }",
      "@keyframes pm-swap { 0% { opacity: 0; transform: scale(0.3) rotate(-10deg); } 18% { opacity: 1; transform: scale(1.05) rotate(2deg); }",
      "  30%, 78% { opacity: 1; transform: none; } 100% { opacity: 0; transform: scale(1.2) translateY(-8vh); } }",
      "@keyframes pm-throb { 50% { transform: scale(1.08); } }"
    ].join("\n"),

    render: function (root, data, ctx) {
      var st = ctx.state;
      var rounds = Math.max(1, Math.floor(Number(data.rounds) || 1));
      var roundMs = Math.max(0, Number(data.roundMinutes) || 0) * 60000;
      if (!st.round) st.round = 1;
      if (st.round > rounds + 1) st.round = rounds + 1; // rounds + 1 = mission complete
      if (!st.rt) st.rt = { remaining: roundMs, running: false, last: 0, total: roundMs };
      if (st.rt.total !== roundMs) st.rt = { remaining: roundMs, running: false, last: 0, total: roundMs };

      var wrap = h("div", { class: "pm" });
      var mission = h("p", { class: "pm-mission" });
      ctx.bind(mission, "mission", { multiline: true, placeholder: "Mission" });
      wrap.appendChild(mission);

      var mid = h("div", { class: "pm-mid" });
      if (data.frame || ctx.editing) {
        var frame = h("p", { class: "pm-frame" });
        ctx.bind(frame, "frame", { multiline: true, placeholder: "Language frame (optional)" });
        mid.appendChild(frame);
      }
      var bank = data.bank || [];
      if (bank.length || (ctx.editing && data.bankCue)) {
        var box = h("div", { class: "pm-bankbox" });
        if (data.bankCue || ctx.editing) {
          var bc = h("p", { class: "pm-bankcue" });
          ctx.bind(bc, "bankCue", { placeholder: "Bank cue (optional)" });
          box.appendChild(bc);
        }
        var chips = h("div", { class: "pm-bank" });
        bank.forEach(function (b, i) {
          var chip = h("div", { class: "pm-chip" });
          if (b.picture) {
            var img = h("img", { src: b.picture, alt: "" });
            img.addEventListener("error", function () { img.remove(); });
            chip.appendChild(img);
          }
          var lab = h("span");
          ctx.bind(lab, "bank." + i + ".label", { placeholder: "Label" });
          chip.appendChild(lab);
          chips.appendChild(chip);
        });
        box.appendChild(chips);
        mid.appendChild(box);
      }
      if (mid.childNodes.length) wrap.appendChild(mid);

      var track = h("div", { class: "pm-track" });
      wrap.appendChild(track);
      root.appendChild(wrap);

      var swapLayer = null;
      function showSwap() {
        if (ctx.editing || !data.swapCue) return;
        if (swapLayer) swapLayer.remove();
        swapLayer = h("div", { class: "pm-swap", "aria-live": "assertive" }, h("span", { text: data.swapCue }));
        root.appendChild(swapLayer);
        var mine = swapLayer;
        setTimeout(function () { if (mine.parentNode) mine.remove(); }, 2000);
      }

      var rtEl = null;
      function drawTrack() {
        track.innerHTML = "";
        if (st.round > rounds) {
          track.appendChild(h("span", { class: "pm-complete", text: "✓ Mission complete" }));
          return;
        }
        track.appendChild(h("span", { class: "pm-round-label", text: "Round " + st.round + " of " + rounds }));
        for (var i = 1; i <= rounds; i++) {
          track.appendChild(h("span", { class: "pm-token" + (i < st.round ? " pm-done" : i === st.round ? " pm-cur" : ""), text: String(i) }));
        }
        rtEl = roundMs ? h("span", { class: "pm-rt" }) : null;
        if (rtEl) track.appendChild(rtEl);
        tick();
      }

      function tick() {
        if (!rtEl) return;
        var now = Date.now();
        if (st.rt.running) st.rt.remaining -= now - st.rt.last;
        st.rt.last = now;
        rtEl.textContent = fmt(st.rt.remaining);
        rtEl.classList.toggle("pm-paused", !st.rt.running && st.rt.remaining > 0);
        rtEl.classList.toggle("pm-up", st.rt.remaining <= 0);
      }

      function restartRoundTimer() {
        st.rt.remaining = roundMs;
        st.rt.running = roundMs > 0;
        st.rt.last = Date.now();
      }

      drawTrack();
      var interval = roundMs ? setInterval(tick, 250) : null;

      return {
        onKey: function (e) {
          switch (e.key.toLowerCase()) {
            case "n":
              if (st.round > rounds) return true;
              st.round += 1;
              if (st.round <= rounds) { restartRoundTimer(); showSwap(); } else st.rt.running = false;
              break;
            case "b":
              st.round = Math.max(1, st.round - 1);
              restartRoundTimer();
              st.rt.running = false;
              break;
            case "p":
              if (!roundMs) return true;
              if (st.rt.remaining <= 0) restartRoundTimer();
              else { tick(); st.rt.running = !st.rt.running; st.rt.last = Date.now(); }
              break;
            case "w":
              showSwap();
              return true;
            case "o":
              st.round = 1;
              restartRoundTimer();
              st.rt.running = false;
              break;
            default:
              return false;
          }
          drawTrack();
          return true;
        },
        destroy: function () {
          if (interval) clearInterval(interval);
          // Keep the round timer honest while the stage is off screen.
          if (st.rt.running) { st.rt.remaining -= Date.now() - st.rt.last; st.rt.last = Date.now(); }
        }
      };
    },

    editor: function (root, ctx) {
      root.appendChild(ctx.form());
    }
  });
})();
