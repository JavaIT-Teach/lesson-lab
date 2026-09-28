/*
 * Lesson Lab — overrides engine (pure logic, no DOM).
 *
 * A lesson on screen = base lesson file + overrides (the teacher's edits).
 * Overrides are a patch keyed by stable ids, never by position:
 *
 *   {
 *     lesson: "sample-hello",
 *     format: 1,
 *     resetAt: 0,            // entries saved before this time are dead (Reset / fold-in)
 *     updatedAt: 1727000000000,
 *     entries: {
 *       "title":                              { op: "set",   v: "New title", t, by },
 *       "stages[warm-up].data.prompt":        { op: "set",   v: "…",         t, by },
 *       "stages[warm-up].minutes":            { op: "unset",                 t, by },
 *       "stages[stage-x1]":                   { op: "add",   v: {…stage},    t, by },
 *       "stages[where-from]":                 { op: "del",                   t, by },
 *       "stages":                             { op: "order", v: [ids…],      t, by },
 *       "stages[s1].data.items[q2].text":     { op: "set",   v: "…",         t, by },
 *       "stages[s1].data.items[q9]":          { op: "add",   v: {…item},     t, by },
 *       "subAims":                            { op: "none",                  t, by }  // tombstone
 *     }
 *   }
 *
 * Path syntax: dot-separated keys; [id] selects the item with that id in a list.
 * A list is "id-keyed" when every item is an object with an id. Other values
 * (text, numbers, lists of plain text such as subAims) are replaced whole.
 *
 * Merge rule between devices: per entry, the newest save (t) wins.
 *
 * Loaded by the browser as a classic script and by tools/fold-overrides.js under Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    root.LL = root.LL || {};
    root.LL.ov = api;
  }
})(typeof window !== "undefined" ? window : this, function () {
  "use strict";

  var ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
  var KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  var FORMAT = 1;

  function clone(x) {
    return x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  }

  function isObj(x) {
    return x !== null && typeof x === "object" && !Array.isArray(x);
  }

  function equal(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function isIdArray(a) {
    return Array.isArray(a) && a.every(function (x) { return isObj(x) && typeof x.id === "string" && ID_RE.test(x.id); });
  }

  /* ---------- Paths ---------- */

  function pathKey(segs) {
    var s = "";
    segs.forEach(function (g) {
      if (typeof g === "object") s += "[" + g.id + "]";
      else s += (s ? "." : "") + g;
    });
    return s;
  }

  function parseKey(key) {
    var segs = [];
    var re = /([A-Za-z_$][A-Za-z0-9_$]*)|\[([A-Za-z0-9][A-Za-z0-9_-]*)\]|\./g;
    var m, consumed = 0;
    while ((m = re.exec(key))) {
      if (m.index !== consumed) return null;
      consumed = re.lastIndex;
      if (m[1]) segs.push(m[1]);
      else if (m[2]) segs.push({ id: m[2] });
    }
    return consumed === key.length && segs.length ? segs : null;
  }

  function step(node, seg) {
    if (node == null) return undefined;
    if (typeof seg === "object") {
      if (!Array.isArray(node)) return undefined;
      for (var i = 0; i < node.length; i++) if (isObj(node[i]) && node[i].id === seg.id) return node[i];
      return undefined;
    }
    return isObj(node) ? node[seg] : undefined;
  }

  function resolve(node, segs) {
    for (var i = 0; i < segs.length && node !== undefined; i++) node = step(node, segs[i]);
    return node;
  }

  /* ---------- Diff: what does `work` change relative to `base`? ---------- */

  function diff(base, work) {
    var out = {};
    walk(base, work, [], out);
    return out;
  }

  function walk(b, w, segs, out) {
    if (isIdArray(b) && isIdArray(w)) {
      var bIds = b.map(function (x) { return x.id; });
      var wIds = w.map(function (x) { return x.id; });
      var added = [];
      w.forEach(function (item) {
        if (bIds.indexOf(item.id) === -1) {
          added.push(item.id);
          out[pathKey(segs.concat({ id: item.id }))] = { op: "add", v: clone(item) };
        }
      });
      b.forEach(function (item) {
        if (wIds.indexOf(item.id) === -1) out[pathKey(segs.concat({ id: item.id }))] = { op: "del" };
      });
      w.forEach(function (item) {
        var i = bIds.indexOf(item.id);
        if (i !== -1) walk(b[i], item, segs.concat({ id: item.id }), out);
      });
      var natural = bIds.filter(function (id) { return wIds.indexOf(id) !== -1; }).concat(added);
      if (!equal(natural, wIds)) out[pathKey(segs)] = { op: "order", v: wIds.slice() };
      return;
    }
    if (isObj(b) && isObj(w)) {
      var keys = {};
      Object.keys(b).forEach(function (k) { keys[k] = 1; });
      Object.keys(w).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) {
        if (!KEY_RE.test(k)) return; // unaddressable key; never produced by the app
        var inB = b[k] !== undefined, inW = w[k] !== undefined;
        var p = segs.concat(k);
        if (inB && !inW) out[pathKey(p)] = { op: "unset" };
        else if (!inB && inW) out[pathKey(p)] = { op: "set", v: clone(w[k]) };
        else if (inB && inW) walk(b[k], w[k], p, out);
      });
      return;
    }
    if (!equal(b, w)) out[pathKey(segs)] = { op: "set", v: clone(w) };
  }

  /* ---------- Apply: base + overrides → lesson ---------- */

  var RANK = { del: 0, add: 1, order: 2, set: 3, unset: 3 };

  function liveEntries(doc) {
    var list = [];
    if (!doc || !isObj(doc.entries)) return list;
    var resetAt = doc.resetAt || 0;
    Object.keys(doc.entries).forEach(function (k) {
      var e = doc.entries[k];
      if (!e || e.op === "none" || !(e.op in RANK) || (e.t || 0) < resetAt) return;
      var segs = parseKey(k);
      list.push({ key: k, segs: segs, e: e });
    });
    list.sort(function (a, b) {
      return RANK[a.e.op] - RANK[b.e.op] || (a.segs ? a.segs.length : 0) - (b.segs ? b.segs.length : 0);
    });
    return list;
  }

  /* Returns { lesson, orphans: [keys that could not be applied] }. Never mutates base. */
  function apply(base, doc) {
    var work = clone(base);
    var orphans = [];
    liveEntries(doc).forEach(function (x) {
      if (!x.segs || !applyOne(work, x.segs, x.e)) orphans.push(x.key);
    });
    return { lesson: work, orphans: orphans };
  }

  function applyOne(work, segs, e) {
    var last = segs[segs.length - 1];
    var parent = resolve(work, segs.slice(0, -1));
    var i;
    switch (e.op) {
      case "del":
        if (typeof last !== "object" || !Array.isArray(parent)) return false;
        for (i = 0; i < parent.length; i++) if (isObj(parent[i]) && parent[i].id === last.id) { parent.splice(i, 1); return true; }
        return false; // already gone from the base
      case "add":
        if (typeof last !== "object" || !Array.isArray(parent) || !isObj(e.v)) return false;
        for (i = 0; i < parent.length; i++) if (isObj(parent[i]) && parent[i].id === last.id) { parent[i] = clone(e.v); return true; }
        parent.push(clone(e.v));
        return true;
      case "order":
        var arr = resolve(work, segs);
        if (!Array.isArray(arr) || !Array.isArray(e.v)) return false;
        reorder(arr, e.v);
        return true;
      case "set":
        if (typeof last === "object" || !isObj(parent)) return false;
        parent[last] = clone(e.v);
        return true;
      case "unset":
        if (typeof last === "object" || !isObj(parent)) return false;
        delete parent[last];
        return true;
    }
    return false;
  }

  /* Put listed ids first in the listed order; items not listed (new in the base) keep their place after their predecessor. */
  function reorder(arr, ids) {
    var byId = {};
    arr.forEach(function (x) { if (isObj(x)) byId[x.id] = x; });
    var result = [];
    ids.forEach(function (id) { if (byId[id] && result.indexOf(byId[id]) === -1) result.push(byId[id]); });
    arr.forEach(function (x, i) {
      if (result.indexOf(x) !== -1) return;
      var j = i - 1;
      while (j >= 0 && result.indexOf(arr[j]) === -1) j--;
      result.splice(j < 0 ? 0 : result.indexOf(arr[j]) + 1, 0, x);
    });
    arr.length = 0;
    Array.prototype.push.apply(arr, result);
  }

  /* ---------- Record edits: new doc after the teacher changed `work` ---------- */

  function emptyDoc(lessonId) {
    return { lesson: lessonId, format: FORMAT, resetAt: 0, updatedAt: 0, entries: {} };
  }

  function sameEntry(a, b) {
    return !!a && !!b && a.op === b.op && equal(a.v, b.v);
  }

  function record(doc, base, work, now, by) {
    doc = doc || emptyDoc(base.id);
    var resetAt = doc.resetAt || 0;
    var d = diff(base, work);
    var orphans = apply(base, doc).orphans;
    var entries = {};
    Object.keys(d).forEach(function (k) {
      var old = doc.entries[k];
      entries[k] = old && (old.t || 0) >= resetAt && sameEntry(old, d[k]) ? old : withMeta(d[k], now, by);
    });
    Object.keys(doc.entries).forEach(function (k) {
      if (entries[k]) return;
      var old = doc.entries[k];
      if ((old.t || 0) < resetAt) return;
      if (old.op === "none" || orphans.indexOf(k) !== -1) entries[k] = old;
      else entries[k] = { op: "none", t: now, by: by };
    });
    return { lesson: doc.lesson || base.id, format: FORMAT, resetAt: resetAt, updatedAt: now, entries: entries };
  }

  function withMeta(e, t, by) {
    var o = { op: e.op };
    if (e.v !== undefined) o.v = e.v;
    o.t = t;
    if (by) o.by = by;
    return o;
  }

  function reset(doc, lessonId, now) {
    return { lesson: lessonId, format: FORMAT, resetAt: now, updatedAt: now, entries: {} };
  }

  function hasEdits(doc) {
    return liveEntries(doc).length > 0;
  }

  /* ---------- Merge two copies (this device vs repo) ----------
   * synced: { key: t } as last agreed with the repo (null if never synced).
   * Newest t wins per entry. When both sides changed the same entry since the
   * last sync and disagree, the losing side goes into `conflicts`.
   */
  function merge(local, remote, synced, now) {
    local = local || emptyDoc(remote && remote.lesson);
    remote = remote || emptyDoc(local.lesson);
    var resetAt = Math.max(local.resetAt || 0, remote.resetAt || 0);
    var entries = {};
    var conflicts = [];
    var keys = {};
    Object.keys(local.entries || {}).forEach(function (k) { keys[k] = 1; });
    Object.keys(remote.entries || {}).forEach(function (k) { keys[k] = 1; });

    function changedSinceSync(k, e) {
      return !synced || synced[k] !== e.t;
    }

    Object.keys(keys).forEach(function (k) {
      var a = local.entries[k], b = remote.entries[k];
      var aLive = a && (a.t || 0) >= resetAt;
      var bLive = b && (b.t || 0) >= resetAt;
      if (a && !aLive && a.op !== "none" && changedSinceSync(k, a) && !(b && sameEntry(a, b))) {
        conflicts.push(conflict(local.lesson, k, null, a, "Cleared by a reset or fold-in that happened after this edit.", now));
      }
      if (aLive && bLive) {
        var winner = (a.t || 0) > (b.t || 0) ? a : b;
        var loser = winner === a ? b : a;
        if (!sameEntry(a, b) && changedSinceSync(k, a) && changedSinceSync(k, b)) {
          conflicts.push(conflict(local.lesson, k, winner, loser, "Two devices changed this; the later save was kept.", now));
        }
        entries[k] = winner;
      } else if (aLive) entries[k] = a;
      else if (bLive) entries[k] = b;
    });

    return {
      doc: {
        lesson: local.lesson || remote.lesson,
        format: FORMAT,
        resetAt: resetAt,
        updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
        entries: entries
      },
      conflicts: conflicts
    };
  }

  function conflict(lesson, key, kept, lost, reason, now) {
    return {
      lesson: lesson,
      field: key,
      kept: kept ? { op: kept.op, value: kept.v, savedAt: iso(kept.t), by: kept.by || null } : null,
      lost: { op: lost.op, value: lost.v, savedAt: iso(lost.t), by: lost.by || null },
      reason: reason,
      loggedAt: iso(now || Date.now())
    };
  }

  function iso(t) {
    try { return new Date(t).toISOString(); } catch (e) { return null; }
  }

  function syncedMap(doc) {
    var m = {};
    Object.keys((doc && doc.entries) || {}).forEach(function (k) { m[k] = doc.entries[k].t; });
    return m;
  }

  /* ---------- Plain-words description (reports, fold-in) ---------- */

  function describe(key, e) {
    var val = function (v) {
      var s = JSON.stringify(v);
      return s && s.length > 90 ? s.slice(0, 87) + "…" : s;
    };
    switch (e.op) {
      case "set": return key + " → " + val(e.v);
      case "unset": return key + " → (removed)";
      case "add": return "added " + key + (e.v && e.v.title ? " “" + e.v.title + "”" : "");
      case "del": return "deleted " + key;
      case "order": return "reordered " + (key || "(root)") + " → " + e.v.join(", ");
      case "none": return key + " (edit undone)";
    }
    return key;
  }

  /* ---------- File format: data/overrides/<lesson-id>.js ---------- */

  function toFile(doc) {
    var ids = JSON.stringify(doc.lesson);
    return (
      "/*\n" +
      " * Teacher edits (overrides) for lesson " + ids + ".\n" +
      " * Written by Lesson Lab. Do not hand-edit. Before changing the lesson file,\n" +
      " * fold these into it with: node tools/fold-overrides.js " + doc.lesson + "\n" +
      " */\n" +
      "window.LL = window.LL || {};\n" +
      "window.LL.overrides = window.LL.overrides || {};\n" +
      "window.LL.overrides[" + ids + "] = " + JSON.stringify(doc, null, 2) + ";\n"
    );
  }

  function fromFile(text) {
    var m = /window\.LL\.overrides\[[^\]]*\]\s*=\s*([\s\S]*);\s*$/.exec(String(text).trim());
    if (!m) throw new Error("Not a Lesson Lab overrides file.");
    var doc = JSON.parse(m[1]);
    if (!isObj(doc) || !isObj(doc.entries)) throw new Error("Overrides file has no entries.");
    return doc;
  }

  return {
    FORMAT: FORMAT,
    ID_RE: ID_RE,
    clone: clone,
    equal: equal,
    isIdArray: isIdArray,
    parseKey: parseKey,
    pathKey: pathKey,
    diff: diff,
    apply: apply,
    record: record,
    merge: merge,
    reset: reset,
    emptyDoc: emptyDoc,
    hasEdits: hasEdits,
    liveEntries: liveEntries,
    syncedMap: syncedMap,
    describe: describe,
    toFile: toFile,
    fromFile: fromFile
  };
});
