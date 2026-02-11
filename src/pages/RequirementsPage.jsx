import React, { useState, useRef, useEffect } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery.js'
import { createRequirement, updateRequirement, deleteRequirement, getRequirements, getDomains, getDataBags } from '../db/database.js'
import { useStore } from '../store/useStore.js'
import Modal from '../components/Modal.jsx'
import {
  FileText, Plus, Pencil, Trash2, ChevronDown, AtSign,
  CheckCircle, Clock, AlertCircle, Circle
} from 'lucide-react'

const STATUS_CONFIG = {
  draft:    { label: 'Draft',    icon: Circle,        className: 'badge-gray' },
  review:   { label: 'Review',   icon: Clock,         className: 'badge-yellow' },
  approved: { label: 'Approved', icon: CheckCircle,   className: 'badge-green' },
  rejected: { label: 'Rejected', icon: AlertCircle,   className: 'badge-red' },
}

// --- Gherkin step editor with domain attribute autocomplete ---
function GherkinStepInput({ value, onChange, placeholder, domains }) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [cursorPos, setCursorPos] = useState(0)
  const inputRef = useRef(null)

  // Compute autocomplete suggestions when user types "@"
  const handleChange = (e) => {
    const val = e.target.value
    const cursor = e.target.selectionStart
    onChange(val)
    setCursorPos(cursor)

    // Find the last @ before cursor
    const before = val.slice(0, cursor)
    const atIdx = before.lastIndexOf('@')
    if (atIdx !== -1) {
      const token = before.slice(atIdx + 1)
      if (!token.includes(' ')) {
        const lower = token.toLowerCase()
        const results = []
        domains?.forEach(d => {
          d.attributes?.forEach(a => {
            const ref = `${d.name}.${a.name}`
            if (ref.toLowerCase().includes(lower)) results.push({ ref, domain: d.name, attr: a.name, type: a.type })
          })
        })
        setSuggestions(results.slice(0, 8))
        setShowSuggestions(results.length > 0)
        return
      }
    }
    setShowSuggestions(false)
  }

  const applySuggestion = (ref) => {
    const val = value
    const before = val.slice(0, cursorPos)
    const after = val.slice(cursorPos)
    const atIdx = before.lastIndexOf('@')
    const newVal = before.slice(0, atIdx) + '@' + ref + ' ' + after
    onChange(newVal)
    setShowSuggestions(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        className="input text-sm"
        value={value}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder={placeholder}
      />
      {showSuggestions && (
        <div className="absolute z-20 top-full left-0 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-700 flex items-center gap-2"
              onMouseDown={() => applySuggestion(s.ref)}
            >
              <AtSign size={11} className="text-brand-400 flex-shrink-0" />
              <span className="text-brand-300 font-mono">{s.ref}</span>
              <span className="badge-gray ml-1">{s.type}</span>
            </button>
          ))}
          <div className="px-3 py-1 border-t border-gray-700 text-[10px] text-gray-600">
            Type @ to reference domain attributes
          </div>
        </div>
      )}
    </div>
  )
}

