# Mechanics

One entry per mechanic in `mechanics/`. Reuse before building. Update this file after every task (see CLAUDE.md, rule 4).

Rules that apply to every mechanic (see CLAUDE.md → Mechanic registry rules):
- A list field holds objects, and every item in lesson data has a permanent `id`. Lists of plain values are rejected.
- A picture field is a text field with `format: "image"`; edit mode adds "Upload / replace image" next to it.

---

## prompt-card

- **File:** `mechanics/prompt-card.js`
- **What it does:** Shows one big prompt, with an optional picture and an optional interaction cue (who speaks with whom). Placeholder mechanic built to prove the stage loop.
- **Language it forces:** Whatever the prompt targets. The stage's `rationale.language` names it.
- **What students produce:** Spoken answers to the prompt, in the pairing the cue sets. The stage's `rationale.output` names it.
- **Required data fields:**

  | Field        | Type | Required | Notes |
  |--------------|------|----------|-------|
  | `prompt`     | text | yes      | The question or task. Multi-line allowed. |
  | `cue`        | text | no       | Interaction cue, e.g. "Pairs: A asks, B answers. Swap." |
  | `picture`    | text | no       | Path relative to `index.html` (e.g. `assets/…/x.svg`) or web address (web addresses fail offline). Edit mode offers "Upload / replace image" here (matched by field name; the schema has no `format: "image"` flag yet). |
  | `pictureAlt` | text | no       | Shown if the picture cannot load. |

- **How it keeps every student speaking:** The cue names who speaks with whom. Everyone answers the same prompt at the same time, so no one waits for a turn. It is only as strong as its cue: a stage with no cue risks one-at-a-time answers.
- **In-stage keys:** none.
- **Lists / item ids:** none (no list fields).
- **Lessons that use it:** `beginner/sample-hello` (SAMPLE — all 3 stages).
