var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/electron-squirrel-startup/node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/electron-squirrel-startup/node_modules/ms/index.js"(exports2, module2) {
    var s = 1e3;
    var m = s * 60;
    var h = m * 60;
    var d = h * 24;
    var y = d * 365.25;
    module2.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse(val);
      } else if (type === "number" && isNaN(val) === false) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      str = String(str);
      if (str.length > 100) {
        return;
      }
      var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
        str
      );
      if (!match) {
        return;
      }
      var n = parseFloat(match[1]);
      var type = (match[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y;
        case "days":
        case "day":
        case "d":
          return n * d;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    function fmtShort(ms) {
      if (ms >= d) {
        return Math.round(ms / d) + "d";
      }
      if (ms >= h) {
        return Math.round(ms / h) + "h";
      }
      if (ms >= m) {
        return Math.round(ms / m) + "m";
      }
      if (ms >= s) {
        return Math.round(ms / s) + "s";
      }
      return ms + "ms";
    }
    function fmtLong(ms) {
      return plural(ms, d, "day") || plural(ms, h, "hour") || plural(ms, m, "minute") || plural(ms, s, "second") || ms + " ms";
    }
    function plural(ms, n, name) {
      if (ms < n) {
        return;
      }
      if (ms < n * 1.5) {
        return Math.floor(ms / n) + " " + name;
      }
      return Math.ceil(ms / n) + " " + name + "s";
    }
  }
});

