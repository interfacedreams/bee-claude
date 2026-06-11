import { useCallback, useEffect } from 'react'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import ChatNodeView from './ChatNodeView'
import ForkEdge from './ForkEdge'
import BeeIcon from './BeeIcon'
import RepoChip from './RepoChip'
import DeleteChatModal from './DeleteChatModal'
import { useCanvasStore, NODE_W } from '../store/canvas'
import { paletteFor } from '../lib/palette'

const nodeTypes: NodeTypes = { chat: ChatNodeView }
const edgeTypes: EdgeTypes = { fork: ForkEdge }

function CanvasInner(): React.JSX.Element {
  const nodes = useCanvasStore((s) => s.nodes)
  const storeEdges = useCanvasStore((s) => s.edges)
  const loaded = useCanvasStore((s) => s.loaded)
  const repo = useCanvasStore((s) => s.repo)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  const addNode = useCanvasStore((s) => s.addNode)
  const addNodeAt = useCanvasStore((s) => s.addNodeAt)
  const setStoreViewport = useCanvasStore((s) => s.setViewport)
  const init = useCanvasStore((s) => s.init)
  const chooseRepo = useCanvasStore((s) => s.chooseRepo)
  const { setViewport, getViewport, fitView, setCenter, screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    void init().then((vp) => {
      if (vp) void setViewport(vp)
    })
  }, [init, setViewport])

  const handleChooseRepo = useCallback(async () => {
    const vp = await chooseRepo()
    if (vp) void setViewport(vp)
  }, [chooseRepo, setViewport])

  // ⌘N: spawn a chat at a free spot near the view, then center the camera on it —
  // the empty composer autofocuses, so it's type-ready as soon as it lands.
  const handleNewChat = useCallback(() => {
    if (!useCanvasStore.getState().repo?.current) return
    const vp = getViewport()
    const node = addNode({
      x: -vp.x / vp.zoom,
      y: -vp.y / vp.zoom,
      w: window.innerWidth / vp.zoom,
      h: window.innerHeight / vp.zoom
    })
    // If zoomed way out, come in to a readable zoom; otherwise stay put.
    const zoom = Math.max(vp.zoom, 1)
    void setCenter(node.position.x + NODE_W / 2, node.position.y + 150, { zoom, duration: 250 })
  }, [addNode, getViewport, setCenter])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '0') {
        e.preventDefault()
        void fitView({ padding: 0.1, duration: 250 })
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handleNewChat()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fitView, handleNewChat])

  // Double-click on empty canvas: spawn a chat right there, under the cursor.
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!(e.target as HTMLElement).classList.contains('react-flow__pane')) return
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addNodeAt({ x: p.x - NODE_W / 2, y: p.y - 24 })
    },
    [addNodeAt, screenToFlowPosition]
  )

  return (
    <div className="h-screen w-screen bg-[#FBFAF4]">
      {loaded && (
        <ReactFlow
          nodes={nodes}
          edges={storeEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'fork',
            data: { sourceMessageId: e.sourceMessageId },
            // fork connectors take the parent chat's accent color
            style: {
              stroke: paletteFor(nodes.find((n) => n.id === e.source)?.data.color).accent,
              strokeWidth: 3
            },
            focusable: false,
            selectable: false
          }))}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesConnectable={false}
          minZoom={0.05}
          maxZoom={2}
          panOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          onMoveEnd={(_, vp) => setStoreViewport(vp)}
          onDoubleClick={handleDoubleClick}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#E2DAC0" />
        </ReactFlow>
      )}

      {repo && !repo.current && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4">
          <BeeIcon className="h-16 w-16" />
          <p className="text-[15px] text-[#92690B]">Pick a repository to start a canvas</p>
          <button
            type="button"
            onClick={() => void handleChooseRepo()}
            className="cursor-pointer rounded-[14px] border border-[#EDD27E] bg-[#FEF3C7] px-4 py-2 text-[14px] font-medium text-[#92690B] shadow-lg transition-colors hover:bg-[#FDE68A] active:scale-95"
          >
            Open repo…
          </button>
        </div>
      )}

      <RepoChip />
      <DeleteChatModal />
    </div>
  )
}

export default function Canvas(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}
