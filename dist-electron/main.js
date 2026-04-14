var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// electron/main.ts
var import_electron = require("electron");
var import_path2 = __toESM(require("path"));
var import_promises2 = __toESM(require("fs/promises"));
var import_http = __toESM(require("http"));

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
var OAUTH_CONFIGS = {
  "gemini-cli": process.env.GEMINI_CLI_CLIENT_ID ? {
    clientId: process.env.GEMINI_CLI_CLIENT_ID,
    clientSecret: process.env.GEMINI_CLI_CLIENT_SECRET || "",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/cloud-platform",
    port: 8085,
    credDir: ".null-library/gemini-cli",
    credFile: "oauth_creds.json"
  } : null,
  "gemini-antigravity": process.env.GEMINI_ANTIGRAVITY_CLIENT_ID ? {
    clientId: process.env.GEMINI_ANTIGRAVITY_CLIENT_ID,
    clientSecret: process.env.GEMINI_ANTIGRAVITY_CLIENT_SECRET || "",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/cloud-platform",
    port: 8086,
    credDir: ".null-library/gemini-antigravity",
    credFile: "oauth_creds.json"
  } : null,
  "claude-kiro": null,
  // Kiro OAuth is more complex; handled via external browser
  "openai-codex": null,
  // Codex OAuth via GitHub device flow
  "openai-qwen": null,
  // Qwen browser login
  "openai-iflow": null
  // iFlow browser login
};
try {
  if (require("electron-squirrel-startup")) {
    import_electron.app.quit();
  }
} catch {
}
var mainWindow = null;
var automationGenerator = null;
var oauthServers = /* @__PURE__ */ new Map();
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
  if (!import_electron.app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
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
function getCredStoreDir() {
  return import_path2.default.join(import_electron.app.getPath("userData"), "null-library-credentials");
}
function getAccountCredPath(provider, accountId) {
  return import_path2.default.join(getCredStoreDir(), provider, `${accountId}.json`);
}
async function ensureDir(dir) {
  await import_promises2.default.mkdir(dir, { recursive: true });
}
function sendOAuthStatus(provider, phase, message, error) {
  mainWindow?.webContents.send("oauth-status", { provider, phase, message, error });
}
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
import_electron.ipcMain.handle("oauth:start", async (event, provider) => {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    return { success: false, error: `OAuth not configured for provider: ${provider}` };
  }
  const existing = oauthServers.get(provider);
  if (existing) {
    existing.close();
    oauthServers.delete(provider);
  }
  return new Promise((resolve) => {
    const redirectUri = `http://localhost:${config.port}/callback`;
    sendOAuthStatus(provider, "starting", `Starting OAuth flow for ${provider}\u2026`);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: config.scope,
      access_type: "offline",
      prompt: "consent"
    });
    const authUrl = `${config.authUrl}?${params.toString()}`;
    const server = import_http.default.createServer(async (req, res) => {
      if (!req.url?.startsWith("/callback")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const url = new URL(req.url, `http://localhost:${config.port}`);
      const code = url.searchParams.get("code");
      const rawError = url.searchParams.get("error");
      const error = rawError ? rawError.replace(/[^\w\s\-_.]/g, "") : null;
      if (error || !code) {
        const displayError = error ?? "No authorization code received";
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(buildCallbackPage(false, `Auth failed: ${displayError}`, provider));
        sendOAuthStatus(provider, "error", `OAuth cancelled or failed: ${displayError}`);
        server.close();
        oauthServers.delete(provider);
        resolve({ success: false, error: displayError });
        return;
      }
      sendOAuthStatus(provider, "callback-received", "Login successful! Saving credentials\u2026");
      try {
        const tokenRes = await fetch(config.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code"
          }).toString()
        });
        if (!tokenRes.ok) {
          const err = await tokenRes.text();
          throw new Error(`Token exchange failed: ${err}`);
        }
        const tokens = await tokenRes.json();
        const accountId = `${provider}-${Date.now()}`;
        const credPath = getAccountCredPath(provider, accountId);
        await ensureDir(import_path2.default.dirname(credPath));
        const credData = {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: Date.now() + tokens.expires_in * 1e3,
          token_type: tokens.token_type,
          accountId,
          provider,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        await import_promises2.default.writeFile(credPath, JSON.stringify(credData, null, 2), "utf-8");
        sendOAuthStatus(provider, "saving", "Credentials saved.");
        sendOAuthStatus(provider, "done", `Connected to ${provider} successfully!`);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(buildCallbackPage(true, `Connected to ${provider}!`, provider));
        await updateProxyAccountsList(provider, accountId, credPath);
        server.close();
        oauthServers.delete(provider);
        resolve({ success: true });
      } catch (e) {
        const errMsg = e.message;
        sendOAuthStatus(provider, "error", `Failed to save credentials: ${errMsg}`, errMsg);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(buildCallbackPage(false, errMsg, provider));
        server.close();
        oauthServers.delete(provider);
        resolve({ success: false, error: errMsg });
      }
    });
    server.listen(config.port, () => {
      oauthServers.set(provider, server);
      sendOAuthStatus(provider, "waiting-for-browser", "Browser opened \u2014 please log in\u2026");
      import_electron.shell.openExternal(authUrl).catch((e) => {
        console.error("Failed to open browser:", e);
        server.close();
        oauthServers.delete(provider);
        resolve({ success: false, error: "Could not open browser" });
      });
    });
    server.on("error", (e) => {
      sendOAuthStatus(provider, "error", `Server error: ${e.message}`, e.message);
      resolve({ success: false, error: e.message });
    });
  });
});
import_electron.ipcMain.handle("oauth:cancel", async (_, provider) => {
  const server = oauthServers.get(provider);
  if (server) {
    server.close();
    oauthServers.delete(provider);
  }
  sendOAuthStatus(provider, "error", "OAuth flow cancelled by user.");
});
import_electron.ipcMain.handle("proxy:getStatus", async () => {
  try {
    const settings = await loadProxySettingsFromDisk();
    return settings.accounts ?? [];
  } catch {
    return [];
  }
});
import_electron.ipcMain.handle("proxy:addAccount", async (_, provider) => {
  return import_electron.ipcMain.emit("oauth:start", provider);
});
import_electron.ipcMain.handle("proxy:removeAccount", async (_, accountId) => {
  const settings = await loadProxySettingsFromDisk();
  settings.accounts = (settings.accounts ?? []).filter((a) => a.id !== accountId);
  await saveProxySettingsToDisk(settings);
  const credStoreDir = getCredStoreDir();
  try {
    const files = await import_promises2.default.readdir(credStoreDir, { recursive: true, withFileTypes: true });
    for (const f of files) {
      if (f.name === `${accountId}.json`) {
        await import_promises2.default.unlink(import_path2.default.join(f.path ?? f.parentPath, f.name)).catch(() => {
        });
      }
    }
  } catch {
  }
});
import_electron.ipcMain.handle("proxy:getSettings", async () => {
  return loadProxySettingsFromDisk();
});
import_electron.ipcMain.handle("proxy:saveSettings", async (_, settings) => {
  await saveProxySettingsToDisk(settings);
});
import_electron.ipcMain.handle("proxy:getCredPath", async (_, provider, accountId) => {
  const p = getAccountCredPath(provider, accountId);
  try {
    await import_promises2.default.access(p);
    return p;
  } catch {
    return null;
  }
});
import_electron.ipcMain.handle("proxy:readCredFile", async (_, filePath) => {
  try {
    return await import_promises2.default.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
});
var PROXY_SETTINGS_FILE = () => import_path2.default.join(import_electron.app.getPath("userData"), "null-library-proxy-settings.json");
async function loadProxySettingsFromDisk() {
  try {
    const data = await import_promises2.default.readFile(PROXY_SETTINGS_FILE(), "utf-8");
    return JSON.parse(data);
  } catch {
    return {
      enabled: true,
      roundRobinEnabled: true,
      providerPriority: ["gemini-cli", "gemini-antigravity", "claude-kiro", "openai-codex", "openai-qwen", "openai-iflow"],
      taskRouting: {
        "creative-writing": ["gemini-cli", "gemini-antigravity", "openai-codex"],
        "market-research": ["gemini-cli", "gemini-antigravity", "claude-kiro"],
        "marketing-copy": ["claude-kiro", "openai-codex", "gemini-cli"],
        "image-prompt": ["gemini-cli", "gemini-antigravity"],
        "critique": ["claude-kiro", "gemini-cli", "openai-codex"],
        "general": ["gemini-cli", "gemini-antigravity", "claude-kiro", "openai-codex"]
      },
      failsafeEnabled: true,
      accounts: []
    };
  }
}
async function saveProxySettingsToDisk(settings) {
  const filePath = PROXY_SETTINGS_FILE();
  await ensureDir(import_path2.default.dirname(filePath));
  await import_promises2.default.writeFile(filePath, JSON.stringify(settings, null, 2), "utf-8");
}
async function updateProxyAccountsList(provider, accountId, credPath) {
  const settings = await loadProxySettingsFromDisk();
  const newAccount = {
    id: accountId,
    provider,
    isHealthy: true,
    isDisabled: false,
    lastUsed: Date.now(),
    usageCount: 0,
    errorCount: 0
  };
  const existing = (settings.accounts ?? []).findIndex((a) => a.id === accountId);
  if (existing >= 0) {
    settings.accounts[existing] = newAccount;
  } else {
    settings.accounts = [...settings.accounts ?? [], newAccount];
  }
  await saveProxySettingsToDisk(settings);
  mainWindow?.webContents.send("proxy-accounts-updated", settings.accounts);
}
function escapeHtml(unsafe) {
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function buildCallbackPage(isSuccess, message, provider) {
  const title = isSuccess ? "\u2705 Connected!" : "\u274C Connection Failed";
  const bgColor = isSuccess ? "#0f172a" : "#1a0a0a";
  const borderColor = isSuccess ? "#6d28d9" : "#dc2626";
  const textColor = isSuccess ? "#a78bfa" : "#f87171";
  const instruction = isSuccess ? "You can close this tab and return to Null Library." : "Please close this tab and try again in Null Library.";
  const safeProvider = escapeHtml(provider);
  const safeMessage = escapeHtml(message);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${isSuccess ? "Connected!" : "Connection Failed"}</title>
<style>
  body { margin:0; background:${bgColor}; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; }
  .card { background:#1e293b; border:1px solid ${borderColor}; border-radius:12px; padding:2rem 3rem; text-align:center; max-width:420px; }
  h1 { color:${textColor}; font-size:1.5rem; margin:0 0 .5rem; }
  p { color:#94a3b8; margin:.5rem 0 0; font-size:.95rem; }
  .logo { font-size:2.5rem; margin-bottom:1rem; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">${isSuccess ? "\u{1F4DA}" : "\u26A0\uFE0F"}</div>
  <h1>${title}</h1>
  <p><strong style="color:#e2e8f0">${safeProvider}</strong></p>
  <p>${safeMessage}</p>
  <p style="margin-top:1.5rem;font-size:.85rem;color:#64748b">${instruction}</p>
</div>
<script>
  setTimeout(() => { try { window.close(); } catch(e) {} }, 3000);
</script>
</body>
</html>`;
}
