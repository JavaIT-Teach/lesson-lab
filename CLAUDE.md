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

## Folder layout

```
index.html                 App entry. Loads shell, mechanics, manifest, then app.
css/app.css                Shell styles (home, player, rail, timer, panels, scene palettes).
js/core.js                 LL namespace, level list, mechanic + lesson registries, validation.
js/ui.js                   DOM helper h() and the generic schema form used by editors.
js/store.js                localStorage edits, prefs, backup export/import.
js/loader.js               Loads every file in lessons/manifest.js via <script> injection.
js/app.js                  Home, lesson player, rail, timer, teacher view, edit mode, keys.
mechanics/<id>.js          One file per mechanic. Shared by all lessons.
lessons/manifest.js        List of lesson files to load (browsers cannot list folders offline).
lessons/<level-id>/<lesson-id>.js   One self-contained lesson per file. Data only.
assets/                    Local pictures. Subfolder per lesson or topic.
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
  stages: [                        // ordered; at least one
    {
      id: "warm-up",               // unique within the lesson
      title: "Warm-up",
      minutes: 3,                  // number above 0; drives the stage timer
      mechanic: "prompt-card",     // id of a registered mechanic (see MECHANICS.md)
      data: { /* exactly the fields that mechanic's schema defines */ },
      rationale: {                 // MANDATORY
        language: "What language this stage forces",
        output: "What students produce"
      },
      teacherNotes: "Only shown in teacher view."
    }
  ]
});
```

To make a lesson appear, add one line to `lessons/manifest.js`: `"<level-id>/<lesson-id>.js"`.

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
| `editor(root, ctx)`       | Draws the edit-panel form for its data (usually `root.appendChild(ctx.form())`). |
| `css` (optional)          | A CSS string; injected once so the mechanic stays one file. Prefix classes with a short mechanic prefix. |

Schema field spec: `{ type: "string" | "number" | "boolean" | "list" | "object", required, label, help, placeholder, multiline, min, max, item (for list), itemLabel (for list), fields (for object), default }`.

`ctx` passed to `render` and `editor`:
- `ctx.editing`, `ctx.teacher` — current modes.
- `ctx.bind(el, "field.path", { multiline, placeholder })` — shows the text; in edit mode makes it editable in place with an outline. Use it for every visible text field.
- `ctx.form()` — generic form for the whole schema (lists get add / delete / reorder).
- `ctx.set("field", value)` — change a data value (goes through undo + save).
- `ctx.stage`, `ctx.lesson`, `ctx.stageIndex`.

`render` may return `{ onKey(event) → true if handled, destroy() }` for in-stage keys (e.g. reveal next item). Arrow keys, PageUp/PageDown and the global letters must keep working. Mechanic colours should use the scene variables `--ink`, `--accent`, `--accent-ink`, `--shape`.

Registry rejects a mechanic that is missing any required field and lists it on the home screen.

## Edit mode (content changes without code)

- `E` toggles edit mode. Every editable element gets a dashed yellow outline.
- Text on the scene is edited in place. The side panel edits everything else: stage title, minutes, rationale, teacher notes, mechanic, mechanic data, lesson title/unit/aims.
- Stages: add, duplicate, delete, move up/down. List items: add, delete, move.
- Undo: `Ctrl+Z` / `U` / Undo button. Typing in one field within 2 s is one undo step.
- Edits are saved as a full copy of the lesson in `localStorage` (`lessonlab.edits.v1`), keyed by lesson id. The file on disk is never changed. The edited copy shadows the file until "Reset lesson to original".
- Backup: Export writes a `.json` file of all edited lessons; Import reads it back.
- No GitHub sync. Do not build it unless a prompt asks for it.

## Design principles

1. **Not slides.** No slide numbers, no title + bullets, no deck look. Each stage is a scene with motion and its own identity.
2. **One task on screen at a time.** Large type, readable from the back of the room.
3. **Keyboard-first.** Every action has a key. `?` shows them all. Keep the key map in `js/app.js` (`KEYS`) in sync with the handler.
4. **Every student speaks.** Every mechanic must say how it keeps all students talking at once, not one at a time.
5. **Teacher information stays hidden** from students unless the teacher opens teacher view (`T`).

## Key map (current)

Lesson: `→`/`PageDown` next · `←`/`PageUp` previous · `1–9` jump · `Home`/`End` · `Space` timer start/pause · `X` reset timer · `C` fold/unfold timer (remembered) · `R` fold/unfold rail · `T` teacher view · `H`/`Backspace` back to lesson list.
Edit: `E` toggle · `Ctrl+Z`/`U` undo · `A` add stage · `Alt+↑/↓` move stage · `Delete` delete stage · `Esc` stop typing / leave.
Anywhere: `?` keys · `F` full screen · arrows + `Enter` on home · `Esc` back.

## Working rules for every future prompt

1. Read the repo and this CLAUDE.md first.
2. Adding a lesson means adding a lesson file (plus its one line in `lessons/manifest.js`, and any pictures in `assets/`). Do not modify existing lessons or shared code unless the prompt says so.
3. Reuse existing mechanics listed in MECHANICS.md. Build a new mechanic only when none fits, and only if the prompt approves it.
4. After every task, update MECHANICS.md and report which entries changed.
5. Never regenerate or restructure the app.

## Sample content

`lessons/beginner/sample-hello.js` and `assets/sample/` are a SAMPLE that proves the loop. Delete both and the manifest line once real lessons exist.
