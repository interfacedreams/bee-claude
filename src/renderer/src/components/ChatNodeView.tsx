import { memo, useCallback, useEffect, useRef } from 'react'
import {
  Handle,
  NodeResizeControl,
  Position,
  ResizeControlVariant,
  useReactFlow,
  useStoreApi,
  type NodeProps
} from '@xyflow/react'
import TextareaAutosize from 'react-textarea-autosize'
import Markdown from 'react-markdown'
import { Expand, GitFork, Minus, ShieldQuestion, Trash2 } from 'lucide-react'
import type { PermissionRequest } from '../../../shared/types'
import { useCanvasStore, MAX_NODE_H, type ChatNode, type Message } from '../store/canvas'
import { paletteFor } from '../lib/palette'
import BeeIcon from './BeeIcon'

function MessageView({
  message,
  pending
}: {
  message: Message
  pending?: boolean
}): React.JSX.Element {
  if (message.role === 'user') {
    return (
      <div
        data-msg={message.id}
        className="mr-1 mb-2 ml-auto w-fit max-w-full rounded-[10px] bg-white/85 px-3 py-2 break-words whitespace-pre-wrap"
      >
        {message.text}
      </div>
    )
  }
  if (pending && !message.text) {
    return (
      <div
        data-msg={message.id}
        className="mb-2 animate-pulse px-3 py-1 tracking-widest text-neutral-400"
      >
        ●●●
      </div>
    )
  }
  return (
    <div data-msg={message.id} className="prose-chat mb-2 px-3 py-1">
      <Markdown>{message.text}</Markdown>
    </div>
  )
}

/** The most telling detail of a tool input — the query/command/url, not raw JSON. */
function permissionDetail(input: Record<string, unknown>): string {
  const detail = input.query ?? input.command ?? input.url ?? input.file_path ?? input.prompt
  const text = typeof detail === 'string' ? detail : JSON.stringify(input)
  return text.length > 200 ? `${text.slice(0, 200)}…` : text
}

