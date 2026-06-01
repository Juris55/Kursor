import { useEffect, useCallback, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, loadSession, persistSession, selectActiveFolder } from './store'
import { openFileDialog, saveFileDialog, openFolderDialog, listDirectory, readFileContent, getLanguageFromExtension, getFileExtension } from './services/fileSystem'
import { sendCdToTerminal } from './services/terminal'
import MenuBar from './components/MenuBar'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import Terminal from './components/Terminal'
import AIChat from './components/AIChat'
import StatusBar from './components/StatusBar'
import SettingsDialog from './components/SettingsDialog'
import ExtensionsDialog from './components/ExtensionsDialog'
import PermissionDialog from './components/PermissionDialog'
import './App.css'

export default function App() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const showTerminal = useAppStore((s) => s.showTerminal)
  const showAIPanel = useAppStore((s) => s.showAIPanel)
  const showSettings = useAppStore((s) => s.showSettings)
  const showExtensions = useAppStore((s) => s.showExtensions)
  const openFileInEditor = useAppStore((s) => s.openFileInEditor)
  const setCurrentFolder = useAppStore((s) => s.setCurrentFolder)
  const setFolderFiles = useAppStore((s) => s.setFolderFiles)
  const setShowSettings = useAppStore((s) => s.setShowSettings)
  const setSettings = useAppStore((s) => s.setSettings)

  const [dragging, setDragging] = useState<'sidebar' | 'ai' | 'terminal' | null>(null)
  const dragStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    document.title = t('app.title')
  }, [settings.theme, t])

  useEffect(() => {
    loadSession()
    const handleClose = () => persistSession()
    window.addEventListener('beforeunload', handleClose)
    return () => window.removeEventListener('beforeunload', handleClose)
  }, [])

  const currentFolder = useAppStore(selectActiveFolder)
  const terminalType = useAppStore((s) => s.settings.terminal)
  useEffect(() => {
    if (currentFolder) {
      sendCdToTerminal(currentFolder, terminalType)
    }
  }, [currentFolder, terminalType])

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onFileOpened(async (data) => {
        const ext = getFileExtension(data.filePath)
        openFileInEditor({
          filePath: data.filePath,
          content: data.content,
          isModified: false,
        })
      })

      window.electronAPI.onFolderOpened(async (data) => {
        setCurrentFolder(data.folderPath)
        const files = await listDirectory(data.folderPath)
        setFolderFiles(files)
      })
    }
  }, [])

  const handleOpenFile = useCallback(async () => {
    const result = await openFileDialog()
    if (result) {
      const ext = getFileExtension(result.filePath)
      openFileInEditor({
        filePath: result.filePath,
        content: result.content,
        isModified: false,
      })
    }
  }, [])

  useEffect(() => {
    if (!dragging) return
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging === 'sidebar') {
        const w = Math.max(150, Math.min(600, dragStart.current.w + (e.clientX - dragStart.current.x)))
        setSettings({ ...useAppStore.getState().settings, sidebarWidth: w })
      } else if (dragging === 'ai') {
        const w = Math.max(200, Math.min(800, dragStart.current.w - (e.clientX - dragStart.current.x)))
        setSettings({ ...useAppStore.getState().settings, aiPanelWidth: w })
      } else if (dragging === 'terminal') {
        const h = Math.max(80, Math.min(600, dragStart.current.h - (e.clientY - dragStart.current.y)))
        setSettings({ ...useAppStore.getState().settings, terminalHeight: h })
      }
    }
    const handleMouseUp = () => setDragging(null)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, setSettings])

  const handleOpenFolder = useCallback(async () => {
    const folderPath = await openFolderDialog()
    if (folderPath) {
      setCurrentFolder(folderPath)
      const files = await listDirectory(folderPath)
      setFolderFiles(files)
    }
  }, [])

  return (
    <div className="app">
      <MenuBar onOpenFile={handleOpenFile} onOpenFolder={handleOpenFolder} />
      <div className="app-content">
        {settings.swapLayout ? (
          // Swapped: AI panel on left, sidebar on right
          <>
            {showAIPanel && (
              <>
                <div className="ai-panel" style={{ width: settings.aiPanelWidth }}>
                  <AIChat />
                </div>
                <div
                  className="drag-handle drag-handle-h"
                  style={{ cursor: dragging === 'ai' ? 'col-resize' : undefined }}
                  onMouseDown={(e) => {
                    dragStart.current = { x: e.clientX, y: 0, w: settings.aiPanelWidth, h: 0 }
                    setDragging('ai')
                  }}
                />
              </>
            )}
            <div className="app-right">
              <div className="app-main">
                <div className="editor-panel">
                  <Editor />
                </div>
                {settings.showSidebar && (
                  <>
                    <div
                      className="drag-handle drag-handle-h"
                      style={{ cursor: dragging === 'sidebar' ? 'col-resize' : undefined }}
                      onMouseDown={(e) => {
                        dragStart.current = { x: e.clientX, y: 0, w: settings.sidebarWidth, h: 0 }
                        setDragging('sidebar')
                      }}
                    />
                    <Sidebar
                      onOpenFile={handleOpenFile}
                      onOpenFolder={handleOpenFolder}
                      sidebarWidth={settings.sidebarWidth}
                    />
                  </>
                )}
              </div>
              {showTerminal && (
                <>
                  <div
                    className="drag-handle drag-handle-v"
                    style={{ cursor: dragging === 'terminal' ? 'row-resize' : undefined }}
                    onMouseDown={(e) => {
                      dragStart.current = { x: 0, y: e.clientY, w: 0, h: settings.terminalHeight }
                      setDragging('terminal')
                    }}
                  />
                  <div className="terminal-panel" style={{ height: settings.terminalHeight, flexBasis: settings.terminalHeight, maxHeight: '80vh' }}>
                    <Terminal />
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          // Default: sidebar on left, AI panel on right
          <>
            {settings.showSidebar && (
              <>
                <Sidebar
                  onOpenFile={handleOpenFile}
                  onOpenFolder={handleOpenFolder}
                  sidebarWidth={settings.sidebarWidth}
                />
                <div
                  className="drag-handle drag-handle-h"
                  style={{ cursor: dragging === 'sidebar' ? 'col-resize' : undefined }}
                  onMouseDown={(e) => {
                    dragStart.current = { x: e.clientX, y: 0, w: settings.sidebarWidth, h: 0 }
                    setDragging('sidebar')
                  }}
                />
              </>
            )}
            <div className="app-right">
              <div className="app-main">
                <div className="editor-panel">
                  <Editor />
                </div>
                {showAIPanel && (
                  <>
                    <div
                      className="drag-handle drag-handle-h"
                      style={{ cursor: dragging === 'ai' ? 'col-resize' : undefined }}
                      onMouseDown={(e) => {
                        dragStart.current = { x: e.clientX, y: 0, w: settings.aiPanelWidth, h: 0 }
                        setDragging('ai')
                      }}
                    />
                    <div className="ai-panel" style={{ width: settings.aiPanelWidth }}>
                      <AIChat />
                    </div>
                  </>
                )}
              </div>
              {showTerminal && (
                <>
                  <div
                    className="drag-handle drag-handle-v"
                    style={{ cursor: dragging === 'terminal' ? 'row-resize' : undefined }}
                    onMouseDown={(e) => {
                      dragStart.current = { x: 0, y: e.clientY, w: 0, h: settings.terminalHeight }
                      setDragging('terminal')
                    }}
                  />
                  <div className="terminal-panel" style={{ height: settings.terminalHeight, flexBasis: settings.terminalHeight, maxHeight: '80vh' }}>
                    <Terminal />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <StatusBar />
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showExtensions && <ExtensionsDialog />}
      <PermissionDialog />
    </div>
  )
}
