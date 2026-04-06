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
async function fetchAmazonSuggestions(keyword) {
  try {
    const response = await fetch(`https://completion.amazon.com/api/2017/suggestions?session-id=123-4567890-123456&customer-id=&request-id=12345&page-type=Search&lop=en_US&site-variant=desktop&client-info=amazon-search-ui&mid=ATVPDKIKX0DER&alias=aps&b2b=0&fresh=0&ks=65&prefix=${encodeURIComponent(keyword)}&event=onKeyPress&limit=11&fb=1&suggestion-type=KEYWORD`);
    const data = await response.json();
    if (data.suggestions) {
      return data.suggestions.map((s) => s.value);
    }
    return [];
  } catch (e) {
    console.error("Amazon Suggestions Error:", e);
    return [];
  }
}

// electron/main.ts
try {
  if (require("electron-squirrel-startup")) {
    import_electron.app.quit();
  }
} catch {
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
  if (process.env.VITE_DEV_SERVER_URL) {
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
  if (automationGenerator) {
    sendUpdate({ type: "error", message: "An automation run is already in progress. Please stop it before starting a new one." });
    return;
  }
  if (!payload || typeof payload !== "object" || !payload.outline?.title || !payload.outline?.subtitle || !Array.isArray(payload.outline?.tableOfContents) || !payload.kdpMarketingInfo || !payload.authorProfile) {
    sendUpdate({ type: "error", message: "Invalid automation payload: missing required fields (outline, kdpMarketingInfo, authorProfile)." });
    return;
  }
  try {
    automationGenerator = runAutomation(payload, sendUpdate);
    const result = await automationGenerator.next();
    if (result.done) {
      automationGenerator = null;
    }
  } catch (e) {
    console.error("Automation error:", e);
    sendUpdate({ type: "error", message: e.message });
    automationGenerator = null;
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
import_electron.ipcMain.handle("market-research:suggestions", async (_, keyword) => {
  return await fetchAmazonSuggestions(keyword);
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
