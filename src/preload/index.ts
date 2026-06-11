import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  CanvasDoc,
  NoteVersion,
  PermissionReply,
  PersistedMessage,
  RepoState,
  ThreadEvent,
  ThreadSendArgs
} from '../shared/types'

// Custom APIs for renderer
const api = {
  repo: {
    get: (): Promise<RepoState> => ipcRenderer.invoke('repo:get'),
    choose: (): Promise<RepoState | null> => ipcRenderer.invoke('repo:choose'),
    select: (path: string): Promise<RepoState> => ipcRenderer.invoke('repo:select', path)
  },
  canvas: {
    load: (): Promise<CanvasDoc | null> => ipcRenderer.invoke('canvas:load'),
    save: (doc: CanvasDoc): Promise<void> => ipcRenderer.invoke('canvas:save', doc),
    saveThread: (nodeId: string, messages: PersistedMessage[]): Promise<void> =>
      ipcRenderer.invoke('canvas:saveThread', nodeId, messages),
    deleteThread: (nodeId: string): Promise<void> =>
      ipcRenderer.invoke('canvas:deleteThread', nodeId)
  },
  note: {
    save: (nodeId: string, content: string): Promise<void> =>
      ipcRenderer.invoke('note:save', nodeId, content),
    restore: (
      nodeId: string,
      index: number
    ): Promise<{ content: string; versions: NoteVersion[] } | null> =>
      ipcRenderer.invoke('note:restore', nodeId, index),
    delete: (nodeId: string): Promise<void> => ipcRenderer.invoke('note:delete', nodeId)
  },
  thread: {
    send: (args: ThreadSendArgs): Promise<void> => ipcRenderer.invoke('thread:send', args),
    respondPermission: (reply: PermissionReply): void => {
      ipcRenderer.send('thread:permission', reply)
    },
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
