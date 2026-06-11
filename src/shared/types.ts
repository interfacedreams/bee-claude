// Shared between main and renderer. Persistence shapes for .canvas/
// (canvas.json holds layout/metadata; threads/<nodeId>.json holds each
// node's transcript) and the thread IPC contract.

export interface RepoInfo {
  path: string
  name: string
  chatCount: number
}

export interface RepoState {
  current: string | null
  recents: RepoInfo[] // repos with at least one chat (plus the current one), most recent first
}

export interface PersistedMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  uuid?: string // SDK assistant-message uuid — the fork anchor (resumeSessionAt)
}

/** A fork that hasn't materialized yet — applied on the node's first send. */
export interface ForkRef {
  sessionId: string
  messageUuid: string
}

export type NodeKind = 'chat' | 'note'

/** One snapshot in a note's history. A version boundary is the end of an AI
 *  turn — or the start of one, capturing the user's unversioned edits first. */
export interface NoteVersion {
  content: string
  author: 'user' | 'ai'
  at: string // ISO timestamp
}

/** A note's version history — .canvas/notes/<nodeId>.versions.json.
 *  The live content is the .md file next to it. */
export interface NoteDoc {
  version: 1
  versions: NoteVersion[]
}

export interface PersistedNode {
  id: string
  kind?: NodeKind // omitted means 'chat' (canvases that predate notes)
  position: { x: number; y: number }
  width: number
  height?: number // only set when the user resized; otherwise height tracks content
  title: string
  color?: string // palette id; omitted means the default (butter)
  // Hydrated from .canvas/threads/<nodeId>.json on load; never written
  // into canvas.json (saved separately so layout saves stay cheap).
  messages?: PersistedMessage[]
  // Hydrated from .canvas/notes/<nodeId>.{md,versions.json} on load; never
  // written into canvas.json.
  content?: string
  noteVersions?: NoteVersion[]
  minimized?: boolean
  sessionId?: string
  forkOf?: ForkRef
}

export interface PersistedEdge {
  id: string
  source: string
  target: string
  sourceMessageId: string
}

export interface CanvasDoc {
  version: 1
  nodes: PersistedNode[]
  edges: PersistedEdge[]
  viewport: { x: number; y: number; zoom: number }
}

/** One node's transcript — .canvas/threads/<nodeId>.json. */
export interface ThreadDoc {
  version: 1
  messages: PersistedMessage[]
}

// --- Thread IPC (renderer ⇄ main) ---

export interface ThreadSendArgs {
  nodeId: string
  text: string
  sessionId?: string
  /** Fork the parent session at this message instead of resuming `sessionId`. */
  forkFrom?: ForkRef
  /** 'note' runs an editing turn against .canvas/notes/<nodeId>.md instead of a chat. */
  kind?: NodeKind
  /** The note's title, woven into the editing prompt. */
  noteTitle?: string
}

/** A tool call waiting on the user's Allow/Deny (SDK canUseTool round-trip). */
export interface PermissionRequest {
  requestId: string
  toolName: string
  /** SDK-rendered prompt sentence (e.g. "Claude wants to search the web for …"). */
  title?: string
  input: Record<string, unknown>
}

export interface PermissionReply {
  requestId: string
  allow: boolean
}

/** Per-turn token/cost accounting from the SDK result message. */
export interface TurnUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  costUsd: number
}

export type ThreadEvent =
  | { nodeId: string; type: 'session'; sessionId: string }
  | { nodeId: string; type: 'delta'; text: string }
  | { nodeId: string; type: 'permission'; request: PermissionRequest }
  // The request settled (user clicked, or the turn was aborted) — dismiss the prompt.
  | { nodeId: string; type: 'permission-resolved'; requestId: string }
  // Note turns: the agent's edit landed on disk — mirror the fresh content live.
  | { nodeId: string; type: 'note-content'; content: string }
  | {
      nodeId: string
      type: 'done'
      ok: boolean
      error?: string
      messageUuid?: string // uuid of the turn's final assistant message (fork anchor)
      usage?: TurnUsage
      /** Note turns: final content + history after the turn's version snapshot. */
      note?: { content: string; versions: NoteVersion[] }
    }
