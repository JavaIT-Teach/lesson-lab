/*
 * Mechanic: prompt-card
 * One big prompt, an optional picture, and an optional interaction cue.
 * Placeholder mechanic that proves the stage loop. See MECHANICS.md.
 */
(function () {
  "use strict";

  var LL = window.LL;
  var h = LL.ui.h;

  LL.registerMechanic({
    id: "prompt-card",
    description: "One big prompt on screen, with an optional picture and an optional interaction cue.",
    speaking:
      "The cue names who speaks with whom (for example 'Pairs: A asks, B answers, then swap'). " +
      "Everyone answers the same prompt at the same time, so no one waits for a turn.",

    schema: {
      prompt: { type: "string", required: true, multiline: true, label: "Prompt", help: "The question or task students respond to." },
      cue: { type: "string", label: "Interaction cue", placeholder: "Pairs: A asks, B answers. Swap.", help: "Optional. Who speaks with whom." },
      picture: { type: "string", label: "Picture", placeholder: "assets/…/file.svg", help: "Optional. A file path (relative to index.html) or web address." },
      pictureAlt: { type: "string", label: "Picture description", help: "Optional. Shown if the picture cannot load." }
    },

    css: [
      ".pc { display: flex; align-items: center; justify-content: center; gap: 5vw; width: 100%; max-width: 1600px; }",
      ".pc-body { display: flex; flex-direction: column; align-items: flex-start; gap: 3.5vh; min-width: 0; }",
      ".pc:not(.pc-has-pic) .pc-body { align-items: center; text-align: center; }",
      ".pc-prompt { margin: 0; font-size: clamp(2.6rem, 6vw, 7.5rem); font-weight: 900; line-height: 1.06; letter-spacing: -0.02em;",
      "  color: var(--ink); text-shadow: 0 0.06em 0 rgba(0,0,0,0.18); white-space: pre-wrap; overflow-wrap: anywhere; }",
      ".pc-has-pic .pc-prompt { font-size: clamp(2.2rem, 4.8vw, 6rem); }",
      ".pc-word { display: inline-block; animation: pc-word 0.55s cubic-bezier(0.2, 1.4, 0.4, 1) both; }",
      ".pc-cue { margin: 0; padding: 0.45em 1em; border-radius: 99px; background: var(--accent); color: var(--accent-ink, #17122b);",
      "  font-size: clamp(1.2rem, 2.1vw, 2.2rem); font-weight: 900; box-shadow: 0 0.2em 0 rgba(0,0,0,0.2);",
      "  animation: pc-cue 0.6s cubic-bezier(0.2, 1.4, 0.4, 1) both 0.7s; }",
      ".editing .pc-cue { animation: none; }",
      ".pc-pic { flex: none; margin: 0; width: min(34vw, 52vh); aspect-ratio: 1; padding: 1.2vmin; border-radius: 4vmin;",
      "  background: #fff; box-shadow: 0 2vmin 0 rgba(0,0,0,0.18), 0 4vmin 8vmin rgba(0,0,0,0.3);",
      "  transform: rotate(-4deg); animation: pc-pic-in 0.7s cubic-bezier(0.2, 1.3, 0.4, 1) both, pc-bob 5s ease-in-out 0.7s infinite; }",
      ".pc-pic img { width: 100%; height: 100%; object-fit: contain; border-radius: 3vmin; display: block; }",
      ".pc-pic-missing { display: flex; align-items: center; justify-content: center; text-align: center; padding: 2rem;",
      "  color: #7a1020; font-weight: 800; font-size: 1.2rem; border: 4px dashed #ff5a6e; }",
      "@keyframes pc-word { from { opacity: 0; transform: translateY(0.4em) scale(0.6) rotate(-6deg); } to { opacity: 1; transform: none; } }",
      "@keyframes pc-cue { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: none; } }",
      "@keyframes pc-pic-in { from { opacity: 0; transform: rotate(-20deg) scale(0.5); } to { opacity: 1; transform: rotate(-4deg); } }",
      "@keyframes pc-bob { 0%, 100% { transform: rotate(-4deg) translateY(0); } 50% { transform: rotate(-2deg) translateY(-1.6vmin); } }",
      "@media (max-aspect-ratio: 1/1) { .pc { flex-direction: column; } }"
    ].join("\n"),

    render: function (root, data, ctx) {
      var card = h("div", { class: "pc" + (data.picture ? " pc-has-pic" : "") });

      if (data.picture) {
        var fig = h("figure", { class: "pc-pic" });
        var img = h("img", { src: data.picture, alt: data.pictureAlt || "" });
        img.addEventListener("error", function () {
          fig.classList.add("pc-pic-missing");
          fig.textContent = data.pictureAlt || "Picture not found: " + data.picture;
        });
        fig.appendChild(img);
        card.appendChild(fig);
      }

      var body = h("div", { class: "pc-body" });
      var prompt = h("p", { class: "pc-prompt" });
      if (ctx.editing) {
        ctx.bind(prompt, "prompt", { multiline: true });
      } else {
        // Word-by-word entrance.
        String(data.prompt).split(/(\s+)/).forEach(function (w, i) {
          if (/^\s+$/.test(w)) prompt.appendChild(document.createTextNode(w));
          else prompt.appendChild(h("span", { class: "pc-word", style: { animationDelay: 120 + i * 45 + "ms" } }, w));
        });
      }
      body.appendChild(prompt);

      if (data.cue || ctx.editing) {
        var cue = h("p", { class: "pc-cue" });
        ctx.bind(cue, "cue", { placeholder: "Interaction cue (optional)" });
        body.appendChild(cue);
      }

      card.appendChild(body);
      root.appendChild(card);
    },

    editor: function (root, ctx) {
      root.appendChild(ctx.form());
    }
  });
})();
