/*
 * Lesson Lab — device storage.
 *
 * Layers: base lesson file (never written by the app) + overrides (teacher edits).
 * Overrides live in the repo at data/overrides/<lesson-id>.js and are cached here
 * in localStorage so the app works offline. See js/overrides.js for the format.
 *
 * localStorage keys:
 *   lessonlab.overrides.v2  { [lessonId]: { doc, synced, sha, dirty } }
 *   lessonlab.conflicts.v1  [ conflict records ]  (goes into the backup file)
 *   lessonlab.github.v1     { token, repo, branch }  (this device only; never exported)
 *   lessonlab.device.v1     random device id
 *   lessonlab.prefs.v1      UI preferences
 */
(function () {
  "use strict";

  var LL = window.LL;
  var ov = LL.ov;
  var OV_KEY = "lessonlab.overrides.v2";
  var CONFLICT_KEY = "lessonlab.conflicts.v1";
  var GH_KEY = "lessonlab.github.v1";
  var DEVICE_KEY = "lessonlab.device.v1";
  var PREFS_KEY = "lessonlab.prefs.v1";
  var OLD_EDITS_KEY = "lessonlab.edits.v1";

  function read(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      LL.store.lastError = "Could not save on this device (" + e.name + "). Export a backup now.";
      return false;
    }
  }

  var listeners = [];

  var store = (LL.store = {
    lastError: null,

    /* ---------- Device + GitHub settings (never exported, never in the repo) ---------- */

    deviceId: function () {
      var id = read(DEVICE_KEY, null);
      if (!id) {
        id = "device-" + Math.random().toString(36).slice(2, 8);
        write(DEVICE_KEY, id);
      }
      return id;
    },

    github: function () {
      var g = read(GH_KEY, {}) || {};
      var def = LL.config || {};
      return {
        token: g.token || "",
        repo: g.repo || guessRepo() || def.repo || "",
        branch: g.branch || def.branch || "main"
      };
    },

    setGithub: function (patch) {
      var g = read(GH_KEY, {}) || {};
      Object.keys(patch).forEach(function (k) {
        if (patch[k] === null || patch[k] === "") delete g[k];
        else g[k] = patch[k];
      });
      write(GH_KEY, g);
      emit();
    },

    canEdit: function () {
      return !!this.github().token;
    },

    /* ---------- Overrides cache ---------- */

    all: function () {
      return read(OV_KEY, {}) || {};
    },

    record: function (id) {
      return this.all()[id] || null;
    },

    putRecord: function (id, rec) {
      var all = this.all();
      all[id] = rec;
      var ok = write(OV_KEY, all);
      emit();
      return ok;
    },

    doc: function (id) {
      var r = this.record(id);
      return r ? r.doc : null;
    },

    hasEdits: function (id) {
      return ov.hasEdits(this.doc(id));
    },

    dirtyIds: function () {
      var all = this.all();
      return Object.keys(all).filter(function (id) { return all[id].dirty; });
    },

    /* The lesson as shown: newest base file + overrides. */
    effectiveLesson: function (id) {
      var entry = LL.lessons[id];
      if (!entry) return null;
      return ov.apply(entry.original, this.doc(id)).lesson;
    },

    orphans: function (id) {
      var entry = LL.lessons[id];
      return entry ? ov.apply(entry.original, this.doc(id)).orphans : [];
    },

    /*
     * Edit mode calls this after every change.
     * work: the full working lesson. derivedDoc: the overrides doc `work` was built from.
     * Recording against derivedDoc (not the stored doc) means edits merged in from
     * another device meanwhile are kept, not mistaken for deletions.
     * Returns the new stored doc; the caller rebuilds its working lesson from it.
     */
    recordEdit: function (id, work, derivedDoc) {
      var entry = LL.lessons[id];
      if (!entry) return null;
      var rec = this.record(id) || { doc: null, synced: null, sha: null, dirty: false };
      var mine = ov.record(derivedDoc || null, entry.original, work, Date.now(), this.deviceId());
      if (rec.doc && !sameDoc(rec.doc, derivedDoc || ov.emptyDoc(id))) {
        var m = ov.merge(mine, rec.doc, ov.syncedMap(derivedDoc), Date.now());
        this.logConflicts(m.conflicts);
        mine = m.doc;
      }
      rec.doc = mine;
      rec.dirty = true;
      if (!this.putRecord(id, rec)) return null;
      if (LL.sync) LL.sync.schedule();
      return rec.doc;
    },

    resetLesson: function (id) {
      var rec = this.record(id) || { doc: null, synced: null, sha: null, dirty: false };
      rec.doc = ov.reset(rec.doc, id, Date.now());
      rec.dirty = true;
      this.putRecord(id, rec);
      if (LL.sync) LL.sync.schedule();
    },

    /*
     * Merge a copy from the repo (script file or GitHub API) into this device's copy.
     * remoteSha: blob sha when it came from the API (null for the script file).
     * Returns true if what this device shows changed.
     */
    mergeRemote: function (id, remoteDoc, remoteSha) {
      var rec = this.record(id);
      var before = rec ? JSON.stringify(rec.doc) : null;
      if (!rec || !rec.doc) {
        rec = { doc: remoteDoc, synced: ov.syncedMap(remoteDoc), sha: remoteSha || null, dirty: false };
      } else {
        var m = ov.merge(rec.doc, remoteDoc, rec.synced, Date.now());
        this.logConflicts(m.conflicts);
        rec.doc = m.doc;
        rec.synced = ov.syncedMap(remoteDoc);
        if (remoteSha) rec.sha = remoteSha;
        // Still has something the repo lacks?
        rec.dirty = !sameDoc(m.doc, remoteDoc);
      }
      this.putRecord(id, rec);
      return before !== JSON.stringify(rec.doc);
    },

    markSynced: function (id, doc, sha) {
      var rec = this.record(id) || {};
      var changedMeanwhile = rec.doc && JSON.stringify(rec.doc) !== JSON.stringify(doc);
      if (!changedMeanwhile) rec.doc = doc;
      rec.synced = ov.syncedMap(doc);
      rec.sha = sha;
      rec.dirty = !!changedMeanwhile;
      this.putRecord(id, rec);
    },

    /* Overrides files loaded with <script> (data/overrides/*.js), merged in at start. */
    mergeFileOverrides: function () {
      var files = LL.overrides || {};
      var self = this;
      Object.keys(files).forEach(function (id) {
        var doc = files[id];
        if (!doc || typeof doc !== "object" || !doc.entries) return;
        self.mergeRemote(id, doc, null);
      });
    },

    /* ---------- Conflict log ---------- */

    conflicts: function () {
      return read(CONFLICT_KEY, []) || [];
    },

    logConflicts: function (list) {
      if (!list || !list.length) return;
      var all = this.conflicts();
      list.forEach(function (c) {
        var dupe = all.some(function (x) { return x.lesson === c.lesson && x.field === c.field && x.lost.savedAt === c.lost.savedAt; });
        if (!dupe) all.push(c);
      });
      write(CONFLICT_KEY, all.slice(-500));
      this.newConflicts = (this.newConflicts || 0) + list.length;
    },

    /* ---------- Prefs ---------- */

    prefs: function () {
      return read(PREFS_KEY, {});
    },

    setPref: function (key, value) {
      var p = this.prefs();
      p[key] = value;
      write(PREFS_KEY, p);
    },

    /* ---------- Backup (no token, ever) ---------- */

    exportBackup: function () {
      var all = this.all();
      var overrides = {};
      Object.keys(all).forEach(function (id) { if (all[id].doc) overrides[id] = all[id].doc; });
      var payload = {
        app: "lesson-lab",
        kind: "backup",
        version: 2,
        exportedAt: new Date().toISOString(),
        device: this.deviceId(),
        overrides: overrides,
        conflicts: this.conflicts()
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      var stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      a.href = URL.createObjectURL(blob);
      a.download = "lesson-lab-backup-" + stamp + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 0);
      return Object.keys(overrides).filter(function (id) { return ov.hasEdits(overrides[id]); }).length;
    },

    /* cb(error, { count, unknown }) */
    importBackup: function (file, cb) {
      var self = this;
      var reader = new FileReader();
      reader.onerror = function () { cb("Could not read the file."); };
      reader.onload = function () {
        var data;
        try {
          data = JSON.parse(reader.result);
        } catch (e) {
          return cb("This is not a Lesson Lab backup file (it is not valid JSON).");
        }
        if (!data || data.app !== "lesson-lab") return cb("This is not a Lesson Lab backup file.");
        var docs = {};
        if (data.version === 2 && data.overrides && typeof data.overrides === "object") docs = data.overrides;
        else if (data.edits && typeof data.edits === "object") docs = convertOldEdits(data.edits);
        else return cb("This backup file has no lessons in it.");

        var ids = Object.keys(docs);
        var unknown = [];
        ids.forEach(function (id) {
          if (!LL.lessons[id]) unknown.push(id);
          var rec = self.record(id);
          var m = ov.merge(rec && rec.doc, docs[id], rec ? rec.synced : null, Date.now());
          self.logConflicts(m.conflicts);
          self.putRecord(id, { doc: m.doc, synced: rec ? rec.synced : null, sha: rec ? rec.sha : null, dirty: true });
        });
        if (Array.isArray(data.conflicts)) self.logConflicts(data.conflicts);
        if (LL.sync) LL.sync.schedule();
        cb(null, { count: ids.length, unknown: unknown });
      };
      reader.readAsText(file);
    },

    /* Old storage (full edited copies, before overrides existed) → overrides. Runs once. */
    migrateOldEdits: function () {
      var old = read(OLD_EDITS_KEY, null);
      if (!old) return 0;
      var docs = convertOldEdits(old);
      var self = this;
      Object.keys(docs).forEach(function (id) {
        if (!self.record(id)) self.putRecord(id, { doc: docs[id], synced: null, sha: null, dirty: true });
      });
      try { window.localStorage.removeItem(OLD_EDITS_KEY); } catch (e) { /* ignore */ }
      return Object.keys(docs).length;
    },

    onChange: function (fn) {
      listeners.push(fn);
    }
  });

  function emit() {
    listeners.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
  }

  /* Same resetAt and same entries (key order ignored). */
  function sameDoc(a, b) {
    if ((a.resetAt || 0) !== (b.resetAt || 0)) return false;
    var ka = Object.keys(a.entries || {}), kb = Object.keys(b.entries || {});
    if (ka.length !== kb.length) return false;
    return ka.every(function (k) {
      var x = a.entries[k], y = b.entries[k];
      return y && x.op === y.op && x.t === y.t && ov.equal(x.v, y.v);
    });
  }
  store.sameDoc = sameDoc;

  function convertOldEdits(edits) {
    var out = {};
    Object.keys(edits).forEach(function (id) {
      var entry = LL.lessons[id];
      var copy = edits[id];
      if (!entry || !copy) return;
      out[id] = ov.record(null, entry.original, copy, Date.now(), store.deviceId());
    });
    return out;
  }

  /* On GitHub Pages the address says which repo this is: <owner>.github.io/<repo>/ */
  function guessRepo() {
    var m = /^([A-Za-z0-9-]+)\.github\.io$/i.exec(location.hostname || "");
    if (!m) return "";
    var repo = (location.pathname.split("/")[1] || "").trim();
    return repo ? m[1] + "/" + repo : "";
  }
})();
