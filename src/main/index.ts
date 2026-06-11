import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { promises as fs, readFileSync } from 'fs'
import { basename, join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { query } from '@anthropic-ai/claude-agent-sdk'
import icon from '../../resources/icon.png?asset'
import type {
  CanvasDoc,
  NoteDoc,
  NoteVersion,
  PermissionReply,
  PersistedMessage,
  RepoState,
  ThreadDoc,
  ThreadEvent,
  ThreadSendArgs
} from '../shared/types'

// The repo the canvas is rooted at: the agent's cwd and the home of
// .canvas/canvas.json. Chosen by the user and remembered across launches —
// null until a repo has been picked (the renderer shows a picker prompt).
let repoRoot: string | null = null

interface RepoSettings {
  current: string | null
  recents: string[]
}

const settingsFile = (): string => join(app.getPath('userData'), 'repos.json')

async function readSettings(): Promise<RepoSettings> {
  try {
    return JSON.parse(await fs.readFile(settingsFile(), 'utf8'))
  } catch {
    return { current: null, recents: [] }
  }
}

const canvasFileFor = (root: string): string => join(root, '.canvas', 'canvas.json')
const threadsDirFor = (root: string): string => join(root, '.canvas', 'threads')
const threadFileFor = (root: string, nodeId: string): string =>
  join(threadsDirFor(root), `${nodeId}.json`)
const notesDirFor = (root: string): string => join(root, '.canvas', 'notes')
const noteFileFor = (root: string, nodeId: string): string =>
  join(notesDirFor(root), `${nodeId}.md`)
const noteVersionsFileFor = (root: string, nodeId: string): string =>
  join(notesDirFor(root), `${nodeId}.versions.json`)

// Node ids come from the renderer over IPC — keep them path-segment safe.
const isSafeNodeId = (nodeId: string): boolean => /^[\w-]+$/.test(nodeId)

async function readTextIfExists(path: string): Promise<string> {
  try {
    return await fs.readFile(path, 'utf8')
  } catch {
    return ''
  }
}

async function readNoteVersions(root: string, nodeId: string): Promise<NoteVersion[]> {
  try {
    const doc: NoteDoc = JSON.parse(await fs.readFile(noteVersionsFileFor(root, nodeId), 'utf8'))
    return doc.versions
  } catch {
    return []
  }
}

async function writeNoteVersions(
  root: string,
  nodeId: string,
  versions: NoteVersion[]
): Promise<void> {
  await fs.mkdir(notesDirFor(root), { recursive: true })
  const doc: NoteDoc = { version: 1, versions }
  await fs.writeFile(noteVersionsFileFor(root, nodeId), JSON.stringify(doc, null, 2))
}

/**
 * Version boundary: snapshot the note's live content if it has drifted from
 * the latest version. Called with 'user' before an AI turn (so unversioned
 * user edits become their own version) and 'ai' after one.
 */
async function snapshotNote(
  root: string,
  nodeId: string,
  author: NoteVersion['author']
): Promise<NoteVersion[]> {
  const content = await readTextIfExists(noteFileFor(root, nodeId))
  const versions = await readNoteVersions(root, nodeId)
  const last = versions[versions.length - 1]
  const drifted = last ? last.content !== content : content !== ''
  if (drifted) {
    versions.push({ content, author, at: new Date().toISOString() })
    await writeNoteVersions(root, nodeId, versions)
  }
  return versions
}

async function dirExists(path: string): Promise<boolean> {
  try {
    return (await fs.stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function chatCountFor(root: string): Promise<number> {
  try {
    const doc: CanvasDoc = JSON.parse(await fs.readFile(canvasFileFor(root), 'utf8'))
    // A title marks a chat: it's stamped on the first send (and on fork).
    return doc.nodes.filter((n) => n.title).length
  } catch {
    return 0
  }
}

async function buildRepoState(): Promise<RepoState> {
  const settings = await readSettings()
  const recents: RepoState['recents'] = []
  for (const path of settings.recents) {
    if (!(await dirExists(path))) continue
    const chatCount = await chatCountFor(path)
    // Only repos you actually chatted in earn a recents slot (plus the open one).
    if (chatCount > 0 || path === repoRoot) {
      recents.push({ path, name: basename(path), chatCount })
    }
  }
  return { current: repoRoot, recents }
}

async function setCurrentRepo(root: string): Promise<RepoState> {
  repoRoot = root
  const settings = await readSettings()
  settings.current = root
  settings.recents = [root, ...settings.recents.filter((r) => r !== root)].slice(0, 20)
  await fs.writeFile(settingsFile(), JSON.stringify(settings, null, 2))
  return buildRepoState()
}

function registerRepoIpc(): void {
  ipcMain.handle('repo:get', () => buildRepoState())

  ipcMain.handle('repo:choose', async (event): Promise<RepoState | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = {
      title: 'Choose a repository',
      properties: ['openDirectory' as const, 'createDirectory' as const]
    }
    const res = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (res.canceled || res.filePaths.length === 0) return null
    return setCurrentRepo(res.filePaths[0])
  })

  ipcMain.handle('repo:select', async (_event, path: string): Promise<RepoState> => {
    if (await dirExists(path)) return setCurrentRepo(path)
    return buildRepoState() // gone from disk — the rebuilt state simply drops it
  })
}

// Minimal .env loader (ANTHROPIC_API_KEY etc.) — real values never leave the main
// process. Read from the app's own launch dir, independent of the chosen repo.
function loadDotEnv(): void {
  try {
    for (const line of readFileSync(join(process.cwd(), '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // no .env — fine if the key is already in the environment
  }
}

function registerThreadIpc(): void {
  // Permission requests in flight: requestId → resolver for the user's verdict.
  // canUseTool blocks the SDK turn until the renderer answers via thread:permission.
  const pendingPermissions = new Map<string, (allow: boolean) => void>()

  ipcMain.on('thread:permission', (_event, { requestId, allow }: PermissionReply) => {
    pendingPermissions.get(requestId)?.(allow)
  })

  // File-mutating tools a note session may only point at its own file.
  const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

  ipcMain.handle(
    'thread:send',
    async (event, { nodeId, text, sessionId, forkFrom, kind, noteTitle }: ThreadSendArgs) => {
      const wc = event.sender
      const emit = (payload: ThreadEvent): void => {
        if (!wc.isDestroyed()) wc.send('thread:event', payload)
      }

      const root = repoRoot
      if (!root) {
        emit({ nodeId, type: 'done', ok: false, error: 'No repository selected' })
        return
      }

      const notePath = kind === 'note' && isSafeNodeId(nodeId) ? noteFileFor(root, nodeId) : null
      if (kind === 'note' && !notePath) {
        emit({ nodeId, type: 'done', ok: false, error: 'Invalid note id' })
        return
      }

      try {
        if (notePath) {
          // The Edit tool needs a file to edit — make sure it exists.
          await fs.mkdir(notesDirFor(root), { recursive: true })
          try {
            await fs.access(notePath)
          } catch {
            await fs.writeFile(notePath, '')
          }
          // Unversioned user edits become their own version before the AI touches it.
          await snapshotNote(root, nodeId, 'user')
        }

        const prompt = notePath
          ? `You are connected to the markdown note "${noteTitle || 'Untitled'}" at ${notePath}. ` +
            `Apply the instruction below by editing that file directly — use the Edit tool ` +
            `(or Write if the file is empty). Never create or modify any other file. ` +
            `Keep your text reply to a sentence or two; the edits speak for themselves.` +
            `\n\nInstruction: ${text}`
          : text

        const turn = query({
          prompt,
          options: {
            cwd: root,
            resume: forkFrom?.sessionId ?? sessionId,
            // Forking resumes the parent transcript truncated at the anchor message
            // under a NEW session id. The prefix is byte-identical, so the first
            // forked turn rides the parent's prompt cache.
            ...(forkFrom ? { forkSession: true, resumeSessionAt: forkFrom.messageUuid } : {}),
            systemPrompt: { type: 'preset', preset: 'claude_code' },
            settingSources: ['project'], // required or CLAUDE.md is not loaded
            // Notes stay in default mode so every edit routes through canUseTool,
            // where it's checked against the note's own file.
            permissionMode: notePath ? 'default' : 'acceptEdits',
            includePartialMessages: true,
            // Tools outside acceptEdits' auto-approval (WebSearch, Bash, …) land
            // here. Without this callback the SDK silently auto-denies them.
            canUseTool: async (toolName, input, { signal, title }) => {
              if (notePath && EDIT_TOOLS.has(toolName)) {
                const target =
                  typeof input.file_path === 'string' ? resolve(root, input.file_path) : null
                return target === resolve(notePath)
                  ? { behavior: 'allow', updatedInput: input }
                  : {
                      behavior: 'deny',
                      message: `This session may only edit the note file at ${notePath}.`
                    }
              }
              const requestId = randomUUID()
              const allow = await new Promise<boolean>((resolveVerdict) => {
                if (wc.isDestroyed()) {
                  resolveVerdict(false)
                  return
                }
                pendingPermissions.set(requestId, resolveVerdict)
                signal.addEventListener('abort', () => resolveVerdict(false), { once: true })
                emit({
                  nodeId,
                  type: 'permission',
                  request: { requestId, toolName, ...(title ? { title } : {}), input }
                })
              })
              pendingPermissions.delete(requestId)
              emit({ nodeId, type: 'permission-resolved', requestId })
              return allow
                ? { behavior: 'allow', updatedInput: input }
                : { behavior: 'deny', message: 'The user declined this tool use.' }
            }
          }
        })

        // resumeSessionAt anchors on assistant-message uuids — remember the turn's last.
        let lastAssistantUuid: string | undefined
        // Last note content mirrored to the renderer — only emit real changes.
        let mirroredNote: string | undefined

        for await (const msg of turn) {
          if (msg.type === 'system' && msg.subtype === 'init') {
            emit({ nodeId, type: 'session', sessionId: msg.session_id })
          } else if (msg.type === 'user' && notePath) {
            // A tool just returned — if it changed the note, stream the fresh content.
            const content = await readTextIfExists(notePath)
            if (content !== mirroredNote) {
              mirroredNote = content
              emit({ nodeId, type: 'note-content', content })
            }
          } else if (msg.type === 'assistant' && msg.parent_tool_use_id === null) {
            lastAssistantUuid = msg.uuid
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
            const u = msg.usage
            console.log(
              `[turn] node=${nodeId.slice(0, 8)} session=${msg.session_id.slice(0, 8)}` +
                `${forkFrom ? ` fork-of=${forkFrom.sessionId.slice(0, 8)}@${forkFrom.messageUuid.slice(0, 8)}` : ''}` +
                ` in=${u.input_tokens} cache_read=${u.cache_read_input_tokens}` +
                ` cache_create=${u.cache_creation_input_tokens} out=${u.output_tokens}` +
                ` cost=$${msg.total_cost_usd.toFixed(4)}`
            )
            // The turn is the version boundary: however many edits it made, they
            // land as one snapshot.
            let note: { content: string; versions: NoteVersion[] } | undefined
            if (notePath) {
              const versions = await snapshotNote(root, nodeId, 'ai')
              note = { content: await readTextIfExists(notePath), versions }
            }
            emit({
              nodeId,
              type: 'done',
              ok: msg.subtype === 'success',
              ...(lastAssistantUuid ? { messageUuid: lastAssistantUuid } : {}),
              usage: {
                inputTokens: msg.usage.input_tokens,
                outputTokens: msg.usage.output_tokens,
                cacheReadTokens: msg.usage.cache_read_input_tokens,
                cacheCreationTokens: msg.usage.cache_creation_input_tokens,
                costUsd: msg.total_cost_usd
              },
              ...(note ? { note } : {}),
              ...(msg.subtype !== 'success' ? { error: msg.subtype } : {})
            })
          }
        }
      } catch (err) {
        // A turn that died mid-edit may have changed the note — version whatever
        // landed so nothing is silently lost.
        let note: { content: string; versions: NoteVersion[] } | undefined
        if (notePath) {
          try {
            const versions = await snapshotNote(root, nodeId, 'ai')
            note = { content: await readTextIfExists(notePath), versions }
          } catch {
            // report the original error regardless
          }
        }
        emit({ nodeId, type: 'done', ok: false, error: String(err), ...(note ? { note } : {}) })
      }
    }
  )
}

function registerNoteIpc(): void {
  // Autosave of the live note content (the renderer debounces keystrokes).
  ipcMain.handle('note:save', async (_event, nodeId: string, content: string): Promise<void> => {
    if (!repoRoot || !isSafeNodeId(nodeId)) return
    await fs.mkdir(notesDirFor(repoRoot), { recursive: true })
    await fs.writeFile(noteFileFor(repoRoot, nodeId), content)
  })

  // Make an old version the live content again. Unversioned edits are
  // snapshotted first, so restoring never destroys anything.
  ipcMain.handle(
    'note:restore',
    async (
      _event,
      nodeId: string,
      index: number
    ): Promise<{ content: string; versions: NoteVersion[] } | null> => {
      const root = repoRoot
      if (!root || !isSafeNodeId(nodeId)) return null
      const versions = await snapshotNote(root, nodeId, 'user')
      const target = versions[index]
      if (!target) return null
      await fs.writeFile(noteFileFor(root, nodeId), target.content)
      return { content: target.content, versions }
    }
  )

  ipcMain.handle('note:delete', async (_event, nodeId: string): Promise<void> => {
    if (!repoRoot || !isSafeNodeId(nodeId)) return
    for (const file of [noteFileFor(repoRoot, nodeId), noteVersionsFileFor(repoRoot, nodeId)]) {
      try {
        await fs.unlink(file)
      } catch {
        // never existed
      }
    }
  })
}

function registerCanvasIpc(): void {
  ipcMain.handle('canvas:load', async (): Promise<CanvasDoc | null> => {
    const root = repoRoot
    if (!root) return null
    try {
      const doc: CanvasDoc = JSON.parse(await fs.readFile(canvasFileFor(root), 'utf8'))
      // Transcripts and note contents live one file per node — rejoin them.
      await Promise.all(
        doc.nodes.map(async (node) => {
          if (!isSafeNodeId(node.id)) return
          if (node.kind === 'note') {
            node.content = await readTextIfExists(noteFileFor(root, node.id))
            node.noteVersions = await readNoteVersions(root, node.id)
            return
          }
          try {
            const thread: ThreadDoc = JSON.parse(
              await fs.readFile(threadFileFor(root, node.id), 'utf8')
            )
            node.messages = thread.messages
          } catch {
            // no transcript yet
          }
        })
      )
      return doc
    } catch {
      return null
    }
  })

  ipcMain.handle('canvas:save', async (_event, doc: CanvasDoc): Promise<void> => {
    if (!repoRoot) return
    const dir = join(repoRoot, '.canvas')
    await fs.mkdir(dir, { recursive: true })
    // Layout/metadata only — transcripts are written via canvas:saveThread.
    const slim = {
      ...doc,
      nodes: doc.nodes.map((node) => {
        const copy = { ...node }
        delete copy.messages
        return copy
      })
    }
    await fs.writeFile(join(dir, 'canvas.json'), JSON.stringify(slim, null, 2))
  })

  ipcMain.handle(
    'canvas:saveThread',
    async (_event, nodeId: string, messages: PersistedMessage[]): Promise<void> => {
      if (!repoRoot || !isSafeNodeId(nodeId)) return
      await fs.mkdir(threadsDirFor(repoRoot), { recursive: true })
      const thread: ThreadDoc = { version: 1, messages }
      await fs.writeFile(threadFileFor(repoRoot, nodeId), JSON.stringify(thread, null, 2))
    }
  )

  ipcMain.handle('canvas:deleteThread', async (_event, nodeId: string): Promise<void> => {
    if (!repoRoot || !isSafeNodeId(nodeId)) return
    try {
      await fs.unlink(threadFileFor(repoRoot, nodeId))
    } catch {
      // never had a transcript
    }
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
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  loadDotEnv()

  // Reopen the repo from last time if it still exists.
  const settings = await readSettings()
  if (settings.current && (await dirExists(settings.current))) repoRoot = settings.current

  registerCanvasIpc()
  registerNoteIpc()
  registerThreadIpc()
  registerRepoIpc()

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
