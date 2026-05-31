import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'

export default function StatusBar() {
  const { t } = useTranslation()
  const openFiles = useAppStore((s) => s.openFiles)
  const activeFileIndex = useAppStore((s) => s.activeFileIndex)
  const settings = useAppStore((s) => s.settings)
  const setShowAIPanel = useAppStore((s) => s.setShowAIPanel)
  const setShowTerminal = useAppStore((s) => s.setShowTerminal)
  const showTerminal = useAppStore((s) => s.showTerminal)
  const showAIPanel = useAppStore((s) => s.showAIPanel)
  const aiConfig = useAppStore((s) => s.aiConfig)
  const [localIP, setLocalIP] = useState('')

  useEffect(() => {
    const refresh = () => {
      window.electronAPI?.getLocalIP().then(setLocalIP).catch(() => setLocalIP('127.0.0.1'))
    }
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [])

  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null
  const activeModel = aiConfig.providers.find((p) => p.id === aiConfig.activeProviderId)?.models.find((m) => m.id === aiConfig.activeModelId)
  const allProxyAddrs = aiConfig.providers.filter(p => p.proxy).map(p => `${p.proxy!.host}:${p.proxy!.port}`)
  const proxyAddr = allProxyAddrs.length > 0 ? allProxyAddrs.join(', ') : ''
  const activeProvider = aiConfig.providers.find(p => p.id === aiConfig.activeProviderId)
  const activeProxy = activeProvider?.proxy ? `${activeProvider.proxy.host}:${activeProvider.proxy.port}` : ''

  return (
    <div style={{
      height: 'var(--statusbar-height)',
      background: 'var(--accent)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 15px',
      fontSize: 11,
      color: '#ffffff',
      flexShrink: 0,
      gap: 12,
    }}>
      <button
        style={{ color: '#fff', fontSize: 11, background: 'none', opacity: 0.9 }}
        onClick={() => setShowTerminal(!showTerminal)}
      >
        {settings.terminal === 'powershell' ? 'PowerShell' : settings.terminal === 'cmd' ? 'CMD' : settings.terminal === 'zsh' ? 'Zsh' : 'Bash'}
      </button>
      <div style={{ flex: 1 }} />
      {localIP && <span style={{ opacity: 0.7 }} title="Local IP">🌐 {localIP}</span>}
      {activeProxy ? (
        <span style={{ opacity: 0.9, fontStyle: 'italic', background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: 3 }} title="Active provider proxy">⬡ {activeProxy}</span>
      ) : proxyAddr ? (
        <span style={{ opacity: 0.7, fontStyle: 'italic' }} title="Inactive provider proxy">⬡ {proxyAddr}</span>
      ) : null}
      {activeModel && (
        <button
          style={{ color: '#fff', fontSize: 11, background: 'none', opacity: 0.9 }}
          onClick={() => setShowAIPanel(!showAIPanel)}
        >
          MI: {activeModel.name}
        </button>
      )}
      {activeFile && (
        <>
          <span style={{ opacity: 0.8 }}>{activeFile.filePath.split(/[\\/]/).pop()}</span>
          {activeFile.isModified && <span style={{ opacity: 0.8 }}>•</span>}
          <span style={{ opacity: 0.7 }}>{t('status.encoding')}</span>
        </>
      )}
      <span style={{ opacity: 0.7 }}>Kursor v2.0.0</span>
    </div>
  )
}
