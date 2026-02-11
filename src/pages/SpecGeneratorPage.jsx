import React, { useState } from 'react'
import { useLiveQuery } from '../hooks/useLiveQuery.js'
import { saveGeneratedSpec, getProject, getRequirements, getDomains, getTestCases, getDataBags, getGeneratedSpecs } from '../db/database.js'
import { useStore } from '../store/useStore.js'
import Anthropic from '@anthropic-ai/sdk'
import { Sparkles, Copy, Download, Loader2, ChevronDown, Clock, Code2 } from 'lucide-react'

const CLAUDE_MODELS = [
  { id: 'claude-opus-4-5-20251101',        label: 'Claude Opus 4.5 (Most capable)' },
  { id: 'claude-sonnet-4-5-20250929',      label: 'Claude Sonnet 4.5 (Balanced)' },
  { id: 'claude-haiku-3-5-20241022',       label: 'Claude Haiku 3.5 (Fast)' },
]

const SPEC_TYPES = [
  { id: 'functional',   label: 'Functional Specification',   description: 'Detailed functional requirements document' },
  { id: 'technical',    label: 'Technical Design Spec',      description: 'Architecture and implementation details' },
  { id: 'bdd',          label: 'BDD Feature Files',          description: 'Cucumber/Gherkin .feature files' },
  { id: 'api',          label: 'API Specification (OpenAPI)', description: 'OpenAPI 3.0 YAML specification' },
  { id: 'test-plan',    label: 'Test Plan',                  description: 'Comprehensive test plan document' },
  { id: 'user-stories', label: 'User Stories',               description: 'Agile user stories with acceptance criteria' },
]

function buildPrompt(project, requirements, domains, testCases, dataBags, specType) {
  const domainSection = domains.map(d =>
    `Domain: ${d.name}\nDescription: ${d.description || 'N/A'}\nAttributes:\n${
      (d.attributes || []).map(a => `  - ${a.name} (${a.type})${a.required ? ' [required]' : ''}${a.description ? ': ' + a.description : ''}`).join('\n')
    }`
  ).join('\n\n')

  const reqSection = requirements.map(r => {
    const given = (r.gherkin?.given || []).map(s => `    Given ${s}`).join('\n')
    const when = (r.gherkin?.when || []).map((s, i) => `    ${i === 0 ? 'When' : 'And'} ${s}`).join('\n')
    const then = (r.gherkin?.then || []).map((s, i) => `    ${i === 0 ? 'Then' : 'And'} ${s}`).join('\n')
    return `Requirement: ${r.title} [${r.status}]\nDescription: ${r.description || 'N/A'}\nScenario:\n${[given, when, then].filter(Boolean).join('\n')}`
  }).join('\n\n')

  const tcSection = testCases.map(tc =>
    `Test Case: ${tc.name} [${tc.status}]\nLinked Requirement: ${requirements.find(r => r.id === tc.requirementId)?.title || 'N/A'}\nSteps: ${(tc.steps || []).map(s => `${s.type}: ${s.description}`).join('; ')}`
  ).join('\n\n')

  const specInstructions = {
    functional:   'Generate a detailed functional specification document with sections for: Overview, Scope, Business Rules, Functional Requirements (derived from the Gherkin scenarios), Non-Functional Requirements, and Constraints. Use markdown formatting.',
    technical:    'Generate a technical design specification with: System Architecture, Component Design, Data Models (based on domains), API Design, Integration Points, and Technical Constraints. Use markdown.',
    bdd:          'Generate Gherkin .feature files for each requirement. Use proper Feature, Background, Scenario, and Scenario Outline structures with Examples tables where appropriate.',
    api:          'Generate an OpenAPI 3.0 YAML specification. Include paths, request/response schemas based on the domain models, and proper HTTP methods.',
    'test-plan':  'Generate a comprehensive test plan with: Test Strategy, Test Scope, Test Cases (based on the provided test cases), Test Environment, Entry/Exit Criteria, and Risk Assessment.',
    'user-stories': 'Generate Agile user stories in "As a [role], I want [goal], So that [benefit]" format for each requirement, with acceptance criteria derived from the Gherkin steps.',
  }

  return `You are an expert software architect and business analyst. Generate a ${specInstructions[specType] || 'software specification'} based on the following project information.

PROJECT: ${project?.name || 'Untitled'}
${project?.description ? `Description: ${project.description}\n` : ''}

=== DOMAIN MODELS ===
${domainSection || 'No domains defined'}

=== REQUIREMENTS (Gherkin Format) ===
${reqSection || 'No requirements defined'}

=== TEST CASES ===
${tcSection || 'No test cases defined'}

${dataBags.length > 0 ? `=== TEST DATA BAGS ===\n${dataBags.map(b => `${b.name}: ${b.records?.length || 0} rows, columns: ${b.schema?.map(c => c.name).join(', ')}`).join('\n')}` : ''}

---
${SPEC_TYPES.find(s => s.id === specType)?.description || ''}
${specInstructions[specType] || ''}

Be thorough, professional, and align the specification with the provided Gherkin requirements and domain models.`
}