// node_modules/electron-squirrel-startup/node_modules/debug/src/debug.js
var require_debug = __commonJS({
  "node_modules/electron-squirrel-startup/node_modules/debug/src/debug.js"(exports2, module2) {
    exports2 = module2.exports = createDebug.debug = createDebug["default"] = createDebug;
    exports2.coerce = coerce;
    exports2.disable = disable;
    exports2.enable = enable;
    exports2.enabled = enabled;
    exports2.humanize = require_ms();
    exports2.names = [];
    exports2.skips = [];
    exports2.formatters = {};
    var prevTime;
    function selectColor(namespace) {
      var hash = 0, i;
      for (i in namespace) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return exports2.colors[Math.abs(hash) % exports2.colors.length];
    }
    function createDebug(namespace) {
      function debug() {
        if (!debug.enabled) return;
        var self = debug;
        var curr = +/* @__PURE__ */ new Date();
        var ms = curr - (prevTime || curr);
        self.diff = ms;
        self.prev = prevTime;
        self.curr = curr;
        prevTime = curr;
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        args[0] = exports2.coerce(args[0]);
        if ("string" !== typeof args[0]) {
          args.unshift("%O");
        }
        var index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
          if (match === "%%") return match;
          index++;
          var formatter = exports2.formatters[format];
          if ("function" === typeof formatter) {
            var val = args[index];
            match = formatter.call(self, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        exports2.formatArgs.call(self, args);
        var logFn = debug.log || exports2.log || console.log.bind(console);
        logFn.apply(self, args);
      }
      debug.namespace = namespace;
      debug.enabled = exports2.enabled(namespace);
      debug.useColors = exports2.useColors();
      debug.color = selectColor(namespace);
      if ("function" === typeof exports2.init) {
        exports2.init(debug);
      }
      return debug;
    }
    function enable(namespaces) {
      exports2.save(namespaces);
      exports2.names = [];
      exports2.skips = [];
      var split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
      var len = split.length;
      for (var i = 0; i < len; i++) {
        if (!split[i]) continue;
        namespaces = split[i].replace(/\*/g, ".*?");
        if (namespaces[0] === "-") {
          exports2.skips.push(new RegExp("^" + namespaces.substr(1) + "$"));
        } else {
          exports2.names.push(new RegExp("^" + namespaces + "$"));
        }
      }
    }
    function disable() {
      exports2.enable("");
    }
    function enabled(name) {
      var i, len;
      for (i = 0, len = exports2.skips.length; i < len; i++) {
        if (exports2.skips[i].test(name)) {
          return false;
        }
      }
      for (i = 0, len = exports2.names.length; i < len; i++) {
        if (exports2.names[i].test(name)) {
          return true;
        }
      }
      return false;
    }
    function coerce(val) {
      if (val instanceof Error) return val.stack || val.message;
      return val;
    }
  }
});

// node_modules/electron-squirrel-startup/node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/electron-squirrel-startup/node_modules/debug/src/browser.js"(exports2, module2) {
    exports2 = module2.exports = require_debug();
    exports2.log = log;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.storage = "undefined" != typeof chrome && "undefined" != typeof chrome.storage ? chrome.storage.local : localstorage();
    exports2.colors = [
      "lightseagreen",
      "forestgreen",
      "goldenrod",
      "dodgerblue",
      "darkorchid",
      "crimson"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && window.process.type === "renderer") {
        return true;
      }
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31 || // double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    exports2.formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (err) {
        return "[UnexpectedJSONParseError]: " + err.message;
      }
    };
    function formatArgs(args) {
      var useColors2 = this.useColors;
      args[0] = (useColors2 ? "%c" : "") + this.namespace + (useColors2 ? " %c" : " ") + args[0] + (useColors2 ? "%c " : " ") + "+" + exports2.humanize(this.diff);
      if (!useColors2) return;
      var c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      var index = 0;
      var lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, function(match) {
        if ("%%" === match) return;
        index++;
        if ("%c" === match) {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    function log() {
      return "object" === typeof console && console.log && Function.prototype.apply.call(console.log, console, arguments);
    }
    function save(namespaces) {
      try {
        if (null == namespaces) {
          exports2.storage.removeItem("debug");
        } else {
          exports2.storage.debug = namespaces;
        }
      } catch (e) {
      }
    }
    function load() {
      var r;
      try {
        r = exports2.storage.debug;
      } catch (e) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    exports2.enable(load());
    function localstorage() {
      try {
        return window.localStorage;
      } catch (e) {
      }
    }
  }
});

// node_modules/electron-squirrel-startup/node_modules/debug/src/node.js
var require_node = __commonJS({
  "node_modules/electron-squirrel-startup/node_modules/debug/src/node.js"(exports2, module2) {
    var tty = require("tty");
    var util = require("util");
    exports2 = module2.exports = require_debug();
    exports2.init = init;
    exports2.log = log;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.colors = [6, 2, 3, 4, 5, 1];
    exports2.inspectOpts = Object.keys(process.env).filter(function(key) {
      return /^debug_/i.test(key);
    }).reduce(function(obj, key) {
      var prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, function(_, k) {
        return k.toUpperCase();
      });
      var val = process.env[key];
      if (/^(yes|on|true|enabled)$/i.test(val)) val = true;
      else if (/^(no|off|false|disabled)$/i.test(val)) val = false;
      else if (val === "null") val = null;
      else val = Number(val);
      obj[prop] = val;
      return obj;
    }, {});
    var fd = parseInt(process.env.DEBUG_FD, 10) || 2;
    if (1 !== fd && 2 !== fd) {
      util.deprecate(function() {
      }, "except for stderr(2) and stdout(1), any other usage of DEBUG_FD is deprecated. Override debug.log if you want to use a different log function (https://git.io/debug_fd)")();
    }
    var stream = 1 === fd ? process.stdout : 2 === fd ? process.stderr : createWritableStdioStream(fd);
    function useColors() {
      return "colors" in exports2.inspectOpts ? Boolean(exports2.inspectOpts.colors) : tty.isatty(fd);
    }
    exports2.formatters.o = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts).split("\n").map(function(str) {
        return str.trim();
      }).join(" ");
    };
    exports2.formatters.O = function(v) {
      this.inspectOpts.colors = this.useColors;
      return util.inspect(v, this.inspectOpts);
    };
    function formatArgs(args) {
      var name = this.namespace;
      var useColors2 = this.useColors;
      if (useColors2) {
        var c = this.color;
        var prefix = "  \x1B[3" + c + ";1m" + name + " \x1B[0m";
        args[0] = prefix + args[0].split("\n").join("\n" + prefix);
        args.push("\x1B[3" + c + "m+" + exports2.humanize(this.diff) + "\x1B[0m");
      } else {
        args[0] = (/* @__PURE__ */ new Date()).toUTCString() + " " + name + " " + args[0];
      }
    }
    function log() {
      return stream.write(util.format.apply(util, arguments) + "\n");
    }
    function save(namespaces) {
      if (null == namespaces) {
        delete process.env.DEBUG;
      } else {
        process.env.DEBUG = namespaces;
      }
    }
    function load() {
      return process.env.DEBUG;
    }
    function createWritableStdioStream(fd2) {
      var stream2;
      var tty_wrap = process.binding("tty_wrap");
      switch (tty_wrap.guessHandleType(fd2)) {
        case "TTY":
          stream2 = new tty.WriteStream(fd2);
          stream2._type = "tty";
          if (stream2._handle && stream2._handle.unref) {
            stream2._handle.unref();
          }
          break;
        case "FILE":
          var fs3 = require("fs");
          stream2 = new fs3.SyncWriteStream(fd2, { autoClose: false });
          stream2._type = "fs";
          break;
        case "PIPE":
        case "TCP":
          var net = require("net");
          stream2 = new net.Socket({
            fd: fd2,
            readable: false,
            writable: true
          });
          stream2.readable = false;
          stream2.read = null;
          stream2._type = "pipe";
          if (stream2._handle && stream2._handle.unref) {
            stream2._handle.unref();
          }
          break;
        default:
          throw new Error("Implement me. Unknown stream file type!");
      }
      stream2.fd = fd2;
      stream2._isStdio = true;
      return stream2;
    }
    function init(debug) {
      debug.inspectOpts = {};
      var keys = Object.keys(exports2.inspectOpts);
      for (var i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports2.inspectOpts[keys[i]];
      }
    }
    exports2.enable(load());
  }
});

