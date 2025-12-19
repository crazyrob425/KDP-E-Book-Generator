// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => import_electron.ipcRenderer.invoke("window-control", "minimize"),
  maximize: () => import_electron.ipcRenderer.invoke("window-control", "maximize"),
  close: () => import_electron.ipcRenderer.invoke("window-control", "close"),
  startAutomation: (payload) => import_electron.ipcRenderer.invoke("start-automation", payload),
  submitCaptcha: (solution) => import_electron.ipcRenderer.invoke("captcha-solution", solution),
  stopAutomation: () => import_electron.ipcRenderer.invoke("stop-automation"),
  onAutomationUpdate: (callback) => {
    const subscription = (_event, value) => callback(value);
    import_electron.ipcRenderer.on("automation-update", subscription);
    return () => {
      import_electron.ipcRenderer.removeListener("automation-update", subscription);
    };
  }
});
