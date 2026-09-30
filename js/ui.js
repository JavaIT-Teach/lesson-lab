/*
 * Lesson Lab — small DOM helpers and the generic schema form used by editors.
 */
(function () {
  "use strict";

  var LL = window.LL;

  /* h("div", { class: "x", onclick: fn, text: "hi" }, child, "text", [children]) */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k === "html") el.innerHTML = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k === "value") el.value = v;
        else if (k === "checked") el.checked = !!v;
        else el.setAttribute(k, v === true ? "" : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { append(el, x); });
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }

  function isBlank(v) {
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  }

  /*
   * Generic form for a schema.
   * api: { lesson(), set(path, value), update(key, fn), refresh() }
   * path: absolute path inside the lesson to the object that holds the fields.
   */
  function schemaForm(schema, path, api) {
    var wrap = h("div", { class: "form" });
    Object.keys(schema).forEach(function (key) {
      if (key === "id") return; // permanent ids are never edited by hand
      wrap.appendChild(fieldControl(schema[key], path.concat(key), schema[key].label || key, api));
    });
    return wrap;
  }

  function fieldControl(spec, path, label, api) {
    var value = LL.getAt(api.lesson(), path);
    var row = h("label", { class: "field" + (spec.required && isBlank(value) ? " invalid" : "") });
    row.appendChild(h("span", { class: "field-label" }, label, spec.required ? h("b", { class: "req", title: "Required" }, " *") : null));

    function markValidity(v) {
      row.classList.toggle("invalid", !!spec.required && isBlank(v));
    }

    if (spec.type === "string" && Array.isArray(spec.options)) {
      // A fixed list of choices (e.g. a colour word). "—" = not set.
      var sel = h("select", { class: "editable-outline" }, h("option", { value: "", text: "—" }),
        spec.options.map(function (o) { return h("option", { value: o, text: o }); }));
      sel.value = typeof value === "string" && spec.options.indexOf(value) !== -1 ? value : "";
      sel.addEventListener("change", function () {
        api.set(path, sel.value || undefined);
        markValidity(sel.value);
      });
      row.appendChild(sel);
    } else if (spec.type === "string") {
      var input = spec.multiline
        ? h("textarea", { rows: 3, class: "editable-outline" })
        : h("input", { type: "text", class: "editable-outline" });
      input.value = typeof value === "string" ? value : "";
      if (spec.placeholder) input.placeholder = spec.placeholder;
      input.addEventListener("input", function () {
        api.set(path, input.value);
        markValidity(input.value);
      });
      row.appendChild(input);
      if (!spec.multiline && isImageField(spec, path) && api.uploadImage) row.appendChild(imageTools(input, path, api));
    } else if (spec.type === "number") {
      var num = h("input", { type: "number", class: "editable-outline", step: spec.step || "any" });
      num.value = typeof value === "number" ? value : "";
      num.addEventListener("input", function () {
        var n = parseFloat(num.value);
        api.set(path, isNaN(n) ? undefined : n);
        markValidity(isNaN(n) ? "" : n);
      });
      row.appendChild(num);
    } else if (spec.type === "boolean") {
      var cb = h("input", { type: "checkbox", checked: !!value });
      cb.addEventListener("change", function () {
        api.set(path, cb.checked);
      });
      row.classList.add("field-inline");
      row.insertBefore(cb, row.firstChild);
    } else if (spec.type === "list") {
      row = h("div", { class: "field field-list" + (spec.required && (!value || !value.length) ? " invalid" : "") });
      row.appendChild(h("span", { class: "field-label" }, label, spec.required ? h("b", { class: "req" }, " *") : null));
      row.appendChild(listControl(spec, path, api));
    } else if (spec.type === "object") {
      row = h("fieldset", { class: "field-group" }, h("legend", { text: label }));
      row.appendChild(schemaForm(spec.fields || {}, path, api));
    }
    if (spec.help) row.appendChild(h("small", { class: "field-help", text: spec.help }));
    return row;
  }

  function listControl(spec, path, api) {
    var items = LL.getAt(api.lesson(), path);
    if (!Array.isArray(items)) items = [];
    var itemSpec = spec.item || { type: "string" };
    var box = h("div", { class: "list" });

    items.forEach(function (_, i) {
      var itemPath = path.concat(i);
      var control = fieldControl(itemSpec, itemPath, (spec.itemLabel || "Item") + " " + (i + 1), api);
      var grip = h("span", { class: "grip list-grip", title: "Drag to reorder", "aria-hidden": "true", text: "⠿" });
      var tools = h(
        "div",
        { class: "list-tools" },
        h("button", { type: "button", title: "Move up", disabled: i === 0, onclick: function () { move(i, -1); } }, "↑"),
        h("button", { type: "button", title: "Move down", disabled: i === items.length - 1, onclick: function () { move(i, 1); } }, "↓"),
        h("button", { type: "button", class: "danger", title: "Delete", onclick: function () { remove(i); } }, "✕")
      );
      box.appendChild(h("div", { class: "list-row" }, grip, control, tools));
    });

    // Drag to reorder: changes array order only; item ids never change (overrides record an "order" edit).
    sortable(box, {
      item: ".list-row",
      handle: ".list-grip",
      onDrop: function (from, to) {
        api.update("list-move", function (lesson) {
          var arr = LL.getAt(lesson, path);
          arr.splice(to, 0, arr.splice(from, 1)[0]);
        });
        api.refresh();
      }
    });

    box.appendChild(
      h("button", {
        type: "button",
        class: "add",
        onclick: function () {
          api.update("list-add", function (lesson) {
            var arr = LL.getAt(lesson, path);
            if (!Array.isArray(arr)) { arr = []; LL.setAt(lesson, path, arr); }
            // Object items get a permanent id; plain values (e.g. sub-aims) are replaced as a whole list.
            var blank = itemSpec.type === "object" ? LL.newItem(itemSpec) : itemSpec.type === "number" ? 0 : "";
            arr.push(blank);
          });
          api.refresh();
        }
      }, "+ Add " + (spec.itemLabel || "item").toLowerCase())
    );

    function move(i, d) {
      api.update("list-move", function (lesson) {
        var arr = LL.getAt(lesson, path);
        var t = arr[i];
        arr[i] = arr[i + d];
        arr[i + d] = t;
      });
      api.refresh();
    }

    function remove(i) {
      api.update("list-remove", function (lesson) {
        LL.getAt(lesson, path).splice(i, 1);
      });
      api.refresh();
    }

    return box;
  }

  /*
   * Vertical drag-to-reorder with a handle (pointer events: mouse, pen and touch).
   * opts: { item: selector for direct children, handle: selector inside an item, onDrop(from, to) }
   * The DOM moves live while dragging; onDrop gets the old and new index (only when it changed).
   */
  function sortable(list, opts) {
    function items() {
      return Array.prototype.filter.call(list.children, function (c) { return c.matches(opts.item); });
    }
    list.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var handle = e.target.closest(opts.handle);
      if (!handle || !list.contains(handle)) return;
      var item = handle.closest(opts.item);
      if (!item || item.parentNode !== list) return;
      e.preventDefault();
      var from = items().indexOf(item);
      item.classList.add("dragging");
      list.classList.add("sorting");
      // Listen on the document: the pointer may be over another row when it is released.
      function move(ev) {
        var all = items();
        var target = null;
        for (var i = 0; i < all.length; i++) {
          if (all[i] === item) continue;
          var r = all[i].getBoundingClientRect();
          if (ev.clientY < r.top + r.height / 2) { target = all[i]; break; }
        }
        if (target) { if (target !== item.nextSibling) list.insertBefore(item, target); }
        else {
          var last = all[all.length - 1];
          if (last !== item) list.insertBefore(item, last.nextSibling);
        }
      }
      function up() {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        item.classList.remove("dragging");
        list.classList.remove("sorting");
        var to = items().indexOf(item);
        if (to !== from && to !== -1) opts.onDrop(from, to);
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    });
  }

  /*
   * Picture fields: format "image" in the schema, or (for mechanics written before
   * that existed) a text field named like picture / image / photo / img.
   */
  function isImageField(spec, path) {
    if (spec.format === "image") return true;
    var key = String(path[path.length - 1]);
    return /(picture|image|photo|img)$/i.test(key);
  }

  function imageTools(input, path, api) {
    var thumb = h("img", { class: "img-thumb", alt: "" });
    function refresh() {
      var v = input.value.trim();
      thumb.hidden = !v;
      if (v) thumb.setAttribute("src", v);
    }
    thumb.addEventListener("error", function () { thumb.hidden = true; });
    refresh();
    input.addEventListener("input", refresh);
    var btn = h("button", {
      type: "button",
      class: "btn btn-upload",
      onclick: function (e) {
        e.preventDefault();
        api.uploadImage(path, input.value.trim(), function (newPath) {
          input.value = newPath;
          refresh();
        });
      }
    }, "Upload / replace image");
    return h("div", { class: "img-tools" }, thumb, btn);
  }

  LL.ui = { h: h, schemaForm: schemaForm, fieldControl: fieldControl, isBlank: isBlank, isImageField: isImageField, sortable: sortable };
})();