function PermissionPrompt({
  request,
  onRespond
}: {
  request: PermissionRequest
  onRespond: (allow: boolean) => void
}): React.JSX.Element {
  const detail = permissionDetail(request.input)
  return (
    <div className="nodrag mx-1 mt-2 shrink-0 cursor-auto rounded-[10px] border border-(--np-edge) bg-white/85 px-3 py-2 text-[14px]">
      <div className="flex items-center gap-2 font-medium text-neutral-800">
        <ShieldQuestion className="h-4 w-4 shrink-0 text-(--np-deep)" />
        <span className="min-w-0 break-words">{request.title ?? `Allow ${request.toolName}?`}</span>
      </div>
      {detail && detail !== '{}' && (
        <div className="mt-1 line-clamp-3 font-mono text-[12px] break-all text-neutral-500">
          {detail}
        </div>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onRespond(false)}
          className="cursor-pointer rounded-md px-3 py-1 text-neutral-500 transition-colors hover:bg-neutral-100"
        >
          Deny
        </button>
        <button
          type="button"
          onClick={() => onRespond(true)}
          className="cursor-pointer rounded-md bg-(--np-accent) px-3 py-1 font-medium text-white transition-colors hover:opacity-85"
        >
          Allow
        </button>
      </div>
    </div>
  )
}

// Every header chip button (minimize/expand/fork/delete) shares this shape:
// rounded square, icon centered, palette chip fill that darkens to accent on hover.
const CHIP_BUTTON =
  'nodrag flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md bg-(--np-chip) text-(--np-deep) transition-colors hover:bg-(--np-accent)'

// React Flow's default handle is a visible 6px dot — these are layout anchors only.
const HIDDEN_HANDLE: React.CSSProperties = {
  opacity: 0,
  pointerEvents: 'none',
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 'none',
  background: 'transparent'
}

function ChatNodeView({ id, data, selected }: NodeProps<ChatNode>): React.JSX.Element {
  const setDraft = useCanvasStore((s) => s.setDraft)
  const send = useCanvasStore((s) => s.send)
  const respondPermission = useCanvasStore((s) => s.respondPermission)
  const forkChat = useCanvasStore((s) => s.forkChat)
  const requestDelete = useCanvasStore((s) => s.requestDelete)
  const discardNode = useCanvasStore((s) => s.discardNode)
  const toggleMinimize = useCanvasStore((s) => s.toggleMinimize)
  const clearFocusDraft = useCanvasStore((s) => s.clearFocusDraft)
  // Explicit height only (user resize / restored from disk) — React Flow's own
  // `height` prop reports the *measured* height, which would pin the node at
  // whatever size it currently is and stop it from growing with new content.
  const explicitHeight = useCanvasStore((s) => s.nodes.find((n) => n.id === id)?.height)
  const { fitView } = useReactFlow()

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  // Follow new content only while the user is at (or near) the bottom,
  // so scrolling up to read history never gets yanked back down.
  const stickToBottom = useRef(true)
  const streaming = data.status === 'streaming'
  const empty = data.messages.length === 0
  // Fork-ahead: forkable once the chat has a tip (a completed assistant reply).
  const canFork = !streaming && data.messages.some((m) => m.role === 'assistant' && m.uuid)

  const palette = paletteFor(data.color)

  // Fork edges attach to their anchor message, so measure where those messages
  // sit inside this node (flow px from the node top, clamped into the node so a
  // scrolled-away anchor degrades to the node edge instead of floating outside).
  const flowStore = useStoreApi()
  const setAnchorOffsets = useCanvasStore((s) => s.setAnchorOffsets)
  const anchorKey = useCanvasStore((s) =>
    s.edges
      .filter((e) => e.source === id)
      .map((e) => e.sourceMessageId)
      .join(',')
  )
  const measureAnchors = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const offsets: Record<string, number> = {}
    if (anchorKey) {
      const zoom = flowStore.getState().transform[2]
      const rootRect = root.getBoundingClientRect()
      const headerH = 28 // keep endpoints below the title row
      const maxY = Math.max(headerH, rootRect.height / zoom - 12)
      for (const messageId of anchorKey.split(',')) {
        const el = root.querySelector(`[data-msg="${messageId}"]`)
        if (!el) continue
        const r = el.getBoundingClientRect()
        const center = (r.top + r.height / 2 - rootRect.top) / zoom
        offsets[messageId] = Math.min(Math.max(center, headerH), maxY)
      }
    }
    setAnchorOffsets(id, offsets)
  }, [anchorKey, flowStore, id, setAnchorOffsets])
  // Re-measure after every commit: messages stream in, nodes resize, forks come
  // and go — setAnchorOffsets no-ops when nothing moved.
  useEffect(measureAnchors)

  // Refocus the composer the moment the assistant finishes in this node —
  // unless the user has moved on to typing somewhere else (don't steal focus).
  const wasStreaming = useRef(streaming)
  useEffect(() => {
    if (wasStreaming.current && !streaming) {
      const active = document.activeElement
      const typingElsewhere =
        active instanceof HTMLElement &&
        active !== textareaRef.current &&
        (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)
      if (!typingElsewhere) textareaRef.current?.focus()
    }
    wasStreaming.current = streaming
  }, [streaming])

  // Spawned via ⌘N / double-click / fork: pull the keyboard into this composer,
  // even if another chat's composer currently has focus. A fresh node mounts
  // `visibility: hidden` until React Flow measures it, and focus() on a hidden
  // element is silently ignored — so retry every frame until focus sticks, and
  // only then consume the focusDraft flag.
  useEffect(() => {
    if (!data.focusDraft) return
    let raf = 0
    const tryFocus = (): void => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      if (document.activeElement === el) clearFocusDraft(id)
      else raf = requestAnimationFrame(tryFocus)
    }
    tryFocus()
    return () => cancelAnimationFrame(raf)
  }, [data.focusDraft, clearFocusDraft, id])

  // Arrive at the latest messages: jump to the bottom on mount.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  // The transcript is `nowheel` (plain scroll stays inside it), but two cases
  // must still reach React Flow: ⌘/ctrl+scroll and pinch (canvas zoom), and any
  // scroll the transcript can't absorb — no overflow, or already at the edge —
  // which pans the canvas so an off-screen node bottom can be scrolled into view.
  const lastInnerWheelAt = useRef(0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const forwardToPane = (e: WheelEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const pane = el.closest('.react-flow')?.querySelector('.react-flow__pane')
      pane?.dispatchEvent(
        new WheelEvent('wheel', {
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaMode: e.deltaMode,
          clientX: e.clientX,
          clientY: e.clientY,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          bubbles: true,
          cancelable: true
        })
      )
    }
    // True if something between the wheel target and the transcript (e.g. an
    // overflowing code block) can still scroll horizontally in this direction.
    const childCanScrollX = (e: WheelEvent): boolean => {
      let node = e.target instanceof HTMLElement ? e.target : null
      while (node && node !== el) {
        const { overflowX } = getComputedStyle(node)
        if (
          (overflowX === 'auto' || overflowX === 'scroll') &&
          node.scrollWidth > node.clientWidth + 1 &&
          (e.deltaX > 0
            ? node.scrollLeft + node.clientWidth < node.scrollWidth - 1
            : node.scrollLeft > 0)
        ) {
          return true
        }
        node = node.parentElement
      }
      return false
    }
    const onWheel = (e: WheelEvent): void => {
      if (e.metaKey || e.ctrlKey) {
        forwardToPane(e)
        return
      }
      // Any upward wheel during streaming releases the auto-follow immediately.
      if (e.deltaY < 0) stickToBottom.current = false
      // Mostly-horizontal: scroll an overflowing code block if one is under the
      // cursor, otherwise pan the canvas — a sideways trackpad pan shouldn't die
      // just because it drifted over a chat.
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) {
        if (!childCanScrollX(e)) forwardToPane(e)
        return
      }
      const canScroll = el.scrollHeight - el.clientHeight > 1
      const atEdge =
        e.deltaY < 0 ? el.scrollTop <= 0 : el.scrollHeight - el.scrollTop - el.clientHeight <= 1
      if (canScroll && !atEdge) {
        lastInnerWheelAt.current = performance.now()
        return
      }
      // At an edge, a fling that just landed here shouldn't slingshot into a
      // canvas pan — only chain once the gesture that hit the edge has died down.
      if (canScroll && performance.now() - lastInnerWheelAt.current < 200) return
      forwardToPane(e)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [empty])

  const handleScroll = (): void => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 8) stickToBottom.current = true
    else if (distanceFromBottom > 48) stickToBottom.current = false
    measureAnchors() // anchor messages move with the transcript
  }
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [data.messages])

  const canSend = !streaming && data.draft.trim().length > 0

  const expandAndCenter = (): void => {
    const fit = (): void => {
      void fitView({ nodes: [{ id }], duration: 300, padding: 0.1, maxZoom: 1 })
    }
    if (data.minimized) {
      toggleMinimize(id)
      // let React Flow re-measure the expanded node before fitting to it
      setTimeout(fit, 50)
    } else {
      fit()
    }
  }

  return (
    <div
      ref={rootRef}
      style={
        {
          // the growth cap only limits auto-sizing; an explicit (user-resized) height wins
          maxHeight: explicitHeight ?? data.growthCap ?? MAX_NODE_H,
          backgroundColor: `${palette.bg}D9`, // body fill at 85%
          '--np-bg': palette.bg,
          '--np-edge': palette.edge,
          '--np-chip': `${palette.edge}99`, // chip buttons at 60%
          '--np-accent': palette.accent,
          '--np-deep': palette.deep,
          '--np-ring': `${palette.accent}B3` // selection ring at 70%
        } as React.CSSProperties
      }
      className={`drag-handle flex h-full w-full cursor-grab flex-col rounded-[14px] border border-black/5 shadow-md active:cursor-grabbing ${
        selected ? 'ring-2 ring-(--np-ring)' : ''
      }`}
    >
      {/* invisible anchors so fork edges have somewhere to attach */}
      <Handle type="target" position={Position.Left} isConnectable={false} style={HIDDEN_HANDLE} />
      <Handle type="source" position={Position.Right} isConnectable={false} style={HIDDEN_HANDLE} />

      {!data.minimized && (
        <>
          <NodeResizeControl
            position="right"
            variant={ResizeControlVariant.Line}
            minWidth={360}
            minHeight={140}
            maxHeight={1280}
            style={{ borderColor: 'transparent', borderWidth: 5 }}
          />
          <NodeResizeControl
            position="bottom"
            variant={ResizeControlVariant.Line}
            minWidth={360}
            minHeight={140}
            maxHeight={1280}
            style={{ borderColor: 'transparent', borderWidth: 5 }}
          />
          <NodeResizeControl
            position="bottom-right"
            minWidth={360}
            minHeight={140}
            maxHeight={1280}
            style={{
              background: 'transparent',
              border: 'none',
              width: 16,
              height: 16,
              cursor: 'nwse-resize'
            }}
          />
        </>
      )}

      <div
        className={`flex shrink-0 items-center gap-2 px-2 py-1 ${
          data.minimized ? '' : 'border-b border-(--np-edge)'
        }`}
      >
        {!data.minimized && (
          <button
            type="button"
            onClick={() => toggleMinimize(id)}
            title="Minimize"
            className={CHIP_BUTTON}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={expandAndCenter}
          title={data.minimized ? 'Expand' : 'Zoom to fit'}
          className={CHIP_BUTTON}
        >
          <Expand className="h-3.5 w-3.5" />
        </button>
        <span
          className={`truncate text-[13px] font-medium text-(--np-deep) ${data.title ? '' : 'opacity-50'}`}
        >
          {data.title || 'New chat'}
        </span>
        <div className="nodrag relative ml-auto flex shrink-0 items-center gap-1">
          {canFork && (
            <button
              type="button"
              onClick={() => forkChat(id)}
              title="Fork this chat from its latest message"
              className={CHIP_BUTTON}
            >
              <GitFork className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => requestDelete(id)}
            title="Delete this chat"
            className={CHIP_BUTTON}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!data.minimized && empty && <div className="min-h-0 flex-1" />}

      {!data.minimized && !empty && (
        <div className="nodrag mx-1 mt-3 flex min-h-0 flex-1 cursor-auto flex-col overflow-hidden">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="nowheel select-text transcript-scroll min-h-0 flex-1 overflow-y-auto pb-1 text-[16px] leading-relaxed text-neutral-900"
          >
            {data.messages.map((m, i) => (
              <MessageView
                key={m.id}
                message={m}
                pending={streaming && i === data.messages.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {!data.minimized && data.pendingPermission && (
        <PermissionPrompt
          request={data.pendingPermission}
          onRespond={(allow) => respondPermission(id, data.pendingPermission!.requestId, allow)}
        />
      )}

      {!data.minimized && (
        <div className="nodrag mx-1 mt-2 mb-1 shrink-0 cursor-auto rounded-[10px] bg-white/85 text-[16px]">
          <TextareaAutosize
            ref={textareaRef}
            autoFocus={data.status === 'empty' || data.focusDraft === true}
            value={data.draft}
            minRows={1}
            placeholder={empty ? 'Ask anything…' : 'Reply…'}
            onChange={(e) => setDraft(id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canSend) send(id)
              } else if (e.key === 'Escape' && empty && !data.draft) {
                discardNode(id)
              }
            }}
            className="block w-full resize-none bg-transparent px-3 py-2 outline-none placeholder:text-neutral-400"
          />
          <div className="flex items-center justify-end px-2 pb-1.5">
            <button
              type="button"
              onClick={() => send(id)}
              disabled={!canSend}
              title={streaming ? 'Waiting for the assistant to finish' : 'Send (Enter)'}
              className="transition-all hover:scale-110 active:scale-95 disabled:opacity-30"
            >
              <BeeIcon className="h-7 w-7" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(ChatNodeView)
