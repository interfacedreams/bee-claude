import { useCallback, useEffect } from 'react'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import ChatNodeView from './ChatNodeView'
import BeeIcon from './BeeIcon'
import { useCanvasStore } from '../store/canvas'

const nodeTypes: NodeTypes = { chat: ChatNodeView }

function CanvasInner(): React.JSX.Element {
  const nodes = useCanvasStore((s) => s.nodes)
  const loaded = useCanvasStore((s) => s.loaded)
  const onNodesChange = useCanvasStore((s) => s.onNodesChange)
  const addNode = useCanvasStore((s) => s.addNode)
  const setStoreViewport = useCanvasStore((s) => s.setViewport)
  const load = useCanvasStore((s) => s.load)
  const { setViewport, getViewport, fitView } = useReactFlow()

  useEffect(() => {
    void load().then((vp) => {
      if (vp) void setViewport(vp)
    })
  }, [load, setViewport])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault()
        void fitView({ padding: 0.1, duration: 250 })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fitView])

  const handleAdd = useCallback(() => {
    const vp = getViewport()
    addNode({
      x: -vp.x / vp.zoom,
      y: -vp.y / vp.zoom,
      w: window.innerWidth / vp.zoom,
      h: window.innerHeight / vp.zoom
    })
  }, [addNode, getViewport])

  return (
    <div className="h-screen w-screen bg-[#FBFAF4]">
      {loaded && (
        <ReactFlow
          nodes={nodes}
          edges={[]}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          minZoom={0.05}
          maxZoom={2}
          panOnScroll
          zoomOnPinch
          deleteKeyCode={null}
          onMoveEnd={(_, vp) => setStoreViewport(vp)}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#E2DAC0" />
        </ReactFlow>
      )}

      <button
        type="button"
        onClick={handleAdd}
        className="fixed bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-[14px] border border-[#EDD27E] bg-[#FEF3C7] py-2 pr-4 pl-2 text-[14px] font-medium text-[#92690B] shadow-lg transition-colors hover:bg-[#FDE68A] active:scale-95"
      >
        <BeeIcon className="h-6 w-6" />
        New chat
      </button>
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
