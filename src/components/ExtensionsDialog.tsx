import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { Plugin } from '../types'
import { getActiveSession } from '../services/terminal'

const builtinSkills: Plugin[] = [
  { id: 'skill-analyze', name: 'Code Analysis', description: 'Analyze code for errors and improvements', type: 'builtin', enabled: true },
  { id: 'skill-design', name: 'Design Generator', description: 'Generate UI designs from descriptions', type: 'builtin', enabled: true },
  { id: 'skill-chat', name: 'AI Chat', description: 'Chat with AI assistant', type: 'builtin', enabled: true },
  { id: 'skill-terminal', name: 'Terminal Commands', description: 'Run terminal commands via AI', type: 'builtin', enabled: true },
  { id: 'skill-preview', name: 'Live Preview', description: 'Preview HTML files in editor', type: 'builtin', enabled: true },
]

const skillLocations: Record<string, string> = {
  'skill-analyze': 'extensions.locationAnalyze',
  'skill-design': 'extensions.locationDesign',
  'skill-chat': 'extensions.locationChat',
  'skill-terminal': 'extensions.locationTerminal',
  'skill-preview': 'extensions.locationPreview',
}

const examplePlugins: Plugin[] = [
  { id: 'ex-dir', name: 'Show Files', description: 'List current directory contents', type: 'custom', command: 'dir', args: [], enabled: true },
  { id: 'ex-nodev', name: 'Node.js Version', description: 'Check installed Node.js version', type: 'custom', command: 'node', args: ['-v'], enabled: true },
  { id: 'ex-npmv', name: 'npm Version', description: 'Check installed npm version', type: 'custom', command: 'npm', args: ['--version'], enabled: true },
  { id: 'ex-init', name: 'Init Project', description: 'Create package.json in current folder', type: 'custom', command: 'npm', args: ['init', '-y'], enabled: true },
  { id: 'ex-install-ts', name: 'Install TypeScript', description: 'Add TypeScript as dev dependency', type: 'custom', command: 'npm', args: ['install', 'typescript', '--save-dev'], enabled: true },
  { id: 'ex-install-eslint', name: 'Install ESLint', description: 'Add ESLint as dev dependency', type: 'custom', command: 'npm', args: ['install', 'eslint', '--save-dev'], enabled: true },
  { id: 'ex-node-eval', name: 'Test Node.js', description: 'Run a quick Node.js test', type: 'custom', command: 'node', args: ['-e', 'console.log("Node.js works!")'], enabled: true },
]

