# Lesson Lab — project memory

Read this file in full before doing anything in this repo.

## Purpose

Lesson Lab is the classroom interface one teacher uses to run English lessons at Cambridge Learning Centre.

- One screen at the front of the room. One shared board. No student devices.
- Fully offline. No AI or API features. No accounts. No server.
- It is not a slide deck. Each lesson stage is a full-screen **scene** with its own colours, background motif and motion.
- It must feel alive and game-like, so students want to come back.

This project is independent. Do not copy from, or refer to, any other repo.

## Levels (fixed order)

| Order | Level id           | Display name     |
|-------|--------------------|------------------|
| 1     | `beginner`         | Beginner         |
| 2     | `elementary`       | Elementary       |
| 3     | `pre-intermediate` | Pre-Intermediate |
| 4     | `intermediate`     | Intermediate     |
| 5     | `ielts-1`          | IELTS 1          |
| 6     | `ielts-2`          | IELTS 2          |
| 7     | `ielts-3`          | IELTS 3          |

The list is defined once, in `js/core.js` (`LL.levels`). The level id is also the lesson folder name.

## Offline / no-build constraint

- Plain HTML, CSS and JavaScript. No build step, no bundler, no npm packages, no framework.
- It must run in two ways: by double-clicking `index.html` (`file://`), and from GitHub Pages.
- On `file://` the browser blocks `fetch()` and ES modules. So:
  - Use classic `<script>` files only. No `import` or `export`. No `type="module"`.
  - Lesson data is a `.js` file that calls `LL.registerLesson({...})`. Never a `.json` file loaded with `fetch`.
- No web fonts, CDNs or remote assets. Pictures are local files under `assets/`.
- Everything hangs off one global: `window.LL`.
- The only network use is the optional GitHub sync (`api.github.com`, `raw.githubusercontent.com`). Without a connection the app still runs fully from the files and the device cache.
- `tools/` holds Node scripts for maintainers (no npm packages). The app never needs them.

## Folder layout

```
index.html                 App entry. Loads shell, mechanics, manifest, then app.
css/app.css                Shell styles (home, player, rail, timer, panels, scene palettes, settings).
js/core.js                 LL namespace, level list, mechanic + lesson registries, validation, id rules.
js/overrides.js            Overrides engine: diff / apply / merge of teacher edits (also used by tools/).
js/ui.js                   DOM helper h(), the generic schema form used by editors, drag-to-reorder (sortable).
js/store.js                Device storage: overrides cache, conflict log, token, prefs, backup.
js/images.js               Uploaded pictures: resize, preview, device cache (IndexedDB), src rewriting.
js/sync.js                 GitHub sync: save overrides + uploads, load latest, status.
js/loader.js               Loads lessons/manifest.js files, then data/overrides/<id>.js for each lesson.
js/app.js                  Home, lesson menu, lesson player, rail, timer, teacher view, edit toolbar + popovers, shapes, settings, keys.
mechanics/<id>.js          One file per mechanic. Shared by all lessons.
lessons/manifest.js        List of lesson files to load (browsers cannot list folders offline).
lessons/<level-id>/<lesson-id>.js   Base lesson. One self-contained lesson per file. Data only.
data/config.js             Default repo + branch for GitHub sync.
data/overrides/<lesson-id>.js       Teacher edits for that lesson. Written by the app. Never hand-edit.
assets/                    Local pictures. Subfolder per lesson or topic.
assets/uploads/            Pictures uploaded in edit mode (generated names). Public.
tools/fold-overrides.js    Folds a lesson's overrides into its lesson file and clears them.
CLAUDE.md                  This file.
MECHANICS.md               Catalogue of mechanics.
```

## Lesson file schema

File: `lessons/<level-id>/<lesson-id>.js`. Data only. No functions, no logic.

