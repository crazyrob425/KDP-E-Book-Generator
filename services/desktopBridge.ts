import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { BotUpdate, GoogleTrendsData, KdpAutomationPayload } from '../types';

type SaveResult = { success: boolean; filePath?: string; error?: string };
type LoadResult = { success: boolean; data?: string; error?: string };

export interface DesktopBridge {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;

  startAutomation: (payload: KdpAutomationPayload) => Promise<void>;
  submitCaptcha: (solution: string) => Promise<void>;
  stopAutomation: () => Promise<void>;
  onAutomationUpdate: (callback: (update: BotUpdate) => void) => () => void;

  saveFile: (data: string, filename: string) => Promise<SaveResult>;
  loadFile: () => Promise<LoadResult>;

  fetchGoogleTrends: (keyword: string) => Promise<GoogleTrendsData | null>;
  fetchAmazonCompetitors: (keyword: string) => Promise<any[]>;
  fetchAmazonSuggestions: (keyword: string) => Promise<string[]>;
}

const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI;
const isTauri = () => typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

const browserBridge: DesktopBridge = {
  minimize: async () => {},
  maximize: async () => {},
  close: async () => {},

  startAutomation: async () => {
    throw new Error('Automation is only available in desktop runtime.');
  },
  submitCaptcha: async () => {
    throw new Error('Automation is only available in desktop runtime.');
  },
  stopAutomation: async () => {},
  onAutomationUpdate: () => () => {},

  saveFile: async () => ({ success: false, error: 'Desktop file system integration unavailable.' }),
  loadFile: async () => ({ success: false, error: 'Desktop file system integration unavailable.' }),

  fetchGoogleTrends: async () => null,
  fetchAmazonCompetitors: async () => [],
  fetchAmazonSuggestions: async () => [],
};

const electronBridge: DesktopBridge = {
  minimize: async () => window.electronAPI?.minimize?.(),
  maximize: async () => window.electronAPI?.maximize?.(),
  close: async () => window.electronAPI?.close?.(),

  startAutomation: async (payload) => window.electronAPI?.startAutomation?.(payload),
  submitCaptcha: async (solution) => window.electronAPI?.submitCaptcha?.(solution),
  stopAutomation: async () => window.electronAPI?.stopAutomation?.(),
  onAutomationUpdate: (callback) => window.electronAPI?.onAutomationUpdate?.(callback) || (() => {}),

  saveFile: async (data, filename) => window.electronAPI?.saveFile?.(data, filename) || { success: false },
  loadFile: async () => window.electronAPI?.loadFile?.() || { success: false },

  fetchGoogleTrends: async (keyword) => window.electronAPI?.fetchGoogleTrends?.(keyword) || null,
  fetchAmazonCompetitors: async (keyword) => window.electronAPI?.fetchAmazonCompetitors?.(keyword) || [],
  fetchAmazonSuggestions: async (keyword) => window.electronAPI?.fetchAmazonSuggestions?.(keyword) || [],
};

const tauriBridge: DesktopBridge = {
  minimize: async () => {
    await invoke('window_control', { action: 'minimize' });
  },
  maximize: async () => {
    await invoke('window_control', { action: 'maximize' });
  },
  close: async () => {
    await invoke('window_control', { action: 'close' });
  },

  startAutomation: async (payload) => {
    await invoke('start_automation', { payload });
  },
  submitCaptcha: async (solution) => {
    await invoke('captcha_solution', { solution });
  },
  stopAutomation: async () => {
    await invoke('stop_automation');
  },
  onAutomationUpdate: (callback) => {
    const unlistenPromise = listen<BotUpdate>('automation-update', (event) => callback(event.payload));
    return () => {
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  },

  saveFile: async (data, filename) => {
    const filePath = await save({
      title: 'Save Project',
      defaultPath: filename,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    if (!filePath) return { success: false };
    await writeTextFile(filePath, data);
    return { success: true, filePath };
  },
  loadFile: async () => {
    const filePath = await open({
      title: 'Load Project',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      multiple: false,
      directory: false,
    });
    if (!filePath || Array.isArray(filePath)) return { success: false };
    const data = await readTextFile(filePath);
    return { success: true, data };
  },

  fetchGoogleTrends: async (keyword) => {
    try {
      return await invoke<GoogleTrendsData | null>('fetch_google_trends', { keyword });
    } catch {
      return null;
    }
  },
  fetchAmazonCompetitors: async (keyword) => {
    try {
      return await invoke<any[]>('fetch_amazon_competitors', { keyword });
    } catch {
      return [];
    }
  },
  fetchAmazonSuggestions: async (keyword) => {
    try {
      return await invoke<string[]>('fetch_amazon_suggestions', { keyword });
    } catch {
      return [];
    }
  },
};

const desktopBridge: DesktopBridge = isElectron() ? electronBridge : isTauri() ? tauriBridge : browserBridge;

export default desktopBridge;