// node_modules/electron-squirrel-startup/node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/electron-squirrel-startup/node_modules/debug/src/index.js"(exports2, module2) {
    if (typeof process !== "undefined" && process.type === "renderer") {
      module2.exports = require_browser();
    } else {
      module2.exports = require_node();
    }
  }
});

// node_modules/electron-squirrel-startup/index.js
var require_electron_squirrel_startup = __commonJS({
  "node_modules/electron-squirrel-startup/index.js"(exports2, module2) {
    var path3 = require("path");
    var spawn = require("child_process").spawn;
    var debug = require_src()("electron-squirrel-startup");
    var app2 = require("electron").app;
    var run = function(args, done) {
      var updateExe = path3.resolve(path3.dirname(process.execPath), "..", "Update.exe");
      debug("Spawning `%s` with args `%s`", updateExe, args);
      spawn(updateExe, args, {
        detached: true
      }).on("close", done);
    };
    var check = function() {
      if (process.platform === "win32") {
        var cmd = process.argv[1];
        debug("processing squirrel command `%s`", cmd);
        var target = path3.basename(process.execPath);
        if (cmd === "--squirrel-install" || cmd === "--squirrel-updated") {
          run(["--createShortcut=" + target], app2.quit);
          return true;
        }
        if (cmd === "--squirrel-uninstall") {
          run(["--removeShortcut=" + target], app2.quit);
          return true;
        }
        if (cmd === "--squirrel-obsolete") {
          app2.quit();
          return true;
        }
      }
      return false;
    };
    module2.exports = check();
  }
});

// electron/main.ts
var import_electron = require("electron");
var import_path2 = __toESM(require("path"));
var import_promises2 = __toESM(require("fs/promises"));

