/*
 * Lesson Lab — lesson loader.
 * Injects each file listed in lessons/manifest.js as a <script> (works on file://).
 * Every failure is recorded in LL.loadErrors and shown on the home screen.
 */
(function () {
  "use strict";

  var LL = window.LL;

  // Syntax errors inside a lesson file surface here, not in onerror.
  // Files load one at a time, so an error during a load belongs to that file.
  // On file:// browsers may hide the details ("Script error."), so say where to look.
  window.addEventListener("error", function (e) {
    if (!LL._loadingPath) return;
    var detail = e.message && e.message !== "Script error." ? e.message + (e.lineno ? " (line " + e.lineno + ")" : "") : "";
    LL._loadingFailure = detail || "details hidden by the browser — open the browser console (F12) to see the line";
  });

  LL.loadLessons = function (done) {
    var list = Array.isArray(LL.manifest) ? LL.manifest : [];
    if (!Array.isArray(LL.manifest)) {
      LL.loadErrors.push({ path: "manifest.js", problems: ["lessons/manifest.js is missing or broken, so no lessons were loaded."] });
    }
    var i = 0;

    function next() {
      if (i >= list.length) {
        LL._loadingPath = null;
        return done();
      }
      var path = list[i++];
      var before = LL._registeredCount || 0;
      var s = document.createElement("script");
      LL._loadingPath = path;
      LL._loadingFailure = null;
      s.src = "lessons/" + path;
      s.onload = function () {
        if (LL._loadingFailure) {
          LL.loadErrors.push({ path: path, problems: ["The file has a typing error: " + LL._loadingFailure] });
        } else if ((LL._registeredCount || 0) === before) {
          LL.loadErrors.push({ path: path, problems: ["The file loaded but never called LL.registerLesson({...})."] });
        }
        next();
      };
      s.onerror = function () {
        LL.loadErrors.push({ path: path, problems: ["File not found. Check its path in lessons/manifest.js."] });
        next();
      };
      document.head.appendChild(s);
    }

    next();
  };
})();
