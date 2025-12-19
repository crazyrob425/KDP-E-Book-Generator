import { contextBridge, ipcRenderer } from 'electron';
import { KdpAutomationPayload, BotUpdate } from '../types';

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window-control', 'minimize'),
  maximize: () => ipcRenderer.invoke('window-control', 'maximize'),
  close: () => ipcRenderer.invoke('window-control', 'close'),
  
  startAutomation: (payload: KdpAutomationPayload) => ipcRenderer.invoke('start-automation', payload),
  submitCaptcha: (solution: string) => ipcRenderer.invoke('captcha-solution', solution),
  stopAutomation: () => ipcRenderer.invoke('stop-automation'),
  
  onAutomationUpdate: (callback: (update: BotUpdate) => void) => {
      const subscription = (_event: any, value: BotUpdate) => callback(value);
      ipcRenderer.on('automation-update', subscription);
      return () => {
          ipcRenderer.removeListener('automation-update', subscription);
      }
  }
});