// --- Gherkin clause builder ---
function GherkinSection({ label, color, steps, onChange, domains }) {
  const add = () => onChange([...steps, ''])
  const update = (i, val) => onChange(steps.map((s, idx) => idx === i ? val : s))
  const remove = (i) => onChange(steps.filter((_, idx) => idx !== i))

  const colorMap = {
    given: 'text-green-400 bg-green-900/20 border-green-800/40',
    when:  'text-yellow-400 bg-yellow-900/20 border-yellow-800/40',
    then:  'text-blue-400 bg-blue-900/20 border-blue-800/40',
  }

  return (
    <div className={`border rounded-xl p-3 ${colorMap[label.toLowerCase()]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        <button type="button" className="btn-ghost py-0 px-1.5 text-xs" onClick={add}>
          <Plus size={11} /> Add
        </button>
      </div>
      <div className="space-y-1.5">
        {steps.length === 0 && (
          <div className="text-xs text-gray-600 text-center py-2">No steps — click Add to define {label.toLowerCase()} conditions</div>
        )}
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-gray-600 w-8 flex-shrink-0">
              {label === 'Given' ? 'Given' : label === 'When' ? i === 0 ? 'When' : 'And' : i === 0 ? 'Then' : 'And'}
            </span>
            <GherkinStepInput
              value={step}
              onChange={val => update(i, val)}
              placeholder={`Enter ${label.toLowerCase()} step — use @ to reference domain attrs`}
              domains={domains}
            />
            <button type="button" className="btn-ghost p-1 text-red-400" onClick={() => remove(i)}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Highlight domain attribute refs in display ---
function StepDisplay({ text }) {
  const parts = text.split(/(@[\w.]+)/g)
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('@') ? (
          <span key={i} className="text-brand-400 bg-brand-900/30 px-1 rounded font-mono text-xs">{p}</span>
        ) : p
      )}
    </span>
  )
}

function RequirementForm({ initial, onSave, onCancel, domains, dataBags }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [given, setGiven] = useState(initial?.gherkin?.given || [])
  const [when, setWhen] = useState(initial?.gherkin?.when || [])
  const [then, setThen] = useState(initial?.gherkin?.then || [])
  const [selectedBags, setSelectedBags] = useState(initial?.dataBagIds || [])
  const [status, setStatus] = useState(initial?.status || 'draft')

  const toggleBag = (id) => setSelectedBags(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      description: description.trim(),
      gherkin: { given, when, then },
      dataBagIds: selectedBags,
      status
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="label">Title *</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Requirement title" autoFocus />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Description / Scenario</label>
        <textarea className="textarea" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this requirement..." />
      </div>
      <div className="text-xs text-gray-500 flex items-center gap-1">
        <AtSign size={11} className="text-brand-400" /> Type <kbd className="bg-gray-800 border border-gray-700 px-1 rounded text-[10px]">@DomainName.attribute</kbd> to insert domain attribute references
      </div>
      <GherkinSection label="Given" steps={given} onChange={setGiven} domains={domains} />
      <GherkinSection label="When" steps={when} onChange={setWhen} domains={domains} />
      <GherkinSection label="Then" steps={then} onChange={setThen} domains={domains} />

      {dataBags?.length > 0 && (
        <div>
          <label className="label">Link Data Bags (test data)</label>
          <div className="flex flex-wrap gap-2">
            {dataBags.map(bag => (
              <button
                key={bag.id}
                type="button"
                onClick={() => toggleBag(bag.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  selectedBags.includes(bag.id)
                    ? 'bg-brand-600 border-brand-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {bag.name} ({bag.records?.length || 0} rows)
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!title.trim()}>
          {initial ? 'Update' : 'Create'} Requirement
        </button>
      </div>
    </form>
  )
}

function RequirementCard({ req, onEdit, onDelete, domains }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.draft
  const Icon = cfg.icon

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <FileText size={15} className="text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-100">{req.title}</h3>
              {req.description && <p className="text-xs text-gray-500 mt-0.5">{req.description}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={cfg.className}>
                <Icon size={10} className="mr-1" />{cfg.label}
              </span>
              <button className="btn-ghost p-1.5" onClick={() => onEdit(req)}><Pencil size={13} /></button>
              <button className="btn-ghost p-1.5 text-red-400" onClick={() => onDelete(req)}><Trash2 size={13} /></button>
            </div>
          </div>

          {/* Summary counts */}
          <div className="flex items-center gap-3 mt-2">
            {req.gherkin?.given?.length > 0 && <span className="text-xs text-green-500">{req.gherkin.given.length} Given</span>}
            {req.gherkin?.when?.length > 0 && <span className="text-xs text-yellow-500">{req.gherkin.when.length} When</span>}
            {req.gherkin?.then?.length > 0 && <span className="text-xs text-blue-500">{req.gherkin.then.length} Then</span>}
            {(req.gherkin?.given?.length > 0 || req.gherkin?.when?.length > 0 || req.gherkin?.then?.length > 0) && (
              <button className="text-xs text-gray-600 hover:text-gray-300 flex items-center gap-1" onClick={() => setExpanded(e => !e)}>
                <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                {expanded ? 'Hide' : 'Show'} steps
              </button>
            )}
          </div>

          {expanded && (
            <div className="mt-3 space-y-2 text-xs">
              {['given', 'when', 'then'].map(clause => (
                req.gherkin?.[clause]?.length > 0 && (
                  <div key={clause}>
                    {req.gherkin[clause].map((step, i) => (
                      <div key={i} className="flex items-start gap-2 py-0.5">
                        <span className={`font-mono font-bold flex-shrink-0 ${
                          clause === 'given' ? 'text-green-500' : clause === 'when' ? 'text-yellow-500' : 'text-blue-500'
                        }`}>
                          {clause === 'given' ? 'Given' : clause === 'when' ? (i === 0 ? 'When' : 'And') : (i === 0 ? 'Then' : 'And')}
                        </span>
                        <span className="text-gray-300"><StepDisplay text={step} /></span>
                      </div>
                    ))}
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RequirementsPage() {
  const { activeProjectId } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  const requirements = useLiveQuery(
    () => activeProjectId ? getRequirements(activeProjectId) : Promise.resolve([]),
    [activeProjectId]
  )
  const domains = useLiveQuery(
    () => activeProjectId ? getDomains(activeProjectId) : Promise.resolve([]),
    [activeProjectId]
  )
  const dataBags = useLiveQuery(
    () => activeProjectId ? getDataBags(activeProjectId) : Promise.resolve([]),
    [activeProjectId]
  )

  const filtered = requirements?.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleCreate = async (data) => {
    await createRequirement({ ...data, projectId: activeProjectId })
    setShowCreate(false)
  }

  const handleUpdate = async (data) => {
    await updateRequirement(editing.id, data)
    setEditing(null)
  }

  const handleDelete = async () => {
    await deleteRequirement(confirmDelete.id)
    setConfirmDelete(null)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Requirements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define Gherkin-format requirements with domain references</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Requirement
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <input
          className="input max-w-xs text-sm"
          placeholder="Search requirements..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          <button
            className={`btn text-xs py-1 ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus('all')}
          >All</button>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <button
              key={k}
              className={`btn text-xs py-1 ${filterStatus === k ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterStatus(k)}
            >{v.label}</button>
          ))}
        </div>
      </div>

      {!filtered?.length ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
            <FileText size={28} className="text-gray-500" />
          </div>
          <h3 className="text-gray-300 font-medium mb-1">
            {requirements?.length ? 'No matching requirements' : 'No requirements yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {requirements?.length ? 'Try adjusting filters' : 'Create your first Gherkin requirement'}
          </p>
          {!requirements?.length && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Create Requirement
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <RequirementCard key={req.id} req={req} onEdit={setEditing} onDelete={setConfirmDelete} domains={domains} />
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Requirement" size="xl">
        <RequirementForm onSave={handleCreate} onCancel={() => setShowCreate(false)} domains={domains} dataBags={dataBags} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Requirement" size="xl">
        {editing && <RequirementForm initial={editing} onSave={handleUpdate} onCancel={() => setEditing(null)} domains={domains} dataBags={dataBags} />}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Requirement" size="sm">
        <p className="text-sm text-gray-400 mb-4">
          Delete <strong className="text-gray-200">{confirmDelete?.title}</strong>? Associated test cases will also be removed.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}