```js
LL.registerLesson({
  id: "hello-my-name-is",          // unique across all lessons; kebab-case; matches the file name
  title: "Hello, my name is…",
  level: "beginner",               // a level id; must match the folder
  unit: "1",                       // text
  mainAim: "Students can …",
  subAims: ["…", "…"],             // list; may be empty
  // hidden: true                  // NOT written in lesson files: set by the Hide control, as an override
  stages: [                        // ordered; at least one
    {
      id: "warm-up",               // PERMANENT; unique within the lesson; letters, digits, - and _
      title: "Warm-up",
      minutes: 3,                  // number above 0; drives the stage timer
      audioCue: "Listen: Track 3", // OPTIONAL short text; metadata only (the app plays no audio)
      worksheetLabel: "Worksheet Part 2", // OPTIONAL short text; metadata only (paired printed worksheet)
      decorations: [               // OPTIONAL shapes on the scene; usually added in edit mode (Insert shape)
        { id: "shape-1", shape: "circle", x: 80, y: 25, w: 14, h: 14, label: "Go!" }  // colour: curated role only (see below)
      ],
      mechanic: "prompt-card",     // id of a registered mechanic (see MECHANICS.md)
      data: {                      // exactly the fields that mechanic's schema defines
        // Every list inside data holds objects, and every item has a PERMANENT id,
        // unique within its list:  items: [{ id: "q1", text: "…" }, { id: "q2", text: "…" }]
      },
      rationale: {                 // MANDATORY
        language: "What language this stage forces",
        output: "What students produce"
      },
      teacherNotes: "Only shown in teacher view."
      // textStyle: { … }          // OPTIONAL per-field align / size / colour / free position (set in edit mode)
      // groups: [ … ]             // OPTIONAL groups of shapes / moved text (set in edit mode, Ctrl+G)
    }
  ]
});
```

`audioCue` (optional): a short text such as `"Listen: Track 3"`. If a stage has it, a headphones badge shows next to the stage title in both student and teacher view, and in the teacher panel. It is editable in edit mode (in place and in the side panel). Leave it out when the stage has no recording. If present it must be text.

`worksheetLabel` (optional): a short text such as `"Worksheet Part 2"`. It marks that the stage has a paired printed worksheet and names it. Metadata only: it shows with 📝 on that stage's line in the lesson menu and in teacher view, not on the student scene. Editable in edit mode (side panel), no forced value. Leave it out when there is no worksheet. If present it must be text.

`hidden` (lesson level, optional, true/false): takes the lesson off the home screen lists. It is set and cleared by the app's Hide / Unhide controls as a normal override (`"hidden"` entry in `data/overrides/<lesson-id>.js`), so it is reversible and synced like any edit. Do not write it into lesson files by hand; folding a hidden lesson's overrides would carry it into the base file, so check before folding.

