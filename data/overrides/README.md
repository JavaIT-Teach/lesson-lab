# Teacher edits (overrides)

One file per lesson: `<lesson-id>.js`. Written by the app (edit mode + GitHub sync). Do not hand-edit.

Each file is a patch on top of `lessons/<level>/<lesson-id>.js`, keyed by stage and item ids.
Before changing a lesson file, fold its overrides in: `node tools/fold-overrides.js <lesson-id>` (see CLAUDE.md).
