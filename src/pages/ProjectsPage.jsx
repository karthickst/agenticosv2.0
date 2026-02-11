import React, { useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery.js'
import { createProject, updateProject, deleteProject, getProjects, getRequirementCounts } from '../db/database.js'
import { useStore } from '../store/useStore.js'
import Modal from '../components/Modal.jsx'
import { FolderOpen, Plus, Pencil, Trash2, ArrowRight, Calendar, FileText } from 'lucide-react'

function ProjectForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), description: description.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Project Name *</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. E-Commerce Platform" autoFocus />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this project..." />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          {initial ? 'Update' : 'Create'} Project
        </button>
      </div>
    </form>
  )
}

export default function ProjectsPage() {
  const { setActiveProject, currentUser } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const projects   = useLiveQuery(() => getProjects(currentUser.id), [currentUser.id])
  const reqCounts  = useLiveQuery(() => getRequirementCounts(currentUser.id), [currentUser.id])

  const handleCreate = async (data) => {
    await createProject({ ...data, userId: currentUser.id })
    setShowCreate(false)
  }

  const handleUpdate = async (data) => {
    await updateProject(editing.id, { ...data, userId: currentUser.id })
    setEditing(null)
  }

  const handleDelete = async () => {
    await deleteProject(confirmDelete.id, currentUser.id)
    setConfirmDelete(null)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your specification projects</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Grid */}
      {!projects?.length ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
            <FolderOpen size={28} className="text-gray-500" />
          </div>
          <h3 className="text-gray-300 font-medium mb-1">No projects yet</h3>
          <p className="text-sm text-gray-500 mb-4">Create your first project to get started</p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <div key={project.id} className="card p-5 group hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-brand-900/50 border border-brand-800 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FolderOpen size={18} className="text-brand-400" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="btn-ghost p-1.5" onClick={() => setEditing(project)} title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button className="btn-ghost p-1.5 text-red-400" onClick={() => setConfirmDelete(project)} title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-gray-100 mb-1 truncate">{project.name}</h3>
              {project.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description}</p>
              )}

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <FileText size={11} /> {reqCounts?.[project.id] || 0} reqs
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={11} /> {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  className="btn-primary py-1 text-xs"
                  onClick={() => setActiveProject(project.id)}
                >
                  Open <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Project">
        <ProjectForm onSave={handleCreate} onCancel={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Project">
        {editing && <ProjectForm initial={editing} onSave={handleUpdate} onCancel={() => setEditing(null)} />}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Project" size="sm">
        <p className="text-sm text-gray-400 mb-4">
          Are you sure you want to delete <strong className="text-gray-200">{confirmDelete?.name}</strong>?
          This will permanently remove all requirements, domains, test cases, and data bags.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button className="btn-danger" onClick={handleDelete}>Delete Project</button>
        </div>
      </Modal>
    </div>
  )
}