`decorations` (optional): shapes placed on the scene. Each item: `id` (permanent), `shape` (`circle` | `rectangle` | `triangle` | `arrow` | `line` — `LL.SHAPES`), `x` and `y` (centre, % of the scene, 0–100), `w` and `h` (independent width/height, vmin, `LL.DECO_MIN`–`LL.DECO_MAX`), optional short `label` (≤ 40 characters; not for `arrow`/`line`), optional `color` (one of `LL.COLOR_ROLES` — see below), optional `z` (`"front"`, to sit in front of the stage content instead of behind it; default/omitted = behind), optional `rotation` (degrees clockwise, a number from 0 to 359; omitted = 0), optional `radius` (**rectangle only**: rounded corners, 0–50 = % of the shorter side; omitted = the app's small default rounding), optional `locked` (`true`: no move / resize / rotate / nudge until unlocked; omitted = unlocked). `arrow` and `line` (`LL.STROKE_SHAPES`) are drawn as a stroke along the box's width, not a filled area: `w` is the length, `h` sets the thickness (and the arrowhead's size); rotate them to point anywhere. Labels use one fixed weight (size follows `textStyle`, below). Validation rejects any other key, and any `color`/`z`/`rotation`/`radius`/`locked` value outside those rules. In edit mode a selected shape has 8 resize handles (4 corners + 4 edge midpoints) that work in the shape's own rotated frame: a corner drags width and height together, an edge drags one dimension only, so `w` and `h` are always independent — this is how a rectangle is stretched.

**Paint order (hard rule, `css/app.css`, never DOM order):** back shapes < stage content < stage title < front shapes < freed (dragged) text. Freed text always paints above every shape, in student, teacher and edit view — so a highlighter shape placed behind a dragged phrase can never hide it. Edit mode raises all shapes above the content so they can be grabbed, and keeps freed text on top.

**Curated colour, never a picker.** `LL.COLOR_ROLES = ["accent", "highlight", "paper"]` is the complete, fixed set the teacher can choose from, for a shape's `color` and a text field's `textStyle[key].color` alike — never an open colour picker, never a hex value. `accent` matches the stage's own hash-of-the-stage-id palette (what shapes and per-field colour both defaulted to before this existed); `highlight` and `paper` are two colours that stay the same on every stage regardless of palette (`--highlight`/`--highlight-ink` and `--paper`/`--paper-ink` in `css/app.css`), for things like a highlighter chip that must always look the same, whichever stage it's on. Leaving `color` out means "automatic" (the stage's own ink/accent) exactly as before. There is still no free colour, no font choice and no theme switch.

**Text lists are plain characters.** A bulleted line starts with `• `, a numbered line with `1. `, `2. ` … — ordinary text inside the string, not a separate data format. The edit toolbar's list buttons (and `Ctrl+Shift+8` / `Ctrl+Shift+7`) add or strip these prefixes on the current line or each selected line. Renderers need nothing special; multi-line fields already keep line breaks.

`textStyle` (stage level, optional): per-field overrides on top of the mechanic's own layout. Shape: `{ "<field path under the stage>": { align?: "left"|"center"|"right", scale?: number, size?: number (legacy), color?: one of LL.COLOR_ROLES, x?: number, y?: number, rotation?: number, locked?: true } }`. The key is the field's path relative to the stage, with every list item named by its permanent id, never its position (`"data.mission"`, `"data.items[q2].text"`, `"title"`, `"decorations[shape-1].label"`) — see `js/app.js`'s `textStyleKey()`. So a style follows its item through reorder and delete, like every other edit. The overrides engine records a stage's `textStyle` as one whole value (its keys are field paths, not addressable one by one). `scale` (what the Text size control writes) multiplies the field's **own untouched rendered size**, measured live from its computed style with the override removed — never a nominal per-mechanic constant — and re-measured whenever layout can change (every render, window resize), because mechanic font sizes follow the viewport. `LL.TEXT_SCALE_MIN`–`LL.TEXT_SCALE_MAX` (0.4–2.5, symmetric on a log scale); 1 = untouched, so it is never stored: back at 100% the entry is removed and the field is pixel-identical to never having been touched. `size` is **legacy** (the first Text size control, which multiplied the *parent's* font size — the cause of "100% doesn't look like before"): still valid (`LL.TEXT_SIZE_MIN`–`LL.TEXT_SIZE_MAX`) and still rendered exactly as before so no existing lesson changes by itself, never written any more; touching Text size on such a field replaces it with `scale`. `color` is one of the curated roles (see `decorations` above); left out, the field keeps the stage's own ink colour. `x`/`y` (both required together, % of the scene, 0–100) free the field from the mechanic's normal flow layout entirely and place it like a shape — this is what a dragged field's position is stored as; a field with no `x`/`y` renders exactly where its mechanic puts it. `rotation` (0–359) and `locked` (`true`) work as on shapes and are only valid on a freed field (with `x`/`y`); putting a field back into the layout (reset) clears `x`, `y`, `rotation` and `locked` together. Set from the toolbar's Align, Text size and Text colour icons (act on whichever bound text the teacher last clicked, same "click in a text, then choose here" pattern as the list buttons) and from dragging the field's own handle (below). All of it applies in both student and teacher view, not just while editing.

`groups` (stage level, optional): `[{ id, members: ["shape:<decoration id>" | "text:<textStyle key>", …] }]` — shapes and freed text fields the teacher grouped (Ctrl+G) so they can be selected together again. Each group has a permanent id; `members` is a plain list of refs, recorded as one whole value (like `subAims`). A member that no longer exists (shape deleted, text put back in the layout) is simply skipped wherever the group is used — never a validation problem, the same tolerance overrides have for stale ids. An element is in one group at most; a group left with fewer than 2 members dissolves.

To make a lesson appear, add one line to `lessons/manifest.js`: `"<level-id>/<lesson-id>.js"`. Every lesson prompt still needs this line.

### Ids are permanent

Teacher edits are stored against ids, not positions. So:
- Every stage, and every list item inside stage `data`, has an id. Ids use letters, digits, `-` and `_`.
- Never rename or reuse an id. To replace a stage, give the new one a new id.
- The loader **rejects** a lesson file with a missing, invalid or duplicate id and lists the problems on the home screen.
- Lesson-level `subAims` is a list of plain text; it is edited as one whole value.

## Rationale is mandatory

Every stage must have `rationale.language` and `rationale.output`, both non-empty.
A stage without them fails validation. It is flagged on the home screen (problem count), on the rail (⚠) and in the side panel, and its scene is replaced by an error card. It does not run. Never add a stage without a real rationale.

## Validation (never silent)

`LL.validateLesson()` checks lesson fields, every stage's required fields, the rationale, that the mechanic exists, and the stage `data` against the mechanic's schema. Load failures (missing file, typing error, file that never registers) are listed on the home screen. Problems are always shown on screen in plain words. Never swallow an error.

## Mechanic registry rules

A mechanic is one file in `mechanics/`, registered with `LL.registerMechanic({...})` and loaded by a `<script>` tag in `index.html` (in the Mechanics block). It must define:

| Field         | Meaning |
|---------------|---------|
| `id`          | kebab-case, unique. Stages refer to it by this id. |
| `description` | What it does, one sentence. |
| `speaking`    | How it keeps every student speaking. Shown in teacher view. |
| `schema`      | Data fields the stage must provide. |
| `render(root, data, ctx)` | Draws the scene content into `root`. |
| `editor(root, ctx)`       | Draws the form for its data in the edit toolbar's **Content** popover (usually `root.appendChild(ctx.form())`). |
| `css` (optional)          | A CSS string; injected once so the mechanic stays one file. Prefix classes with a short mechanic prefix. |
| `keys` (optional)         | `[[key, what it does], …]` for its in-stage keys. Shown in the `?` overlay ("This stage") and in teacher view. |
| `validate(data)` (optional) | Extra checks the schema cannot express (e.g. references between its lists). Returns a list of plain-word problems; runs only after the schema passes; problems are shown like any other stage problem. |

Schema field spec: `{ type: "string" | "number" | "boolean" | "list" | "object", required, label, help, placeholder, multiline, min, max, format, options, item (for list), itemLabel (for list), fields (for object), default }`.

- `options` (string fields): a fixed list of allowed values. The edit form shows a chooser (with "—" for not set), never free text, and validation rejects any other value. Use it wherever a free value would be a style choice (e.g. `reveal-board`'s `textColor` = one of nine colour words; the mechanic maps each word to its own fixed colour).

- A `list` must have `item: { type: "object", fields: {...} }` so every item can carry an id. The registry rejects a mechanic whose list holds plain values. New items get a generated id in edit mode.
- Every list in the generic form gets a drag handle (⠿) automatically, plus ↑ ↓ ✕ buttons. Dragging changes array order only: ids never change, so overrides record an `order` edit and undo / sync work unchanged. A mechanic needs nothing extra for this.
- A picture field is a `string` with `format: "image"`. Edit mode then shows "Upload / replace image" next to it. (Fields named `…picture`, `…image`, `…photo`, `…img` get it too, for older mechanics.)

`ctx` passed to `render` and `editor`:
- `ctx.editing`, `ctx.teacher` — current modes.
- `ctx.bind(el, "field.path", { multiline, placeholder })` — shows the text; in edit mode makes it editable in place with an outline. Use it for every visible text field.
- `ctx.form()` — generic form for the whole schema (lists get add / delete / reorder).
- `ctx.set("field", value)` — change a data value (goes through undo + save).
- `ctx.stage`, `ctx.lesson`, `ctx.stageIndex`.
- `ctx.state` — a plain object for **live in-stage state** (what is highlighted or revealed, scores, current round). One per lesson + stage. It survives re-renders (teacher view, edits, leaving the stage and coming back) but not a page reload, and it is **never saved**. Anything the teacher toggles live belongs here, not in `data`. Mechanics must drop ids in it that no longer exist in `data`.

`render` may return `{ onKey(event) → true if handled, destroy() }` for in-stage keys (e.g. reveal next item). Arrow keys, PageUp/PageDown and the global letters must keep working. `onKey` is not called in edit mode. Keys a mechanic may use: `N B G O M V P W K` (and Shift+ variants, `Shift+1–9`); never the arrows, PageUp/PageDown, Home/End, Space, `1–9`, `X C R T E H F U A S L`, Backspace, Delete, Esc, `?`, Enter. The shared meanings are listed at the top of MECHANICS.md. Mechanic colours should use the scene variables `--ink`, `--accent`, `--accent-ink`, `--shape`.

Registry rejects a mechanic that is missing any required field and lists it on the home screen.

## Teacher edits: base + overrides (content changes without code)

A lesson on screen is always **the newest base file + the teacher's overrides**. Neither hides the other.

- **Base** = `lessons/<level>/<lesson-id>.js`. Written by Claude. The app never writes it.
- **Overrides** = `data/overrides/<lesson-id>.js`. A patch keyed by stage and item ids: field edits, added items, deleted items, order changes. Written by the app. It sets `window.LL.overrides["<lesson-id>"]`, so it loads on `file://` too. Format: see the top of `js/overrides.js`.
- If the base changes a field the teacher did not touch, the new base value shows. If the teacher overrode that field, the teacher's value shows.
- An override whose stage or item no longer exists in the base cannot apply; it is kept in the file (never silently dropped).

Edit mode (icon toolbar — there is no side panel in edit mode; the side panel is teacher view only):
- `E` toggles edit mode. Every editable text on the scene gets a dashed yellow outline and is edited in place.
- A single row of **icons** across the top of the stage; nothing else is on screen by default. Left to right: Add stage · Delete stage (opens a confirm step: "Delete stage" / "Cancel") · Undo · Redo | Bulleted list · Numbered list · Align · Text size · Text colour | Insert shape · Insert highlighter · Layers | Zoom out · zoom % (click = 100%) · Zoom in | This stage (title, minutes, audio cue, worksheet label, mechanic, earlier / later / duplicate) · Why (rationale; red "!" while missing) · Teacher notes · Content (the mechanic's own data: items, banks, teams, pool…) · Lesson (lesson title, unit, aims, backup, reset) | ⚠ problems (only when there are any, with a count) · ✓ Done.
- Each icon except Add / Delete / Undo / Redo / the list buttons / Insert highlighter / the zoom buttons opens a **small popover** under it; one at a time. `Esc` or a click outside closes it. Below ~1400 px wide the toolbar turns compact; below ~1150 px the zoom buttons hide (Ctrl + / Ctrl - / Ctrl 0 still work).
- **Stages**: Add (`A` or the icon), Delete (the icon or `Delete`, always with a confirm click), reorder by **dragging the ⠿ handle on the rail** (or `Alt+↑/↓`, or Earlier / Later). Ids never change.
- **Lists inside Content**: drag ⠿ to reorder, or ↑ ↓; ✕ removes; "+ Add" adds (new id).
- **Text align / size / colour**: click into any bound text on the scene, then Align (left / center / right / Auto), Text size or Text colour (the curated swatches, or Auto) in the toolbar — same "click a text, then choose here" pattern as the list buttons. Stored per field in `textStyle` (see the lesson file schema above). **Text size** is the Canva model: it never interacts with any box size. When the popover opens it measures the field's untouched rendered size — that is 100%. The slider is logarithmic (the same distance halves or doubles) in whole 5% steps from 40% to 250%, previews live and saves on release; back at 100%, or "Reset to auto", removes the override completely.
- **Move any text by dragging it.** Every bound text field shows a small drag handle above it in edit mode (a separate button, not the text itself, so dragging never fights clicking in to type or selecting text). Drag the handle to free that field from the mechanic's layout and place it anywhere on the scene, like a shape; a field that has been freed this way also shows a small reset button next to its handle, which puts it back into the mechanic's normal layout. Stored as `x`/`y` in that field's `textStyle` entry.
- **Shapes**: Insert shape → circle / rectangle / triangle / arrow / line, placed at a default spot. **Insert highlighter** (one click) adds a rectangle already set up as a highlighter: `color: "highlight"`, `z: "front"`, 30 × 8, in the middle of the current view — then drag / resize it like any shape. (A front highlighter covers text still in the mechanic's layout; drag that text free first — freed text always paints on top — or send the highlighter behind with ▼.) Drag to move; drag any of its 8 handles to resize (a corner scales both dimensions, an edge stretches one); click its label to type; ✕ removes.
- **Selecting (shapes and freed text)**: click a shape, or a freed text's drag handle, to select it; Shift-click adds / removes; drag on empty scene space for a selection box (everything it touches). `Esc` clears the selection (before it closes edit mode). Selection, zoom and pan are view state: memory only, never saved, cleared when the stage changes or edit mode ends.
- **Selection tools** (a small floating panel by the selection): one element → colour swatches + ▲ Front / ▼ Back + rounded-corners slider (shapes; rectangles only for the slider), **X / Y (% of the stage) and rotation (°) number fields** (same undo path as a drag), **align to page** (left · centre · right · top · middle · bottom — the selection moves as one block), Lock / Unlock, Duplicate and ✕ (shapes) or ⤺ Reset (text), and "Select group" when it is grouped. 2 or more → **align to each other** (left / centre / right edges, top / middle / bottom edges), align to page, Group / Ungroup, Lock all, Duplicate and ✕ (the shapes in it). Drag, arrow nudge and Delete act on the whole selection. Text is lesson content: Delete and Duplicate skip it.
- **Rotation**: a ↻ handle above the selected element (shape or freed text): drag to rotate freely around its centre; it snaps to multiples of 15° (0, 15, 45, 90 …) when within 4°, with a thin guide line while snapped. Or type the angle.
- **Snapping**: while dragging, the grabbed element's centre snaps (within 1.5% of the stage) to the stage's centre lines and to any other shape's / freed text's centre x or y, with thin guide lines for the length of the drag.
- **Nudge**: arrow keys move the selection 0.5% of the stage, Shift+arrows 2% (instead of changing stage while something is selected). Rapid nudges of the same selection within 2 s share one undo step — the same coalescing rule as typing in one field and repeated drags of one element.
- **Lock**: per shape / freed text (tools, right-click, or Layers shows 🔒). Locked = no drag, resize, rotate or nudge, no handles; still selectable (to unlock), with a 🔒 badge in edit mode.
- **Group**: `Ctrl+G` groups the selection (stored in `groups`), `Ctrl+Shift+G` ungroups; clicking one member selects just it, and its tools offer "Select group".
- **Right-click** a shape or freed text: Duplicate · Delete · Bring to front / Send to back (shapes: front / back of the content and top / bottom of the other shapes) · Lock / Unlock · Group / Ungroup / Select group · Centre on page · Reset position (text).
- **Layers** (toolbar): every shape and freed text on this stage, top of the pile first (freed text is always on top), with front/back, 🔒 and group tags; click an entry to select it (Shift-click adds) — for picking something that is hard to click on the canvas.
- **Zoom / pan** (edit mode only): `Ctrl +` / `Ctrl -` / `Ctrl 0` (or the toolbar), 100–400%, or Ctrl + scroll around the pointer; pan with scroll or Space + drag (a Space *tap* still starts / pauses the timer). A pure view transform: stored x / y / w / h never change, a drag at 200% just moves half as far on the stage. Back to 100% when edit mode ends or the stage changes.
- Undo: `Ctrl+Z` / `U` / Undo icon. Redo: `Ctrl+Y` (or `Ctrl+Shift+Z`) / Redo icon — walks forward through the same history; any new edit clears the redo steps.
- **Layout, colour role and position are freely adjustable; free colour and font are not.** The teacher can position, resize and rotate anything, drag any text field anywhere on the scene, lock, group and align elements, and set per-field text alignment, size and colour (Align, Text size, Text colour, shape drag-resize, shape colour/front-back, rounded corners). Colour is always one of the curated roles (`LL.COLOR_ROLES`) or "automatic" — never an open picker, never a hex value or a font choice, so scenes stay visually consistent no matter how much the teacher rearranges them. There is no way to colour or highlight only part of a text field (a single phrase inside a longer sentence, say) — the closest approximation is a separately positioned, coloured shape placed behind that part of the text.
- Every change is recorded as overrides, cached in `localStorage` (`lessonlab.overrides.v2`) for offline use.
- "Has teacher edits" badge on a lesson = it has overrides. "Reset lesson to original" clears that lesson's overrides (on every device once saved).
- **Hide / Unhide a lesson** (home screen): `E` on the home screen (a level's lesson list) shows a Hide control on each lesson tile, gated like every other write (view-only devices cannot hide). Hide records a lesson-level `hidden: true` override; the tile leaves the normal list and the level count. "Show hidden (n)" under the tiles lists hidden lessons with Open and Unhide; Unhide clears the flag (the entry becomes an "edit undone" tombstone, like any undone edit). **The app never deletes a lesson file or edits `lessons/manifest.js`.** Removing a lesson for real is a repo edit by Claude.

GitHub sync (public repo):
- Settings (`S` on the home screen) → Save edits to GitHub. The teacher pastes a fine-grained token (Contents: Read and write, this repo only) once per device. It is stored only in that device's `localStorage`: never in the repo, never in a backup file.
- **Without a token a device is view only** (edit mode refuses to open).
- Edits save to `data/overrides/<lesson-id>.js` about 3 seconds after each change. Status: Saved / Saving… / Offline: will save later / Not saved: reason. Offline edits wait and save when back online.
- On start and when a lesson opens, the app loads the latest overrides from the repo (reads need no token).
- Two devices changed the same field: the later save wins; the other value goes to the conflict log (`lessonlab.conflicts.v1`), which is included in the backup file.
- Every save is a commit to the sync branch (`main` by default). Expect many small "Teacher edits: <id>" commits.

Pictures:
- "Upload / replace image" appears next to every picture path field in edit mode. The picture is resized (longest side 1600 px) and previewed before it is used.
- It is saved as `assets/uploads/<lesson>-<stage>-<random>.<ext>`; only the path is stored, as an override. The original picture file is never overwritten, so Reset brings it back.
- Uploads are cached on the device (IndexedDB) and synced like edits. Uploaded pictures are public: never photos of students.

Backup: Export writes one `.json` file with every lesson's overrides and the conflict log. Import merges it back (newest wins). Old-format backups (full edited copies) are converted on import.

## Working with overrides (rules for Claude)

1. The app commits teacher edits to `main`. Before any task, fetch `main` and bring it into your branch so you see the latest `data/overrides/`.
2. **Before changing any lesson file**, read `data/overrides/<lesson-id>.js`. If it has edits, fold them into the base file and clear the overrides file:
   `node tools/fold-overrides.js <lesson-id>` (use `--dry-run` first to preview).
   Then **report exactly what was folded in** (the tool prints every edit, with device and time).
3. If the tool refuses (an edit points at a stage/item that no longer exists), change nothing and ask the teacher.
4. If a task changes a field the teacher overrode, **keep the teacher's version** unless the prompt says otherwise, and report it.
5. **Never delete overrides without folding them in.** Never hand-edit an overrides file. Never delete files in `assets/uploads/` that a lesson or override still points to.
6. Adding a new lesson still needs its line in `lessons/manifest.js`.

## Navigation flow

Home (levels) → level (lesson tiles) → **lesson menu** → stage scene.

- **Home / level**: `E` toggles home edit (Hide on each lesson tile; `Esc` or Done leaves it). Hidden lessons are not on the tiles or in the level counts; "Show hidden (n)" under the tiles lists them with Open (goes to their lesson menu) and Unhide.

- **Lesson menu** (`#/lesson/<id>`): opening a lesson tile lands here, not on stage 1. One numbered line per stage, in order: title, minutes, and 📝 + `worksheetLabel` when the stage has one (⚠ if the stage has problems). Click a line, or `↑ ↓` + `Enter`, or `1–9`, to open that stage. The stage last shown this session is highlighted ("▶ Continue") and focused; stages already shown get a ring on their number. `H` / `Esc` / `Backspace` go back to the lesson list. It is a teacher navigation screen: no edit mode here.
- **Stage scene** (`#/lesson/<id>/<n>`): unchanged — rail, ‹ › / arrows, per-stage timer, teacher view, edit mode. `L` or the ☰ HUD button returns to the lesson menu; `H` / ⌂ / `Esc` still go back to the lesson list.
- Where the teacher left off (last stage, stages shown) is kept in memory for the session only, like timers and `ctx.state`; a page reload clears it.

## Design principles

1. **Not slides.** No slide numbers, no title + bullets, no deck look. Each stage is a scene with motion and its own identity.
2. **One task on screen at a time.** Large type, readable from the back of the room.
3. **Keyboard-first.** Every action has a key. `?` shows them all. Keep the key map in `js/app.js` (`KEYS`) in sync with the handler.
4. **Every student speaks.** Every mechanic must say how it keeps all students talking at once, not one at a time.
5. **Teacher information stays hidden** from students unless the teacher opens teacher view (`T`).
6. **No walls of text.** No mechanic renders more than about one sentence of instruction as a single unbroken block of prose. Multi-part instructions get a short title plus short numbered steps (see `prompt-card`'s `title` + `steps`).
7. **Layout and position are freely adjustable; colour is curated, never free; typeface never changes.** The teacher can position, resize and rotate shapes (independent width/height, drag any edge or corner; arrows and lines too), drag and rotate any text field anywhere on the scene, and set per-field text alignment, size and colour (`textStyle`), plus a shape's colour and front/back layering (`decorations`). Colour is always chosen from a small fixed set (`LL.COLOR_ROLES`) or left automatic — never an open picker, never a hex value. There is no font picker and no theme switch anywhere — the app always chooses typeface, and colour beyond the curated roles, from the same hash-of-the-stage-id palette (see "Edit mode").

## Key map (current)

In-stage keys (per mechanic, listed by `?` and in teacher view): see MECHANICS.md.
Lesson: `→`/`PageDown` next · `←`/`PageUp` previous · `1–9` jump · `Home`/`End` · `Space` timer start/pause · `X` reset timer · `C` fold/unfold timer (remembered) · `R` fold/unfold rail · `T` teacher view · `L` lesson menu · `H`/`Backspace` back to lesson list.
Lesson menu: `↑ ↓` + `Enter` or `1–9` open a stage · `H`/`Esc`/`Backspace` back to lesson list.
Edit: `E` toggle · `Ctrl+Z`/`U` undo · `Ctrl+Y` (or `Ctrl+Shift+Z`) redo · `A` add stage · `Alt+↑/↓` move stage (or drag ⠿ on the rail) · `Delete` delete stage (asks first), or the selected shapes · arrows / `Shift`+arrows nudge the selection 0.5% / 2% (only while something is selected; otherwise they change stage) · `Ctrl+D` duplicate selected shapes · `Ctrl+G` / `Ctrl+Shift+G` group / ungroup · Shift-click / drag on empty space select several · right-click more actions · `Ctrl +` / `Ctrl -` / `Ctrl 0` zoom in / out / 100% · Space + drag or scroll pan when zoomed (a Space tap still toggles the timer) · `Ctrl+Shift+8` / `Ctrl+Shift+7` bulleted / numbered list · `Esc` close the menu / stop typing / close the open popover / clear the selection / leave.
Home: `S` settings · `E` home edit (Hide on lesson tiles) · "Show hidden" lists hidden lessons (Unhide).
Anywhere: `?` keys · `F` full screen · arrows + `Enter` on home · `Esc` back.

## Working rules for every future prompt

1. Read the repo and this CLAUDE.md first.
2. Adding a lesson means adding a lesson file (plus its one line in `lessons/manifest.js`, and any pictures in `assets/`). Do not modify existing lessons or shared code unless the prompt says so. Before changing an existing lesson, follow "Working with overrides" above.
3. Reuse existing mechanics listed in MECHANICS.md. Build a new mechanic only when none fits, and only if the prompt approves it.
4. After every task, update MECHANICS.md and report which entries changed.
5. Never regenerate or restructure the app.

## Sample content

The SAMPLE lessons (`sample-hello`, `sample-mechanics`) and `assets/sample/` were removed once real lessons existed. There is no sample content now; `lessons/beginner/starter-in-the-classroom.js` is the reference lesson (it uses every mechanic).
