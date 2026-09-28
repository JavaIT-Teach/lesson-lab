#!/usr/bin/env node
/*
 * Fold a lesson's teacher edits (data/overrides/<id>.js) into its lesson file,
 * then clear the overrides file. For Claude / maintainers; the app never runs this.
 *
 *   node tools/fold-overrides.js <lesson-id>            fold one lesson
 *   node tools/fold-overrides.js <lesson-id> --dry-run  report only, change nothing
 *   node tools/fold-overrides.js --all [--dry-run]      every lesson with edits
 *
 * Uses js/overrides.js, so the folded file is exactly what the app was showing.
 * Refuses (changes nothing) if an edit cannot be applied (its stage/item is gone)
 * or if the result would break the id rules.
 * "Clearing" writes an empty overrides file with resetAt = now, so every device
 * drops its cached copy of the folded edits instead of re-uploading them.
 */
"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var ROOT = path.resolve(__dirname, "..");
var ov = require(path.join(ROOT, "js/overrides.js"));

function sandbox() {
  var win = { LL: {} };
  win.window = win;
  return vm.createContext(win);
}

function run(ctx, file) {
  vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
}

function loadCore() {
  var ctx = sandbox();
  run(ctx, path.join(ROOT, "js/core.js"));
  return ctx.LL;
}

function manifest() {
  var ctx = sandbox();
  run(ctx, path.join(ROOT, "lessons/manifest.js"));
  return ctx.LL.manifest || [];
}

/* Find the file that registers `id`. */
function findLesson(id) {
  var files = manifest();
  for (var i = 0; i < files.length; i++) {
    var file = path.join(ROOT, "lessons", files[i]);
    if (!fs.existsSync(file)) continue;
    var ctx = sandbox();
    var got = null;
    ctx.LL.registerLesson = function (l) { got = l; };
    ctx.window.LL = ctx.LL;
    try { run(ctx, file); } catch (e) { continue; }
    if (got && got.id === id) return { file: file, lesson: JSON.parse(JSON.stringify(got)) };
  }
  return null;
}

function loadOverrides(id) {
  var file = path.join(ROOT, "data/overrides", id + ".js");
  if (!fs.existsSync(file)) return { file: file, doc: null };
  return { file: file, doc: ov.fromFile(fs.readFileSync(file, "utf8")) };
}

/* ---------- JS literal writer (unquoted keys, 2-space indent) ---------- */

function lit(v, ind) {
  ind = ind || "";
  var next = ind + "  ";
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return "[\n" + v.map(function (x) { return next + lit(x, next); }).join(",\n") + "\n" + ind + "]";
  }
  if (v && typeof v === "object") {
    var keys = Object.keys(v);
    if (!keys.length) return "{}";
    return "{\n" + keys.map(function (k) {
      var key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return next + key + ": " + lit(v[k], next);
    }).join(",\n") + "\n" + ind + "}";
  }
  return JSON.stringify(v);
}

function writeLesson(file, lesson) {
  var src = fs.readFileSync(file, "utf8");
  var header = /^\s*\/\*[\s\S]*?\*\/\s*/.exec(src);
  fs.writeFileSync(file, (header ? header[0].trimEnd() + "\n" : "") + "LL.registerLesson(" + lit(lesson) + ");\n");
}

/* ---------- Fold ---------- */

function fold(id, dry) {
  var found = findLesson(id);
  if (!found) return fail("No lesson with id '" + id + "' in lessons/manifest.js.");
  var o = loadOverrides(id);
  var live = ov.liveEntries(o.doc);
  var rel = function (f) { return path.relative(ROOT, f); };
  if (!live.length) {
    console.log("• " + id + ": no teacher edits to fold (" + rel(o.file) + (o.doc ? " is empty" : " does not exist") + ").");
    return true;
  }

  var res = ov.apply(found.lesson, o.doc);
  if (res.orphans.length) {
    return fail(id + ": these edits point at stages/items that are no longer in the lesson file, so they cannot be folded.\n" +
      res.orphans.map(function (k) { return "    - " + ov.describe(k, o.doc.entries[k]); }).join("\n") +
      "\n  Nothing was changed. Ask the teacher what to do with them.");
  }
  var LL = loadCore();
  var idProblems = LL.idProblems(res.lesson);
  if (idProblems.length) return fail(id + ": folding would break the id rules:\n    - " + idProblems.join("\n    - ") + "\n  Nothing was changed.");

  console.log((dry ? "Would fold " : "Folded ") + live.length + " teacher edit(s) into " + rel(found.file) + ":");
  live.forEach(function (x) {
    var when = x.e.t ? new Date(x.e.t).toISOString().slice(0, 16).replace("T", " ") : "?";
    console.log("    - " + ov.describe(x.key, x.e) + "   [" + (x.e.by || "unknown device") + ", " + when + " UTC]");
  });
  if (dry) return true;

  writeLesson(found.file, res.lesson);
  var now = Date.now();
  fs.writeFileSync(o.file, ov.toFile({ lesson: id, format: ov.FORMAT, resetAt: now, updatedAt: now, entries: {} }));
  console.log("  Cleared " + rel(o.file) + " (resetAt " + new Date(now).toISOString() + ").");
  return true;
}

function fail(msg) {
  console.error("✗ " + msg);
  return false;
}

var args = process.argv.slice(2);
var dry = args.indexOf("--dry-run") !== -1;
var ids = args.filter(function (a) { return a.charAt(0) !== "-"; });
if (args.indexOf("--all") !== -1) {
  var dir = path.join(ROOT, "data/overrides");
  ids = fs.existsSync(dir) ? fs.readdirSync(dir).filter(function (f) { return /\.js$/.test(f); }).map(function (f) { return f.slice(0, -3); }) : [];
}
if (!ids.length) {
  console.error("Usage: node tools/fold-overrides.js <lesson-id> [--dry-run] | --all [--dry-run]");
  process.exit(2);
}
var ok = ids.map(function (id) { return fold(id, dry); }).every(Boolean);
process.exit(ok ? 0 : 1);
