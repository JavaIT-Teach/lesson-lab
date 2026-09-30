# Mechanics

One entry per mechanic in `mechanics/`. Reuse before building. Update this file after every task (see CLAUDE.md, rule 4).

Rules that apply to every mechanic (see CLAUDE.md → Mechanic registry rules):
- A list field holds objects, and every item in lesson data has a permanent `id`. Lists of plain values are rejected.
- A picture field is a text field with `format: "image"`; edit mode adds "Upload / replace image" next to it.
- Edit mode: a mechanic's data is edited in the toolbar's **Content** popover (its `editor`). Every list field there gets a drag handle (⠿) automatically — dragging changes order only, ids stay, overrides record an `order` edit. No mechanic needs schema changes for this.
- No colour or font choices anywhere in a mechanic's schema, ever (CLAUDE.md design principle 7); use `options` only for content choices (e.g. `reveal-board`'s `textColor` colour-word field), never a style knob. Stage-level shapes (`decorations`) take their colour from the scene palette; their layout (position, independent width/height) and any bound text's alignment/size are teacher-adjustable from the toolbar, not from a mechanic's own schema.
- No walls of text (CLAUDE.md design principle 6): at most about one sentence of instruction as one block of prose; multi-part instructions become a title + short numbered steps.
- Live in-stage state (highlight, revealed answers, scores, rounds) lives in `ctx.state`: kept while the page is open, never saved, never in `data`.
- In-stage keys work outside edit mode only. Shared meanings across mechanics: `N` next · `B` back · `O` clear / reset the live state · `M` switch mode · `V` reveal / vary. `?` lists the current stage's keys; teacher view shows them too.

## Quick chooser

| Need | Mechanic |
|------|----------|
| One prompt, or a title + short numbered steps; everyone answers in pairs | `prompt-card` |
| A fixed set (alphabet, numbers, word set) on screen; chorus by item or sound group; "what's missing?" | `reveal-board` |
| Students commit (write / tell partner) before the answer is shown | `drill-check` |
| Mingle or fixed-partner drill over several rounds with a language frame | `pair-mission` |
| Competitive calling game (bingo, "first team to…") with scores | `team-game` |

---

## prompt-card

- **File:** `mechanics/prompt-card.js`
- **What it does:** Either one big prompt (one short sentence) **or** a large activity title with short numbered steps, plus an optional picture and an optional interaction cue (who speaks with whom). With `steps`, each step is its own line with a number badge, never a paragraph. Without `steps`, the prompt renders exactly as before (word-by-word entrance).
- **Language it forces:** Whatever the prompt or steps target. The stage's `rationale.language` names it.
- **What students produce:** Spoken answers to the prompt / steps, in the pairing the cue sets. The stage's `rationale.output` names it.
- **Required data fields:**

  | Field        | Type | Required | Notes |
  |--------------|------|----------|-------|
  | `title`      | text | no       | Large activity heading above the steps (separate from the small stage-title pill top-left). Shown whenever set. |
  | `prompt`     | text | one of prompt / steps | The question or task, one short sentence. Ignored when `steps` has items. |
  | `steps`      | list | one of prompt / steps | Ordered short steps. Each: `id`, `text` (required). Rendered as a numbered list replacing the prompt. |
  | `cue`        | text | no       | Interaction cue, e.g. "Pairs: A asks, B answers. Swap." |
  | `picture`    | text | no       | Path relative to `index.html` (e.g. `assets/…/x.svg`) or web address (web addresses fail offline). Edit mode offers "Upload / replace image" here (matched by field name). |
  | `pictureAlt` | text | no       | Shown if the picture cannot load. |

- **Extra validation (`validate`):** a stage needs a non-empty `prompt` or at least one step.
- **How it keeps every student speaking:** The cue names who speaks with whom. Everyone answers the same prompt (or works through the same steps) at the same time, so no one waits for a turn. It is only as strong as its cue: a stage with no cue risks one-at-a-time answers.
- **In-stage keys:** none.
- **Lists / item ids:** `steps[].id` (drag ⠿ to reorder in edit mode).
- **Lessons that use it:** `beginner/starter-in-the-classroom` — `cheat-sheet-partner` (title + 3 steps + worksheet cue).

---

## reveal-board

