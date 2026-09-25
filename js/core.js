/*
 * Lesson Lab — core.
 * Global namespace, level list, mechanic + lesson registries, validation.
 * Classic script (no modules): ES modules and fetch() are blocked on file://.
 */
(function () {
  "use strict";

  var LL = (window.LL = window.LL || {});

  /* ---------- Levels (fixed order) ---------- */

  LL.levels = [
    { id: "beginner", name: "Beginner" },
    { id: "elementary", name: "Elementary" },
    { id: "pre-intermediate", name: "Pre-Intermediate" },
    { id: "intermediate", name: "Intermediate" },
    { id: "ielts-1", name: "IELTS 1" },
    { id: "ielts-2", name: "IELTS 2" },
    { id: "ielts-3", name: "IELTS 3" }
  ];

  LL.levelById = function (id) {
    for (var i = 0; i < LL.levels.length; i++) if (LL.levels[i].id === id) return LL.levels[i];
    return null;
  };

  /* ---------- Small utilities ---------- */

  LL.clone = function (x) {
    return x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  };

  LL.getAt = function (obj, path) {
    var cur = obj;
    for (var i = 0; i < path.length; i++) {
      if (cur == null) return undefined;
      cur = cur[path[i]];
    }
    return cur;
  };

  LL.setAt = function (obj, path, value) {
    var cur = obj;
    for (var i = 0; i < path.length - 1; i++) {
      if (cur[path[i]] == null || typeof cur[path[i]] !== "object") {
        cur[path[i]] = typeof path[i + 1] === "number" ? [] : {};
      }
      cur = cur[path[i]];
    }
    cur[path[path.length - 1]] = value;
  };

  LL.uid = function (prefix) {
    return (prefix || "s") + "-" + Math.random().toString(36).slice(2, 8);
  };

  function isBlank(v) {
    return typeof v !== "string" || v.trim() === "";
  }

  /* ---------- Mechanic registry ---------- */

  LL.mechanics = {};
  LL.mechanicErrors = []; // [{ id, problems: [] }]

  LL.registerMechanic = function (m) {
    var problems = [];
    var id = m && typeof m.id === "string" ? m.id : "(no id)";
    if (!m || typeof m !== "object") problems.push("registerMechanic() was called without an object.");
    else {
      if (isBlank(m.id)) problems.push("Missing id.");
      if (isBlank(m.description)) problems.push("Missing description.");
      if (isBlank(m.speaking)) problems.push("Missing 'speaking' (how it keeps every student speaking).");
      if (!m.schema || typeof m.schema !== "object") problems.push("Missing data schema.");
      if (typeof m.render !== "function") problems.push("Missing render().");
      if (typeof m.editor !== "function") problems.push("Missing editor().");
      if (LL.mechanics[m.id]) problems.push("A mechanic with this id is already registered.");
    }
    if (problems.length) {
      LL.mechanicErrors.push({ id: id, problems: problems });
      return;
    }
    LL.mechanics[m.id] = m;
    // Optional: a mechanic may carry its own CSS so it stays one file.
    if (typeof m.css === "string" && m.css) {
      var style = document.createElement("style");
      style.setAttribute("data-mechanic", m.id);
      style.textContent = m.css;
      document.head.appendChild(style);
    }
  };

  /* Default data for a schema (used when a stage is added or its mechanic changed). */
  LL.defaultsFor = function (schema, keep) {
    var out = {};
    Object.keys(schema).forEach(function (k) {
      var f = schema[k];
      if (keep && keep[k] !== undefined) out[k] = LL.clone(keep[k]);
      else if (f.default !== undefined) out[k] = LL.clone(f.default);
      else if (f.type === "list") out[k] = [];
      else if (f.type === "object") out[k] = LL.defaultsFor(f.fields || {});
      else if (f.type === "number") out[k] = 0;
      else if (f.type === "boolean") out[k] = false;
      else out[k] = "";
    });
    return out;
  };

  /* ---------- Schema validation ----------
   * Field spec: { type: "string"|"number"|"boolean"|"list"|"object",
   *               required, label, help, multiline, min, max,
   *               item (field spec, for list), fields (object of specs, for object) }
   */
  function validateField(spec, value, label, problems) {
    var present = value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");
    if (!present) {
      if (spec.required) problems.push(label + " is required.");
      return;
    }
    switch (spec.type) {
      case "string":
        if (typeof value !== "string") problems.push(label + " must be text.");
        break;
      case "number":
        if (typeof value !== "number" || isNaN(value)) problems.push(label + " must be a number.");
        else {
          if (spec.min !== undefined && value < spec.min) problems.push(label + " must be at least " + spec.min + ".");
          if (spec.max !== undefined && value > spec.max) problems.push(label + " must be at most " + spec.max + ".");
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") problems.push(label + " must be true or false.");
        break;
      case "list":
        if (!Array.isArray(value)) {
          problems.push(label + " must be a list.");
          break;
        }
        if (spec.required && value.length === 0) problems.push(label + " needs at least one item.");
        if (spec.min !== undefined && value.length < spec.min) problems.push(label + " needs at least " + spec.min + " items.");
        if (spec.item) {
          value.forEach(function (v, i) {
            validateField(spec.item, v, label + " item " + (i + 1), problems);
          });
        }
        break;
      case "object":
        if (typeof value !== "object" || Array.isArray(value)) {
          problems.push(label + " must be a group of fields.");
          break;
        }
        validateObject(spec.fields || {}, value, label + " → ", problems);
        break;
      default:
        problems.push(label + ": unknown field type '" + spec.type + "' in the mechanic schema.");
    }
  }

  function validateObject(schema, obj, prefix, problems) {
    Object.keys(schema).forEach(function (k) {
      var spec = schema[k];
      validateField(spec, obj ? obj[k] : undefined, prefix + (spec.label || k), problems);
    });
  }

  LL.validateData = function (schema, data) {
    var problems = [];
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      problems.push("data is missing or is not a group of fields.");
      return problems;
    }
    validateObject(schema, data, "", problems);
    return problems;
  };

  /* Returns an array of problem strings for one stage. Empty = valid. */
  LL.validateStage = function (stage) {
    var p = [];
    if (!stage || typeof stage !== "object") return ["Stage is not a valid object."];
    if (isBlank(stage.id)) p.push("Stage id is missing.");
    if (isBlank(stage.title)) p.push("Title is missing.");
    if (typeof stage.minutes !== "number" || isNaN(stage.minutes) || stage.minutes <= 0)
      p.push("Minutes must be a number above 0.");
    // Rationale is mandatory.
    if (!stage.rationale || typeof stage.rationale !== "object") {
      p.push("Rationale is missing. Every stage needs rationale.language and rationale.output.");
    } else {
      if (isBlank(stage.rationale.language)) p.push("Rationale → language is missing (what language this stage forces).");
      if (isBlank(stage.rationale.output)) p.push("Rationale → output is missing (what students produce).");
    }
    if (stage.teacherNotes !== undefined && typeof stage.teacherNotes !== "string")
      p.push("teacherNotes must be text.");
    var m = LL.mechanics[stage.mechanic];
    if (isBlank(stage.mechanic)) p.push("Mechanic is missing.");
    else if (!m) p.push("Mechanic '" + stage.mechanic + "' is not registered. See MECHANICS.md.");
    else {
      LL.validateData(m.schema, stage.data).forEach(function (s) {
        p.push("Data: " + s);
      });
    }
    return p;
  };

  /* Returns { lesson: [problems], stages: [[problems], ...], count } */
  LL.validateLesson = function (lesson, path) {
    var lp = [];
    var stages = [];
    if (!lesson || typeof lesson !== "object") return { lesson: ["Lesson is not a valid object."], stages: [], count: 1 };
    if (isBlank(lesson.id)) lp.push("Lesson id is missing.");
    if (isBlank(lesson.title)) lp.push("Title is missing.");
    if (!LL.levelById(lesson.level)) lp.push("Level '" + lesson.level + "' is not one of: " + LL.levels.map(function (l) { return l.id; }).join(", ") + ".");
    if (path) {
      var folder = path.split("/")[0];
      if (lesson.level && folder !== lesson.level)
        lp.push("File is in lessons/" + folder + "/ but its level is '" + lesson.level + "'.");
    }
    if (lesson.unit == null || String(lesson.unit).trim() === "") lp.push("Unit is missing.");
    if (isBlank(lesson.mainAim)) lp.push("Main aim is missing.");
    if (!Array.isArray(lesson.subAims)) lp.push("Sub-aims must be a list (it can be empty).");
    if (!Array.isArray(lesson.stages) || lesson.stages.length === 0) {
      lp.push("Lesson has no stages.");
    } else {
      var seen = {};
      lesson.stages.forEach(function (st) {
        var sp = LL.validateStage(st);
        if (st && st.id) {
          if (seen[st.id]) sp.push("Stage id '" + st.id + "' is used twice in this lesson.");
          seen[st.id] = true;
        }
        stages.push(sp);
      });
    }
    var count = lp.length;
    stages.forEach(function (s) { count += s.length; });
    return { lesson: lp, stages: stages, count: count };
  };

  /* ---------- Lesson registry ----------
   * Lesson files call LL.registerLesson({...}). The loader sets LL._loadingPath
   * before injecting each file so errors can name the file.
   */
  LL.lessons = {}; // id -> { original, path }
  LL.loadErrors = []; // [{ path, problems: [] }]

  LL.registerLesson = function (lesson) {
    var path = LL._loadingPath || "(unknown file)";
    LL._registeredCount = (LL._registeredCount || 0) + 1;
    if (!lesson || typeof lesson !== "object" || isBlank(lesson.id)) {
      LL.loadErrors.push({ path: path, problems: ["LL.registerLesson() was called without a lesson id."] });
      return;
    }
    if (LL.lessons[lesson.id]) {
      LL.loadErrors.push({
        path: path,
        problems: ["Lesson id '" + lesson.id + "' is already used by lessons/" + LL.lessons[lesson.id].path + "."]
      });
      return;
    }
    LL.lessons[lesson.id] = { original: LL.clone(lesson), path: path };
  };
})();
