import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, selectActiveFolder } from '../store'
import { listDirectory, readFileContent, createFile as fsCreateFile, createFolder as fsCreateFolder, renameItem as fsRenameItem, deleteItem as fsDeleteItem } from '../services/fileSystem'
import { FileItem } from '../types'
import { editorAPI } from './Editor'

interface Props {
  onOpenFile: () => void
  onOpenFolder: () => void
  sidebarWidth?: number
}

export default function Sidebar({ onOpenFile, onOpenFolder, sidebarWidth }: Props) {
  const { t } = useTranslation()
  const currentFolder = useAppStore(selectActiveFolder)
  const workspaceFolders = useAppStore((s) => s.workspaceFolders)
  const activeFolderIndex = useAppStore((s) => s.activeFolderIndex)
  const setActiveFolderIndex = useAppStore((s) => s.setActiveFolderIndex)
  const addWorkspaceFolder = useAppStore((s) => s.addWorkspaceFolder)
  const removeWorkspaceFolder = useAppStore((s) => s.removeWorkspaceFolder)
  const setCurrentFolder = useAppStore((s) => s.setCurrentFolder)
  const folderFiles = useAppStore((s) => s.folderFiles)
  const setFolderFiles = useAppStore((s) => s.setFolderFiles)
  const openFileInEditor = useAppStore((s) => s.openFileInEditor)
  const openFiles = useAppStore((s) => s.openFiles)
  const activeFileIndex = useAppStore((s) => s.activeFileIndex)
  const activeFile = activeFileIndex >= 0 && activeFileIndex < openFiles.length ? openFiles[activeFileIndex] : null
  const analyzeWithAI = useAppStore((s) => s.analyzeWithAI)
  const isAnalyzing = useAppStore((s) => s.isAnalyzing)
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; item?: FileItem; parentPath?: string } | null>(null)
  const [treeKey, setTreeKey] = useState(0)
  const committingRef = useRef(false)
  const [newItemPath, setNewItemPath] = useState<string | null>(null)
  const [newItemType, setNewItemType] = useState<'file' | 'folder'>('file')
  const [newItemName, setNewItemName] = useState('')
  const [renamePath, setRenamePath] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ filePath: string; fileName: string; line: string }[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  useEffect(() => {
    if (currentFolder) {
      listDirectory(currentFolder).then(files => {
        setFolderFiles(files)
        setTreeKey(n => n + 1)
      }).catch(() => {})
    }
  }, [activeFolderIndex])

  const refreshFolder = async () => {
    if (currentFolder) {
      const files = await listDirectory(currentFolder)
      setFolderFiles(files)
      setTreeKey(n => n + 1)
    }
  }

  const beginNewItem = (parentPath: string, type: 'file' | 'folder') => {
    setCtxMenu(null)
    setNewItemPath(parentPath)
    setNewItemType(type)
    setNewItemName('')
  }

  const commitNewItem = async () => {
    if (committingRef.current) return
    if (!newItemPath || !newItemName.trim()) { setNewItemPath(null); return }
    committingRef.current = true
    const path = `${newItemPath}/${newItemName.trim()}`
    if (newItemType === 'file') await fsCreateFile(path); else await fsCreateFolder(path)
    setNewItemPath(null)
    await refreshFolder()
    committingRef.current = false
  }

  const beginRename = (item: FileItem) => {
    setCtxMenu(null)
    setRenamePath(item.path)
    setRenameName(item.name)
  }

  const commitRename = async () => {
    if (!renamePath || !renameName.trim()) { setRenamePath(null); return }
    const dir = renamePath.includes('\\') ? renamePath.substring(0, renamePath.lastIndexOf('\\')) : renamePath.substring(0, renamePath.lastIndexOf('/'))
    const newPath = `${dir}/${renameName.trim()}`
    await fsRenameItem(renamePath, newPath)
    setRenamePath(null)
    await refreshFolder()
  }

  const handleDeleteItem = async (item: FileItem) => {
    setCtxMenu(null)
    if (!confirm(t('sidebar.deleteConfirm', { name: item.name }))) return
    await fsDeleteItem(item.path)
    await refreshFolder()
  }

  const handleContextMenu = (e: React.MouseEvent, item?: FileItem) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, item, parentPath: currentFolder || undefined })
  }

  const handleFileClick = useCallback(async (item: FileItem) => {
    if (item.isDirectory) {
      if (expandedDirs.has(item.path)) {
        setExpandedDirs((prev) => { const n = new Set(prev); n.delete(item.path); return n })
      } else {
        setExpandedDirs((prev) => { const n = new Set(prev); n.add(item.path); return n })
      }
    } else {
      try {
        const content = await readFileContent(item.path)
        openFileInEditor({ filePath: item.path, content, isModified: false })
      } catch (e: any) {
        openFileInEditor({ filePath: item.path, content: `// Kļūda atverot failu: ${e?.message || e}\n`, isModified: false })
      }
    }
  }, [expandedDirs, openFileInEditor])

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim().toLowerCase()
    if (!q || !currentFolder) { setSearchResults([]); return }
    setIsSearching(true)
    const results: { filePath: string; fileName: string; line: string }[] = []
    const searchDir = async (dir: string) => {
      try {
        const items = await listDirectory(dir)
        for (const item of items) {
          if (item.isDirectory) {
            await searchDir(item.path)
          } else {
            try {
              const content = await readFileContent(item.path)
              const lines = content.split('\n')
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(q)) {
                  results.push({ filePath: item.path, fileName: item.name, line: lines[i].trim().substring(0, 120) })
                }
              }
            } catch { }
          }
        }
      } catch { }
    }
    await searchDir(currentFolder)
    setSearchResults(results)
    setIsSearching(false)
  }, [searchQuery, currentFolder])

  return (
    <div style={{
      width: sidebarWidth || 260,
      minWidth: 200,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }} onContextMenu={(e) => handleContextMenu(e)}>
      <div style={{
        padding: '6px 8px', borderBottom: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {workspaceFolders.map((f, i) => (
            <div key={f} style={{
              display: 'flex', alignItems: 'center', gap: 2,
              padding: '2px 6px', borderRadius: 3, fontSize: 10,
              background: i === activeFolderIndex ? 'var(--accent)' : 'var(--bg-hover)',
              color: i === activeFolderIndex ? '#fff' : 'var(--text-primary)',
              cursor: 'pointer', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
              onClick={() => setActiveFolderIndex(i)}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.split(/[\\/]/).pop()}</span>
              <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 2, cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); removeWorkspaceFolder(i) }}
              >×</span>
            </div>
          ))}
          <button className="btn btn-sm" onClick={onOpenFolder}
            style={{ fontSize: 9, padding: '1px 4px', lineHeight: '16px' }}
            title={t('sidebar.addFolder')}>+📂</button>
        </div>
        {currentFolder && (
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {currentFolder.split(/[\\/]/).pop()}
            </span>
            <button className="btn btn-sm" style={{ fontSize: 9, padding: '1px 4px' }} onClick={() => beginNewItem(currentFolder, 'file')} title={t('sidebar.contextNewFile')}>📄</button>
            <button className="btn btn-sm" style={{ fontSize: 9, padding: '1px 4px' }} onClick={() => beginNewItem(currentFolder, 'folder')} title={t('sidebar.contextNewFolder')}>📁</button>
          </div>
        )}
      </div>
      {currentFolder && (
        <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              placeholder={t('sidebar.searchPlaceholder')}
              style={{ flex: 1, padding: '2px 6px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)', outline: 'none' }}
            />
            <button className="btn btn-sm" style={{ fontSize: 10, padding: '1px 6px' }} onClick={handleSearch} disabled={isSearching}>{isSearching ? '⏳' : '🔍'}</button>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" style={{ fontSize: 9, padding: '1px 4px' }}
              onClick={() => { if (activeFile) editorAPI.previewInBrowser?.(activeFile.filePath, activeFile.content) }}
              title={t('editor.previewTooltip')} disabled={!activeFile}
            >🌐 {t('editor.previewButton')}</button>
            <button className="btn btn-sm" style={{ fontSize: 9, padding: '1px 4px' }}
              onClick={() => { editorAPI.togglePreview?.() }}
              title={t('editor.previewSplitButton')} disabled={!activeFile || !/\.(html?|svg|xml)$/i.test(activeFile.filePath)}
            >🖥️ {t('editor.previewSplitButton')}</button>
            <button className="btn btn-sm btn-primary" style={{ fontSize: 9, padding: '1px 4px' }}
              onClick={() => { if (!activeFile) return; window.dispatchEvent(new CustomEvent('editor:analyze')) }}
              disabled={!activeFile || isAnalyzing}
              title={isAnalyzing ? t('editor.analyzing') : t('editor.analyzeWithAI')}
            >
              {isAnalyzing ? '⏳' : '🧠'} {isAnalyzing ? t('editor.analyzing') : t('editor.analyzeWithAI')}
            </button>
            <button className="btn btn-sm" style={{ fontSize: 9, padding: '1px 4px' }}
              onClick={() => window.dispatchEvent(new CustomEvent('editor:showProblems'))}
              title={t('editor.problemsTitle')}
            >⚠️ {t('editor.problemsTitle')}</button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ maxHeight: 150, overflow: 'auto', background: 'var(--bg-hover)', borderRadius: 3, padding: 2 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', padding: '2px 6px' }}>{t('sidebar.searchResults', { count: searchResults.length })}</div>
              {searchResults.map((r, i) => (
                <div key={i} style={{ padding: '2px 6px', fontSize: 10, cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                  onClick={() => {
                    readFileContent(r.filePath).then(c => {
                      openFileInEditor({ filePath: r.filePath, content: c, isModified: false })
                      setSearchResults([])
                      setSearchQuery('')
                    }).catch(() => {})
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontWeight: 600 }}>{r.fileName}</div>
                  <div style={{ color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.line}</div>
                </div>
              ))}
              <button className="btn btn-sm" style={{ fontSize: 9, padding: '1px 6px', width: '100%', textAlign: 'center' }}
                onClick={() => { setSearchResults([]); setSearchQuery('') }}
              >{t('common.close')}</button>
            </div>
          )}
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {newItemPath && (
          <div style={{ display: 'flex', gap: 4, padding: '4px 12px', alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>{newItemType === 'file' ? '📄' : '📁'}</span>
            <input
              autoFocus
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitNewItem() }
                if (e.key === 'Escape') setNewItemPath(null)
              }}
              onBlur={() => commitNewItem()}
              placeholder={newItemType === 'file' ? t('sidebar.newItemPlaceholderFile') : t('sidebar.newItemPlaceholderFolder')}
              style={{
                flex: 1, padding: '2px 4px', fontSize: 12,
                background: 'var(--bg-primary)', border: '1px solid var(--accent)',
                borderRadius: 3, color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <button className="btn btn-sm" style={{ fontSize: 12, padding: '1px 6px' }} onClick={commitNewItem}>✓</button>
          </div>
        )}
        {currentFolder ? (
          <FileTree
            key={treeKey}
            items={folderFiles}
            depth={0}
            expandedDirs={expandedDirs}
            onItemClick={handleFileClick}
            onContextMenu={handleContextMenu}
            onDeleteItem={handleDeleteItem}
            renamePath={renamePath}
            renameName={renameName}
            onRenameNameChange={setRenameName}
            onCommitRename={commitRename}
            onCancelRename={() => setRenamePath(null)}
          />
        ) : (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
            <p>{t('sidebar.noFolder')}</p>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={onOpenFolder}>{t('sidebar.openFolder')}</button>
          </div>
        )}
      </div>

      {ctxMenu && (
        <div
          ref={r => r?.focus()}
          tabIndex={-1}
          style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
            background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
            borderRadius: 6, padding: '4px 0', zIndex: 1000,
            minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="ctx-item" onClick={() => beginNewItem(ctxMenu.item?.isDirectory ? ctxMenu.item.path : (ctxMenu.parentPath || currentFolder || ''), 'file')} style={ctxItemStyle}>{`📄 ${t('sidebar.contextNewFile')}`}</div>
          <div className="ctx-item" onClick={() => beginNewItem(ctxMenu.item?.isDirectory ? ctxMenu.item.path : (ctxMenu.parentPath || currentFolder || ''), 'folder')} style={ctxItemStyle}>{`📁 ${t('sidebar.contextNewFolder')}`}</div>
          {ctxMenu.item && <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />}
          {ctxMenu.item && <div className="ctx-item" onClick={() => beginRename(ctxMenu.item!)} style={ctxItemStyle}>{`✏ ${t('sidebar.contextRename')}`}</div>}
          {ctxMenu.item && <div className="ctx-item" onClick={() => handleDeleteItem(ctxMenu.item!)} style={{ ...ctxItemStyle, color: 'var(--danger)' }}>{`🗑 ${t('sidebar.contextDelete')}`}</div>}
        </div>
      )}
    </div>
  )
}

const ctxItemStyle: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
}

function FileTree({
  items,
  depth,
  expandedDirs,
  onItemClick,
  onContextMenu,
  onDeleteItem,
  renamePath,
  renameName,
  onRenameNameChange,
  onCommitRename,
  onCancelRename,
}: {
  items: FileItem[]
  depth: number
  expandedDirs: Set<string>
  onItemClick: (item: FileItem) => void
  onContextMenu: (e: React.MouseEvent, item: FileItem) => void
  onDeleteItem: (item: FileItem) => void
  renamePath: string | null
  renameName: string
  onRenameNameChange: (name: string) => void
  onCommitRename: () => void
  onCancelRename: () => void
}) {
  const { t } = useTranslation()
  const [subdirFiles, setSubdirFiles] = useState<Record<string, FileItem[]>>({})

  const handleClick = async (item: FileItem) => {
    if (item.isDirectory) {
      const isExpanding = !expandedDirs.has(item.path)
      // Load subdirectory files BEFORE expanding
      if (isExpanding && !subdirFiles[item.path]) {
        const files = await listDirectory(item.path)
        setSubdirFiles((prev) => ({ ...prev, [item.path]: files }))
      }
    }
    onItemClick(item)
  }

  return (
    <div>
      {items.map((item) => (
        <div key={item.path}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              width: '100%',
              padding: '3px 8px',
              paddingLeft: 12 + depth * 16,
              fontSize: 13,
              textAlign: 'left',
              background: 'transparent',
              borderRadius: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)'
              const delBtn = e.currentTarget.querySelector('.del-btn') as HTMLElement
              if (delBtn) delBtn.style.display = 'inline-flex'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              const delBtn = e.currentTarget.querySelector('.del-btn') as HTMLElement
              if (delBtn) delBtn.style.display = 'none'
            }}
            onClick={() => handleClick(item)}
            onContextMenu={(e) => onContextMenu(e, item)}
            title={item.path}
          >
            <span style={{ fontSize: 11, flexShrink: 0 }}>
              {item.isDirectory ? (expandedDirs.has(item.path) ? '▼' : '▶') : '📄'}
            </span>
            {renamePath === item.path ? (
              <input
                autoFocus
                value={renameName}
                onChange={e => onRenameNameChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') onCancelRename() }}
                style={{
                  flex: 1, padding: '1px 3px', fontSize: 12,
                  background: 'var(--bg-primary)', border: '1px solid var(--accent)',
                  borderRadius: 3, color: 'var(--text-primary)', outline: 'none',
                }}
              />
            ) : (
              <span style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}>
                {item.name}
              </span>
            )}
            <span
              className="del-btn"
              onClick={(e) => { e.stopPropagation(); onDeleteItem(item) }}
              style={{
                display: 'none', fontSize: 11, padding: '0 4px', lineHeight: '18px',
                color: 'var(--danger)', cursor: 'pointer', flexShrink: 0,
              }}
              title={t('sidebar.tooltipDelete')}
            >🗑</span>
          </button>
          {item.isDirectory && expandedDirs.has(item.path) && subdirFiles[item.path] && (
            <FileTree
              items={subdirFiles[item.path]}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              onItemClick={onItemClick}
              onContextMenu={onContextMenu}
              onDeleteItem={onDeleteItem}
              renamePath={renamePath}
              renameName={renameName}
              onRenameNameChange={onRenameNameChange}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
            />
          )}
        </div>
      ))}
    </div>
  )
}
