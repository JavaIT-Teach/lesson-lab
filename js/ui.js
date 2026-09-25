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

    if (spec.type === "string") {
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
      var tools = h(
        "div",
        { class: "list-tools" },
        h("button", { type: "button", title: "Move up", disabled: i === 0, onclick: function () { move(i, -1); } }, "↑"),
        h("button", { type: "button", title: "Move down", disabled: i === items.length - 1, onclick: function () { move(i, 1); } }, "↓"),
        h("button", { type: "button", class: "danger", title: "Delete", onclick: function () { remove(i); } }, "✕")
      );
      box.appendChild(h("div", { class: "list-row" }, control, tools));
    });

    box.appendChild(
      h("button", {
        type: "button",
        class: "add",
        onclick: function () {
          api.update("list-add", function (lesson) {
            var arr = LL.getAt(lesson, path);
            if (!Array.isArray(arr)) { arr = []; LL.setAt(lesson, path, arr); }
            var blank = itemSpec.type === "object" ? LL.defaultsFor(itemSpec.fields || {}) : itemSpec.type === "number" ? 0 : "";
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

  LL.ui = { h: h, schemaForm: schemaForm, fieldControl: fieldControl, isBlank: isBlank };
})();
