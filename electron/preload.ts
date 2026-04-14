import { contextBridge, ipcRenderer } from 'electron';
import { KdpAutomationPayload, BotUpdate, ProxyProvider, ProxyAccount, ProxySettings, OAuthFlowStatus } from '../types';

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window-control', 'minimize'),
  maximize: () => ipcRenderer.invoke('window-control', 'maximize'),
  close: () => ipcRenderer.invoke('window-control', 'close'),
  
  startAutomation: (payload: KdpAutomationPayload) => ipcRenderer.invoke('start-automation', payload),
  submitCaptcha: (solution: string) => ipcRenderer.invoke('captcha-solution', solution),
  stopAutomation: () => ipcRenderer.invoke('stop-automation'),
  
  saveFile: (data: string, filename: string) => ipcRenderer.invoke('save-file', data, filename),
  loadFile: () => ipcRenderer.invoke('load-file'),
  
  onAutomationUpdate: (callback: (update: BotUpdate) => void) => {
      const subscription = (_event: any, value: BotUpdate) => callback(value);
      ipcRenderer.on('automation-update', subscription);
      return () => {
          ipcRenderer.removeListener('automation-update', subscription);
      }
  },

  fetchGoogleTrends: (keyword: string) => ipcRenderer.invoke('market-research:trends', keyword),
  fetchAmazonCompetitors: (keyword: string) => ipcRenderer.invoke('market-research:competitors', keyword),
  fetchAmazonSuggestions: (keyword: string) => ipcRenderer.invoke('market-research:suggestions', keyword),

  // ── NullProxy OAuth ──
  oauthStart: (provider: ProxyProvider) => ipcRenderer.invoke('oauth:start', provider),
  oauthCancel: (provider: ProxyProvider) => ipcRenderer.invoke('oauth:cancel', provider),
  onOAuthStatus: (callback: (status: OAuthFlowStatus) => void) => {
    const subscription = (_event: any, value: OAuthFlowStatus) => callback(value);
    ipcRenderer.on('oauth-status', subscription);
    return () => {
      ipcRenderer.removeListener('oauth-status', subscription);
    };
  },

  // ── NullProxy Proxy Operations ──
  proxyGetStatus: (): Promise<ProxyAccount[]> => ipcRenderer.invoke('proxy:getStatus'),
  proxyAddAccount: (provider: ProxyProvider) => ipcRenderer.invoke('proxy:addAccount', provider),
  proxyRemoveAccount: (accountId: string) => ipcRenderer.invoke('proxy:removeAccount', accountId),
  proxyGetSettings: (): Promise<ProxySettings | null> => ipcRenderer.invoke('proxy:getSettings'),
  proxySaveSettings: (settings: ProxySettings) => ipcRenderer.invoke('proxy:saveSettings', settings),
  proxyGetCredPath: (provider: ProxyProvider, accountId: string) =>
    ipcRenderer.invoke('proxy:getCredPath', provider, accountId),
  readCredFile: (filePath: string) => ipcRenderer.invoke('proxy:readCredFile', filePath),

  // Subscribe to proxy accounts being updated (after an OAuth login)
  onProxyAccountsUpdated: (callback: (accounts: ProxyAccount[]) => void) => {
    const subscription = (_event: any, value: ProxyAccount[]) => callback(value);
    ipcRenderer.on('proxy-accounts-updated', subscription);
    return () => {
      ipcRenderer.removeListener('proxy-accounts-updated', subscription);
    };
  },
});

