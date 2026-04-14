import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import http from 'http';
import { runAutomation } from '../server/automation-worker';
import { fetchGoogleTrends, fetchAmazonCompetitors, fetchAmazonSuggestions } from '../server/market-research-worker';
import { KdpAutomationPayload, BotUpdate, ProxyProvider, ProxyAccount, ProxySettings } from '../types';

// ─── OAuth provider configurations ────────────────────────────────────────────
// Client IDs and secrets are loaded from environment variables at build time,
// or from a local config file at runtime. They are NOT committed to source.
//
// For Gemini CLI OAuth:
//   Set GEMINI_CLI_CLIENT_ID and GEMINI_CLI_CLIENT_SECRET in your .env file.
//   These can be obtained from the gemini-cli open-source project, or by
//   registering your own OAuth app at https://console.cloud.google.com.
//
// For Gemini Antigravity:
//   Set GEMINI_ANTIGRAVITY_CLIENT_ID and GEMINI_ANTIGRAVITY_CLIENT_SECRET.
//
// Users who don't configure these can still use manual API keys (Settings →
// API Keys tab) or the free Google Gemini fallback.

const OAUTH_CONFIGS: Record<ProxyProvider, {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  port: number;
  credDir: string;
  credFile: string;
} | null> = {
  'gemini-cli': process.env.GEMINI_CLI_CLIENT_ID ? {
    clientId: process.env.GEMINI_CLI_CLIENT_ID,
    clientSecret: process.env.GEMINI_CLI_CLIENT_SECRET || '',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    port: 8085,
    credDir: '.null-library/gemini-cli',
    credFile: 'oauth_creds.json',
  } : null,
  'gemini-antigravity': process.env.GEMINI_ANTIGRAVITY_CLIENT_ID ? {
    clientId: process.env.GEMINI_ANTIGRAVITY_CLIENT_ID,
    clientSecret: process.env.GEMINI_ANTIGRAVITY_CLIENT_SECRET || '',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    port: 8086,
    credDir: '.null-library/gemini-antigravity',
    credFile: 'oauth_creds.json',
  } : null,
  'claude-kiro': null,      // Kiro OAuth is more complex; handled via external browser
  'openai-codex': null,     // Codex OAuth via GitHub device flow
  'openai-qwen': null,      // Qwen browser login
  'openai-iflow': null,     // iFlow browser login
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // Package is absent outside packaged Windows installers — safe to ignore.
}

let mainWindow: BrowserWindow | null = null;
let automationGenerator: AsyncGenerator<void, void, string> | null = null;
// Track active OAuth callback servers keyed by provider
const oauthServers: Map<string, http.Server> = new Map();

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

  if (!app.isPackaged) {
      mainWindow!.webContents.openDevTools();
  }

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

// ─── Helper: get the app's credential storage directory ──────────────────────
function getCredStoreDir(): string {
  return path.join(app.getPath('userData'), 'null-library-credentials');
}

function getAccountCredPath(provider: ProxyProvider, accountId: string): string {
  return path.join(getCredStoreDir(), provider, `${accountId}.json`);
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

// ─── Helper: send OAuth status event to renderer ──────────────────────────────
function sendOAuthStatus(provider: ProxyProvider, phase: string, message: string, error?: string) {
  mainWindow?.webContents.send('oauth-status', { provider, phase, message, error });
}

// ─── IPC HANDLERS ─────────────────────────────────────────────────────────────

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

// ─── MARKET RESEARCH HANDLERS ──────────────────────────────────────────────────

ipcMain.handle('market-research:trends', async (_, keyword: string) => {
    return await fetchGoogleTrends(keyword);
});

ipcMain.handle('market-research:competitors', async (_, keyword: string) => {
    return await fetchAmazonCompetitors(keyword);
});

// ─── FILE SYSTEM HANDLERS ──────────────────────────────────────────────────────

ipcMain.handle('save-file', async (event, data: string, filename: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Project',
        defaultPath: filename,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    
    if (canceled || !filePath) return { success: false };
    
    try {
        await fs.writeFile(filePath, data, 'utf-8');
        return { success: true, filePath };
    } catch (e) {
        console.error('Failed to save file:', e);
        return { success: false, error: (e as Error).message };
    }
});

ipcMain.handle('load-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Load Project',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile']
    });
    
    if (canceled || filePaths.length === 0) return { success: false };
    
    try {
        const data = await fs.readFile(filePaths[0], 'utf-8');
        return { success: true, data };
    } catch (e) {
        console.error('Failed to load file:', e);
        return { success: false, error: (e as Error).message };
    }
});

// ─── NULLPROXY OAUTH HANDLERS ──────────────────────────────────────────────────

