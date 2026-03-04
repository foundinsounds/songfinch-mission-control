'use client'

import { useState } from 'react'

const TEMPLATE_STORAGE = 'roundtable-templates'

function getStoredTemplates() {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATES
  try {
    const saved = JSON.parse(localStorage.getItem(TEMPLATE_STORAGE))
    return saved && saved.length > 0 ? saved : DEFAULT_TEMPLATES
  } catch { return DEFAULT_TEMPLATES }
}

function storeTemplates(templates) {
  localStorage.setItem(TEMPLATE_STORAGE, JSON.stringify(templates))
}

const DEFAULT_TEMPLATES = [
  {
    id: '1', name: 'Social Post — Emotional Hook', category: 'Social Post',
    prompt: 'Write a social media post for {{platform}} that leads with the emotional moment of {{emotion}}. The post should tell a micro-story in 2-3 sentences, then connect it to Songfinch\'s ability to turn that moment into a personalized song. Include 3-5 relevant hashtags. Tone: warm, genuine, never salesy.',
    variables: ['platform', 'emotion'],
  },
  {
    id: '2', name: 'Ad Copy — Pain Point', category: 'Ad Copy',
    prompt: 'Create ad copy targeting {{audience}} who struggle with {{pain_point}}. Lead with empathy, acknowledge the challenge, then position Songfinch as the solution. Include: headline (max 40 chars), body copy (max 125 chars), and CTA. Create A/B variations.',
    variables: ['audience', 'pain_point'],
  },
  {
    id: '3', name: 'Blog Post — SEO Optimized', category: 'Blog Post',
    prompt: 'Write an SEO-optimized blog post about "{{topic}}" targeting the keyword "{{keyword}}". Include: compelling title with keyword, meta description (155 chars), introduction with hook, 3-5 H2 sections, internal linking opportunities, and conclusion with CTA to Songfinch. Word count: 1200-1500.',
    variables: ['topic', 'keyword'],
  },
  {
    id: '4', name: 'Video Script — Testimonial Style', category: 'Video Script',
    prompt: 'Write a {{duration}}-second video script in testimonial style about {{occasion}}. Structure: Hook (3s) → Setup the moment (10s) → The Songfinch experience (15s) → Emotional payoff (10s) → CTA (5s). Include visual direction notes and text overlays.',
    variables: ['duration', 'occasion'],
  },
  {
    id: '5', name: 'Email — Nurture Sequence', category: 'Email',
    prompt: 'Write email {{sequence_number}} of a nurture sequence for {{segment}}. Subject line (max 50 chars), preview text (90 chars), body with personal tone, and clear CTA. This email should focus on: {{focus_area}}. Maintain Songfinch\'s warm, emotion-first voice.',
    variables: ['sequence_number', 'segment', 'focus_area'],
  },
]

export default function TemplateLibrary() {
  const [templates, setTemplates] = useState(() => getStoredTemplates())
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState('All')
  const [form, setForm] = useState({ name: '', category: 'Social Post', prompt: '', variables: '' })

  const categories = ['All', ...new Set(templates.map(t => t.category))]
  const filtered = filterCategory === 'All' ? templates : templates.filter(t => t.category === filterCategory)

  const handleCreate = () => {
    if (!form.name.trim() || !form.prompt.trim()) return
    const vars = form.prompt.match(/\{\{(\w+)\}\}/g)?.map(v => v.replace(/\{\{|\}\}/g, '')) || []
    const template = {
      id: Date.now().toString(),
      name: form.name,
      category: form.category,
      prompt: form.prompt,
      variables: vars,
    }
    const updated = [...templates, template]
    setTemplates(updated)
    storeTemplates(updated)
    setForm({ name: '', category: 'Social Post', prompt: '', variables: '' })
    setShowForm(false)
  }

  const deleteTemplate = (id) => {
    const updated = templates.filter(t => t.id !== id)
    setTemplates(updated)
    storeTemplates(updated)
    if (selectedTemplate?.id === id) setSelectedTemplate(null)
  }

  const copyPrompt = (prompt) => {
    navigator.clipboard.writeText(prompt)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-gray-200">Template Library</h2>
          <span className="text-xs bg-dark-600 px-2 py-0.5 rounded-full text-gray-400">{templates.length} templates</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`text-[10px] px-2 py-1 rounded-md transition-all ${
                  filterCategory === cat ? 'bg-accent-orange/15 text-accent-orange font-semibold' : 'text-gray-500 hover:text-gray-300'
                }`}
              >{cat}</button>
            ))}
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="text-xs px-3 py-1.5 bg-accent-orange/20 text-accent-orange rounded-md hover:bg-accent-orange/30 transition-colors font-semibold">
            + New Template
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="px-4 py-4 border-b border-dark-500 bg-dark-800/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input type="text" placeholder="Template Name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40" />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-accent-orange/40">
              <option>Social Post</option><option>Ad Copy</option><option>Blog Post</option>
              <option>Video Script</option><option>Email</option><option>Landing Page</option>
              <option>Strategy</option><option>General</option>
            </select>
          </div>
          <textarea placeholder="Template prompt... Use {{variable_name}} for dynamic values"
            value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })}
            className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40 resize-none mb-3 font-mono"
            rows={4} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
            <button onClick={handleCreate} disabled={!form.name.trim() || !form.prompt.trim()}
              className="text-xs px-4 py-1.5 bg-accent-green/20 text-accent-green rounded-md hover:bg-accent-green/30 transition-colors font-semibold disabled:opacity-30">
              Save Template
            </button>
          </div>
        </div>
      )}

      {/* Template Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(template => (
            <div key={template.id}
              className={`bg-dark-700 rounded-lg border p-4 cursor-pointer transition-colors ${
                selectedTemplate?.id === template.id ? 'border-accent-orange/40' : 'border-dark-500 hover:border-dark-400'
              }`}
              onClick={() => setSelectedTemplate(selectedTemplate?.id === template.id ? null : template)}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-100">{template.name}</h3>
                  <span className="text-[10px] text-gray-500">{template.category}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={e => { e.stopPropagation(); copyPrompt(template.prompt) }}
                    className="text-[10px] px-2 py-1 bg-dark-600 text-gray-400 rounded hover:text-gray-200 transition-colors" title="Copy prompt">
                    Copy
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteTemplate(template.id) }}
                    className="text-gray-600 hover:text-red-400 transition-colors p-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </div>
              </div>

              {/* Variables */}
              {template.variables.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-2">
                  {template.variables.map(v => (
                    <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}

              {/* Preview */}
              <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">{template.prompt}</p>

              {/* Expanded View */}
              {selectedTemplate?.id === template.id && (
                <div className="mt-3 pt-3 border-t border-dark-500">
                  <div className="bg-dark-900 rounded-lg p-3 border border-dark-500">
                    <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{template.prompt}</pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
