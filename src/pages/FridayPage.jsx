import React, { useState, useRef, useCallback } from 'react'
import {
  LayoutGrid, Plus, Trash2, GripVertical, ChevronDown,
  Circle, CheckCircle2, Clock, AlertCircle, XCircle,
  Flag, MoreHorizontal, X, FileText, Layers, Table2,
  User, CalendarDays, MessageSquare, CheckCheck, Ban, TrendingUp
} from 'lucide-react'
import { useLiveQuery } from '../hooks/useLiveQuery.js'
import {
  getProjects, getRequirements,
  getFridayItems, createFridayItem, updateFridayItem,
  moveFridayItem, deleteFridayItem,
  getTrackerItems, createTrackerItem, updateTrackerItem, deleteTrackerItem,
} from '../db/database.js'
import { useStore } from '../store/useStore.js'
import Modal from '../components/Modal.jsx'

// ─── Constants ────────────────────────────────────────────────────────────────
const SWIMLANES = [
  { id: 'backlog',   label: 'Backlog',    color: 'bg-gray-500',   border: 'border-gray-500',   text: 'text-gray-400',   ring: 'ring-gray-500',  headerBg: 'bg-gray-800/60' },
  { id: 'this_week', label: 'This Week',  color: 'bg-blue-500',   border: 'border-blue-500',   text: 'text-blue-400',   ring: 'ring-blue-500',  headerBg: 'bg-blue-950/60' },
  { id: 'next_week', label: 'Next Week',  color: 'bg-violet-500', border: 'border-violet-500', text: 'text-violet-400', ring: 'ring-violet-500',headerBg: 'bg-violet-950/60' },
  { id: 'done',      label: 'Done',       color: 'bg-emerald-500',border: 'border-emerald-500',text: 'text-emerald-400',ring: 'ring-emerald-500',headerBg: 'bg-emerald-950/60' },
]