/**
 * Start an OAuth login flow for a Google-based provider.
 * Opens a local callback server, then opens the browser to the auth URL.
 */
ipcMain.handle('oauth:start', async (event, provider: ProxyProvider) => {
    const config = OAUTH_CONFIGS[provider];
    if (!config) {
        return { success: false, error: `OAuth not configured for provider: ${provider}` };
    }

    // Close any existing server for this provider
    const existing = oauthServers.get(provider);
    if (existing) {
        existing.close();
        oauthServers.delete(provider);
    }

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
        const redirectUri = `http://localhost:${config.port}/callback`;

        sendOAuthStatus(provider, 'starting', `Starting OAuth flow for ${provider}…`);

        // Build auth URL
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: config.scope,
            access_type: 'offline',
            prompt: 'consent',
        });
        const authUrl = `${config.authUrl}?${params.toString()}`;

        // Start local callback server
        const server = http.createServer(async (req, res) => {
            if (!req.url?.startsWith('/callback')) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }

            const url = new URL(req.url, `http://localhost:${config.port}`);
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');

            if (error || !code) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(buildCallbackPage(false, `Auth failed: ${error ?? 'No code received'}`, provider));
                sendOAuthStatus(provider, 'error', `OAuth cancelled or failed: ${error ?? 'No code'}`);
                server.close();
                oauthServers.delete(provider);
                resolve({ success: false, error: error ?? 'No code received' });
                return;
            }

            sendOAuthStatus(provider, 'callback-received', 'Login successful! Saving credentials…');

            try {
                // Exchange code for tokens
                const tokenRes = await fetch(config.tokenUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        code,
                        client_id: config.clientId,
                        client_secret: config.clientSecret,
                        redirect_uri: redirectUri,
                        grant_type: 'authorization_code',
                    }).toString(),
                });

                if (!tokenRes.ok) {
                    const err = await tokenRes.text();
                    throw new Error(`Token exchange failed: ${err}`);
                }

                const tokens = await tokenRes.json() as {
                    access_token: string;
                    refresh_token?: string;
                    expires_in: number;
                    token_type: string;
                };

                // Generate a deterministic account ID from the first part of the token
                const accountId = `${provider}-${Date.now()}`;
                const credPath = getAccountCredPath(provider, accountId);
                await ensureDir(path.dirname(credPath));

                const credData = {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expiry_date: Date.now() + (tokens.expires_in * 1000),
                    token_type: tokens.token_type,
                    accountId,
                    provider,
                    createdAt: new Date().toISOString(),
                };
                await fs.writeFile(credPath, JSON.stringify(credData, null, 2), 'utf-8');

                sendOAuthStatus(provider, 'saving', 'Credentials saved.');
                sendOAuthStatus(provider, 'done', `Connected to ${provider} successfully!`);

                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(buildCallbackPage(true, `Connected to ${provider}!`, provider));

                // Update the main proxy accounts list
                await updateProxyAccountsList(provider, accountId, credPath);

                server.close();
                oauthServers.delete(provider);
                resolve({ success: true });

            } catch (e) {
                const errMsg = (e as Error).message;
                sendOAuthStatus(provider, 'error', `Failed to save credentials: ${errMsg}`, errMsg);
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(buildCallbackPage(false, errMsg, provider));
                server.close();
                oauthServers.delete(provider);
                resolve({ success: false, error: errMsg });
            }
        });

        server.listen(config.port, () => {
            oauthServers.set(provider, server);
            sendOAuthStatus(provider, 'waiting-for-browser', 'Browser opened — please log in…');
            shell.openExternal(authUrl).catch((e) => {
                console.error('Failed to open browser:', e);
                server.close();
                oauthServers.delete(provider);
                resolve({ success: false, error: 'Could not open browser' });
            });
        });

        server.on('error', (e) => {
            sendOAuthStatus(provider, 'error', `Server error: ${e.message}`, e.message);
            resolve({ success: false, error: e.message });
        });
    });
});

ipcMain.handle('oauth:cancel', async (_, provider: ProxyProvider) => {
    const server = oauthServers.get(provider);
    if (server) {
        server.close();
        oauthServers.delete(provider);
    }
    sendOAuthStatus(provider, 'error', 'OAuth flow cancelled by user.');
});

// ─── NULLPROXY STATUS & MANAGEMENT HANDLERS ────────────────────────────────────

ipcMain.handle('proxy:getStatus', async () => {
    try {
        const settings = await loadProxySettingsFromDisk();
        return settings.accounts ?? [];
    } catch {
        return [];
    }
});

ipcMain.handle('proxy:addAccount', async (_, provider: ProxyProvider) => {
    // Alias for oauth:start — triggered from UI "Add Account" button
    return ipcMain.emit('oauth:start', provider);
});

