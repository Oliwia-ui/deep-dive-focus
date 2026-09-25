import { contextBridge, ipcRenderer } from 'electron'
import type { AppState, DeepDiveApi, SessionKind } from '../shared/types'

const api: DeepDiveApi = {
  loadState: () => ipcRenderer.invoke('state:load') as Promise<AppState>,
  saveState: (state) => ipcRenderer.invoke('state:save', state) as Promise<void>,
  selectVault: () => ipcRenderer.invoke('vault:select') as Promise<string | null>,
  appendLogEvent: (vaultPath, event) => ipcRenderer.invoke('vault:append-event', vaultPath, event),
  notifySurface: (activity: string, kind: SessionKind) =>
    ipcRenderer.invoke('notification:surface', activity, kind) as Promise<void>,
  getAppInfo: () => ipcRenderer.invoke('app:info')
}

contextBridge.exposeInMainWorld('deepDive', api)
