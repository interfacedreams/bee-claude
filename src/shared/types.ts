// Shared between main and renderer. Persistence shapes for .canvas/canvas.json
// and the thread IPC contract.

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

export interface PersistedNode {
  id: string
  position: { x: number; y: number }
  width: number
  height?: number // only set when the user resized; otherwise height tracks content
  title: string
  color?: string // palette id; omitted means the default (butter)
  messages?: PersistedMessage[]
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

// --- Thread IPC (renderer ⇄ main) ---

export interface ThreadSendArgs {
  nodeId: string
  text: string
  sessionId?: string
  /** Fork the parent session at this message instead of resuming `sessionId`. */
  forkFrom?: ForkRef
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
  | {
      nodeId: string
      type: 'done'
      ok: boolean
      error?: string
      messageUuid?: string // uuid of the turn's final assistant message (fork anchor)
      usage?: TurnUsage
    }