ipcMain.handle('proxy:removeAccount', async (_, accountId: string) => {
    const settings = await loadProxySettingsFromDisk();
    settings.accounts = (settings.accounts ?? []).filter((a: ProxyAccount) => a.id !== accountId);
    await saveProxySettingsToDisk(settings);

    // Also remove the credential file
    const credStoreDir = getCredStoreDir();
    try {
        const files = await fs.readdir(credStoreDir, { recursive: true, withFileTypes: true } as any);
        for (const f of files as any[]) {
            if (f.name === `${accountId}.json`) {
                await fs.unlink(path.join(f.path ?? f.parentPath, f.name)).catch(() => {});
            }
        }
    } catch {
        // best-effort
    }
});

ipcMain.handle('proxy:getSettings', async () => {
    return loadProxySettingsFromDisk();
});

ipcMain.handle('proxy:saveSettings', async (_, settings: ProxySettings) => {
    await saveProxySettingsToDisk(settings);
});

ipcMain.handle('proxy:getCredPath', async (_, provider: ProxyProvider, accountId: string) => {
    const p = getAccountCredPath(provider, accountId);
    try {
        await fs.access(p);
        return p;
    } catch {
        return null;
    }
});

ipcMain.handle('proxy:readCredFile', async (_, filePath: string) => {
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch {
        return null;
    }
});

// ─── Proxy settings persistence (main process) ───────────────────────────────

const PROXY_SETTINGS_FILE = () => path.join(app.getPath('userData'), 'null-library-proxy-settings.json');

async function loadProxySettingsFromDisk(): Promise<ProxySettings> {
    try {
        const data = await fs.readFile(PROXY_SETTINGS_FILE(), 'utf-8');
        return JSON.parse(data) as ProxySettings;
    } catch {
        return {
            enabled: true,
            roundRobinEnabled: true,
            providerPriority: ['gemini-cli', 'gemini-antigravity', 'claude-kiro', 'openai-codex', 'openai-qwen', 'openai-iflow'],
            taskRouting: {
                'creative-writing':  ['gemini-cli', 'gemini-antigravity', 'openai-codex'],
                'market-research':   ['gemini-cli', 'gemini-antigravity', 'claude-kiro'],
                'marketing-copy':    ['claude-kiro', 'openai-codex', 'gemini-cli'],
                'image-prompt':      ['gemini-cli', 'gemini-antigravity'],
                'critique':          ['claude-kiro', 'gemini-cli', 'openai-codex'],
                'general':           ['gemini-cli', 'gemini-antigravity', 'claude-kiro', 'openai-codex'],
            },
            failsafeEnabled: true,
            accounts: [],
        };
    }
}

async function saveProxySettingsToDisk(settings: ProxySettings): Promise<void> {
    const filePath = PROXY_SETTINGS_FILE();
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}

async function updateProxyAccountsList(provider: ProxyProvider, accountId: string, credPath: string): Promise<void> {
    const settings = await loadProxySettingsFromDisk();
    const newAccount: ProxyAccount = {
        id: accountId,
        provider,
        isHealthy: true,
        isDisabled: false,
        lastUsed: Date.now(),
        usageCount: 0,
        errorCount: 0,
    };
    const existing = (settings.accounts ?? []).findIndex((a: ProxyAccount) => a.id === accountId);
    if (existing >= 0) {
        settings.accounts[existing] = newAccount;
    } else {
        settings.accounts = [...(settings.accounts ?? []), newAccount];
    }
    await saveProxySettingsToDisk(settings);
    // Notify renderer that accounts changed
    mainWindow?.webContents.send('proxy-accounts-updated', settings.accounts);
}

// ─── HTML page shown in browser after OAuth callback ─────────────────────────
function buildCallbackPage(isSuccess: boolean, message: string, provider: string): string {
    const title = isSuccess ? '✅ Connected!' : '❌ Connection Failed';
    const bgColor = isSuccess ? '#0f172a' : '#1a0a0a';
    const borderColor = isSuccess ? '#6d28d9' : '#dc2626';
    const textColor = isSuccess ? '#a78bfa' : '#f87171';
    const instruction = isSuccess
        ? 'You can close this tab and return to Null Library.'
        : 'Please close this tab and try again in Null Library.';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
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
  <div class="logo">${isSuccess ? '📚' : '⚠️'}</div>
  <h1>${title}</h1>
  <p><strong style="color:#e2e8f0">${provider}</strong></p>
  <p>${message}</p>
  <p style="margin-top:1.5rem;font-size:.85rem;color:#64748b">${instruction}</p>
</div>
<script>
  setTimeout(() => { try { window.close(); } catch(e) {} }, 3000);
</script>
</body>
</html>`;
}




