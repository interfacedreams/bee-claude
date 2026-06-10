import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CanvasDoc } from '../shared/types'

// Custom APIs for renderer
const api = {
  canvas: {
    load: (): Promise<CanvasDoc | null> => ipcRenderer.invoke('canvas:load'),
    save: (doc: CanvasDoc): Promise<void> => ipcRenderer.invoke('canvas:save', doc)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type Api = typeof api
