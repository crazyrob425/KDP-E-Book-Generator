import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { runAutomation } from '../server/automation-worker';
import { KdpAutomationPayload, BotUpdate } from '../types';



// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let automationGenerator: AsyncGenerator<void, void, string> | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Frameless for custom title bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
  });

  // DEBUG: Open DevTools to debug blank screen
  mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load window:', errorCode, errorDescription);
  });
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- IPC HANDLERS ---

ipcMain.handle('window-control', async (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    switch (action) {
        case 'minimize': win.minimize(); break;
        case 'maximize': win.isMaximized() ? win.unmaximize() : win.maximize(); break;
        case 'close': win.close(); break;
    }
});

ipcMain.handle('start-automation', async (event, payload: KdpAutomationPayload) => {
    const sender = event.sender;
    const sendUpdate = (update: BotUpdate) => {
        sender.send('automation-update', update);
    };

    try {
        if (automationGenerator) {
            // If running, ensure we clean up? Or maybe we just restart.
            // For now, let's just error if busy? Or kill previous?
            // Simple approach: Error if busy
             // But actually, the generator might be waiting for input.
        }

        automationGenerator = runAutomation(payload, sendUpdate);
        const result = await automationGenerator.next();
        if (result.done) {
            automationGenerator = null;
        }
    } catch (e) {
        console.error('Automation error:', e);
        sendUpdate({ type: 'error', message: (e as Error).message });
    }
});

ipcMain.handle('captcha-solution', async (event, solution: string) => {
    if (automationGenerator) {
        const result = await automationGenerator.next(solution);
        if (result.done) {
            automationGenerator = null;
        }
    }
});

ipcMain.handle('stop-automation', async () => {
   if (automationGenerator) {
       await automationGenerator.return();
       automationGenerator = null;
   }
});