- **File:** `mechanics/reveal-board.js`
- **What it does:** A grid of items (letters, numbers, words or pictures), all on screen for the whole stage. Two live teacher controls, fired by keys and never stored in the data: (a) a highlight, stepped item by item or by named group (chorus by sound group); (b) missing-item mode, an ON/OFF toggle that blanks a subset of items in place (a "?" in the same grid position). The teacher can flip it on and off and change which items are blanked at any point in the same stage.
- **Language it forces:** The item set itself (letter names, numbers, a word set) and, with groups, the sound or category that groups them. The stage's `rationale.language` names it.
- **What students produce:** Choral repetition of the highlighted item or group; naming the blanked items (in pairs, then chorally). The mechanic does not force pairing: the stage's `rationale.output` must name the choral or paired production planned.
- **Required data fields:**

  | Field        | Type | Required | Notes |
  |--------------|------|----------|-------|
  | `cue`        | text | no  | One line above the board, e.g. "Listen and repeat." |
  | `items`      | list | yes | Each item: `id`, `label` (required), `picture` (optional, `format: "image"`), `group` (optional: a group id or group name), `blankable` (true/false: may be blanked in missing-item mode), `textColor` (optional: one of the nine colour words `black blue brown green grey orange red white yellow`, chosen from a list — no free colour). |
  | `groups`     | list | no  | Each: `id`, `label` (e.g. "/eɪ/ like 'say'"). Used for chorus-by-group stepping (G). |
  | `blankCount` | number | no | Empty/0 = blank every `blankable` item. A number = that many, picked at random from the `blankable` items; V picks again. If no item is marked `blankable`, all items are eligible. |

  `textColor` draws that item's label in the colour named by the word. Each word maps to one fixed shade inside the mechanic (the same shades as the Starter lesson's colour swatches), so the teacher chooses *which* colour word, never a colour value. The tile turns neutral grey with a dark outline on the letters, so every ink stays readable (white and yellow included), and the highlight never changes the tile colour. Items without it look as before. Built for "say the colour, not the word".

  With a picture, the label is a caption sized to the grid (readable from the back), not to the longest label.

  Eligibility is authored as a `blankable` flag on each item rather than a separate list of item ids: it cannot point at a missing item, and in edit mode it is one checkbox per item. The ON/OFF state and the current blank set are live state, not data.
- **Extra validation (`validate`):** an item's `group` must match a group id or name; every group must have at least one item; `blankCount` cannot exceed the eligible items; `textColor` must be one of the nine colour words (checked by the schema `options`).
- **How it keeps every student speaking:** The teacher sets pace and grouping live: the whole class choruses the highlighted item or group together, or pairs name the blanked items before the class says them. It only keeps everyone talking if the stage's rationale plans choral or paired production around it.
- **In-stage keys:** `N` / `B` highlight next / previous item · `G` highlight next group (after the last group: off) · `O` clear highlight · `M` missing-item mode on/off · `V` blank a new random set (and turn missing-item mode on) · click an item: highlight it, or in missing-item mode blank / unblank it.
- **Lists / item ids:** `items[].id`, `groups[].id` (both drag-reorderable in edit mode; grid order follows `items`). Live state refers to these ids; deleted ids drop out.
- **Lessons that use it:**
  - `beginner/starter-in-the-classroom` — `numbers-1-20` (1–20, one group "-teen: 13–19"), `classroom-objects` (13 pictures), `colours-stroop` (9 colour words with a different `textColor` each).

---

## drill-check

- **File:** `mechanics/drill-check.js`
- **What it does:** Students commit to an answer (write it, or say it to a partner) before the teacher reveals it. Two modes, switched live with `M`: **step** — one item at a time: prompt, commit, reveal; **all** — every item on screen at once, and the teacher reveals any single item's answer in any order (key or click), for a "collect everything, then reveal only the disputed ones" flow.
- **Language it forces:** Whatever the items target (spellings, forms, answers). The stage's `rationale.language` names it.
- **What students produce:** A committed answer per item before the reveal. The stage's `rationale.output` must state what they commit to (write, say to a partner) and in what pairing.
- **Required data fields:**

  | Field       | Type | Required | Notes |
  |-------------|------|----------|-------|
  | `mode`      | text | no  | `step` (default) or `all`: the mode the stage opens in. `M` switches live. Anything else fails validation. |
  | `commitCue` | text | no  | What students do before the reveal, e.g. "Write it. Show your partner." Shown until the answer is revealed. |
  | `items`     | list | yes | Each item: `id`, `prompt` (required, multi-line), `answer` (optional; without one the reveal shows "✓ Checked"), `picture` (optional, `format: "image"`), `pairCue` (optional, e.g. "A spells it. B writes it."). |

- **How it keeps every student speaking:** Every student commits before anything is shown, so no one can wait for a stronger student's answer. Whether that commitment is spoken or written is set by the pair cue / commit cue and stated in `rationale.output`.
- **In-stage keys:** `N` / `B` next / previous item (in "all" mode: moves the focus) · `V` reveal / hide the current item's answer · `Shift+V` reveal all / hide all · `M` switch step ↔ all · `O` hide every answer · click an item (all mode): reveal / hide that item.
- **Lists / item ids:** `items[].id` (drag ⠿ to reorder in edit mode). Revealed answers are live state keyed by these ids.
- **Lessons that use it:**
  - `beginner/starter-in-the-classroom` — `birthday-cakes` (Ex 5: cakes A–F with pictures, no audio), `how-old-are-you` (Ex 6 answer key, Ryan–Lara, audioCue "Listen: Track 5"), `days-order` (7 days, opens in "all" mode), `days-spelling` (7 misspelled days), `colours-ttt` (9 colour swatches).

