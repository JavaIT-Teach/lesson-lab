/*
 * Lesson Lab — GitHub sync.
 *
 * Writes teacher edits to data/overrides/<lesson-id>.js and uploaded pictures to
 * assets/uploads/ in the repo, using a fine-grained token stored on this device only.
 * Reads work without a token (the repo is public).
 *
 * Status: "view-only" (no token) · "saved" · "saving" · "offline" · "error".
 * Offline changes stay queued (localStorage / IndexedDB) and go out when back online.
 */
(function () {
  "use strict";

  var LL = window.LL;
  var ov = LL.ov;
  var DEBOUNCE = 3000;
  var RETRY_OFFLINE = 20000;
  var RETRY_ERROR = 60000;

  var state = { status: "saved", message: "", lastSavedAt: null };
  var listeners = [];
  var timer = null;
  var retryTimer = null;
  var running = false;
  var again = false;

  function setStatus(status, message) {
    state.status = status;
    state.message = message || "";
    if (status === "saved") state.lastSavedAt = Date.now();
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* ignore */ } });
  }

  function cfg() {
    var g = LL.store.github();
    return { token: g.token, repo: g.repo, branch: g.branch || "main", api: (LL.config && LL.config.apiBase) || "https://api.github.com", raw: (LL.config && LL.config.rawBase) || "https://raw.githubusercontent.com" };
  }

  /* ---------- HTTP ---------- */

  function NetError(msg) { this.name = "NetError"; this.message = msg; }
  function HttpError(status, msg) { this.name = "HttpError"; this.status = status; this.message = msg; }

  function api(method, path, body, useToken) {
    var c = cfg();
    var headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (useToken !== false && c.token) headers.Authorization = "Bearer " + c.token;
    if (body) headers["Content-Type"] = "application/json";
    return fetch(c.api + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" })
      .catch(function () { throw new NetError("No connection to GitHub."); })
      .then(function (res) {
        if (res.status === 404) return null;
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { /* ignore */ }
          if (!res.ok) throw new HttpError(res.status, (data && data.message) || res.statusText || "GitHub error");
          return data;
        });
      });
  }

  function repoPath(p) {
    var c = cfg();
    return "/repos/" + c.repo + "/contents/" + p.split("/").map(encodeURIComponent).join("/");
  }

  function getFile(p, useToken) {
    return api("GET", repoPath(p) + "?ref=" + encodeURIComponent(cfg().branch), null, useToken).then(function (d) {
      if (!d || Array.isArray(d)) return null;
      return { sha: d.sha, text: d.content ? b64decodeText(d.content) : "" };
    });
  }

  function putFile(p, base64, sha, message) {
    var body = { message: message, content: base64, branch: cfg().branch };
    if (sha) body.sha = sha;
    return api("PUT", repoPath(p), body).then(function (d) {
      if (!d) throw new HttpError(404, "Repository not found, or the token has no access to it.");
      return d.content && d.content.sha;
    });
  }

  function b64encodeText(s) {
    return btoa(unescape(encodeURIComponent(s)));
  }

  function b64decodeText(b) {
    return decodeURIComponent(escape(atob(String(b).replace(/\s/g, ""))));
  }

  function explain(e) {
    if (e instanceof NetError) return e.message;
    if (e instanceof HttpError) {
      if (e.status === 401) return "GitHub rejected the token (it may have expired). Open Settings.";
      if (e.status === 403) return "The token cannot write to this repo, or GitHub is limiting requests. Open Settings.";
      if (e.status === 404) return "Repository not found, or the token has no access to it. Open Settings.";
      return "GitHub error " + e.status + ": " + e.message;
    }
    return String(e && e.message ? e.message : e);
  }

  /* ---------- Push ---------- */

  function overridesPath(id) {
    return "data/overrides/" + id + ".js";
  }

  function pushLesson(id, attempt) {
    attempt = attempt || 0;
    return getFile(overridesPath(id)).then(function (remote) {
      if (remote) {
        var remoteDoc;
        try { remoteDoc = ov.fromFile(remote.text); } catch (e) { remoteDoc = null; }
        if (remoteDoc && LL.store.mergeRemote(id, remoteDoc, remote.sha)) notifyRemote(id);
      }
      var rec = LL.store.record(id);
      if (!rec || !rec.dirty) return;
      var doc = rec.doc;
      return putFile(overridesPath(id), b64encodeText(ov.toFile(doc)), remote && remote.sha, "Teacher edits: " + id)
        .then(function (sha) {
          LL.store.markSynced(id, doc, sha);
        })
        .catch(function (e) {
          // Someone else saved in between: fetch again, merge, retry.
          if (e instanceof HttpError && (e.status === 409 || e.status === 422) && attempt < 3) return pushLesson(id, attempt + 1);
          throw e;
        });
    });
  }

  function pushImage(path) {
    return LL.images.getBlob(path).then(function (blob) {
      if (!blob) return LL.images.markUploaded(path); // nothing to send
      return blobToBase64(blob).then(function (b64) {
        return putFile(path, b64, null, "Teacher upload: " + path.split("/").pop())
          .catch(function (e) {
            // Already there (e.g. an earlier save whose reply was lost)?
            if (e instanceof HttpError && e.status === 422) {
              return getFile(path).then(function (f) { if (!f) throw e; });
            }
            throw e;
          })
          .then(function () { return LL.images.markUploaded(path); });
      });
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1] || ""); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function pendingCount() {
    return LL.store.dirtyIds().length + (LL.images ? LL.images.pending().length : 0);
  }

  function flush() {
    clearTimeout(timer);
    timer = null;
    if (running) { again = true; return Promise.resolve(); }
    var c = cfg();
    if (!c.token) { setStatus("view-only"); return Promise.resolve(); }
    if (!pendingCount()) { setStatus("saved"); return Promise.resolve(); }
    if (!c.repo) { setStatus("error", "No repository set. Open Settings."); return Promise.resolve(); }
    if (navigator.onLine === false) { setStatus("offline"); return Promise.resolve(); }

    running = true;
    setStatus("saving");
    var chain = Promise.resolve();
    (LL.images ? LL.images.pending() : []).forEach(function (p) {
      chain = chain.then(function () { return pushImage(p); });
    });
    LL.store.dirtyIds().forEach(function (id) {
      chain = chain.then(function () { return pushLesson(id); });
    });
    return chain
      .then(function () {
        running = false;
        if (again || pendingCount()) { again = false; return flush(); }
        setStatus("saved");
      })
      .catch(function (e) {
        running = false;
        again = false;
        clearTimeout(retryTimer);
        if (e instanceof NetError) {
          setStatus("offline");
          retryTimer = setTimeout(flush, RETRY_OFFLINE);
        } else {
          setStatus("error", explain(e));
          if (!(e instanceof HttpError) || e.status >= 500 || e.status === 403) retryTimer = setTimeout(flush, RETRY_ERROR);
        }
      });
  }

  /* ---------- Pull (works without a token: public repo) ---------- */

  var remoteListeners = [];
  function notifyRemote(id) {
    remoteListeners.forEach(function (fn) { try { fn(id); } catch (e) { /* ignore */ } });
  }

  function pullOne(id) {
    if (!cfg().repo || navigator.onLine === false) return Promise.resolve(false);
    return getFile(overridesPath(id))
      .then(function (f) {
        if (!f) return false;
        var rec = LL.store.record(id);
        if (rec && rec.sha === f.sha) return false;
        var changed = LL.store.mergeRemote(id, ov.fromFile(f.text), f.sha);
        if (changed) notifyRemote(id);
        if (LL.store.record(id).dirty) schedule();
        return changed;
      })
      .catch(function () { return false; });
  }

  function pullAll() {
    if (!cfg().repo || navigator.onLine === false) return Promise.resolve([]);
    return api("GET", repoPath("data/overrides") + "?ref=" + encodeURIComponent(cfg().branch))
      .then(function (list) {
        if (!Array.isArray(list)) return [];
        var jobs = list
          .filter(function (f) { return /\.js$/.test(f.name) && f.type === "file"; })
          .map(function (f) {
            var id = f.name.replace(/\.js$/, "");
            var rec = LL.store.record(id);
            if (rec && rec.sha === f.sha) return Promise.resolve(null);
            return api("GET", "/repos/" + cfg().repo + "/git/blobs/" + f.sha).then(function (b) {
              if (!b) return null;
              var changed = LL.store.mergeRemote(id, ov.fromFile(b64decodeText(b.content)), f.sha);
              return changed ? id : null;
            }).catch(function () { return null; });
          });
        return Promise.all(jobs);
      })
      .then(function (ids) {
        ids = ids.filter(Boolean);
        ids.forEach(notifyRemote);
        if (LL.store.dirtyIds().length) schedule();
        return ids;
      })
      .catch(function () { return []; });
  }

  /* ---------- Token check ---------- */

  function testToken() {
    var c = cfg();
    if (!c.repo) return Promise.reject(new Error("Enter the repository as owner/name."));
    return api("GET", "/repos/" + c.repo).then(function (d) {
      if (!d) throw new Error("Repository " + c.repo + " was not found, or this token cannot see it.");
      if (!d.permissions || !d.permissions.push) throw new Error("This token can read " + c.repo + " but cannot write to it. Give it Contents: Read and write.");
      return d;
    }, function (e) { throw new Error(explain(e)); });
  }

  function schedule() {
    if (!cfg().token) { setStatus("view-only"); return; }
    setStatus(navigator.onLine === false ? "offline" : "saving");
    clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE);
  }

  window.addEventListener("online", function () { flush(); });
  window.addEventListener("offline", function () { if (pendingCount()) setStatus("offline"); });

  LL.sync = {
    state: state,
    schedule: schedule,
    flush: flush,
    pullAll: pullAll,
    pullOne: pullOne,
    testToken: testToken,
    pendingCount: pendingCount,
    rawUrl: function (p) {
      var c = cfg();
      return c.repo ? c.raw + "/" + c.repo + "/" + encodeURIComponent(c.branch) + "/" + p : null;
    },
    onStatus: function (fn) { listeners.push(fn); },
    onRemoteChange: function (fn) { remoteListeners.push(fn); },
    init: function () {
      if (!cfg().token) setStatus("view-only");
      else if (pendingCount()) schedule();
      else setStatus("saved");
    },
    label: function () {
      switch (state.status) {
        case "view-only": return "View only";
        case "saving": return "Saving…";
        case "offline": return "Offline: will save later";
        case "error": return "Not saved: " + state.message;
        default: return "Saved";
      }
    }
  };
})();
