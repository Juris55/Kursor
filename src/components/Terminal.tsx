import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, selectActiveFolder } from '../store'
import { createTerminal, closeTerminal, activateTerminal, fitTerminal, clearTerminal, disposeTerminal, sendCdToTerminal, setTerminalTheme, getSessions, getActiveSessionId } from '../services/terminal'
import 'xterm/css/xterm.css'

export default function TerminalPanel() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const currentFolder = useAppStore(selectActiveFolder)
  const [sessions, setSessions] = useState<Array<{ id: string; type: string }>>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [showHotkeys, setShowHotkeys] = useState(false)
  const initializedRef = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const refreshSessions = () => {
    setSessions(getSessions())
    setActiveId(getActiveSessionId())
  }

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    const panelEl = panelRef.current
    if (!panelEl) return
    const container = document.createElement('div')
    container.style.cssText = 'flex:1;padding:4px;overflow:hidden'
    panelEl.appendChild(container)
    ;(async () => {
      const id = await createTerminal(container, settings.terminal, settings.theme as 'dark' | 'light')
      refreshSessions()
      const folderNow = useAppStore.getState().currentFolder
      if (folderNow) {
        sendCdToTerminal(folderNow, settings.terminal)
      }
      setTimeout(() => {
        fitTerminal(id)
        const handleResize = () => fitTerminal(id)
        window.addEventListener('resize', handleResize)
        const resizeObserver = new ResizeObserver(() => fitTerminal(id))
        resizeObserver.observe(container)
      }, 100)
    })()
    return () => {
      disposeTerminal()
      if (panelEl) {
        while (panelEl.firstChild) panelEl.removeChild(panelEl.firstChild)
      }
      initializedRef.current = false
    }
  }, [])

  useEffect(() => {
    setTerminalTheme(settings.theme as 'dark' | 'light')
  }, [settings.theme])

  useEffect(() => {
    if (initializedRef.current && currentFolder) {
      sendCdToTerminal(currentFolder, settings.terminal)
    }
  }, [currentFolder])

  useEffect(() => {
    if (!showNewMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false)
      }
    }
    setTimeout(() => document.addEventListener('click', handler), 0)
    return () => document.removeEventListener('click', handler)
  }, [showNewMenu])

  // Keyboard shortcuts: Ctrl+Shift+N new terminal, Ctrl+Shift+W close terminal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod || !e.shiftKey) return
      if (e.key === 'N' || e.code === 'KeyN') {
        e.preventDefault()
        setShowNewMenu(true)
      }
      if ((e.key === 'W' || e.code === 'KeyW') && activeId) {
        e.preventDefault()
        closeActiveTab()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [activeId, sessions])

  // Watch for pending terminal actions from menu/toolbar
  const pendingAction = useAppStore((s) => s.pendingTerminalAction)
  const setPendingAction = useAppStore((s) => s.setPendingTerminalAction)
  useEffect(() => {
    if (!pendingAction) return
    if (pendingAction === 'new') setShowNewMenu(true)
    else if (pendingAction === 'close') closeActiveTab()
    setPendingAction(null)
  }, [pendingAction])

  const handleClear = () => clearTerminal()

  const handleNewTerminal = async (type: 'powershell' | 'cmd') => {
    setShowNewMenu(false)
    const panelEl = panelRef.current
    if (!panelEl) return
    const newContainer = document.createElement('div')
    newContainer.style.cssText = 'flex:1;padding:4px;overflow:hidden'
    panelEl.appendChild(newContainer)
    const id = await createTerminal(newContainer, type, settings.theme as 'dark' | 'light')
    activateTerminal(id)
    refreshSessions()
    const folderNow = useAppStore.getState().currentFolder
    if (folderNow) {
      sendCdToTerminal(folderNow, settings.terminal)
    }
    setTimeout(() => fitTerminal(id), 100)
  }

  const handleSelectTab = (id: string) => {
    activateTerminal(id)
    refreshSessions()
    setTimeout(() => fitTerminal(id), 50)
  }

  const closeActiveTab = async () => {
    if (!activeId) return
    if (sessions.length <= 1) {
      useAppStore.getState().setShowTerminal(false)
      return
    }
    const id = activeId
    const idx = sessions.findIndex(s => s.id === id)
    const nextIdx = idx > 0 ? idx - 1 : 1
    if (sessions[nextIdx]) {
      activateTerminal(sessions[nextIdx].id)
    }
    await closeTerminal(id)
    refreshSessions()
    setTimeout(() => fitTerminal(getActiveSessionId() || undefined), 50)
  }

  const handleCloseTab = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (sessions.length <= 1) return
    if (id === activeId) {
      await closeActiveTab()
    } else {
      await closeTerminal(id)
      refreshSessions()
      setTimeout(() => fitTerminal(getActiveSessionId() || undefined), 50)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
        minHeight: 32,
      }}>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => handleSelectTab(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: 12,
                color: s.id === activeId ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: s.id === activeId ? 'var(--bg-secondary)' : 'transparent',
                borderRight: '1px solid var(--border-color)',
                borderBottom: s.id === activeId ? '2px solid var(--accent-color, #0078d4)' : '2px solid transparent',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 10 }}>{s.type === 'powershell' ? '>' : (s.type === 'cmd' ? 'C:' : '$')}</span>
              <span>{s.type === 'powershell' ? t('terminal.powershell') : s.type === 'cmd' ? t('terminal.cmd') : s.type}</span>
              {sessions.length > 1 && (
                <span
                  onClick={(e) => handleCloseTab(e, s.id)}
                  style={{
                    fontSize: 12,
                    lineHeight: '12px',
                    cursor: 'pointer',
                    opacity: 0.5,
                    padding: '0 2px',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseOut={(e) => (e.currentTarget.style.opacity = '0.5')}
                >
                  x
                </span>
              )}
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', padding: '0 4px' }} ref={menuRef}>
          <button
            className="btn btn-sm"
            onClick={() => setShowNewMenu(!showNewMenu)}
            style={{ fontSize: 14, lineHeight: '14px', padding: '2px 6px' }}
            title={t('terminal.newTerminal')}
          >
            +
          </button>
          {showNewMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                zIndex: 100,
                minWidth: 140,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <div
                onClick={() => handleNewTerminal('powershell')}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-hover, rgba(128,128,128,0.15))')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                PowerShell
              </div>
              <div
                onClick={() => handleNewTerminal('cmd')}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-hover, rgba(128,128,128,0.15))')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Command Prompt
              </div>
            </div>
          )}
        </div>
        <button className="btn btn-sm" onClick={handleClear} style={{ marginRight: 4 }}>
          {t('terminal.clear')}
        </button>
        <button className="btn btn-sm" onClick={() => setShowHotkeys(true)} style={{ marginRight: 4, fontSize: 12, padding: '2px 6px' }}>
          ⌨
        </button>
      </div>

      {showHotkeys && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
        }} onClick={() => setShowHotkeys(false)}>
          <div style={{
            background: 'var(--bg-primary)', borderRadius: 8,
            padding: 20, minWidth: 400, maxWidth: 500, maxHeight: '80vh', overflow: 'auto',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              {t('terminal.hotkeys')}
            </div>
            {[
              { keys: 'Ctrl+`', desc: t('terminal.hotkeyToggleTerminal') },
              { keys: 'Ctrl+B', desc: t('terminal.hotkeyToggleSidebar') },
              { keys: 'Ctrl+I', desc: t('terminal.hotkeyToggleAI') },
              { keys: 'Ctrl+Shift+N', desc: t('terminal.hotkeyNewTab') },
              { keys: 'Ctrl+Shift+W', desc: t('terminal.hotkeyCloseTab') },
              { keys: 'Ctrl+L', desc: t('terminal.hotkeyClear') },
              { keys: 'Ctrl+C', desc: t('terminal.hotkeyCopy') },
              { keys: 'Ctrl+V', desc: t('terminal.hotkeyPaste') },
              { keys: 'Delete', desc: t('terminal.hotkeyDelete') },
              { keys: 'Ctrl+S', desc: t('terminal.hotkeySave') },
              { keys: 'F5', desc: t('terminal.hotkeyReload') },
              { keys: 'F11', desc: t('terminal.hotkeyFullscreen') },
            ].map(({ keys, desc }) => (
              <div key={keys} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '4px 0', fontSize: 12,
              }}>
                <kbd style={{
                  background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                  borderRadius: 3, padding: '2px 6px', fontSize: 11,
                  fontFamily: 'monospace', minWidth: 100, textAlign: 'center',
                }}>{keys}</kbd>
                <span style={{ color: 'var(--text-secondary)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        ref={panelRef}
        className="terminal-panel-inner"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}
      />
    </div>
  )
}
