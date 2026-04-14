// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => import_electron.ipcRenderer.invoke("window-control", "minimize"),
  maximize: () => import_electron.ipcRenderer.invoke("window-control", "maximize"),
  close: () => import_electron.ipcRenderer.invoke("window-control", "close"),
  startAutomation: (payload) => import_electron.ipcRenderer.invoke("start-automation", payload),
  submitCaptcha: (solution) => import_electron.ipcRenderer.invoke("captcha-solution", solution),
  stopAutomation: () => import_electron.ipcRenderer.invoke("stop-automation"),
  saveFile: (data, filename) => import_electron.ipcRenderer.invoke("save-file", data, filename),
  loadFile: () => import_electron.ipcRenderer.invoke("load-file"),
  onAutomationUpdate: (callback) => {
    const subscription = (_event, value) => callback(value);
    import_electron.ipcRenderer.on("automation-update", subscription);
    return () => {
      import_electron.ipcRenderer.removeListener("automation-update", subscription);
    };
  },
  fetchGoogleTrends: (keyword) => import_electron.ipcRenderer.invoke("market-research:trends", keyword),
  fetchAmazonCompetitors: (keyword) => import_electron.ipcRenderer.invoke("market-research:competitors", keyword),
  fetchAmazonSuggestions: (keyword) => import_electron.ipcRenderer.invoke("market-research:suggestions", keyword),
  // ── NullProxy OAuth ──
  oauthStart: (provider) => import_electron.ipcRenderer.invoke("oauth:start", provider),
  oauthCancel: (provider) => import_electron.ipcRenderer.invoke("oauth:cancel", provider),
  onOAuthStatus: (callback) => {
    const subscription = (_event, value) => callback(value);
    import_electron.ipcRenderer.on("oauth-status", subscription);
    return () => {
      import_electron.ipcRenderer.removeListener("oauth-status", subscription);
    };
  },
  // ── NullProxy Proxy Operations ──
  proxyGetStatus: () => import_electron.ipcRenderer.invoke("proxy:getStatus"),
  proxyAddAccount: (provider) => import_electron.ipcRenderer.invoke("proxy:addAccount", provider),
  proxyRemoveAccount: (accountId) => import_electron.ipcRenderer.invoke("proxy:removeAccount", accountId),
  proxyGetSettings: () => import_electron.ipcRenderer.invoke("proxy:getSettings"),
  proxySaveSettings: (settings) => import_electron.ipcRenderer.invoke("proxy:saveSettings", settings),
  proxyGetCredPath: (provider, accountId) => import_electron.ipcRenderer.invoke("proxy:getCredPath", provider, accountId),
  readCredFile: (filePath) => import_electron.ipcRenderer.invoke("proxy:readCredFile", filePath),
  // Subscribe to proxy accounts being updated (after an OAuth login)
  onProxyAccountsUpdated: (callback) => {
    const subscription = (_event, value) => callback(value);
    import_electron.ipcRenderer.on("proxy-accounts-updated", subscription);
    return () => {
      import_electron.ipcRenderer.removeListener("proxy-accounts-updated", subscription);
    };
  }
});