---

## pair-mission

- **File:** `mechanics/pair-mission.js`
- **What it does:** Shows a mission, a language frame, and (optionally) a bank of items students privately pick one from, with a target number of rounds / partners. The teacher advances rounds with a key; each new round flashes the swap cue full-screen and restarts an optional round timer. Covers both a fixed-partner drill (swap cue "A: move one seat left") and a free mingle ("Find a new partner!").
- **Language it forces:** The frame. The stage's `rationale.language` names it.
- **What students produce:** The frame exchange, once per round, with a different partner each round. The stage's `rationale.output` names how many exchanges.
- **Required data fields:**

  | Field          | Type   | Required | Notes |
  |----------------|--------|----------|-------|
  | `mission`      | text   | yes | The task, multi-line. |
  | `frame`        | text   | no  | The exact language pairs use; one line per turn. Shown as a speech bubble. |
  | `bankCue`      | text   | no  | Line above the bank, e.g. "Pick one. Keep it secret!" |
  | `bank`         | list   | no  | Each: `id`, `label` (required), `picture` (optional, `format: "image"`). |
  | `rounds`       | number | yes | Target rounds / partners, 1–20. Default 3. |
  | `swapCue`      | text   | no  | Shown big on each new round. Default "Find a new partner!". |
  | `roundMinutes` | number | no  | Per-round countdown. Empty/0 = none (the stage timer still runs). |

- **How it keeps every student speaking:** Every student is in a pair or moving to a new partner at the same time, every round. No one watches or waits.
- **In-stage keys:** `N` next round (swap cue + round timer restart; after the last round: "Mission complete") · `B` back one round · `P` pause / restart the round timer · `W` show the swap cue again · `O` start again from round 1.
- **Lists / item ids:** `bank[].id` (drag ⠿ to reorder in edit mode).
- **Lessons that use it:**
  - `beginner/starter-in-the-classroom` — `meet-classmates` (name / spelling / age mingle, 3 rounds, no bank).

---

## team-game

- **File:** `mechanics/team-game.js`
- **What it does:** A caller feed, with optional teams and live scores (no teams = no scoreboard). The pool of items is hidden from students (shown only in teacher view); the caller reveals them one at a time (in order or shuffled) into a big "last called" card and a "called" list everyone sees. For a second round, calling can be handed to a named student: a caller label in teacher view, no turn logic.
- **Language it forces:** Recognising and saying the pool items (e.g. confusable letter names). The stage's `rationale.language` names it.
- **What students produce:** Calls (the caller), checks of claims against the called list (teams). The stage's `rationale.output` names it.
- **Required data fields:**

  | Field           | Type    | Required | Notes |
  |-----------------|---------|----------|-------|
  | `instructions`  | text    | no  | One or two lines on screen. |
  | `teams`         | list    | no  | Optional. Each: `id`, `name` (required), `score` (starting score, usually 0). **Empty or left out = no scoreboard at all** (no team pills, no score keys, no "Reset scores"); only the last-called card and the called list show — e.g. bingo on paper cards where students report counts aloud. |
  | `pool`          | list    | yes | The hidden caller pool. Each: `id`, `label` (required), `picture` (optional, `format: "image"`). |
  | `shuffle`       | boolean | no  | Call in random order (off = listed order). |
  | `studentCaller` | text    | no  | Name used when `K` hands calling to a student. If empty, the app asks for a name live. |

  Live state (never saved): the called list, the call order, team scores, current caller, round number.
- **How it keeps every student speaking:** It does not make the whole class speak at once. Speech comes from the caller's turn (teacher, then a student) and from teams checking and challenging claims against the called list; most students listen and react most of the time. Pair it with a stage where everyone speaks simultaneously.
- **In-stage keys:** `N` call the next item · `B` take back the last call · `Shift+1`–`Shift+9` +1 point for team 1–9 · `K` hand calling to a student / back to the teacher · `O` new round (clears the called list, keeps scores) · click `+` / `−` on a team to score · teacher view: click a pool item to call it, "Reset scores" button.
- **Lists / item ids:** `teams[].id`, `pool[].id` (both drag-reorderable in edit mode; with `shuffle` on, pool order does not affect calling order). Called list and scores are live state keyed by these ids.
- **Lessons that use it:**
  - `beginner/starter-in-the-classroom` — `bingo` (pool = number words one–twenty, shuffled; no teams, so no scoreboard).
