/*
 * Lesson Lab — device storage.
 * Edited lessons live in localStorage as full copies, keyed by lesson id.
 * The lesson file on disk is never changed; the edited copy shadows it.
 */
(function () {
  "use strict";

  var LL = window.LL;
  var EDITS_KEY = "lessonlab.edits.v1";
  var PREFS_KEY = "lessonlab.prefs.v1";

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

  LL.store = {
    lastError: null,

    edits: function () {
      return read(EDITS_KEY, {});
    },

    hasEdit: function (id) {
      return !!this.edits()[id];
    },

    /* The lesson as the teacher currently sees it: edited copy if one exists. */
    effectiveLesson: function (id) {
      var entry = LL.lessons[id];
      var edited = this.edits()[id];
      if (edited) return LL.clone(edited);
      return entry ? LL.clone(entry.original) : null;
    },

    saveLesson: function (lesson) {
      var all = this.edits();
      var entry = LL.lessons[lesson.id];
      if (entry && JSON.stringify(entry.original) === JSON.stringify(lesson)) delete all[lesson.id];
      else all[lesson.id] = lesson;
      return write(EDITS_KEY, all);
    },

    resetLesson: function (id) {
      var all = this.edits();
      delete all[id];
      write(EDITS_KEY, all);
    },

    prefs: function () {
      return read(PREFS_KEY, {});
    },

    setPref: function (key, value) {
      var p = this.prefs();
      p[key] = value;
      write(PREFS_KEY, p);
    },

    /* Download every edited lesson as one backup file. */
    exportBackup: function () {
      var payload = {
        app: "lesson-lab",
        kind: "edits-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        edits: this.edits()
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
      return Object.keys(payload.edits).length;
    },

    /* Read a backup file. cb(error, summary). Replaces edits for lessons in the file. */
    importBackup: function (file, cb) {
      var self = this;
      var reader = new FileReader();
      reader.onerror = function () {
        cb("Could not read the file.");
      };
      reader.onload = function () {
        var data;
        try {
          data = JSON.parse(reader.result);
        } catch (e) {
          return cb("This is not a Lesson Lab backup file (it is not valid JSON).");
        }
        if (!data || data.app !== "lesson-lab" || typeof data.edits !== "object") {
          return cb("This is not a Lesson Lab backup file.");
        }
        var all = self.edits();
        var ids = Object.keys(data.edits);
        var unknown = [];
        ids.forEach(function (id) {
          all[id] = data.edits[id];
          if (!LL.lessons[id]) unknown.push(id);
        });
        if (!write(EDITS_KEY, all)) return cb(LL.store.lastError);
        cb(null, { count: ids.length, unknown: unknown });
      };
      reader.readAsText(file);
    }
  };
})();
