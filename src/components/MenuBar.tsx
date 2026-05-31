import { useState, useRef, useEffect, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { saveFileDialog } from '../services/fileSystem'
import { editorAPI } from './Editor'

interface Props {
  onOpenFile: () => void
  onOpenFolder: () => void
}

export default function MenuBar({ onOpenFile, onOpenFolder }: Props) {
  const { t } = useTranslation()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const openFiles = useAppStore((s) => s.openFiles)
  const activeFileIndex = useAppStore((s) => s.activeFileIndex)
  const closeFile = useAppStore((s) => s.closeFile)
  const setShowAIPanel = useAppStore((s) => s.setShowAIPanel)
  const setShowTerminal = useAppStore((s) => s.setShowTerminal)
  const setShowSettings = useAppStore((s) => s.setShowSettings)
  const setShowExtensions = useAppStore((s) => s.setShowExtensions)
  const showExtensions = useAppStore((s) => s.showExtensions)
  const showAIPanel = useAppStore((s) => s.showAIPanel)
  const showTerminal = useAppStore((s) => s.showTerminal)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSave = async () => {
    if (activeFileIndex >= 0 && openFiles[activeFileIndex]) {
      const file = openFiles[activeFileIndex]
      const result = await saveFileDialog(file.filePath, file.content)
      if (result) {
        useAppStore.getState().updateFileContent(activeFileIndex, file.content)
      }
    }
    setOpenMenu(null)
  }

  const handleSaveAs = async () => {
    if (activeFileIndex >= 0 && openFiles[activeFileIndex]) {
      const file = openFiles[activeFileIndex]
      const result = await saveFileDialog('', file.content)
      if (result) {
        const files = [...useAppStore.getState().openFiles]
        files[activeFileIndex] = { ...files[activeFileIndex], filePath: result }
        useAppStore.getState().setOpenFiles(files)
      }
    }
    setOpenMenu(null)
  }

  const handleNewFile = () => {
    useAppStore.getState().openFileInEditor({
      filePath: `new-file-${Date.now()}.txt`,
      content: '',
      isModified: false,
    })
    setOpenMenu(null)
  }

  const items: { label: string; key: string; children: { label: string; shortcut?: string; action: () => void }[] }[] = [
    {
      label: t('menu.file'), key: 'file',
      children: [
        { label: t('file.newFile'), shortcut: 'Ctrl+N', action: handleNewFile },
        { label: t('file.openFile'), shortcut: 'Ctrl+O', action: () => { onOpenFile(); setOpenMenu(null) } },
        { label: t('file.openFolder'), shortcut: 'Ctrl+K', action: () => { onOpenFolder(); setOpenMenu(null) } },
        { type: 'separator' } as any,
        { label: t('file.save'), shortcut: 'Ctrl+S', action: handleSave },
        { label: t('file.saveAs'), shortcut: 'Ctrl+Shift+S', action: handleSaveAs },
        { type: 'separator' } as any,
        { label: t('file.close'), action: () => { if (activeFileIndex >= 0) closeFile(activeFileIndex); setOpenMenu(null) } },
        { type: 'separator' } as any,
        { label: t('file.exit'), action: () => window.close() },
      ],
    },
    {
      label: t('menu.edit'), key: 'edit',
      children: [
        { label: t('edit.undo'), shortcut: 'Ctrl+Z', action: () => { editorAPI.undo?.(); setOpenMenu(null) } },
        { label: t('edit.redo'), shortcut: 'Ctrl+Shift+Z', action: () => { editorAPI.redo?.(); setOpenMenu(null) } },
        { type: 'separator' } as any,
        { label: t('edit.cut'), shortcut: 'Ctrl+X', action: () => { editorAPI.cut?.(); setOpenMenu(null) } },
        { label: t('edit.copy'), shortcut: 'Ctrl+C', action: () => { editorAPI.copy?.(); setOpenMenu(null) } },
        { label: t('edit.paste'), shortcut: 'Ctrl+V', action: () => { editorAPI.paste?.(); setOpenMenu(null) } },
        { label: t('edit.selectAll'), shortcut: 'Ctrl+A', action: () => { editorAPI.selectAll?.(); setOpenMenu(null) } },
      ],
    },
    {
      label: t('menu.view'), key: 'view',
      children: [
        { label: t('view.toggleSidebar'), shortcut: 'Ctrl+B', action: () => { setSettings({ ...settings, showSidebar: !settings.showSidebar }); setOpenMenu(null) } },
        { label: t('view.toggleTerminal'), shortcut: 'Ctrl+`', action: () => { setShowTerminal(!showTerminal); setOpenMenu(null) } },
        { label: t('view.toggleAIPanel'), shortcut: 'Ctrl+I', action: () => { setShowAIPanel(!showAIPanel); setOpenMenu(null) } },
        { label: t('view.swapLayout'), shortcut: '', action: () => { setSettings({ ...settings, swapLayout: !settings.swapLayout }); setOpenMenu(null) } },
        { label: t('view.newTerminal'), shortcut: 'Ctrl+Shift+N', action: () => { setShowTerminal(true); useAppStore.getState().setPendingTerminalAction('new'); setOpenMenu(null) } },
        { label: t('view.closeTerminal'), shortcut: 'Ctrl+Shift+W', action: () => { setShowTerminal(true); useAppStore.getState().setPendingTerminalAction('close'); setOpenMenu(null) } },
        { type: 'separator' } as any,
        { label: t('view.zoomIn'), shortcut: 'Ctrl+=', action: () => { document.body.style.zoom = `${(parseFloat(document.body.style.zoom || '1') + 0.1).toFixed(1)}`; setOpenMenu(null) } },
        { label: t('view.zoomOut'), shortcut: 'Ctrl+-', action: () => { document.body.style.zoom = `${Math.max(0.3, parseFloat(document.body.style.zoom || '1') - 0.1).toFixed(1)}`; setOpenMenu(null) } },
        { label: t('view.resetZoom'), shortcut: 'Ctrl+0', action: () => { document.body.style.zoom = '1'; setOpenMenu(null) } },
        { type: 'separator' } as any,
        { label: t('view.fullscreen'), shortcut: 'F11', action: () => { window.electronAPI?.toggleFullscreen(); setOpenMenu(null) } },
        { type: 'separator' } as any,
        { label: t('view.reload'), shortcut: 'Ctrl+R', action: () => { window.location.reload(); setOpenMenu(null) } },
        { label: t('view.devTools'), shortcut: 'Ctrl+Shift+I', action: () => { window.electronAPI?.toggleDevTools(); setOpenMenu(null) } },
      ],
    },
    {
      label: t('menu.settings'), key: 'settings',
      children: [
        { label: t('settings.title'), action: () => { setShowSettings(true); setOpenMenu(null) } },
      ],
    },
    {
      label: t('menu.extensions'), key: 'extensions',
      children: [
        { label: t('extensions.title'), action: () => { setShowExtensions(true); setOpenMenu(null) } },
      ],
    },
    {
      label: t('menu.help'), key: 'help',
      children: [
        { label: t('menu.about'), action: () => {
          window.electronAPI?.showMessageBox({
            type: 'info',
            title: t('menu.about'),
            message: `${t('app.name')} v${t('app.version')} – ${t('app.title')}`,
            buttons: [t('common.ok')],
          })
          setOpenMenu(null)
        }},
        { type: 'separator' } as any,
        { label: 'GitHub', action: () => {
          window.electronAPI?.openExternal('https://github.com/daimo/kursor', '')
          setOpenMenu(null)
        }},
      ],
    },
  ]

  return (
    <div style={{
      height: 'var(--menubar-height)',
      background: 'var(--bg-tertiary)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      gap: '4px',
      userSelect: 'none',
      flexShrink: 0,
      zIndex: 100,
    } as any} ref={menuRef}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', marginRight: 12, WebkitAppRegion: 'no-drag' } as any}>
        Kursor
      </div>
      {items.map((menu) => (
        <div key={menu.key} style={{ position: 'relative', WebkitAppRegion: 'no-drag' } as any}>
          <button
            style={{
              padding: '2px 8px',
              borderRadius: 3,
              fontSize: 12,
              background: openMenu === menu.key ? 'var(--bg-hover)' : 'transparent',
            } as any}
            onMouseEnter={() => openMenu && setOpenMenu(menu.key)}
            onClick={() => setOpenMenu(openMenu === menu.key ? null : menu.key)}
          >
            {menu.label}
          </button>
          {openMenu === menu.key && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              minWidth: 200,
              zIndex: 1000,
            } as any}>
              {menu.children.map((child: any, i: number) =>
                child.type === 'separator' ? (
                  <div key={i} style={{
                    height: 1,
                    background: 'var(--border-color)',
                    margin: '4px 8px',
                  }} />
                ) : (
                  <button
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '4px 16px',
                      fontSize: 12,
                      textAlign: 'left',
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={child.action}
                  >
                    <span>{child.label}</span>
                    {child.shortcut && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 24 }}>{child.shortcut}</span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
