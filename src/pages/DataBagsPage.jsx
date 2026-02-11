import React, { useState, useRef } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery.js'
import { createDataBag, updateDataBag, deleteDataBag, getDataBags } from '../db/database.js'
import { useStore } from '../store/useStore.js'
import Modal from '../components/Modal.jsx'
import { Database, Plus, Pencil, Trash2, Upload, Download, Table, ChevronDown, X } from 'lucide-react'

// Parse CSV text to array of objects
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return { schema: [], records: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const records = lines.slice(1).map(line => {
    const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || []
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = (values[i] || '').trim().replace(/^"|"$/g, '')
    })
    return obj
  })
  const schema = headers.map(h => ({ name: h, type: 'string' }))
  return { schema, records }
}

// Parse JSON array
function parseJSON(text) {
  const data = JSON.parse(text)
  if (!Array.isArray(data) || data.length === 0) return { schema: [], records: [] }
  const keys = Object.keys(data[0])
  const schema = keys.map(k => ({ name: k, type: typeof data[0][k] }))
  return { schema, records: data }
}

function DataBagImportForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [rawText, setRawText] = useState('')
  const fileRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      setRawText(text)
      try {
        const result = file.name.endsWith('.json') ? parseJSON(text) : parseCSV(text)
        setPreview(result)
        if (!name) setName(file.name.replace(/\.(csv|json)$/, ''))
      } catch (err) {
        setError('Failed to parse file: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const handlePaste = (e) => {
    const text = e.target.value
    setRawText(text)
    setError('')
    if (!text.trim()) { setPreview(null); return }
    try {
      const result = text.trim().startsWith('[') || text.trim().startsWith('{')
        ? parseJSON(text) : parseCSV(text)
      setPreview(result)
    } catch (err) {
      setError('Failed to parse: ' + err.message)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim() || !preview) return
    onSave({ name: name.trim(), description, ...preview })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Bag Name *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Users Test Data" autoFocus />
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
        </div>
      </div>

      {/* Import source */}
      <div>
        <label className="label">Import Data</label>
        <div className="grid grid-cols-2 gap-3">
          <div
            className="border-2 border-dashed border-gray-700 hover:border-brand-600 rounded-xl p-4 text-center cursor-pointer transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={20} className="mx-auto text-gray-500 mb-2" />
            <div className="text-sm text-gray-400">Click to upload CSV or JSON</div>
            <div className="text-xs text-gray-600 mt-1">or drag & drop</div>
            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFile} />
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs text-gray-500">Or paste CSV / JSON:</div>
            <textarea
              className="textarea flex-1 text-xs font-mono"
              placeholder={'name,age,email\nAlice,30,alice@ex.com\nBob,25,bob@ex.com'}
              value={rawText}
              onChange={handlePaste}
            />
          </div>
        </div>
      </div>

      {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-2">{error}</div>}

      {/* Preview */}
      {preview && preview.records.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400">
              Preview: <strong className="text-gray-200">{preview.records.length}</strong> rows, <strong className="text-gray-200">{preview.schema.length}</strong> columns
            </div>
          </div>
          <div className="overflow-auto max-h-40 rounded-lg border border-gray-800">
            <table className="w-full text-xs">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  {preview.schema.map(col => (
                    <th key={col.name} className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">{col.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.records.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t border-gray-800/50 hover:bg-gray-800/30">
                    {preview.schema.map(col => (
                      <td key={col.name} className="px-3 py-1.5 text-gray-300 whitespace-nowrap max-w-32 truncate">{String(row[col.name] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.records.length > 10 && (
              <div className="text-center py-2 text-xs text-gray-600 border-t border-gray-800">
                ... and {preview.records.length - 10} more rows
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!name.trim() || !preview?.records?.length}>
          Import Data Bag
        </button>
      </div>
    </form>
  )
}

function DataBagCard({ bag, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  const exportCSV = () => {
    if (!bag.schema?.length) return
    const header = bag.schema.map(c => c.name).join(',')
    const rows = bag.records.map(r => bag.schema.map(c => `"${String(r[c.name] || '').replace(/"/g, '""')}"`).join(','))
    const csv = [header, ...rows].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${bag.name}.csv`
    a.click()
  }

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-orange-900/30 border border-orange-800/40 rounded-lg flex items-center justify-center flex-shrink-0">
          <Database size={15} className="text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-100">{bag.name}</h3>
              {bag.description && <p className="text-xs text-gray-500 mt-0.5">{bag.description}</p>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button className="btn-ghost p-1.5" title="Export CSV" onClick={exportCSV}><Download size={13} /></button>
              <button className="btn-ghost p-1.5" onClick={() => onEdit(bag)}><Pencil size={13} /></button>
              <button className="btn-ghost p-1.5 text-red-400" onClick={() => onDelete(bag)}><Trash2 size={13} /></button>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <span className="badge-yellow">{bag.records?.length || 0} rows</span>
            <span className="badge-gray">{bag.schema?.length || 0} columns</span>
            {bag.records?.length > 0 && (
              <button className="text-xs text-gray-600 hover:text-gray-300 flex items-center gap-1" onClick={() => setExpanded(e => !e)}>
                <Table size={11} />
                {expanded ? 'Hide' : 'Preview'} data
              </button>
            )}
          </div>

          {expanded && bag.records?.length > 0 && (
            <div className="mt-3 overflow-auto max-h-48 rounded-lg border border-gray-800">
              <table className="w-full text-xs">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    {bag.schema.map(col => (
                      <th key={col.name} className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap">{col.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bag.records.slice(0, 15).map((row, i) => (
                    <tr key={i} className="border-t border-gray-800/50 hover:bg-gray-800/30">
                      {bag.schema.map(col => (
                        <td key={col.name} className="px-3 py-1.5 text-gray-300 whitespace-nowrap max-w-32 truncate">{String(row[col.name] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DataBagsPage() {
  const { activeProjectId } = useStore()
  const [showImport, setShowImport] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const dataBags = useLiveQuery(
    () => activeProjectId ? getDataBags(activeProjectId) : Promise.resolve([]),
    [activeProjectId]
  )

  const handleImport = async (data) => {
    await createDataBag({ ...data, projectId: activeProjectId })
    setShowImport(false)
  }

  const handleDelete = async () => {
    await deleteDataBag(confirmDelete.id)
    setConfirmDelete(null)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Data Bags</h1>
          <p className="text-sm text-gray-500 mt-0.5">Import test data to link with requirements and test cases</p>
        </div>
        <button className="btn-primary" onClick={() => setShowImport(true)}>
          <Upload size={16} /> Import Data
        </button>
      </div>

      {!dataBags?.length ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
            <Database size={28} className="text-gray-500" />
          </div>
          <h3 className="text-gray-300 font-medium mb-1">No data bags yet</h3>
          <p className="text-sm text-gray-500 mb-4">Import CSV or JSON test data to use in requirements and test cases</p>
          <button className="btn-primary" onClick={() => setShowImport(true)}>
            <Upload size={16} /> Import Data Bag
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {dataBags.map(bag => (
            <DataBagCard key={bag.id} bag={bag} onEdit={() => {}} onDelete={setConfirmDelete} />
          ))}
        </div>
      )}

      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Data Bag" size="lg">
        <DataBagImportForm onSave={handleImport} onCancel={() => setShowImport(false)} />
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Data Bag" size="sm">
        <p className="text-sm text-gray-400 mb-4">Delete data bag <strong className="text-gray-200">{confirmDelete?.name}</strong>? Links in requirements and test cases will be cleared.</p>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}
