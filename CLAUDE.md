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
        { id: "shape-1", shape: "circle", x: 80, y: 25, size: 14, label: "Go!" }  // NO colour field, ever
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
    }
  ]
});
```

`audioCue` (optional): a short text such as `"Listen: Track 3"`. If a stage has it, a headphones badge shows next to the stage title in both student and teacher view, and in the teacher panel. It is editable in edit mode (in place and in the side panel). Leave it out when the stage has no recording. If present it must be text.

`worksheetLabel` (optional): a short text such as `"Worksheet Part 2"`. It marks that the stage has a paired printed worksheet and names it. Metadata only: it shows with 📝 on that stage's line in the lesson menu and in teacher view, not on the student scene. Editable in edit mode (side panel), no forced value. Leave it out when there is no worksheet. If present it must be text.

`hidden` (lesson level, optional, true/false): takes the lesson off the home screen lists. It is set and cleared by the app's Hide / Unhide controls as a normal override (`"hidden"` entry in `data/overrides/<lesson-id>.js`), so it is reversible and synced like any edit. Do not write it into lesson files by hand; folding a hidden lesson's overrides would carry it into the base file, so check before folding.

`decorations` (optional): shapes placed on the scene. Each item: `id` (permanent), `shape` (`circle` | `rectangle` | `triangle`), `x` and `y` (centre, % of the scene, 0–100), `size` (vmin, 3–60), optional short `label` (≤ 40 characters). **Colour is never stored and never chosen by the teacher**: at render time a shape fills with the scene's `--accent` (label in `--accent-ink`), which come from the same hash-of-the-stage-id palette as the background, so shapes always match their stage. Labels use one fixed size and weight. Validation rejects any other key (e.g. `color`). Shapes sit behind the stage content in normal view (they never cover the task) and above it in edit mode (so they can be dragged). No rotation.

**Text lists are plain characters.** A bulleted line starts with `• `, a numbered line with `1. `, `2. ` … — ordinary text inside the string, not a separate data format. The edit toolbar's list buttons (and `Ctrl+Shift+8` / `Ctrl+Shift+7`) add or strip these prefixes on the current line or each selected line. Renderers need nothing special; multi-line fields already keep line breaks.

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

Schema field spec: `{ type: "string" | "number" | "boolean" | "list" | "object", required, label, help, placeholder, multiline, min, max, format, item (for list), itemLabel (for list), fields (for object), default }`.

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
- A single row of **icons** across the top of the stage; nothing else is on screen by default. Left to right: Add stage · Delete stage (opens a confirm step: "Delete stage" / "Cancel") · Undo | Bulleted list · Numbered list | Insert shape | This stage (title, minutes, audio cue, worksheet label, mechanic, earlier / later / duplicate) · Why (rationale; red "!" while missing) · Teacher notes · Content (the mechanic's own data: items, banks, teams, pool…) · Lesson (lesson title, unit, aims, backup, reset) | ⚠ problems (only when there are any, with a count) · ✓ Done.
- Each icon except Add / Delete / Undo / the list buttons opens a **small popover** under it; one at a time. `Esc` or a click outside closes it.
- **Stages**: Add (`A` or the icon), Delete (the icon or `Delete`, always with a confirm click), reorder by **dragging the ⠿ handle on the rail** (or `Alt+↑/↓`, or Earlier / Later). Ids never change.
- **Lists inside Content**: drag ⠿ to reorder, or ↑ ↓; ✕ removes; "+ Add" adds (new id).
- **Shapes**: Insert shape → circle / rectangle / triangle, placed at a default spot. Drag to move, drag the corner square to resize, ✕ (or `Delete` while selected) removes, click its label to type. Colour follows the stage automatically (see `decorations`).
- Undo: `Ctrl+Z` / `U` / Undo icon.
- **Not built, on purpose**: no font picker, no colour picker, no manual style / size / weight controls anywhere, and no in-app switching of a lesson's visual theme. The app chooses every colour, size and style; the teacher only makes structural and content choices. Theme comes from how the lesson was built (palette = hash of the stage id), not from edit mode.
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
7. **No manual styling in edit mode.** No font, colour, size or theme controls. The teacher edits structure and content; the app styles everything (see "Edit mode").

## Key map (current)

In-stage keys (per mechanic, listed by `?` and in teacher view): see MECHANICS.md.
Lesson: `→`/`PageDown` next · `←`/`PageUp` previous · `1–9` jump · `Home`/`End` · `Space` timer start/pause · `X` reset timer · `C` fold/unfold timer (remembered) · `R` fold/unfold rail · `T` teacher view · `L` lesson menu · `H`/`Backspace` back to lesson list.
Lesson menu: `↑ ↓` + `Enter` or `1–9` open a stage · `H`/`Esc`/`Backspace` back to lesson list.
Edit: `E` toggle · `Ctrl+Z`/`U` undo · `A` add stage · `Alt+↑/↓` move stage (or drag ⠿ on the rail) · `Delete` delete stage (asks first) or the selected shape · `Ctrl+Shift+8` / `Ctrl+Shift+7` bulleted / numbered list · `Esc` stop typing / close the open popover / leave.
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
