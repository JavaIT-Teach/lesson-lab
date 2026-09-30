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
      if (m.validate !== undefined && typeof m.validate !== "function") problems.push("'validate' must be a function (data) → [problems].");
      if (m.keys !== undefined && !Array.isArray(m.keys)) problems.push("'keys' must be a list of [key, what it does] pairs.");
      if (LL.mechanics[m.id]) problems.push("A mechanic with this id is already registered.");
      if (m.schema && typeof m.schema === "object") listSpecProblems(m.schema, "", problems);
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

  /* Every list in a mechanic schema must hold objects, so each item can carry a permanent id. */
  function listSpecProblems(schema, prefix, problems) {
    Object.keys(schema).forEach(function (k) {
      var f = schema[k] || {};
      if (f.type === "list" && (!f.item || f.item.type !== "object"))
        problems.push("Schema list '" + prefix + k + "' must have item: { type: \"object\", fields: {...} } so items can have ids.");
      if (f.type === "list" && f.item && f.item.fields) listSpecProblems(f.item.fields, prefix + k + "[].", problems);
      if (f.type === "object" && f.fields) listSpecProblems(f.fields, prefix + k + ".", problems);
    });
  }

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

  /* A new list item for a list field spec, with a fresh permanent id. */
  LL.newItem = function (itemSpec) {
    var item = LL.defaultsFor((itemSpec && itemSpec.fields) || {});
    item.id = LL.uid("item");
    return item;
  };

  /* ---------- Schema validation ----------
   * Field spec: { type: "string"|"number"|"boolean"|"list"|"object",
   *               required, label, help, multiline, min, max, options (string: fixed choices),
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
        else if (Array.isArray(spec.options) && spec.options.indexOf(value) === -1)
          problems.push(label + " must be one of: " + spec.options.join(", ") + " (it is “" + value + "”).");
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
    // Optional audio cue: metadata only (the app plays no audio).
    if (stage.audioCue !== undefined && typeof stage.audioCue !== "string")
      p.push("audioCue must be text, e.g. \"Listen: Track 3\".");
    // Optional decorative shapes: position, independent w/h, curated colour role, front/back.
    decorationProblems(stage.decorations).forEach(function (x) { p.push(x); });
    // Optional per-field text style overrides (align, size, curated colour role, free position). Never font.
    textStyleProblems(stage.textStyle).forEach(function (x) { p.push(x); });
    // Optional groups of shapes / freed text fields (edit mode: Ctrl+G).
    groupProblems(stage.groups).forEach(function (x) { p.push(x); });
    // Optional paired worksheet label: metadata only (shown in the lesson menu).
    if (stage.worksheetLabel !== undefined && typeof stage.worksheetLabel !== "string")
      p.push("worksheetLabel must be text, e.g. \"Worksheet Part 2\".");
    var m = LL.mechanics[stage.mechanic];
    if (isBlank(stage.mechanic)) p.push("Mechanic is missing.");
    else if (!m) p.push("Mechanic '" + stage.mechanic + "' is not registered. See MECHANICS.md.");
    else {
      var dataProblems = LL.validateData(m.schema, stage.data);
      // A mechanic may add its own checks (e.g. references between its lists) once the schema passes.
      if (!dataProblems.length && typeof m.validate === "function") {
        try {
          dataProblems = m.validate(stage.data) || [];
        } catch (e) {
          dataProblems = ["the '" + m.id + "' mechanic's own check crashed: " + (e && e.message ? e.message : e)];
        }
      }
      dataProblems.forEach(function (s) {
        p.push("Data: " + s);
      });
    }
    return p;
  };

  LL.SHAPES = ["circle", "rectangle", "triangle", "arrow", "line"];
  LL.STROKE_SHAPES = ["arrow", "line"]; // drawn as a stroke, not a filled area; no label
  LL.DECO_MIN = 4;
  LL.DECO_MAX = 70;
  LL.DECO_Z = ["back", "front"];

  /* ---------- Curated colour roles ----------
   * Never an open colour picker: a fixed, small set of roles, each mapped to a fixed CSS value
   * (see css/app.css). "accent" follows the lesson's own generated palette; "highlight" and
   * "paper" are constant across every stage, for things (like a highlighter) that must not
   * change colour with the theme. Used by both decorations (fill) and textStyle (text colour).
   */
  LL.COLOR_ROLES = ["accent", "highlight", "paper"];

  /* Rotation (degrees, clockwise) for shapes and freed text fields: a number from 0 up to (not including) 360. */
  function rotationProblem(v, at) {
    if (v === undefined) return null;
    if (typeof v !== "number" || isNaN(v) || v < 0 || v >= 360) return at + ": rotation must be a number from 0 to 359.";
    return null;
  }

  /* decorations: [{ id, shape, x, y, w, h, label?, color?, z?, rotation?, radius?, locked? }];
     x / y = centre in % of the scene, w / h independent size in vmin.
     radius (rectangle only): corner rounding, 0–50 = % of the shorter side. locked: true = no move / resize / rotate. */
  function decorationProblems(list) {
    var p = [];
    if (list === undefined) return p;
    if (!Array.isArray(list)) return ["decorations must be a list."];
    list.forEach(function (d, i) {
      var at = "Shape " + (i + 1);
      if (!d || typeof d !== "object") return p.push(at + " is not a valid object.");
      if (LL.SHAPES.indexOf(d.shape) === -1) p.push(at + ": shape must be one of " + LL.SHAPES.join(", ") + ".");
      ["x", "y"].forEach(function (k) {
        if (typeof d[k] !== "number" || isNaN(d[k]) || d[k] < 0 || d[k] > 100) p.push(at + ": " + k + " must be a number from 0 to 100.");
      });
      ["w", "h"].forEach(function (k) {
        if (typeof d[k] !== "number" || isNaN(d[k]) || d[k] < LL.DECO_MIN || d[k] > LL.DECO_MAX)
          p.push(at + ": " + k + " must be a number from " + LL.DECO_MIN + " to " + LL.DECO_MAX + ".");
      });
      if (d.label !== undefined && LL.STROKE_SHAPES.indexOf(d.shape) !== -1) p.push(at + ": an " + d.shape + " has no label.");
      else if (d.label !== undefined && typeof d.label !== "string") p.push(at + ": label must be text.");
      else if (d.label && d.label.length > 40) p.push(at + ": label is longer than 40 characters — keep it short.");
      if (d.color !== undefined && LL.COLOR_ROLES.indexOf(d.color) === -1)
        p.push(at + ": colour must be one of: " + LL.COLOR_ROLES.join(", ") + " (or left out for automatic).");
      if (d.z !== undefined && LL.DECO_Z.indexOf(d.z) === -1)
        p.push(at + ": z must be one of: " + LL.DECO_Z.join(", ") + " (or left out — same as \"back\").");
      var rp = rotationProblem(d.rotation, at);
      if (rp) p.push(rp);
      if (d.radius !== undefined) {
        if (d.shape !== "rectangle") p.push(at + ": radius (rounded corners) is only for rectangles.");
        else if (typeof d.radius !== "number" || isNaN(d.radius) || d.radius < 0 || d.radius > 50) p.push(at + ": radius must be a number from 0 to 50.");
      }
      if (d.locked !== undefined && d.locked !== true) p.push(at + ": locked must be true (or left out).");
      Object.keys(d).forEach(function (k) {
        if (["id", "shape", "x", "y", "w", "h", "label", "color", "z", "rotation", "radius", "locked"].indexOf(k) === -1) p.push(at + ": “" + k + "” is not allowed.");
      });
    });
    return p;
  }

  /* ---------- Per-field text style overrides ----------
   * stage.textStyle: { "<field path under the stage>": { align?, scale?, size?, color?, x?, y?, rotation?, locked? } }
   * scale: multiplier of the field's own untouched rendered size (1 = untouched, never stored).
   * size: LEGACY (older Text size control; a multiple of the parent's font size). Still read and shown
   *   exactly as before, never written; the Text size control replaces it with scale.
   * rotation / locked: only for a freed field (x / y set).
   * Layout and a curated colour choice — never an open colour picker, never font.
   * Applied to any bound text field (title, data.*, decoration labels…).
   * x / y (both present together, % of the scene): frees the field from the mechanic's normal
   * layout and positions it absolutely, like a shape. Leave both out to keep the mechanic's layout.
   */
  LL.TEXT_ALIGNS = ["left", "center", "right"];
  LL.TEXT_SIZE_MIN = 0.6; // legacy `size`
  LL.TEXT_SIZE_MAX = 2.2;
  LL.TEXT_SCALE_MIN = 0.4; // `scale`: symmetric around 1 on a log scale (1 / 2.5 = 0.4)
  LL.TEXT_SCALE_MAX = 2.5;

  function textStyleProblems(obj) {
    var p = [];
    if (obj === undefined) return p;
    if (typeof obj !== "object" || Array.isArray(obj)) return ["textStyle must be a group of field-path → style entries."];
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      var at = "textStyle[\"" + k + "\"]";
      if (!v || typeof v !== "object" || Array.isArray(v)) { p.push(at + " must be an object."); return; }
      if (v.align !== undefined && LL.TEXT_ALIGNS.indexOf(v.align) === -1)
        p.push(at + ".align must be one of: " + LL.TEXT_ALIGNS.join(", ") + ".");
      if (v.size !== undefined && (typeof v.size !== "number" || isNaN(v.size) || v.size < LL.TEXT_SIZE_MIN || v.size > LL.TEXT_SIZE_MAX))
        p.push(at + ".size must be a number from " + LL.TEXT_SIZE_MIN + " to " + LL.TEXT_SIZE_MAX + ".");
      if (v.scale !== undefined && (typeof v.scale !== "number" || isNaN(v.scale) || v.scale < LL.TEXT_SCALE_MIN || v.scale > LL.TEXT_SCALE_MAX))
        p.push(at + ".scale must be a number from " + LL.TEXT_SCALE_MIN + " to " + LL.TEXT_SCALE_MAX + ".");
      if (v.color !== undefined && LL.COLOR_ROLES.indexOf(v.color) === -1)
        p.push(at + ".color must be one of: " + LL.COLOR_ROLES.join(", ") + " (or left out for automatic).");
      var freed = v.x !== undefined && v.y !== undefined;
      var rp = rotationProblem(v.rotation, at);
      if (rp) p.push(rp);
      if (v.rotation !== undefined && !freed) p.push(at + ": rotation needs a free position (x and y) — drag the text first.");
      if (v.locked !== undefined && v.locked !== true) p.push(at + ".locked must be true (or left out).");
      else if (v.locked && !freed) p.push(at + ": locked needs a free position (x and y).");
      if ((v.x !== undefined) !== (v.y !== undefined)) p.push(at + ": x and y must be given together (or both left out).");
      ["x", "y"].forEach(function (k2) {
        if (v[k2] !== undefined && (typeof v[k2] !== "number" || isNaN(v[k2]) || v[k2] < 0 || v[k2] > 100))
          p.push(at + "." + k2 + " must be a number from 0 to 100.");
      });
      Object.keys(v).forEach(function (fk) {
        if (["align", "scale", "size", "color", "x", "y", "rotation", "locked"].indexOf(fk) === -1) p.push(at + ": \"" + fk + "\" is not allowed (no font, only align/size/color/position/rotation/lock).");
      });
    });
    return p;
  }

  /* ---------- Groups (edit mode: Ctrl+G) ----------
   * stage.groups: [{ id, members: ["shape:<decoration id>" | "text:<textStyle key>", …] }]
   * A member that no longer exists (shape deleted, text put back in layout) is simply skipped
   * wherever the group is used — never a problem, like any stale override.
   */
  function groupProblems(list) {
    var p = [];
    if (list === undefined) return p;
    if (!Array.isArray(list)) return ["groups must be a list."];
    list.forEach(function (g, i) {
      var at = "Group " + (i + 1);
      if (!g || typeof g !== "object" || Array.isArray(g)) return p.push(at + " is not a valid object.");
      if (!Array.isArray(g.members) || !g.members.every(function (m) { return typeof m === "string" && /^(shape|text):./.test(m); }))
        p.push(at + ": members must be a list of \"shape:<id>\" / \"text:<field>\" entries.");
      Object.keys(g).forEach(function (k) {
        if (["id", "members"].indexOf(k) === -1) p.push(at + ": “" + k + "” is not allowed.");
      });
    });
    return p;
  }

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
    // Optional lesson-level flag, normally set by the Hide control (an override), never by deleting files.
    if (lesson.hidden !== undefined && typeof lesson.hidden !== "boolean") lp.push("hidden must be true or false.");
    if (!Array.isArray(lesson.stages) || lesson.stages.length === 0) {
      lp.push("Lesson has no stages.");
    } else {
      lesson.stages.forEach(function (st) {
        stages.push(LL.validateStage(st));
      });
      LL.idProblems(lesson).forEach(function (x) { lp.push(x); });
    }
    var count = lp.length;
    stages.forEach(function (s) { count += s.length; });
    return { lesson: lp, stages: stages, count: count };
  };

  /* ---------- Stable ids ----------
   * Every stage and every list item inside stage data needs a permanent id:
   * teacher edits (overrides) are keyed by these ids, not by position.
   */
  var ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
  LL.ID_RE = ID_RE;

  LL.idProblems = function (lesson) {
    var p = [];
    if (!lesson || typeof lesson !== "object") return ["Lesson is not a valid object."];
    if (typeof lesson.id !== "string" || !ID_RE.test(lesson.id)) p.push("Lesson id '" + lesson.id + "' is missing or has characters other than letters, digits, - and _.");
    if (!Array.isArray(lesson.stages)) return p;
    var seen = {};
    lesson.stages.forEach(function (st, i) {
      var label = "Stage " + (i + 1) + (st && st.title ? " “" + st.title + "”" : "");
      if (!st || typeof st !== "object") return p.push(label + " is not a valid object.");
      if (typeof st.id !== "string" || !ID_RE.test(st.id)) p.push(label + " has no valid id (letters, digits, - and _ only).");
      else if (seen[st.id]) p.push(label + ": id '" + st.id + "' is used by another stage.");
      else seen[st.id] = true;
      listIdProblems(st.data, label + " → data", p);
      if (Array.isArray(st.decorations)) listIdProblems(st.decorations, label + " → decorations", p);
      // Groups: each group needs its own id; members is a plain list of refs, replaced whole (like subAims).
      if (Array.isArray(st.groups)) listIdProblems(st.groups.map(function (g) { return g && typeof g === "object" ? { id: g.id } : g; }), label + " → groups", p);
    });
    return p;
  };

  function listIdProblems(node, where, p) {
    if (Array.isArray(node)) {
      var seen = {};
      node.forEach(function (item, i) {
        var at = where + " item " + (i + 1);
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          p.push(at + " must be an object with an id (lists of plain values cannot be edited safely).");
          return;
        }
        if (typeof item.id !== "string" || !ID_RE.test(item.id)) p.push(at + " has no valid id.");
        else if (seen[item.id]) p.push(at + ": id '" + item.id + "' is used twice in this list.");
        else seen[item.id] = true;
        listIdProblems(item, at, p);
      });
    } else if (node && typeof node === "object") {
      Object.keys(node).forEach(function (k) {
        listIdProblems(node[k], where + "." + k, p);
      });
    }
  }

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
    // Missing or duplicate ids would make teacher edits land in the wrong place: reject the file.
    var ids = LL.idProblems(lesson);
    if (ids.length) {
      LL.loadErrors.push({ path: path, problems: ["Lesson '" + lesson.id + "' was not loaded because of id problems:"].concat(ids) });
      return;
    }
    LL.lessons[lesson.id] = { original: LL.clone(lesson), path: path };
  };
})();
