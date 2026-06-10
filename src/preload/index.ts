import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CanvasDoc } from '../shared/types'

export interface ThreadEvent {
  nodeId: string
  type: 'session' | 'delta' | 'done'
  sessionId?: string
  text?: string
  ok?: boolean
  error?: string
}

// Custom APIs for renderer
const api = {
  canvas: {
    load: (): Promise<CanvasDoc | null> => ipcRenderer.invoke('canvas:load'),
    save: (doc: CanvasDoc): Promise<void> => ipcRenderer.invoke('canvas:save', doc)
  },
  thread: {
    send: (args: { nodeId: string; text: string; sessionId?: string }): Promise<void> =>
      ipcRenderer.invoke('thread:send', args),
    onEvent: (cb: (event: ThreadEvent) => void): void => {
      ipcRenderer.on('thread:event', (_e, payload: ThreadEvent) => cb(payload))
    }
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