// server/automation-worker.ts
var import_playwright = require("playwright");
var import_promises = __toESM(require("fs/promises"));
var import_path = __toESM(require("path"));
var import_os = __toESM(require("os"));
var import_buffer = require("buffer");
var dataUrlToBuffer = (dataUrl) => {
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Invalid data URL");
  }
  return import_buffer.Buffer.from(base64, "base64");
};
async function* runAutomation(payload, sendUpdate) {
  let browser = null;
  const tempDir = await import_promises.default.mkdtemp(import_path.default.join(import_os.default.tmpdir(), "kdp-automation-"));
  try {
    sendUpdate({ type: "log", message: "Automation sequence initiated on the server." });
    sendUpdate({ type: "status", status: "initializing" });
    sendUpdate({ type: "log", message: "Launching headless Chromium browser..." });
    browser = await import_playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    sendUpdate({ type: "status", status: "running" });
    sendUpdate({ type: "log", message: "Navigating to Amazon KDP login page..." });
    await page.goto("https://kdp.amazon.com/en_US/");
    const email = process.env.KDP_EMAIL;
    const password = process.env.KDP_PASSWORD;
    if (!email || !password) {
      throw new Error("KDP_EMAIL and KDP_PASSWORD environment variables are not set on the server.");
    }
    sendUpdate({ type: "log", message: "Entering credentials..." });
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', email);
    await page.click('input[type="submit"]');
    await page.waitForSelector('input[type="password"]');
    await page.fill('input[type="password"]', password);
    await page.click('input[type="submit"]');
    sendUpdate({ type: "log", message: "Credentials submitted. Waiting for navigation..." });
    await page.waitForNavigation({ waitUntil: "networkidle" });
    const captchaElement = await page.$("#auth-captcha-image");
    if (captchaElement) {
      sendUpdate({ type: "log", message: "Security check detected. Taking screenshot..." });
      const captchaImageBuffer = await captchaElement.screenshot();
      const captchaImageUrl = `data:image/jpeg;base64,${captchaImageBuffer.toString("base64")}`;
      sendUpdate({ type: "captcha", imageUrl: captchaImageUrl });
      const solution = yield;
      sendUpdate({ type: "log", message: "Submitting CAPTCHA solution..." });
      await page.fill("#auth-captcha-guess", solution);
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
      const errorBox = await page.$("#auth-error-message-box");
      if (errorBox) {
        throw new Error("CAPTCHA solution was incorrect or login failed.");
      }
      sendUpdate({ type: "log", message: "CAPTCHA passed. Resuming operation." });
    }
    sendUpdate({ type: "log", message: "Login successful. Navigating to bookshelf..." });
    await page.waitForSelector('div[data-testid="bookshelf-page"]');
    sendUpdate({ type: "log", message: "Creating new Kindle eBook..." });
    await page.click("#create-button");
    await page.click('div[data-testid="create-digital-book-button"]');
    sendUpdate({ type: "log", message: "Waiting for book details page to load..." });
    await page.waitForSelector('input[data-testid="book-title-input"]');
    sendUpdate({ type: "log", message: "Populating book details..." });
    await page.fill('input[data-testid="book-title-input"]', payload.outline.title);
    await page.fill('input[data-testid="book-subtitle-input"]', payload.outline.subtitle);
    sendUpdate({ type: "status", status: "uploading" });
    const epubPath = import_path.default.join(tempDir, "manuscript.epub");
    const coverPath = import_path.default.join(tempDir, "cover.jpg");
    const epubBuffer = dataUrlToBuffer(payload.epubBlob);
    await import_promises.default.writeFile(epubPath, epubBuffer);
    const coverBuffer = dataUrlToBuffer(payload.coverImageUrl);
    await import_promises.default.writeFile(coverPath, coverBuffer);
    sendUpdate({ type: "log", message: `Uploading manuscript...` });
    await page.setInputFiles("#manuscript-upload-button-test-id", epubPath);
    sendUpdate({ type: "log", message: "Manuscript sent. Waiting for KDP to process..." });
    await page.waitForSelector("#manuscript-upload-success-message", { timeout: 3e5 });
    sendUpdate({ type: "log", message: "Manuscript processed successfully." });
    sendUpdate({ type: "log", message: `Uploading cover image...` });
    await page.setInputFiles("#cover-upload-button-test-id", coverPath);
    sendUpdate({ type: "log", message: "Cover sent. Waiting for KDP to process..." });
    await page.waitForSelector("#cover-upload-success-message", { timeout: 18e4 });
    sendUpdate({ type: "log", message: "Cover processed successfully." });
    sendUpdate({ type: "log", message: "File uploads complete." });
    sendUpdate({ type: "status", status: "running" });
    sendUpdate({ type: "log", message: "Saving and continuing to pricing page..." });
    await page.click("#save-and-continue-button-test-id");
    await page.waitForSelector("#pricing-page-test-id");
    sendUpdate({ type: "log", message: "Navigated to pricing page." });
    sendUpdate({ type: "log", message: "Setting pricing and territory rights..." });
    sendUpdate({ type: "log", message: "Submitting book for publication review." });
    await page.click("#publish-book-button-test-id");
    await page.waitForNavigation();
    sendUpdate({ type: "success" });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
    sendUpdate({ type: "log", message: `Automation failed: ${errorMessage}` });
    sendUpdate({ type: "error", message: errorMessage });
  } finally {
    if (browser) {
      await browser.close();
    }
    await import_promises.default.rm(tempDir, { recursive: true, force: true });
    sendUpdate({ type: "log", message: "Browser closed and resources cleaned up." });
  }
}

