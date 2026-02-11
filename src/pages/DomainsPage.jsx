import React, { useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery.js'
import { createDomain, updateDomain, deleteDomain, getDomains } from '../db/database.js'
import { useStore } from '../store/useStore.js'
import Modal from '../components/Modal.jsx'
import { Globe, Plus, Pencil, Trash2, Tag, ChevronDown, ChevronRight } from 'lucide-react'

const ATTR_TYPES = ['string', 'number', 'boolean', 'date', 'email', 'url', 'enum', 'reference']

function AttributeRow({ attr, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg border border-gray-800">
      <input
        className="input flex-1 py-1 text-xs"
        placeholder="Attribute name"
        value={attr.name}
        onChange={e => onChange({ ...attr, name: e.target.value })}
      />
      <select
        className="input w-28 py-1 text-xs"
        value={attr.type}
        onChange={e => onChange({ ...attr, type: e.target.value })}
      >
        {ATTR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <input
        className="input flex-1 py-1 text-xs"
        placeholder="Description (optional)"
        value={attr.description || ''}
        onChange={e => onChange({ ...attr, description: e.target.value })}
      />
      <label className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
        <input
          type="checkbox"
          checked={attr.required || false}
          onChange={e => onChange({ ...attr, required: e.target.checked })}
          className="w-3 h-3"
        />
        Req
      </label>
      <button className="btn-ghost p-1 text-red-400" onClick={onRemove}>
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function DomainForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [attributes, setAttributes] = useState(initial?.attributes || [])

  const addAttr = () => setAttributes(a => [...a, { name: '', type: 'string', description: '', required: false }])
  const updateAttr = (i, val) => setAttributes(a => a.map((x, idx) => idx === i ? val : x))
  const removeAttr = (i) => setAttributes(a => a.filter((_, idx) => idx !== i))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), description: description.trim(), attributes })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Domain Name *</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Customer, Order, Product" autoFocus />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="textarea" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this domain represent?" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Attributes</label>
          <button type="button" className="btn-ghost text-xs py-0.5" onClick={addAttr}>
            <Plus size={12} /> Add Attribute
          </button>
        </div>
        <div className="space-y-1.5">
          {attributes.length === 0 && (
            <div className="text-xs text-gray-600 text-center py-3 border border-dashed border-gray-800 rounded-lg">
              No attributes yet — click "Add Attribute" to define domain properties
            </div>
          )}
          {attributes.map((attr, i) => (
            <AttributeRow key={i} attr={attr} onChange={v => updateAttr(i, v)} onRemove={() => removeAttr(i)} />
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          {initial ? 'Update' : 'Create'} Domain
        </button>
      </div>
    </form>
  )
}

function DomainCard({ domain, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-blue-900/40 border border-blue-800/50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <Globe size={15} className="text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-100">{domain.name}</h3>
            <div className="flex gap-1">
              <button className="btn-ghost p-1.5" onClick={() => onEdit(domain)}><Pencil size={13} /></button>
              <button className="btn-ghost p-1.5 text-red-400" onClick={() => onDelete(domain)}><Trash2 size={13} /></button>
            </div>
          </div>
          {domain.description && <p className="text-xs text-gray-500 mt-0.5">{domain.description}</p>}
          <div className="flex items-center gap-2 mt-2">
            <span className="badge-blue">{domain.attributes?.length || 0} attributes</span>
            {domain.attributes?.length > 0 && (
              <button
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                onClick={() => setExpanded(e => !e)}
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {expanded ? 'Hide' : 'Show'} attributes
              </button>
            )}
          </div>
          {expanded && domain.attributes?.length > 0 && (
            <div className="mt-3 space-y-1">
              {domain.attributes.map((attr, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Tag size={10} className="text-gray-600 flex-shrink-0" />
                  <span className="text-gray-300 font-mono">{attr.name}</span>
                  <span className="badge-gray">{attr.type}</span>
                  {attr.required && <span className="badge-red text-[10px]">required</span>}
                  {attr.description && <span className="text-gray-600">{attr.description}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DomainsPage() {
  const { activeProjectId } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const domains = useLiveQuery(
    () => activeProjectId ? getDomains(activeProjectId) : Promise.resolve([]),
    [activeProjectId]
  )

  const handleCreate = async (data) => {
    await createDomain({ ...data, projectId: activeProjectId })
    setShowCreate(false)
  }

  const handleUpdate = async (data) => {
    await updateDomain(editing.id, data)
    setEditing(null)
  }

  const handleDelete = async () => {
    await deleteDomain(confirmDelete.id)
    setConfirmDelete(null)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Domains</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define domain entities and their attributes</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Domain
        </button>
      </div>

      {!domains?.length ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
            <Globe size={28} className="text-gray-500" />
          </div>
          <h3 className="text-gray-300 font-medium mb-1">No domains yet</h3>
          <p className="text-sm text-gray-500 mb-4">Define business domains to use in your requirements</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create Domain
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {domains.map(domain => (
            <DomainCard key={domain.id} domain={domain} onEdit={setEditing} onDelete={setConfirmDelete} />
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Domain" size="lg">
        <DomainForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Domain" size="lg">
        {editing && <DomainForm initial={editing} onSave={handleUpdate} onCancel={() => setEditing(null)} />}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Domain" size="sm">
        <p className="text-sm text-gray-400 mb-4">
          Delete domain <strong className="text-gray-200">{confirmDelete?.name}</strong>? Any references to its attributes in requirements will remain as text.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}