export default function ExtensionsDialog() {
  const { t } = useTranslation()
  const plugins = useAppStore((s) => s.plugins)
  const setPlugins = useAppStore((s) => s.setPlugins)
  const setShowExtensions = useAppStore((s) => s.setShowExtensions)
  const mcpServers = useAppStore((s) => s.aiConfig.mcpServers)
  const [name, setName] = useState('')
  const [cmd, setCmd] = useState('')
  const [args, setArgs] = useState('')
  const [showExamples, setShowExamples] = useState(false)
  const [skillHint, setSkillHint] = useState<string | null>(null)
  const examplesLoaded = useRef(false)

  useEffect(() => {
    let updated = plugins
    const outdated = ['ex-node', 'ex-eslint', 'ex-tscheck', 'ex-prettier', 'ex-jest', 'ex-ngrok', 'ex-vite']
    const hadOutdated = outdated.some(id => updated.find(p => p.id === id))
    if (hadOutdated) updated = updated.filter(p => !outdated.includes(p.id))
    if (!examplesLoaded.current && updated.length === 0) {
      examplesLoaded.current = true
      updated = examplePlugins
    }
    if (updated !== plugins) setPlugins(updated)
    examplesLoaded.current = true
  }, [])

  const handleToggle = (id: string) => {
    setPlugins(plugins.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p))
  }

  const handleRun = async (p: Plugin) => {
    if (!p.command) return
    setShowExtensions(false)
    const store = useAppStore.getState()
    if (!store.showTerminal) store.setShowTerminal(true)
    const cmd = p.command + (p.args?.length ? ' ' + p.args.join(' ') : '') + '\r\n'
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250))
      const session = getActiveSession()
      if (session?.processId && window.electronAPI) {
        window.electronAPI.terminalWrite(session.processId, cmd)
        return
      }
    }
  }

  const handleAdd = () => {
    if (!name || !cmd) return
    setPlugins([...plugins, { id: `custom-${Date.now()}`, name, description: args || cmd, type: 'custom', command: cmd, args: args.split(' ').filter(Boolean), enabled: true }])
    setName('')
    setCmd('')
    setArgs('')
  }

  const handleRemove = (id: string) => {
    setPlugins(plugins.filter(p => p.id !== id))
  }

  const handleAddExample = (ex: Plugin) => {
    if (plugins.find(p => p.id === ex.id)) return
    setPlugins([...plugins, { ...ex }])
  }

  const skillHints: Record<string, string> = {
    'skill-analyze': 'extensions.hintAnalyze',
    'skill-design': 'extensions.hintDesign',
    'skill-chat': 'extensions.hintChat',
    'skill-terminal': 'extensions.hintTerminal',
    'skill-preview': 'extensions.hintPreview',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }} onClick={() => setShowExtensions(false)}>
      <div style={{
        background: 'var(--bg-primary)', borderRadius: 8,
        padding: 20, minWidth: 520, maxWidth: 600, maxHeight: '85vh', overflow: 'auto',
        border: '1px solid var(--border-color)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
          {t('extensions.title')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          {t('extensions.subtitle')}
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('extensions.sectionBuiltin')}
        </div>
        {builtinSkills.map((p) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', marginBottom: 3,
            borderRadius: 6, fontSize: 12, cursor: 'pointer',
            background: 'var(--bg-tertiary)',
          }} onClick={() => setSkillHint(skillHint === p.id ? null : p.id)}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: 'var(--accent, #0078d4)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t(`extensions.desc.${p.id}` as any)}</div>
              {skillHint === p.id && (
                <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4, padding: '4px 6px', background: 'var(--bg-hover)', borderRadius: 4 }}>
                  {t(skillHints[p.id] as any)}
                </div>
              )}
            </div>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', padding: '2px 6px', whiteSpace: 'nowrap' }}>{t(skillLocations[p.id] as any)}</span>
          </div>
        ))}

        {mcpServers.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('extensions.sectionMcp')} ({mcpServers.length})
            </div>
            {mcpServers.map((m) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', marginBottom: 3,
                borderRadius: 6, fontSize: 12,
                background: 'var(--bg-tertiary)',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: '#8b5cf6' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.command} {m.args.join(' ')}</div>
                </div>
              </div>
            ))}
          </>
        )}

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('extensions.sectionCustom')} ({plugins.length})
        </div>
        {plugins.length === 0 ? (
          <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {t('extensions.noCustom')}
          </div>
        ) : (
          plugins.map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', marginBottom: 3,
              borderRadius: 6, fontSize: 12,
              background: 'var(--bg-tertiary)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: '#10b981' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.command}{p.args?.length ? ' ' + p.args.join(' ') : ''}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{p.description}</div>
              </div>
              <button className="btn btn-sm" style={{ fontSize: 10, padding: '1px 6px', color: 'var(--accent)' }}
                onClick={() => handleRun(p)} title={t('extensions.run')}>
                ▶
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 10, whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={p.enabled} onChange={() => handleToggle(p.id)} />
                {p.enabled ? t('extensions.on') : t('extensions.off')}
              </label>
              <button className="btn btn-sm" style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => handleRemove(p.id)}>×</button>
            </div>
          ))
        )}

        <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('extensions.addCustom')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ flex: 1, padding: '4px 8px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }}
                placeholder={t('extensions.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
              <input style={{ flex: 1, padding: '4px 8px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }}
                placeholder={t('extensions.cmdPlaceholder')} value={cmd} onChange={(e) => setCmd(e.target.value)} />
              <input style={{ flex: 1, padding: '4px 8px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }}
                placeholder={t('extensions.argsPlaceholder')} value={args} onChange={(e) => setArgs(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setShowExamples(!showExamples)}>
                {showExamples ? t('extensions.hideExamples') : t('extensions.showExamples')}
              </button>
              <button className="btn btn-sm btn-primary" style={{ fontSize: 10 }} onClick={handleAdd}>
                + {t('extensions.addBtn')}
              </button>
            </div>
          </div>

          {showExamples && (
            <div style={{ marginTop: 8, border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ fontSize: 10, fontWeight: 600, padding: '6px 8px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                {t('extensions.examplesTitle')}
              </div>
              {examplePlugins.map((ex) => {
                const alreadyAdded = !!plugins.find(p => p.id === ex.id)
                return (
                  <div key={ex.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 8px', fontSize: 11,
                    borderBottom: '1px solid var(--border-color)',
                    background: alreadyAdded ? 'var(--bg-active, rgba(0,0,0,0.05))' : 'transparent',
                  }}>
                    <code style={{
                      fontSize: 10, background: 'var(--bg-hover)', padding: '1px 4px',
                      borderRadius: 3, fontFamily: 'monospace', minWidth: 140,
                    }}>{ex.command} {ex.args?.join(' ')}</code>
                    <span style={{ flex: 1 }}>{ex.name}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{ex.description}</span>
                    <button className="btn btn-sm" style={{ fontSize: 9, padding: '1px 6px' }}
                      disabled={alreadyAdded}
                      onClick={() => handleAddExample(ex)}>
                      {alreadyAdded ? '✓' : '+'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
