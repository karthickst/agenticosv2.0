import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { Settings, Key, Cpu, Eye, EyeOff, CheckCircle } from 'lucide-react'

const CLAUDE_MODELS = [
  { id: 'claude-opus-4-5-20251101',        label: 'Claude Opus 4.5', note: 'Most capable — best for complex specs' },
  { id: 'claude-sonnet-4-5-20250929',      label: 'Claude Sonnet 4.5', note: 'Balanced performance and speed' },
  { id: 'claude-haiku-3-5-20241022',       label: 'Claude Haiku 3.5', note: 'Fastest — best for quick iterations' },
]

export default function SettingsPage() {
  const { claudeApiKey, setClaudeApiKey, claudeModel, setClaudeModel } = useStore()
  const [keyInput, setKeyInput] = useState(claudeApiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setClaudeApiKey(keyInput.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your AgenticOS preferences</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Claude API */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-brand-900/40 border border-brand-800 rounded-lg flex items-center justify-center">
              <Key size={16} className="text-brand-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Claude API Key</h2>
              <p className="text-xs text-gray-500">Required for spec generation. Stored locally in your browser.</p>
            </div>
          </div>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              className="input pr-10"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="sk-ant-api03-..."
            />
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              onClick={() => setShowKey(s => !s)}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="text-[10px] text-gray-600 mt-1.5">
            Get your key at <span className="text-brand-400">console.anthropic.com</span>. Your key is never transmitted to any server other than Anthropic's API.
          </div>
          <button className="btn-primary mt-3" onClick={handleSave}>
            {saved ? <><CheckCircle size={14} /> Saved!</> : 'Save API Key'}
          </button>
        </div>

        {/* Default model */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-purple-900/40 border border-purple-800 rounded-lg flex items-center justify-center">
              <Cpu size={16} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Default Claude Model</h2>
              <p className="text-xs text-gray-500">Default model for specification generation</p>
            </div>
          </div>
          <div className="space-y-2">
            {CLAUDE_MODELS.map(m => (
              <label key={m.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                claudeModel === m.id ? 'border-brand-600 bg-brand-900/20' : 'border-gray-800 hover:border-gray-700'
              }`}>
                <input
                  type="radio"
                  name="model"
                  value={m.id}
                  checked={claudeModel === m.id}
                  onChange={() => setClaudeModel(m.id)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-gray-200">{m.label}</div>
                  <div className="text-xs text-gray-500">{m.note}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center">
              <Settings size={16} className="text-gray-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">About AgenticOS</h2>
              <p className="text-xs text-gray-500">goagenticos.com</p>
            </div>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>AgenticOS is a browser-based specification builder that helps business analysts write structured requirements using Gherkin format, domain modeling, and AI-powered spec generation via Claude.</p>
            <p className="pt-1">All data is stored locally in your browser using IndexedDB. No account or server required.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
