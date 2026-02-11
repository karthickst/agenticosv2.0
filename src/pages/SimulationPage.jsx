import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery.js'
import { getRequirements, getTestCases, getDomains } from '../db/database.js'
import { useStore } from '../store/useStore.js'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  MarkerType, Panel
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { GitBranch, RefreshCw, Download } from 'lucide-react'

// Build flow nodes/edges from requirements
function buildFlow(requirements, testCases, domains) {
  const nodes = []
  const edges = []

  // Start node
  nodes.push({
    id: 'start',
    type: 'input',
    data: { label: '▶ Start' },
    position: { x: 400, y: 20 },
    style: { background: '#4f46e5', color: '#fff', border: '1px solid #6366f1', borderRadius: 10, fontSize: 12, fontWeight: 600, padding: '6px 14px' }
  })

  const statusColors = {
    draft:    { bg: '#1f2937', border: '#374151', text: '#9ca3af' },
    review:   { bg: '#1c1a00', border: '#854d0e', text: '#fbbf24' },
    approved: { bg: '#052e16', border: '#166534', text: '#4ade80' },
    rejected: { bg: '#2d0a0a', border: '#7f1d1d', text: '#f87171' },
  }

  const COLS = 3
  const COL_W = 300
  const ROW_H = 180
  let prevId = 'start'

  requirements.forEach((req, idx) => {
    const col = idx % COLS
    const row = Math.floor(idx / COLS)
    const x = 100 + col * COL_W
    const y = 100 + row * ROW_H

    const colors = statusColors[req.status] || statusColors.draft
    const reqTCs = testCases?.filter(tc => tc.requirementId === req.id) || []

    const givenLines = (req.gherkin?.given || []).slice(0, 2).map(s => `Given ${s}`).join('\n')
    const whenLines = (req.gherkin?.when || []).slice(0, 1).map(s => `When ${s}`).join('\n')
    const thenLines = (req.gherkin?.then || []).slice(0, 1).map(s => `Then ${s}`).join('\n')
    const preview = [givenLines, whenLines, thenLines].filter(Boolean).join('\n')

    nodes.push({
      id: `req-${req.id}`,
      data: {
        label: (
          <div className="text-left">
            <div className="font-semibold mb-1" style={{ color: colors.text }}>{req.title}</div>
            {preview && <div className="text-[10px] opacity-70 whitespace-pre-wrap font-mono">{preview}</div>}
            <div className="mt-1 flex gap-1 flex-wrap">
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#1e293b', color: '#64748b' }}>
                {req.status}
              </span>
              {reqTCs.length > 0 && (
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#1e1b4b', color: '#818cf8' }}>
                  {reqTCs.length} tests
                </span>
              )}
            </div>
          </div>
        )
      },
      position: { x, y },
      style: {
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        fontSize: 11,
        padding: '10px 12px',
        minWidth: 220,
        maxWidth: 260,
      }
    })

    // Connect from start (or previous) to first req in each column
    if (col === 0) {
      edges.push({
        id: `e-${prevId}-req-${req.id}`,
        source: row === 0 ? 'start' : `req-${requirements[(row - 1) * COLS].id}`,
        target: `req-${req.id}`,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#4f46e5' },
        style: { stroke: '#4f46e5', strokeWidth: 1.5 },
        animated: req.status === 'approved'
      })
    } else {
      edges.push({
        id: `e-req-${requirements[idx - 1]?.id}-req-${req.id}`,
        source: `req-${requirements[idx - 1].id}`,
        target: `req-${req.id}`,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#374151' },
        style: { stroke: '#374151', strokeWidth: 1 },
      })
    }

    // Test case nodes
    reqTCs.slice(0, 2).forEach((tc, tIdx) => {
      const tcId = `tc-${tc.id}`
      const tcColors = { pass: '#052e16', fail: '#2d0a0a', pending: '#1f2937', skipped: '#1c1a00' }
      const tcBorder = { pass: '#166534', fail: '#7f1d1d', pending: '#374151', skipped: '#854d0e' }
      nodes.push({
        id: tcId,
        data: { label: <div className="text-xs">{tc.name.slice(0, 30)}</div> },
        position: { x: x + 10 + tIdx * 120, y: y + 130 },
        style: {
          background: tcColors[tc.status] || tcColors.pending,
          border: `1px solid ${tcBorder[tc.status] || tcBorder.pending}`,
          borderRadius: 8,
          fontSize: 10,
          padding: '4px 8px',
          minWidth: 100,
        }
      })
      edges.push({
        id: `e-req-${req.id}-${tcId}`,
        source: `req-${req.id}`,
        target: tcId,
        type: 'straight',
        style: { stroke: '#374151', strokeWidth: 1, strokeDasharray: '4 2' },
      })
    })
  })

  // Domain nodes in a separate lane
  domains?.forEach((domain, i) => {
    const x = 80 + i * 200
    const y = requirements.length > 0 ? Math.ceil(requirements.length / COLS) * ROW_H + 160 : 200
    nodes.push({
      id: `domain-${domain.id}`,
      data: {
        label: (
          <div>
            <div className="font-semibold text-blue-300">{domain.name}</div>
            <div className="text-[10px] text-gray-500">{domain.attributes?.length || 0} attrs</div>
          </div>
        )
      },
      position: { x, y },
      style: {
        background: '#0c1a2e',
        border: '1px solid #1e3a5f',
        borderRadius: 10,
        fontSize: 11,
        padding: '8px 12px',
        minWidth: 130,
      }
    })
  })

  return { nodes, edges }
}