function SpecCard({ spec, index }) {
  const [collapsed, setCollapsed] = useState(index > 0)
  const copySpec = () => navigator.clipboard.writeText(spec.content)
  const downloadSpec = () => {
    const ext = spec.specType === 'api' ? 'yaml' : spec.specType === 'bdd' ? 'feature' : 'md'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([spec.content], { type: 'text/plain' }))
    a.download = `spec-${spec.specType}-${new Date(spec.createdAt).toISOString().slice(0, 10)}.${ext}`
    a.click()
  }

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <Code2 size={15} className="text-brand-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-gray-200">
              {SPEC_TYPES.find(s => s.id === spec.specType)?.label || spec.specType}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span>{spec.model?.split('-').slice(1, 3).join(' ')}</span>
              <span>•</span>
              <Clock size={10} />
              <span>{new Date(spec.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost p-1.5" title="Copy" onClick={e => { e.stopPropagation(); copySpec() }}><Copy size={13} /></button>
          <button className="btn-ghost p-1.5" title="Download" onClick={e => { e.stopPropagation(); downloadSpec() }}><Download size={13} /></button>
          <ChevronDown size={15} className={`text-gray-500 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </div>
      {!collapsed && (
        <div className="border-t border-gray-800 overflow-auto max-h-[60vh]">
          <pre className="text-xs text-gray-300 p-4 whitespace-pre-wrap font-mono leading-relaxed">{spec.content}</pre>
        </div>
      )}
    </div>
  )
}

export default function SpecGeneratorPage() {
  const { activeProjectId, claudeApiKey, claudeModel, setClaudeModel } = useStore()
  const [specType, setSpecType] = useState('functional')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [streamOutput, setStreamOutput] = useState('')

  const project        = useLiveQuery(() => activeProjectId ? getProject(activeProjectId)       : Promise.resolve(null), [activeProjectId])
  const requirements   = useLiveQuery(() => activeProjectId ? getRequirements(activeProjectId)  : Promise.resolve([]),   [activeProjectId])
  const domains        = useLiveQuery(() => activeProjectId ? getDomains(activeProjectId)        : Promise.resolve([]),   [activeProjectId])
  const testCases      = useLiveQuery(() => activeProjectId ? getTestCases(activeProjectId)      : Promise.resolve([]),   [activeProjectId])
  const dataBags       = useLiveQuery(() => activeProjectId ? getDataBags(activeProjectId)       : Promise.resolve([]),   [activeProjectId])
  const generatedSpecs = useLiveQuery(() => activeProjectId ? getGeneratedSpecs(activeProjectId) : Promise.resolve([]),   [activeProjectId])

  const { setClaudeApiKey } = useStore()
  const [localKey, setLocalKey] = useState('')

  const handleGenerate = async () => {
    const apiKey = claudeApiKey || localKey
    if (!apiKey) { setError('Please enter your Claude API key in Settings or below.'); return }
    if (!requirements?.length) { setError('Add at least one requirement before generating a specification.'); return }

    setError('')
    setGenerating(true)
    setStreamOutput('')

    try {
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
      const prompt = buildPrompt(project, requirements, domains || [], testCases || [], dataBags || [], specType)

      let fullText = ''
      const stream = await client.messages.stream({
        model: claudeModel,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
          fullText += chunk.delta.text
          setStreamOutput(fullText)
        }
      }

      await saveGeneratedSpec({
        projectId: activeProjectId,
        content: fullText,
        model: claudeModel,
        specType,
        prompt
      })
      setStreamOutput('')
    } catch (err) {
      setError(err.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const hasApiKey = !!(claudeApiKey || localKey)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Spec Generator</h1>
          <p className="text-sm text-gray-500 mt-0.5">Use Claude AI to generate software specifications from your requirements</p>
        </div>
      </div>

      {/* Config panel */}
      <div className="card p-5 mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Claude Model</label>
            <select className="input" value={claudeModel} onChange={e => setClaudeModel(e.target.value)}>
              {CLAUDE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Specification Type</label>
            <select className="input" value={specType} onChange={e => setSpecType(e.target.value)}>
              {SPEC_TYPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {!claudeApiKey && (
          <div>
            <label className="label">API Key (or set in Settings)</label>
            <input
              type="password"
              className="input"
              value={localKey}
              onChange={e => setLocalKey(e.target.value)}
              placeholder="sk-ant-api03-..."
            />
            <div className="text-[10px] text-gray-600 mt-1">Your key is stored locally and never sent to any server other than Anthropic.</div>
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-800 pt-3">
          <span><strong className="text-gray-300">{requirements?.length || 0}</strong> requirements</span>
          <span><strong className="text-gray-300">{domains?.length || 0}</strong> domains</span>
          <span><strong className="text-gray-300">{testCases?.length || 0}</strong> test cases</span>
          <span><strong className="text-gray-300">{dataBags?.length || 0}</strong> data bags</span>
        </div>

        {error && <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-2">{error}</div>}

        <button
          className="btn-primary w-full justify-center py-2.5"
          onClick={handleGenerate}
          disabled={generating || !hasApiKey || !requirements?.length}
        >
          {generating ? (
            <><Loader2 size={16} className="animate-spin" /> Generating...</>
          ) : (
            <><Sparkles size={16} /> Generate {SPEC_TYPES.find(s => s.id === specType)?.label}</>
          )}
        </button>
      </div>

      {/* Streaming output */}
      {generating && streamOutput && (
        <div className="card mb-6 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-2 text-xs text-brand-400">
            <Loader2 size={12} className="animate-spin" /> Generating...
          </div>
          <pre className="text-xs text-gray-300 p-4 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">{streamOutput}</pre>
        </div>
      )}

      {/* History */}
      {generatedSpecs?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
            Generated Specifications ({generatedSpecs.length})
          </h2>
          <div className="space-y-3">
            {generatedSpecs.map((spec, i) => (
              <SpecCard key={spec.id} spec={spec} index={i} />
            ))}
          </div>
        </div>
      )}

      {!generating && !generatedSpecs?.length && (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center mb-3">
            <Sparkles size={24} className="text-brand-400" />
          </div>
          <p className="text-sm text-gray-500">Configure a model and specification type above, then click Generate</p>
        </div>
      )}
    </div>
  )
}