// server/market-research-worker.ts
var import_playwright2 = require("playwright");
var import_google_trends_api = __toESM(require("google-trends-api"));
async function fetchGoogleTrends(keyword) {
  try {
    const results = await import_google_trends_api.default.interestOverTime({ keyword });
    const data = JSON.parse(results);
    if (!data.default || !data.default.timelineData) return null;
    const timeline = data.default.timelineData.map((item) => ({
      month: item.formattedAxisTime,
      // e.g. "Dec 2023"
      value: item.value[0]
    }));
    const relatedRes = await import_google_trends_api.default.relatedQueries({ keyword });
    const relatedData = JSON.parse(relatedRes);
    const related = relatedData.default?.rankedList?.[0]?.rankedKeyword?.slice(0, 5).map((item) => ({
      query: item.query,
      value: item.value
      // interest level
    })) || [];
    return {
      interestOverTime: timeline,
      relatedQueries: related
    };
  } catch (e) {
    console.error("Google Trends Error:", e);
    return null;
  }
}
async function fetchAmazonCompetitors(keyword) {
  let browser = null;
  try {
    browser = await import_playwright2.chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    });
    const page = await context.newPage();
    const query = encodeURIComponent(keyword + " books");
    await page.goto(`https://www.amazon.com/s?k=${query}&i=stripbooks`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2e3);
    const results = await page.evaluate(() => {
      const items = document.querySelectorAll('.s-result-item[data-component-type="s-search-result"]');
      const data = [];
      items.forEach((item) => {
        if (data.length >= 6) return;
        const titleEl = item.querySelector("h2 a span");
        const authorEl = item.querySelector(".a-row .a-size-base");
        const priceEl = item.querySelector(".a-price .a-offscreen");
        const ratingEl = item.querySelector('i[class*="a-star-small"] span');
        const reviewCountEl = item.querySelector('span[aria-label$="stars"] + span span');
        const reviewCountLink = item.querySelector('a[href*="#customerReviews"] span');
        const imgEl = item.querySelector(".s-image");
        if (titleEl) {
          data.push({
            title: titleEl.textContent?.trim(),
            author: authorEl ? authorEl.textContent?.trim() : "Unknown",
            // This selector is flaky
            price: priceEl ? priceEl.textContent?.trim() : "N/A",
            rating: ratingEl ? ratingEl.textContent?.trim() : "N/A",
            reviewCount: reviewCountLink ? reviewCountLink.textContent?.trim() : "0",
            url: "",
            // We can get href if needed
            imgUrl: imgEl ? imgEl.src : ""
          });
        }
      });
      return data;
    });
    return results;
  } catch (e) {
    console.error("Amazon Scraping Error:", e);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

// electron/main.ts
if (require_electron_squirrel_startup()) {
  import_electron.app.quit();
}
var mainWindow = null;
var automationGenerator = null;
var createWindow = () => {
  mainWindow = new import_electron.BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    // Frameless for custom title bar
    webPreferences: {
      preload: import_path2.default.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(import_path2.default.join(__dirname, "../dist/index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    import_electron.shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.openDevTools();
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Failed to load window:", errorCode, errorDescription);
  });
};
import_electron.app.on("ready", createWindow);
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});
import_electron.app.on("activate", () => {
  if (import_electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
import_electron.ipcMain.handle("window-control", async (event, action) => {
  const win = import_electron.BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  switch (action) {
    case "minimize":
      win.minimize();
      break;
    case "maximize":
      win.isMaximized() ? win.unmaximize() : win.maximize();
      break;
    case "close":
      win.close();
      break;
  }
});
import_electron.ipcMain.handle("start-automation", async (event, payload) => {
  const sender = event.sender;
  const sendUpdate = (update) => {
    sender.send("automation-update", update);
  };
  try {
    if (automationGenerator) {
    }
    automationGenerator = runAutomation(payload, sendUpdate);
    const result = await automationGenerator.next();
    if (result.done) {
      automationGenerator = null;
    }
  } catch (e) {
    console.error("Automation error:", e);
    sendUpdate({ type: "error", message: e.message });
  }
});
import_electron.ipcMain.handle("captcha-solution", async (event, solution) => {
  if (automationGenerator) {
    const result = await automationGenerator.next(solution);
    if (result.done) {
      automationGenerator = null;
    }
  }
});
import_electron.ipcMain.handle("stop-automation", async () => {
  if (automationGenerator) {
    await automationGenerator.return();
    automationGenerator = null;
  }
});
import_electron.ipcMain.handle("market-research:trends", async (_, keyword) => {
  return await fetchGoogleTrends(keyword);
});
import_electron.ipcMain.handle("market-research:competitors", async (_, keyword) => {
  return await fetchAmazonCompetitors(keyword);
});
import_electron.ipcMain.handle("save-file", async (event, data, filename) => {
  const { canceled, filePath } = await import_electron.dialog.showSaveDialog({
    title: "Save Project",
    defaultPath: filename,
    filters: [{ name: "JSON Files", extensions: ["json"] }]
  });
  if (canceled || !filePath) return { success: false };
  try {
    await import_promises2.default.writeFile(filePath, data, "utf-8");
    return { success: true, filePath };
  } catch (e) {
    console.error("Failed to save file:", e);
    return { success: false, error: e.message };
  }
});
import_electron.ipcMain.handle("load-file", async () => {
  const { canceled, filePaths } = await import_electron.dialog.showOpenDialog({
    title: "Load Project",
    filters: [{ name: "JSON Files", extensions: ["json"] }],
    properties: ["openFile"]
  });
  if (canceled || filePaths.length === 0) return { success: false };
  try {
    const data = await import_promises2.default.readFile(filePaths[0], "utf-8");
    return { success: true, data };
  } catch (e) {
    console.error("Failed to load file:", e);
    return { success: false, error: e.message };
  }
});
