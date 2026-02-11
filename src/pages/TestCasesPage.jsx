import React, { useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery.js'
import { createTestCase, updateTestCase, deleteTestCase, getTestCases, getRequirements, getDataBags } from '../db/database.js'
import { useStore } from '../store/useStore.js'
import Modal from '../components/Modal.jsx'
import { FlaskConical, Plus, Pencil, Trash2, CheckCircle, XCircle, Clock, Circle, ChevronDown } from 'lucide-react'

const STEP_TYPES = ['action', 'assertion', 'setup', 'teardown']
const TC_STATUS = {
  pending:  { label: 'Pending',  icon: Circle,       className: 'badge-gray' },
  pass:     { label: 'Pass',     icon: CheckCircle,  className: 'badge-green' },
  fail:     { label: 'Fail',     icon: XCircle,      className: 'badge-red' },
  skipped:  { label: 'Skipped', icon: Clock,         className: 'badge-yellow' },
}

function StepRow({ step, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2">
      <select className="input w-28 py-1 text-xs" value={step.type} onChange={e => onChange({ ...step, type: e.target.value })}>
        {STEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input className="input flex-1 py-1 text-xs" value={step.description} onChange={e => onChange({ ...step, description: e.target.value })} placeholder="Step description" />
      <input className="input w-36 py-1 text-xs" value={step.expected || ''} onChange={e => onChange({ ...step, expected: e.target.value })} placeholder="Expected result" />
      <button className="btn-ghost p-1 text-red-400" onClick={onRemove}><Trash2 size={12} /></button>
    </div>
  )
}

function TestCaseForm({ initial, onSave, onCancel, requirements, dataBags }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [requirementId, setRequirementId] = useState(initial?.requirementId || '')
  const [dataBagId, setDataBagId] = useState(initial?.dataBagId || '')
  const [steps, setSteps] = useState(initial?.steps || [])
  const [status, setStatus] = useState(initial?.status || 'pending')
  const [preconditions, setPreconditions] = useState(initial?.preconditions || '')
  const [expectedResult, setExpectedResult] = useState(initial?.expectedResult || '')

  const addStep = () => setSteps(s => [...s, { type: 'action', description: '', expected: '' }])
  const updateStep = (i, val) => setSteps(s => s.map((x, idx) => idx === i ? val : x))
  const removeStep = (i) => setSteps(s => s.filter((_, idx) => idx !== i))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), description, requirementId: requirementId || null, dataBagId: dataBagId || null, steps, status, preconditions, expectedResult })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Test Case Name *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. TC-001 User Login Success" autoFocus />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
            {Object.entries(TC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea className="textarea" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Test objective and scope..." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Linked Requirement</label>
          <select className="input" value={requirementId} onChange={e => setRequirementId(e.target.value)}>
            <option value="">— None —</option>
            {requirements?.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Test Data Bag</label>
          <select className="input" value={dataBagId} onChange={e => setDataBagId(e.target.value)}>
            <option value="">— None —</option>
            {dataBags?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Preconditions</label>
        <textarea className="textarea" rows={2} value={preconditions} onChange={e => setPreconditions(e.target.value)} placeholder="System state required before test execution..." />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Test Steps</label>
          <button type="button" className="btn-ghost text-xs py-0.5" onClick={addStep}>
            <Plus size={12} /> Add Step
          </button>
        </div>
        {steps.length === 0 && (
          <div className="text-xs text-gray-600 text-center py-3 border border-dashed border-gray-800 rounded-lg">
            No steps defined — add action and assertion steps
          </div>
        )}
        <div className="space-y-1.5">
          {steps.length > 0 && (
            <div className="flex gap-2 text-[10px] text-gray-500 px-0.5 mb-1">
              <span className="w-28">Type</span>
              <span className="flex-1">Description</span>
              <span className="w-36">Expected Result</span>
              <span className="w-6" />
            </div>
          )}
          {steps.map((step, i) => (
            <StepRow key={i} step={step} onChange={v => updateStep(i, v)} onRemove={() => removeStep(i)} />
          ))}
        </div>
      </div>

      <div>
        <label className="label">Overall Expected Result</label>
        <textarea className="textarea" rows={2} value={expectedResult} onChange={e => setExpectedResult(e.target.value)} placeholder="What should be the final outcome of this test?" />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          {initial ? 'Update' : 'Create'} Test Case
        </button>
      </div>
    </form>
  )
}

function TestCaseCard({ tc, onEdit, onDelete, requirementMap }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = TC_STATUS[tc.status] || TC_STATUS.pending
  const Icon = cfg.icon
  const req = tc.requirementId ? requirementMap?.[tc.requirementId] : null

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-purple-900/30 border border-purple-800/40 rounded-lg flex items-center justify-center flex-shrink-0">
          <FlaskConical size={15} className="text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-100">{tc.name}</h3>
              {tc.description && <p className="text-xs text-gray-500 mt-0.5">{tc.description}</p>}
              {req && <p className="text-xs text-brand-400 mt-0.5">↑ {req.title}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={cfg.className}>
                <Icon size={10} className="mr-1" />{cfg.label}
              </span>
              <button className="btn-ghost p-1.5" onClick={() => onEdit(tc)}><Pencil size={13} /></button>
              <button className="btn-ghost p-1.5 text-red-400" onClick={() => onDelete(tc)}><Trash2 size={13} /></button>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-600">{tc.steps?.length || 0} steps</span>
            {tc.steps?.length > 0 && (
              <button className="text-xs text-gray-600 hover:text-gray-300 flex items-center gap-1" onClick={() => setExpanded(e => !e)}>
                <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                {expanded ? 'Hide' : 'Show'} steps
              </button>
            )}
          </div>

          {expanded && tc.steps?.length > 0 && (
            <div className="mt-3 space-y-1">
              {tc.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    step.type === 'assertion' ? 'bg-green-900/40 text-green-400' :
                    step.type === 'setup' ? 'bg-blue-900/40 text-blue-400' :
                    step.type === 'teardown' ? 'bg-red-900/40 text-red-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>{step.type}</span>
                  <span className="text-gray-300">{step.description}</span>
                  {step.expected && <span className="text-gray-600 ml-auto">→ {step.expected}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TestCasesPage() {
  const { activeProjectId } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const testCases = useLiveQuery(
    () => activeProjectId ? getTestCases(activeProjectId) : Promise.resolve([]),
    [activeProjectId]
  )
  const requirements = useLiveQuery(
    () => activeProjectId ? getRequirements(activeProjectId) : Promise.resolve([]),
    [activeProjectId]
  )
  const dataBags = useLiveQuery(
    () => activeProjectId ? getDataBags(activeProjectId) : Promise.resolve([]),
    [activeProjectId]
  )

  const requirementMap = requirements?.reduce((acc, r) => { acc[r.id] = r; return acc }, {})

  const filtered = testCases?.filter(tc => filterStatus === 'all' || tc.status === filterStatus)

  const handleCreate = async (data) => {
    await createTestCase({ ...data, projectId: activeProjectId })
    setShowCreate(false)
  }

  const handleUpdate = async (data) => {
    await updateTestCase(editing.id, data)
    setEditing(null)
  }

  const handleDelete = async () => {
    await deleteTestCase(confirmDelete.id)
    setConfirmDelete(null)
  }

  const stats = testCases?.reduce((acc, tc) => { acc[tc.status] = (acc[tc.status] || 0) + 1; return acc }, {})

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Test Cases</h1>
          <p className="text-sm text-gray-500 mt-0.5">Design and track test scenarios linked to requirements</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Test Case
        </button>
      </div>

      {/* Stats bar */}
      {testCases?.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Object.entries(TC_STATUS).map(([k, v]) => {
            const Icon = v.icon
            return (
              <div key={k} className="card p-3 flex items-center gap-3">
                <Icon size={18} className={k === 'pass' ? 'text-green-400' : k === 'fail' ? 'text-red-400' : k === 'skipped' ? 'text-yellow-400' : 'text-gray-500'} />
                <div>
                  <div className="text-lg font-bold text-gray-100">{stats?.[k] || 0}</div>
                  <div className="text-xs text-gray-500">{v.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        <button className={`btn text-xs py-1 ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus('all')}>All</button>
        {Object.entries(TC_STATUS).map(([k, v]) => (
          <button key={k} className={`btn text-xs py-1 ${filterStatus === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterStatus(k)}>{v.label}</button>
        ))}
      </div>

      {!filtered?.length ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
            <FlaskConical size={28} className="text-gray-500" />
          </div>
          <h3 className="text-gray-300 font-medium mb-1">
            {testCases?.length ? 'No matching test cases' : 'No test cases yet'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {testCases?.length ? 'Try adjusting filters' : 'Design test scenarios for your requirements'}
          </p>
          {!testCases?.length && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Create Test Case
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(tc => (
            <TestCaseCard key={tc.id} tc={tc} onEdit={setEditing} onDelete={setConfirmDelete} requirementMap={requirementMap} />
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Test Case" size="xl">
        <TestCaseForm onSave={handleCreate} onCancel={() => setShowCreate(false)} requirements={requirements} dataBags={dataBags} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Test Case" size="xl">
        {editing && <TestCaseForm initial={editing} onSave={handleUpdate} onCancel={() => setEditing(null)} requirements={requirements} dataBags={dataBags} />}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Test Case" size="sm">
        <p className="text-sm text-gray-400 mb-4">Delete test case <strong className="text-gray-200">{confirmDelete?.name}</strong>?</p>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}
