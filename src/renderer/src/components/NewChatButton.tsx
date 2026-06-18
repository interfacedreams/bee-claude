import { useCanvasStore } from '../store/canvas'

// The keycap badge, identical to the Actions legend (ActionsLegend.tsx): a pale
// chip on the dark button showing the bare-letter shortcut.
const KEYCAP =
  'flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-neutral-300 bg-neutral-100 px-1 text-[11px] font-semibold text-black shadow-[0_1.5px_0_#d4d4d4]'

// Revealed just to the right of a resource's caret knob once that knob is armed
// (ctxConnectSource === id). It's the "make a new one" path: while armed you can
// click an existing chat to wire into it (ContextConnectOverlay), or click this
// to spawn a fresh chat already carrying this resource as context. Styled as the
// armed Actions-legend row (solid black, white label + keycap) but compact —
// just a small gap between label and keycap instead of the legend's full-width
// justify-between.
export default function NewChatButton({ id }: { id: string }): React.JSX.Element {
  const armContextChat = useCanvasStore((s) => s.armContextChat)
  const setCtxConnectSource = useCanvasStore((s) => s.setCtxConnectSource)

  return (
    <button
      type="button"
      title="Click the canvas to place — Esc cancels"
      onClick={(e) => {
        // swallow the tap so the connect overlay's window listener doesn't read
        // it as a cancel, then hand off from tap-to-connect to chat placement
        e.stopPropagation()
        setCtxConnectSource(null)
        armContextChat(id)
      }}
      className="nodrag absolute z-10 flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-[7px] bg-black px-2.5 py-[7px] text-[13px] font-medium text-white shadow-lg transition-colors hover:bg-neutral-800"
      // anchored to the node's right edge, clearing the knob (~37px out) plus a
      // small gap, and vertically centered on the knob (the node's mid-height)
      style={{ left: 'calc(100% + 44px)', top: '50%', transform: 'translateY(-50%)' }}
    >
      <span>New Chat</span>
      <span className={KEYCAP}>C</span>
    </button>
  )
}