export default function SimulationPage() {
  const { activeProjectId } = useStore()
  const requirements = useLiveQuery(
    () => activeProjectId ? getRequirements(activeProjectId) : Promise.resolve([]),
    [activeProjectId]
  )
  const testCases = useLiveQuery(
    () => activeProjectId ? getTestCases(activeProjectId) : Promise.resolve([]),
    [activeProjectId]
  )
  const domains = useLiveQuery(
    () => activeProjectId ? getDomains(activeProjectId) : Promise.resolve([]),
    [activeProjectId]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [refreshKey, setRefreshKey] = useState(0)

  const onConnect = useCallback((params) => setEdges(e => addEdge(params, e)), [setEdges])

  // Build flow when data changes
  useEffect(() => {
    if (requirements !== undefined) {
      const { nodes: n, edges: e } = buildFlow(requirements || [], testCases || [], domains || [])
      setNodes(n)
      setEdges(e)
    }
  }, [requirements, testCases, domains, refreshKey])

  const handleRefresh = () => setRefreshKey(k => k + 1)

  const isEmpty = !requirements?.length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Visual Simulation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Interactive flow diagram of your requirements and test cases</p>
        </div>
        <button className="btn-secondary" onClick={handleRefresh}>
          <RefreshCw size={14} /> Refresh Layout
        </button>
      </div>

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
            <GitBranch size={28} className="text-gray-500" />
          </div>
          <h3 className="text-gray-300 font-medium mb-1">No requirements to visualize</h3>
          <p className="text-sm text-gray-500">Add requirements to see the interactive flow diagram</p>
        </div>
      ) : (
        <div className="flex-1" style={{ background: '#0a0a0f' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            attributionPosition="bottom-right"
          >
            <Background color="#1f2937" gap={20} size={1} />
            <Controls className="!bg-gray-900 !border-gray-700" />
            <MiniMap
              className="!bg-gray-900 !border-gray-700"
              nodeColor={n => n.style?.background || '#1f2937'}
              maskColor="rgba(0,0,0,0.7)"
            />
            <Panel position="top-left" className="text-xs text-gray-600 bg-gray-900/80 border border-gray-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-600 inline-block" /> Requirement</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-900 border border-green-800 inline-block" /> Approved</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-900 border border-yellow-700 inline-block" /> Review</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-900 border border-blue-800 inline-block" /> Domain</span>
              </div>
            </Panel>
          </ReactFlow>
        </div>
      )}
    </div>
  )
}
