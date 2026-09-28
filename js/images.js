/*
 * Lesson Lab — uploaded pictures.
 *
 * An upload is saved as assets/uploads/<generated-name>. The lesson only stores
 * that path, as an override, so the original picture file is never overwritten
 * and "Reset lesson" brings the original back.
 *
 * The picture itself is cached on this device (IndexedDB) so it shows offline
 * at once, and queued for the GitHub sync. Every <img> in the app whose src is
 * assets/uploads/… is pointed at the cached copy (or the repo copy) before it loads.
 */
(function () {
  "use strict";

  var LL = window.LL;
  var h = LL.ui.h;
  var DB_NAME = "lessonlab-images";
  var STORE = "files";
  var MAX_SIDE = 1600; // px: plenty for a projector
  var MAX_BYTES = 1500000; // keep uploads small for the repo
  var PREFIX = "assets/uploads/";

  var db = null;
  var urls = {}; // path -> object URL of the cached copy
  var meta = {}; // path -> { uploaded }

  function req(r) {
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  function tx(mode) {
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  function boot(done) {
    var finished = false;
    function finish() { if (!finished) { finished = true; done(); } }
    setTimeout(finish, 1500); // never block the app on storage
    try {
      var open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = function () { open.result.createObjectStore(STORE, { keyPath: "path" }); };
      open.onerror = finish;
      open.onsuccess = function () {
        db = open.result;
        req(tx("readonly").getAll()).then(function (rows) {
          rows.forEach(function (row) {
            urls[row.path] = URL.createObjectURL(row.blob);
            meta[row.path] = { uploaded: !!row.uploaded };
          });
          finish();
        }, finish);
      };
    } catch (e) {
      finish();
    }
  }

  function put(path, blob, uploaded) {
    urls[path] = URL.createObjectURL(blob);
    meta[path] = { uploaded: !!uploaded };
    if (!db) return Promise.resolve();
    return req(tx("readwrite").put({ path: path, blob: blob, type: blob.type, uploaded: !!uploaded, savedAt: Date.now() }));
  }

  function getBlob(path) {
    if (!db) return Promise.resolve(null);
    return req(tx("readonly").get(path)).then(function (row) { return row ? row.blob : null; });
  }

  function markUploaded(path) {
    meta[path] = { uploaded: true };
    if (!db) return Promise.resolve();
    return getBlob(path).then(function (blob) {
      if (blob) return req(tx("readwrite").put({ path: path, blob: blob, type: blob.type, uploaded: true, savedAt: Date.now() }));
    });
  }

  function pending() {
    return Object.keys(meta).filter(function (p) { return !meta[p].uploaded; });
  }

  function isUpload(path) {
    return typeof path === "string" && path.indexOf(PREFIX) === 0;
  }

  /* Best URL for a picture path. */
  function resolve(path) {
    if (urls[path]) return urls[path];
    if (isUpload(path) && navigator.onLine !== false && LL.sync) {
      var raw = LL.sync.rawUrl(path);
      if (raw) {
        cacheFromRepo(path, raw);
        return raw;
      }
    }
    return path;
  }

  var fetching = {};
  function cacheFromRepo(path, raw) {
    if (fetching[path]) return;
    fetching[path] = true;
    fetch(raw)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(function (blob) { return put(path, blob, true); })
      .catch(function () { /* stays online-only; fine */ })
      .then(function () { fetching[path] = false; });
  }

  /* Point every <img src="assets/uploads/…"> at the cached copy before it loads.
     MutationObserver callbacks run before the browser reports a load error. */
  function rewrite(img) {
    var src = img.getAttribute("src");
    if (!isUpload(src)) return;
    var best = resolve(src);
    if (best !== src) {
      img.setAttribute("data-ll-src", src);
      img.src = best;
    }
  }

  function watch() {
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        if (r.type === "attributes") return rewrite(r.target);
        r.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === "IMG") rewrite(n);
          if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll("img"), rewrite);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  }

  /* ---------- Upload: pick → resize → preview → confirm ---------- */

  function prepare(file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) return reject(new Error("That file is not a picture."));
      if (file.type === "image/svg+xml") {
        if (file.size > MAX_BYTES) return reject(new Error("That SVG is too large (over 1.5 MB)."));
        return resolve({ blob: file, ext: "svg", width: null, height: null, note: "" });
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Could not read that picture.")); };
      img.onload = function () {
        var w = img.naturalWidth, hgt = img.naturalHeight;
        var scale = Math.min(1, MAX_SIDE / Math.max(w, hgt));
        var keep = scale === 1 && file.size <= MAX_BYTES && /^image\/(png|jpeg|gif|webp)$/.test(file.type);
        if (keep) {
          URL.revokeObjectURL(url);
          return resolve({ blob: file, ext: extFor(file.type), width: w, height: hgt, note: "" });
        }
        var cw = Math.round(w * scale), ch = Math.round(hgt * scale);
        var canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        var g = canvas.getContext("2d");
        var png = file.type === "image/png";
        if (!png) { g.fillStyle = "#fff"; g.fillRect(0, 0, cw, ch); }
        g.drawImage(img, 0, 0, cw, ch);
        URL.revokeObjectURL(url);
        var note = scale < 1 ? "Resized from " + w + " × " + hgt + "." : "Compressed.";
        encode(canvas, png ? "image/png" : "image/jpeg").then(function (blob) {
          if (png && blob.size > MAX_BYTES) {
            // Too big as PNG: flatten onto white and use JPEG.
            var c2 = document.createElement("canvas");
            c2.width = cw; c2.height = ch;
            var g2 = c2.getContext("2d");
            g2.fillStyle = "#fff"; g2.fillRect(0, 0, cw, ch); g2.drawImage(canvas, 0, 0);
            return encode(c2, "image/jpeg").then(function (b) { resolve({ blob: b, ext: "jpg", width: cw, height: ch, note: note }); });
          }
          resolve({ blob: blob, ext: png ? "png" : "jpg", width: cw, height: ch, note: note });
        }, reject);
      };
      img.src = url;
    });
  }

  function encode(canvas, type) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error("Could not resize the picture.")); }, type, 0.85);
    });
  }

  function extFor(type) {
    return { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[type] || "img";
  }

  function kb(n) {
    return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  }

  /*
   * opts: { name: "lesson-stage" (used in the file name), current: path or "" }
   * done(path) is called only if the teacher confirms.
   */
  function choose(opts, done) {
    var input = h("input", { type: "file", accept: "image/*", hidden: true });
    document.body.appendChild(input);
    input.addEventListener("change", function () {
      var file = input.files[0];
      input.remove();
      if (!file) return;
      prepare(file).then(function (p) { preview(p, opts, done); }, function (e) { if (LL.toast) LL.toast(e.message, true); });
    });
    input.click();
  }

  function preview(p, opts, done) {
    var url = URL.createObjectURL(p.blob);
    var safe = String(opts.name || "picture").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "picture";
    var path = PREFIX + safe + "-" + Math.random().toString(36).slice(2, 8) + "." + p.ext;

    function close() {
      document.removeEventListener("keydown", onKey, true);
      box.remove();
    }
    function confirm() {
      close();
      put(path, p.blob, false).then(function () {
        done(path);
        URL.revokeObjectURL(url);
      }, function () {
        if (LL.toast) LL.toast("Could not store the picture on this device.", true);
      });
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); confirm(); }
    }

    var box = h("div", { class: "modal", role: "dialog", "aria-label": "Picture preview" },
      h("div", { class: "modal-card" },
        h("h2", null, opts.current ? "Replace picture?" : "Use this picture?"),
        h("div", { class: "upload-preview" }, h("img", { src: url, alt: "Preview" })),
        h("p", { class: "field-help" },
          (p.width ? p.width + " × " + p.height + " · " : "") + kb(p.blob.size) + (p.note ? " · " + p.note : "")),
        h("p", { class: "upload-warn" }, "Uploaded pictures are public on GitHub. No photos of students."),
        opts.current ? h("p", { class: "field-help" }, "The old picture file is kept. “Reset lesson to original” brings it back.") : null,
        h("div", { class: "stage-ops" },
          h("button", { class: "btn btn-primary", onclick: confirm }, "Use this picture (Enter)"),
          h("button", { class: "btn", onclick: close }, "Cancel (Esc)")
        )
      )
    );
    document.body.appendChild(box);
    document.addEventListener("keydown", onKey, true);
  }

  LL.images = {
    PREFIX: PREFIX,
    boot: boot,
    watch: watch,
    resolve: resolve,
    isUpload: isUpload,
    choose: choose,
    getBlob: getBlob,
    markUploaded: markUploaded,
    pending: pending
  };
})();
