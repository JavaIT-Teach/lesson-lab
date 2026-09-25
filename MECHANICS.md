# Mechanics

One entry per mechanic in `mechanics/`. Reuse before building. Update this file after every task (see CLAUDE.md, rule 4).

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
  | `picture`    | text | no       | Path relative to `index.html` (e.g. `assets/…/x.svg`) or web address (web addresses fail offline). |
  | `pictureAlt` | text | no       | Shown if the picture cannot load. |

- **How it keeps every student speaking:** The cue names who speaks with whom. Everyone answers the same prompt at the same time, so no one waits for a turn. It is only as strong as its cue: a stage with no cue risks one-at-a-time answers.
- **In-stage keys:** none.
- **Lessons that use it:** `beginner/sample-hello` (SAMPLE — all 3 stages).