const PRIORITIES = [
  { id: 'critical', label: 'Critical', color: 'bg-red-500',    text: 'text-red-400',    dot: 'bg-red-500' },
  { id: 'high',     label: 'High',     color: 'bg-orange-500', text: 'text-orange-400', dot: 'bg-orange-500' },
  { id: 'medium',   label: 'Medium',   color: 'bg-yellow-500', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  { id: 'low',      label: 'Low',      color: 'bg-blue-500',   text: 'text-blue-400',   dot: 'bg-sky-400' },
]

const STATUSES = [
  { id: 'todo',        label: 'To Do',      icon: Circle,       color: 'text-gray-400' },
  { id: 'in_progress', label: 'In Progress',icon: Clock,        color: 'text-blue-400' },
  { id: 'review',      label: 'In Review',  icon: AlertCircle,  color: 'text-yellow-400' },
  { id: 'blocked',     label: 'Blocked',    icon: XCircle,      color: 'text-red-400' },
  { id: 'done',        label: 'Done',       icon: CheckCircle2, color: 'text-emerald-400' },
]

const getPriority   = (id) => PRIORITIES.find(p => p.id === id) || PRIORITIES[2]
const getStatus     = (id) => STATUSES.find(s => s.id === id)   || STATUSES[0]
const getSwimlane   = (id) => SWIMLANES.find(s => s.id === id)  || SWIMLANES[0]

const TRACKER_STATUSES = [
  { id: 'on_track', label: 'On Track', icon: TrendingUp,   bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  { id: 'blocked',  label: 'Blocked',  icon: Ban,          bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30',     dot: 'bg-red-500' },
  { id: 'done',     label: 'Done',     icon: CheckCheck,   bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/30',    dot: 'bg-blue-500' },
]
const getTrackerStatus = (id) => TRACKER_STATUSES.find(s => s.id === id) || TRACKER_STATUSES[0]

// ─── Item Card ────────────────────────────────────────────────────────────────
function ItemCard({ item, onMove, onDelete, onEdit, isDragging, onDragStart, onDragEnd }) {
  const priority = getPriority(item.priority)
  const status   = getStatus(item.status)
  const StatusIcon = status.icon
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative bg-gray-900 border border-gray-800 rounded-xl p-3 cursor-grab active:cursor-grabbing
        hover:border-gray-700 transition-all duration-150 select-none
        ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}`}
    >
      {/* Priority stripe on left */}
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${priority.color}`} />

      <div className="pl-3">
        {/* Title row */}
        <div className="flex items-start gap-2">
          <GripVertical size={13} className="flex-shrink-0 mt-0.5 text-gray-700 group-hover:text-gray-500 transition-colors" />
          <p className="flex-1 text-sm text-gray-200 leading-snug font-medium min-w-0 break-words">
            {item.title}
          </p>
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-0.5 rounded text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-20 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 text-xs">
                <button
                  className="w-full px-3 py-1.5 text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                  onClick={() => { onEdit(item); setMenuOpen(false) }}
                >
                  Edit item
                </button>
                <div className="border-t border-gray-700 my-1" />
                {SWIMLANES.filter(s => s.id !== item.swimlane).map(s => (
                  <button
                    key={s.id}
                    className="w-full px-3 py-1.5 text-left text-gray-400 hover:bg-gray-700 flex items-center gap-2"
                    onClick={() => { onMove(item, s.id); setMenuOpen(false) }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                    Move to {s.label}
                  </button>
                ))}
                <div className="border-t border-gray-700 my-1" />
                <button
                  className="w-full px-3 py-1.5 text-left text-red-400 hover:bg-red-900/20 flex items-center gap-2"
                  onClick={() => { onDelete(item.id); setMenuOpen(false) }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {item.notes && (
          <p className="mt-1 text-xs text-gray-500 line-clamp-2 pl-5">{item.notes}</p>
        )}

        {/* Footer chips */}
        <div className="flex items-center gap-2 mt-2 pl-5">
          <span className={`flex items-center gap-1 text-[10px] font-medium ${status.color}`}>
            <StatusIcon size={10} />
            {status.label}
          </span>
          <span className="text-gray-700">·</span>
          <span className={`flex items-center gap-1 text-[10px] font-medium ${priority.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
            {priority.label}
          </span>
          {item.requirementId && (
            <>
              <span className="text-gray-700">·</span>
              <span className="flex items-center gap-1 text-[10px] text-gray-600">
                <FileText size={9} /> Req
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Swimlane Column ──────────────────────────────────────────────────────────
function SwimLane({ lane, items, onAddItem, onMove, onDelete, onEdit, dragState, onDragStart, onDragEnd, onDragOver, onDrop }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className="flex flex-col min-w-[280px] w-[280px] flex-shrink-0"
      onDragOver={e => { e.preventDefault(); onDragOver(lane.id) }}
      onDrop={() => onDrop(lane.id)}
    >
      {/* Column Header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 ${lane.headerBg} border ${lane.border} border-opacity-30`}>
        <button onClick={() => setCollapsed(v => !v)} className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-sm ${lane.color} flex-shrink-0`} />
          <span className={`text-sm font-semibold ${lane.text} truncate`}>{lane.label}</span>
          <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-md ${lane.text} bg-black/20`}>
            {items.length}
          </span>
          <ChevronDown
            size={13}
            className={`flex-shrink-0 ${lane.text} transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>
        <button
          onClick={() => onAddItem(lane.id)}
          className={`flex-shrink-0 p-1 rounded-lg hover:bg-black/20 ${lane.text} transition-colors`}
          title={`Add to ${lane.label}`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Cards */}
      {!collapsed && (
        <div
          className={`flex flex-col gap-2 flex-1 min-h-[120px] px-0.5 rounded-xl transition-colors duration-150
            ${dragState.overLane === lane.id && dragState.draggingId ? 'bg-gray-800/40 ring-1 ring-inset ' + lane.ring : ''}`}
        >
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onMove={onMove}
              onDelete={onDelete}
              onEdit={onEdit}
              isDragging={dragState.draggingId === item.id}
              onDragStart={() => onDragStart(item)}
              onDragEnd={onDragEnd}
            />
          ))}
          {items.length === 0 && (
            <div
              className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-gray-800 text-gray-700 text-xs cursor-pointer hover:border-gray-700 hover:text-gray-600 transition-colors"
              onClick={() => onAddItem(lane.id)}
            >
              <Plus size={16} className="mb-1" />
              Add item
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add Item Modal ───────────────────────────────────────────────────────────
function AddItemModal({ open, onClose, onSave, defaultLane, requirements, existingItemReqIds }) {
  const [title, setTitle]           = useState('')
  const [notes, setNotes]           = useState('')
  const [priority, setPriority]     = useState('medium')
  const [status, setStatus]         = useState('todo')
  const [swimlane, setSwimlane]     = useState(defaultLane)
  const [reqId, setReqId]           = useState('')
  const [tab, setTab]               = useState('manual') // manual | requirement

  // Reset when opened
  React.useEffect(() => {
    if (open) {
      setTitle(''); setNotes(''); setPriority('medium'); setStatus('todo')
      setSwimlane(defaultLane); setReqId(''); setTab('manual')
    }
  }, [open, defaultLane])

  const availableReqs = (requirements || []).filter(r => !existingItemReqIds.has(r.id))

  function handleSave() {
    if (tab === 'requirement') {
      if (!reqId) return
      const req = requirements.find(r => r.id === Number(reqId))
      if (!req) return
      onSave({ title: req.title, notes: req.description || '', priority, swimlane, status, requirementId: req.id })
    } else {
      if (!title.trim()) return
      onSave({ title: title.trim(), notes: notes.trim(), priority, swimlane, status, requirementId: null })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Item" size="md">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-800 rounded-lg mb-5">
        {[['manual', 'Manual item'], ['requirement', 'From requirement']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${tab === id ? 'bg-gray-700 text-gray-100 shadow' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {tab === 'manual' ? (
          <div>
            <label className="label">Title *</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus />
          </div>
        ) : (
          <div>
            <label className="label">Requirement *</label>
            {availableReqs.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-800 rounded-lg px-3 py-2">
                All requirements are already on the board.
              </p>
            ) : (
              <select className="input" value={reqId} onChange={e => setReqId(e.target.value)}>
                <option value="">— Select a requirement —</option>
                {availableReqs.map(r => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {tab === 'manual' && (
          <div>
            <label className="label">Notes</label>
            <textarea className="textarea" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Swimlane</label>
            <select className="input" value={swimlane} onChange={e => setSwimlane(e.target.value)}>
              {SWIMLANES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
              {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={tab === 'manual' ? !title.trim() : !reqId}
          >
            Add Item
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Edit Item Modal ──────────────────────────────────────────────────────────
function EditItemModal({ open, onClose, item, onSave }) {
  const [title, setTitle]       = useState('')
  const [notes, setNotes]       = useState('')
  const [priority, setPriority] = useState('medium')
  const [status, setStatus]     = useState('todo')
  const [swimlane, setSwimlane] = useState('backlog')

  React.useEffect(() => {
    if (item) {
      setTitle(item.title); setNotes(item.notes || ''); setPriority(item.priority)
      setStatus(item.status); setSwimlane(item.swimlane)
    }
  }, [item])

  if (!item) return null

  return (
    <Modal open={open} onClose={onClose} title="Edit Item" size="md">
      <div className="space-y-4">
        <div>
          <label className="label">Title *</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea className="textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Swimlane</label>
            <select className="input" value={swimlane} onChange={e => setSwimlane(e.target.value)}>
              {SWIMLANES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
              {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => onSave({ ...item, title: title.trim(), notes: notes.trim(), priority, status, swimlane })}
            disabled={!title.trim()}
          >
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Tracker Inline Cell ──────────────────────────────────────────────────────
function EditableCell({ value, onChange, placeholder = '', type = 'text', className = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  const inputRef              = useRef(null)

  React.useEffect(() => { setDraft(value) }, [value])
  React.useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  function commit() {
    setEditing(false)
    if (draft !== value) onChange(draft)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        className={`w-full bg-gray-800 border border-brand-500 rounded px-2 py-1 text-sm text-gray-100 outline-none ${className}`}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={`px-2 py-1 rounded cursor-text hover:bg-gray-800/60 transition-colors min-h-[30px] text-sm ${value ? 'text-gray-200' : 'text-gray-600'} ${className}`}
    >
      {value || <span className="italic">{placeholder}</span>}
    </div>
  )
}

// ─── Tracker Status Cell ──────────────────────────────────────────────────────
function StatusCell({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const st = getTrackerStatus(value)
  const Icon = st.icon

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${st.bg} ${st.text} ${st.border} hover:opacity-80`}
      >
        <Icon size={11} />
        {st.label}
        <ChevronDown size={10} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-30 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 text-xs">
          {TRACKER_STATUSES.map(s => {
            const SIcon = s.icon
            return (
              <button
                key={s.id}
                className={`w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-gray-700 ${s.text}`}
                onClick={() => { onChange(s.id); setOpen(false) }}
              >
                <SIcon size={11} />
                {s.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tracker View ─────────────────────────────────────────────────────────────
function TrackerView({ projectId }) {
  const items = useLiveQuery(
    () => projectId ? getTrackerItems(projectId) : Promise.resolve([]),
    [projectId]
  )

  async function handleAdd() {
    const position = (items || []).length
    await createTrackerItem({ projectId, title: '', owner: '', dueDate: '', status: 'on_track', comments: '', position })
  }

  async function handleUpdate(item, patch) {
    await updateTrackerItem(item.id, {
      title:    patch.title    !== undefined ? patch.title    : item.title,
      owner:    patch.owner    !== undefined ? patch.owner    : item.owner,
      dueDate:  patch.dueDate  !== undefined ? patch.dueDate  : item.dueDate,
      status:   patch.status   !== undefined ? patch.status   : item.status,
      comments: patch.comments !== undefined ? patch.comments : item.comments,
      position: item.position,
    })
  }

  async function handleDelete(id) {
    await deleteTrackerItem(id)
  }

  const rows = items || []

  // Stats
  const total    = rows.length
  const onTrack  = rows.filter(r => r.status === 'on_track').length
  const blocked  = rows.filter(r => r.status === 'blocked').length
  const done     = rows.filter(r => r.status === 'done').length

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Stats strip */}
      {total > 0 && (
        <div className="flex gap-3 mb-5">
          {[
            { label: 'Total',    count: total,   color: 'text-gray-400', bg: 'bg-gray-800' },
            { label: 'On Track', count: onTrack,  color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
            { label: 'Blocked',  count: blocked,  color: 'text-red-400',     bg: 'bg-red-900/20' },
            { label: 'Done',     count: done,     color: 'text-blue-400',    bg: 'bg-blue-900/20' },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${s.bg}`}>
              <span className={`text-sm font-bold ${s.color}`}>{s.count}</span>
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="grid bg-gray-900 border-b border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider"
          style={{ gridTemplateColumns: '40px 1fr 160px 140px 160px 1fr 44px' }}>
          <div className="px-3 py-3 text-center">#</div>
          <div className="px-3 py-3 flex items-center gap-1.5"><FileText size={11} /> Task</div>
          <div className="px-3 py-3 flex items-center gap-1.5"><User size={11} /> Owner</div>
          <div className="px-3 py-3 flex items-center gap-1.5"><CalendarDays size={11} /> Due Date</div>
          <div className="px-3 py-3 flex items-center gap-1.5"><TrendingUp size={11} /> Status</div>
          <div className="px-3 py-3 flex items-center gap-1.5"><MessageSquare size={11} /> Comments</div>
          <div className="px-3 py-3" />
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-3">
              <Table2 size={22} className="text-gray-600" />
            </div>
            <p className="text-gray-400 font-medium mb-1">No items yet</p>
            <p className="text-xs text-gray-600 mb-4">Add your first task or test case to get started</p>
            <button className="btn-primary" onClick={handleAdd}><Plus size={14} /> Add first item</button>
          </div>
        ) : (
          <>
            {rows.map((item, idx) => (
              <div
                key={item.id}
                className="grid border-b border-gray-800 hover:bg-gray-900/50 transition-colors group items-center"
                style={{ gridTemplateColumns: '40px 1fr 160px 140px 160px 1fr 44px' }}
              >
                {/* # */}
                <div className="px-3 py-2 text-center text-xs text-gray-600 font-mono">{idx + 1}</div>

                {/* Title */}
                <div className="px-1 py-1.5">
                  <EditableCell
                    value={item.title}
                    onChange={v => handleUpdate(item, { title: v })}
                    placeholder="Task name..."
                  />
                </div>

                {/* Owner */}
                <div className="px-1 py-1.5">
                  <EditableCell
                    value={item.owner}
                    onChange={v => handleUpdate(item, { owner: v })}
                    placeholder="Assign owner..."
                  />
                </div>

                {/* Due Date */}
                <div className="px-2 py-1.5">
                  <input
                    type="date"
                    value={item.dueDate}
                    onChange={e => handleUpdate(item, { dueDate: e.target.value })}
                    className="w-full bg-transparent border-0 text-sm text-gray-300 outline-none cursor-pointer hover:bg-gray-800/60 rounded px-1 py-0.5 [color-scheme:dark]"
                  />
                </div>

                {/* Status */}
                <div className="px-2 py-1.5">
                  <StatusCell
                    value={item.status}
                    onChange={v => handleUpdate(item, { status: v })}
                  />
                </div>

                {/* Comments */}
                <div className="px-1 py-1.5">
                  <EditableCell
                    value={item.comments}
                    onChange={v => handleUpdate(item, { comments: v })}
                    placeholder="Add a comment..."
                  />
                </div>

                {/* Delete */}
                <div className="px-2 py-1.5 flex justify-center">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 rounded text-gray-700 hover:text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Add row button */}
        {rows.length > 0 && (
          <button
            onClick={handleAdd}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:text-gray-300 hover:bg-gray-800/40 transition-colors border-t border-gray-800/0 hover:border-gray-800"
          >
            <Plus size={14} />
            Add item
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FridayPage() {
  const { activeProjectId, currentUser } = useStore()
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId)
  const [activeTab, setActiveTab]       = useState('board')  // 'board' | 'tracker'
  const [addLane, setAddLane]           = useState(null)   // lane id when adding
  const [editItem, setEditItem]         = useState(null)
  const [dragState, setDragState]       = useState({ draggingId: null, draggingItem: null, overLane: null })

  const projects     = useLiveQuery(() => getProjects(currentUser.id), [currentUser.id])
  const requirements = useLiveQuery(
    () => selectedProjectId ? getRequirements(selectedProjectId) : Promise.resolve([]),
    [selectedProjectId]
  )
  const allItems = useLiveQuery(
    () => selectedProjectId ? getFridayItems(selectedProjectId) : Promise.resolve([]),
    [selectedProjectId]
  )

  const project = (projects || []).find(p => p.id === selectedProjectId)

  // When active project changes, sync selection
  React.useEffect(() => {
    if (activeProjectId) setSelectedProjectId(activeProjectId)
  }, [activeProjectId])

  const itemsByLane = (lane) =>
    (allItems || [])
      .filter(i => i.swimlane === lane)
      .sort((a, b) => a.position - b.position)

  const existingItemReqIds = new Set((allItems || []).map(i => i.requirementId).filter(Boolean))

  // Stats
  const total     = (allItems || []).length
  const doneCount = (allItems || []).filter(i => i.swimlane === 'done').length
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0

  async function handleAddItem({ title, notes, priority, swimlane, status, requirementId }) {
    const laneItems  = itemsByLane(swimlane)
    const position   = laneItems.length
    await createFridayItem({ projectId: selectedProjectId, requirementId, title, notes, priority, swimlane, position, status })
    setAddLane(null)
  }

  async function handleEditSave(updated) {
    await updateFridayItem(updated.id, {
      title: updated.title, notes: updated.notes,
      priority: updated.priority, swimlane: updated.swimlane,
      position: updated.position, status: updated.status,
    })
    setEditItem(null)
  }

  async function handleDelete(id) {
    await deleteFridayItem(id)
  }

  async function handleMove(item, targetLane) {
    const laneItems = itemsByLane(targetLane)
    await moveFridayItem(item.id, { swimlane: targetLane, position: laneItems.length })
  }

  // Drag & Drop
  function handleDragStart(item) {
    setDragState({ draggingId: item.id, draggingItem: item, overLane: item.swimlane })
  }
  function handleDragEnd() {
    setDragState({ draggingId: null, draggingItem: null, overLane: null })
  }
  function handleDragOver(laneId) {
    setDragState(s => ({ ...s, overLane: laneId }))
  }
  async function handleDrop(targetLane) {
    const { draggingItem } = dragState
    if (draggingItem && draggingItem.swimlane !== targetLane) {
      await handleMove(draggingItem, targetLane)
    }
    setDragState({ draggingId: null, draggingItem: null, overLane: null })
  }

  if (!projects) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <LayoutGrid size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-100 leading-tight">Friday</h1>
            <p className="text-[11px] text-gray-500 leading-tight">Project Management</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 ml-4 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('board')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'board' ? 'bg-gray-700 text-gray-100 shadow' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <LayoutGrid size={12} /> Board
          </button>
          <button
            onClick={() => setActiveTab('tracker')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'tracker' ? 'bg-gray-700 text-gray-100 shadow' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Table2 size={12} /> Tracker
          </button>
        </div>

        {/* Project picker */}
        <div className="flex items-center gap-2 ml-2">
          <Layers size={13} className="text-gray-500 flex-shrink-0" />
          <select
            className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={selectedProjectId || ''}
            onChange={e => setSelectedProjectId(Number(e.target.value) || null)}
          >
            <option value="">— Select project —</option>
            {(projects || []).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Progress (board tab only) */}
        {activeTab === 'board' && total > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-500">{doneCount}/{total} done</div>
              <div className="text-[10px] text-gray-600">{pct}% complete</div>
            </div>
            <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {selectedProjectId && activeTab === 'board' && (
          <button
            className="btn-primary ml-auto"
            onClick={() => setAddLane('backlog')}
          >
            <Plus size={15} /> Add Item
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {!selectedProjectId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
            <LayoutGrid size={28} className="text-gray-600" />
          </div>
          <h3 className="text-gray-300 font-semibold mb-1">Select a project</h3>
          <p className="text-sm text-gray-600">Choose a project above to manage its requirements on the board</p>
        </div>
      ) : activeTab === 'tracker' ? (
        <TrackerView projectId={selectedProjectId} />
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
          <div className="flex gap-4 h-full min-w-max pb-4">
            {SWIMLANES.map(lane => (
              <SwimLane
                key={lane.id}
                lane={lane}
                items={itemsByLane(lane.id)}
                onAddItem={(laneId) => setAddLane(laneId)}
                onMove={handleMove}
                onDelete={handleDelete}
                onEdit={setEditItem}
                dragState={dragState}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <AddItemModal
        open={addLane !== null}
        onClose={() => setAddLane(null)}
        onSave={handleAddItem}
        defaultLane={addLane || 'backlog'}
        requirements={requirements || []}
        existingItemReqIds={existingItemReqIds}
      />

      <EditItemModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        item={editItem}
        onSave={handleEditSave}
      />
    </div>
  )
}
