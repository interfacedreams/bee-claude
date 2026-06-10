import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { promises as fs, readFileSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { query } from '@anthropic-ai/claude-agent-sdk'
import icon from '../../resources/icon.png?asset'
import type { CanvasDoc } from '../shared/types'

// M1: the canvas is rooted at the dev repo (cwd). Repo picker comes later (RepoService).
const repoRoot = process.cwd()
const canvasDir = join(repoRoot, '.canvas')
const canvasFile = join(canvasDir, 'canvas.json')

// Minimal .env loader (ANTHROPIC_API_KEY etc.) — real values never leave the main process.
function loadDotEnv(): void {
  try {
    for (const line of readFileSync(join(repoRoot, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // no .env — fine if the key is already in the environment
  }
}

interface ThreadSendArgs {
  nodeId: string
  text: string
  sessionId?: string
}

type ThreadEvent =
  | { nodeId: string; type: 'session'; sessionId: string }
  | { nodeId: string; type: 'delta'; text: string }
  | { nodeId: string; type: 'done'; ok: boolean; error?: string }

function registerThreadIpc(): void {
  ipcMain.handle('thread:send', async (event, { nodeId, text, sessionId }: ThreadSendArgs) => {
    const wc = event.sender
    const emit = (payload: ThreadEvent): void => {
      if (!wc.isDestroyed()) wc.send('thread:event', payload)
    }

    try {
      const turn = query({
        prompt: text,
        options: {
          cwd: repoRoot,
          resume: sessionId,
          systemPrompt: { type: 'preset', preset: 'claude_code' },
          settingSources: ['project'], // required or CLAUDE.md is not loaded
          permissionMode: 'acceptEdits',
          includePartialMessages: true
        }
      })

      for await (const msg of turn) {
        if (msg.type === 'system' && msg.subtype === 'init') {
          emit({ nodeId, type: 'session', sessionId: msg.session_id })
        } else if (msg.type === 'stream_event') {
          const ev = msg.event
          if (
            ev.type === 'content_block_delta' &&
            ev.delta.type === 'text_delta' &&
            msg.parent_tool_use_id === null
          ) {
            emit({ nodeId, type: 'delta', text: ev.delta.text })
          }
        } else if (msg.type === 'result') {
          emit({
            nodeId,
            type: 'done',
            ok: msg.subtype === 'success',
            ...(msg.subtype !== 'success' ? { error: msg.subtype } : {})
          })
        }
      }
    } catch (err) {
      emit({ nodeId, type: 'done', ok: false, error: String(err) })
    }
  })
}

function registerCanvasIpc(): void {
  ipcMain.handle('canvas:load', async (): Promise<CanvasDoc | null> => {
    try {
      return JSON.parse(await fs.readFile(canvasFile, 'utf8'))
    } catch {
      return null
    }
  })

  ipcMain.handle('canvas:save', async (_event, doc: CanvasDoc): Promise<void> => {
    await fs.mkdir(canvasDir, { recursive: true })
    await fs.writeFile(canvasFile, JSON.stringify(doc, null, 2))
  })
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  loadDotEnv()
  registerCanvasIpc()
  registerThreadIpc()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
