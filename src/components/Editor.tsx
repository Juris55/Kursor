import { useState, useCallback, useRef, useEffect } from 'react'
import Editor, { OnMount, loader } from '@monaco-editor/react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { sendChatMessage } from '../services/ai'
import { getLanguageFromExtension, getFileExtension, saveFileDialog } from '../services/fileSystem'
import { clearTerminal } from '../services/terminal'

loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs',
  },
})

let monacoInstance: any = null

export const editorAPI = {
  analyzeWithAI: null as (() => Promise<void>) | null,
  clearAI: null as (() => void) | null,
  previewInBrowser: null as ((filePath: string, content: string) => void) | null,
  togglePreview: null as (() => void) | null,
  hasAIDiagnostics: false,
  isAnalyzing: false,
  getActiveFile: null as (() => { filePath: string; content: string } | null) | null,
  isPreviewable: null as ((path: string) => boolean) | null,
  showProblems: null as (() => void) | null,
  showConsole: null as (() => void) | null,
  showAnalysis: null as (() => void) | null,
  undo: null as (() => void) | null,
  redo: null as (() => void) | null,
  cut: null as (() => void) | null,
  copy: null as (() => void) | null,
  paste: null as (() => void) | null,
  selectAll: null as (() => void) | null,
}

const getPreviewSrcDoc = (content: string) => {
  const injectScript = `
    <script>
      (function() {
        const _log = console.log;
        const _warn = console.warn;
        const _error = console.error;
        
        window.addEventListener('error', (e) => {
          window.parent.postMessage({ type: 'iframe-error', message: e.message, line: e.lineno, col: e.colno }, '*');
        });
        
        console.log = (...args) => {
          _log(...args);
          window.parent.postMessage({ type: 'iframe-log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
        };
        console.warn = (...args) => {
          _warn(...args);
          window.parent.postMessage({ type: 'iframe-warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
        };
        console.error = (...args) => {
          _error(...args);
          window.parent.postMessage({ type: 'iframe-error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
        };
      })();
    </script>
  `;
  
  if (content.includes('<head>')) {
    return content.replace('<head>', `<head>${injectScript}`);
  } else if (content.includes('<html>')) {
    return content.replace('<html>', `<html><head>${injectScript}</head>`);
  } else {
    return `${injectScript}${content}`;
  }
};

export default function MonacoEditor() {
  const { t } = useTranslation()
  const [monacoFailed, setMonacoFailed] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showBottomPanel, setShowBottomPanel] = useState(false)
  const [bottomTab, setBottomTab] = useState<'problems' | 'console' | 'analysis'>('problems')
  const [consoleLogs, setConsoleLogs] = useState<{ type: 'log' | 'warn' | 'error'; message: string; timestamp: number }[]>([])
  const [problems, setProblems] = useState<{ file: string; line: number; col: number; message: string; severity: 'error' | 'warning' | 'info'; source?: string }[]>([])
  const [aiResults, setAiResults] = useState<any[]>([])
  const [aiResultsText, setAiResultsText] = useState('')
  const [iframeKey, setIframeKey] = useState(0)
  const [hasAIDiagnostics, setHasAIDiagnostics] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const editorRef = useRef<any>(null)
  const problemsRef = useRef<HTMLDivElement>(null)

  const openFiles = useAppStore((s) => s.openFiles)
  const activeFileIndex = useAppStore((s) => s.activeFileIndex)
  const setActiveFileIndex = useAppStore((s) => s.setActiveFileIndex)
  const updateFileContent = useAppStore((s) => s.updateFileContent)
  const closeFile = useAppStore((s) => s.closeFile)
  const settings = useAppStore((s) => s.settings)
  const setIsAnalyzingStore = useAppStore((s) => s.setIsAnalyzing)
  const activeFile = openFiles[activeFileIndex] || null
  const language = activeFile ? getLanguageFromExtension(getFileExtension(activeFile.filePath)) : 'plaintext'

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoInstance = monaco
    editor.focus()
    editorAPI.undo = () => editor.getModel()?.undo()
    editorAPI.redo = () => editor.getModel()?.redo()
    editorAPI.cut = () => editor.trigger('keyboard', 'cut', null)
    editorAPI.copy = () => editor.trigger('keyboard', 'editor.action.clipboardCopyAction', null)
    editorAPI.paste = () => editor.trigger('keyboard', 'editor.action.clipboardPasteAction', null)
    editorAPI.selectAll = () => editor.trigger('keyboard', 'editor.action.selectAll', null)
  }

  const handleChange = (value: string | undefined) => {
    if (value !== undefined && activeFileIndex >= 0) {
      updateFileContent(activeFileIndex, value)
    }
  }

  const previewableExts = ['html', 'htm', 'svg', 'xml']

  const isPreviewable = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase()
    return ext && previewableExts.includes(ext)
  }

  const previewInBrowser = (filePath: string, content: string) => {
    if (filePath.startsWith('http')) {
      window.electronAPI?.openExternal(filePath, settings.browser)
    } else if (content) {
      const filename = filePath.split(/[\\/]/).pop() || 'preview.html'
      window.electronAPI?.previewInBrowser(content, filename, settings.browser)
    }
  }

  const refreshProblems = useCallback(() => {
    if (!monacoInstance?.editor) return
    const models = monacoInstance.editor.getModels()
    const all: typeof problems = []
    for (const model of models) {
      const markers = monacoInstance.editor.getModelMarkers({ resource: model.uri })
      if (markers.length === 0) continue
      const filePath = decodeURIComponent(model.uri.path)
      for (const m of markers) {
        const sev = m.severity === monacoInstance.MarkerSeverity.Error ? 'error' as const
          : m.severity === monacoInstance.MarkerSeverity.Warning ? 'warning' as const
          : 'info' as const
        all.push({ file: filePath, line: m.startLineNumber, col: m.startColumn, message: m.message, severity: sev, source: m.source })
      }
    }
    setProblems(all)
  }, [])

  useEffect(() => {
    const check = setInterval(() => {
      if (monacoInstance?.editor) {
        clearInterval(check)
        const sub = monacoInstance.editor.onDidChangeMarkers(() => refreshProblems())
        refreshProblems()
        const poll = setInterval(refreshProblems, 2000)
        return () => { sub.dispose(); clearInterval(poll) }
      }
    }, 200)
    return () => clearInterval(check)
  }, [refreshProblems])

  const getMonaco = () => monacoInstance

  useEffect(() => {
    setConsoleLogs([])
    if (editorRef.current) {
      const model = editorRef.current.getModel()
      const m = getMonaco()
      if (model && m?.editor) {
        m.editor.setModelMarkers(model, 'browser-errors', [])
      }
    }
  }, [activeFileIndex])

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && typeof e.data === 'object') {
        if (e.data.type === 'iframe-log') {
          setConsoleLogs(prev => [...prev, { type: 'log' as const, message: e.data.message, timestamp: Date.now() }].slice(-100))
        } else if (e.data.type === 'iframe-warn') {
          setConsoleLogs(prev => [...prev, { type: 'warn' as const, message: e.data.message, timestamp: Date.now() }].slice(-100))
        } else if (e.data.type === 'iframe-error') {
          setConsoleLogs(prev => [...prev, { type: 'error' as const, message: e.data.message, timestamp: Date.now() }].slice(-100))
          
          if (activeFile && editorRef.current) {
            const model = editorRef.current.getModel()
            const m = getMonaco()
            if (model && m?.editor) {
              const currentMarkers = m.editor.getModelMarkers({ resource: model.uri })
              const newMarker = {
                startLineNumber: e.data.line || 1,
                startColumn: e.data.col || 1,
                endLineNumber: e.data.line || 1,
                endColumn: (e.data.col || 1) + 15,
                message: `[Browser Error] ${e.data.message}`,
                severity: m.MarkerSeverity.Error,
                source: 'Browser Preview',
              }
              const hasSame = currentMarkers.some((m2: any) => m2.message === newMarker.message && m2.startLineNumber === newMarker.startLineNumber)
              if (!hasSame) {
                m.editor.setModelMarkers(model, 'browser-errors', [...currentMarkers, newMarker])
              }
            }
          }
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [activeFile?.filePath])

  const handleAIDiagnostics = useCallback(async () => {
    const currentActiveFile = useAppStore.getState().openFiles[useAppStore.getState().activeFileIndex]
    if (!currentActiveFile) return
    
    const currentAIConfig = useAppStore.getState().aiConfig
    const currentProvider = currentAIConfig.providers.find((p) => p.id === currentAIConfig.activeProviderId)
    const currentModelId = currentAIConfig.activeModelId
    
    if (!currentProvider || !currentModelId) {
      alert(t('editor.noProviderConfigured'))
      return
    }
    
      setIsAnalyzing(true)
    let fullContent = ''
    try {
      const sysMsg = `Tu esi koda analīzes asistents. Analizē kodu un atrodi iespējamās problēmas, kļūdas, drošības riskus un optimizācijas iespējas. Atbildi latviešu valodā.`
      const userMsg = `Lūdzu, analizē šo kodu:\n\n\`\`\`\n${currentActiveFile.content}\n\`\`\``
      
      const messages = [
        { role: 'system', content: sysMsg },
        { role: 'user', content: userMsg },
      ]
      const response = await sendChatMessage(currentProvider, currentModelId, messages, (chunk) => {})
      fullContent = response
      setAiResultsText(response)
      editorAPI.hasAIDiagnostics = true
      setHasAIDiagnostics(true)
    } catch (err: any) {
      fullContent = `[ERROR] ${err.message || 'Unknown error'}`
      setAiResultsText(fullContent)
      console.error('AI analysis error:', err)
    } finally {
      setIsAnalyzing(false)
      setBottomTab('analysis')
      setShowBottomPanel(true)
    }
  }, [t])

  const clearAIDiagnostics = useCallback(() => {
    setAiResults([])
    setAiResultsText('')
    setHasAIDiagnostics(false)
    editorAPI.hasAIDiagnostics = false
    const model = editorRef.current?.getModel()
    if (model && monacoInstance?.editor) {
      monacoInstance.editor.setModelMarkers(model, 'ai-diagnostics', [])
    }
  }, [])

  useEffect(() => {
    editorAPI.analyzeWithAI = handleAIDiagnostics
    editorAPI.clearAI = clearAIDiagnostics
    editorAPI.previewInBrowser = previewInBrowser
    editorAPI.togglePreview = () => setShowPreview(v => !v)
    editorAPI.isPreviewable = ((path: string) => isPreviewable(path)) as any
    editorAPI.hasAIDiagnostics = hasAIDiagnostics
    editorAPI.isAnalyzing = isAnalyzing
    editorAPI.getActiveFile = () => activeFile
    editorAPI.showProblems = () => { setBottomTab('problems'); setShowBottomPanel(true) }
    editorAPI.showConsole = () => { setBottomTab('console'); setShowBottomPanel(true) }
    editorAPI.showAnalysis = () => { setBottomTab('analysis'); setShowBottomPanel(true) }
    setIsAnalyzingStore(isAnalyzing)
  }, [hasAIDiagnostics, isAnalyzing, activeFile, handleAIDiagnostics, clearAIDiagnostics])

  // Listen for custom events from Sidebar
  useEffect(() => {
    const onAnalyze = () => handleAIDiagnostics()
    const onShowProblems = () => { setBottomTab('problems'); setShowBottomPanel(true) }
    window.addEventListener('editor:analyze', onAnalyze)
    window.addEventListener('editor:showProblems', onShowProblems)
    return () => {
      window.removeEventListener('editor:analyze', onAnalyze)
      window.removeEventListener('editor:showProblems', onShowProblems)
    }
  }, [handleAIDiagnostics])

  const handleTabClose = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    closeFile(index)
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (activeFileIndex >= 0) {
      updateFileContent(activeFileIndex, e.target.value)
    }
  }

  if (openFiles.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: 14,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>Kursor</div>
          <p>{t('file.noFilesOpen')}</p>
          <p style={{ fontSize: 12, marginTop: 8, color: 'var(--text-muted)' }}>
            {t('editor.emptyHint')}
          </p>
        </div>
      </div>
    )
  }

  const errorCount = problems.filter(p => p.severity === 'error').length
  const warnCount = problems.filter(p => p.severity === 'warning').length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        overflow: 'auto',
        flexShrink: 0,
      }}>
        {openFiles.map((file, index) => (
          <div
            key={`${file.filePath}-${index}`}
            onClick={() => setActiveFileIndex(index)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
              borderRight: '1px solid var(--border-color)',
              background: index === activeFileIndex ? 'var(--bg-primary)' : 'transparent',
              borderBottom: index === activeFileIndex ? '2px solid var(--accent)' : '2px solid transparent',
              color: index === activeFileIndex ? 'var(--text-primary)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              maxWidth: 200,
            }}
          >
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {file.filePath.split(/[\\/]/).pop() || t('editor.untitled')}
            </span>
            {file.isModified && <span style={{ color: 'var(--warning)', fontSize: 10 }}>●</span>}
            <button
              style={{
                marginLeft: 4,
                fontSize: 14,
                lineHeight: '14px',
                color: 'var(--text-muted)',
                padding: 0,
                background: 'none',
                opacity: 0.6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
              onClick={(e) => handleTabClose(index, e)}
            >
              ×
            </button>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: 8 }}>
          <button
            className="btn btn-sm"
            onClick={clearTerminal}
            title={t('terminal.clear')}
            style={{ fontSize: 11, padding: '2px 6px' }}
          >
            🗑 {t('terminal.clear')}
          </button>
        </div>

      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', position: 'relative', overflow: 'hidden' }}>
        {/* Editor (left pane) */}
        <div style={{ flex: 1, height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {monacoFailed ? (
            <textarea
              value={activeFile?.content || ''}
              onChange={handleTextareaChange}
              style={{
                width: '100%',
                height: '100%',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: 'none',
                outline: 'none',
                resize: 'none',
                padding: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: settings.fontSize,
                lineHeight: 1.5,
                tabSize: 4,
              }}
              spellCheck={false}
            />
          ) : (
            <Editor
              key={activeFile?.filePath}
              height="100%"
              language={language}
              value={activeFile?.content || ''}
              theme={settings.theme === 'dark' ? 'vs-dark' : 'vs'}
              onChange={handleChange}
              onMount={handleEditorMount}
              loading={
                <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
                  {t('editor.loadingEditor')}
                </div>
              }
              options={{
                fontSize: settings.fontSize,
                wordWrap: settings.wordWrap ? 'on' : 'off',
                minimap: { enabled: settings.minimap },
                lineNumbers: settings.lineNumbers ? 'on' : 'off',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                renderWhitespace: 'selection',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                bracketPairColorization: { enabled: true },
                padding: { top: 8 },
              }}
            />
          )}
          {!monacoFailed && activeFile && (
            <button
              className="btn btn-sm"
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                zIndex: 10,
                background: 'var(--bg-hover)',
                border: '1px solid var(--border-color)',
                opacity: 0.9,
              }}
              onClick={() => setMonacoFailed(true)}
              title={t('editor.simpleModeTooltip')}
            >
              {t('editor.simpleMode')}
            </button>
          )}
        </div>

        {/* Integrated Preview (right pane) */}
        {showPreview && activeFile && isPreviewable(activeFile.filePath) && (
          <div style={{
            width: '50%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            borderLeft: '1px solid var(--border-color)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              background: '#f3f3f3',
              borderBottom: '1px solid #d4d4d4',
              color: '#333333',
              flexShrink: 0,
            }}>
              <button
                style={{ fontSize: 13, color: '#666', background: 'none', padding: 2 }}
                onClick={() => setIframeKey(k => k + 1)}
                title={t('editor.refreshPreview')}
              >
                🔄
              </button>
              <div style={{
                flex: 1,
                padding: '2px 8px',
                background: '#ffffff',
                border: '1px solid #d4d4d4',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: '#666',
              }}>
                http://localhost:3000/{activeFile.filePath.split(/[\\/]/).pop()}
              </div>
              <button
                className="btn btn-sm"
                style={{ padding: '2px 6px', fontSize: 10, background: '#e1e1e1', color: '#333', border: '1px solid #ccc' }}
                onClick={() => previewInBrowser(activeFile.filePath, activeFile.content)}
              >
                ↗
              </button>
            </div>
            <iframe
              key={iframeKey}
              srcDoc={getPreviewSrcDoc(activeFile.content)}
              sandbox="allow-scripts allow-same-origin allow-modals allow-popups"
              style={{
                flex: 1,
                border: 'none',
                background: '#ffffff',
              }}
            />
          </div>
        )}
      </div>
      {activeFile && (
        <div style={{
          borderTop: '1px solid var(--border-color)', flexShrink: 0,
          background: 'var(--bg-secondary)', fontSize: 11,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', padding: '0 8px',
            cursor: 'pointer', userSelect: 'none', height: 28,
            background: 'var(--bg-tertiary)', borderBottom: showBottomPanel ? '1px solid var(--border-color)' : 'none',
          }}
            onClick={() => setShowBottomPanel(!showBottomPanel)}
          >
            <div style={{ display: 'flex', gap: 12, height: '100%', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
              <div
                style={{
                  padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center',
                  cursor: 'pointer',
                  borderBottom: bottomTab === 'problems' && showBottomPanel ? '2px solid var(--accent)' : 'none',
                  color: bottomTab === 'problems' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: bottomTab === 'problems' ? 600 : 'normal',
                }}
                onClick={() => { setBottomTab('problems'); setShowBottomPanel(true) }}
              >
                ⚠️ {t('editor.problemsTitle')} ({problems.length})
              </div>
              <div
                style={{
                  padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center',
                  cursor: 'pointer',
                  borderBottom: bottomTab === 'console' && showBottomPanel ? '2px solid var(--accent)' : 'none',
                  color: bottomTab === 'console' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: bottomTab === 'console' ? 600 : 'normal',
                }}
                onClick={() => { setBottomTab('console'); setShowBottomPanel(true) }}
              >
                📟 {t('editor.consoleTitle')} ({consoleLogs.length})
              </div>
              <div
                style={{
                  padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center',
                  cursor: 'pointer',
                  borderBottom: bottomTab === 'analysis' && showBottomPanel ? '2px solid var(--accent)' : 'none',
                  color: bottomTab === 'analysis' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: bottomTab === 'analysis' ? 600 : 'normal',
                }}
                onClick={() => { setBottomTab('analysis'); setShowBottomPanel(true) }}
              >
                🧠 {t('editor.analysisTitle', 'Analysis')} ({aiResults.length || (aiResultsText ? 1 : 0)})
              </div>
              <div
                style={{
                  padding: '0 8px', height: '100%', display: 'flex', alignItems: 'center',
                  cursor: 'pointer',
                  borderBottom: 'none',
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                  background: 'var(--bg-hover)',
                  borderRadius: '4px 4px 0 0',
                }}
                onClick={() => {
                  let text = ''
                  if (bottomTab === 'problems') {
                    text = problems.map(p => `[${p.severity.toUpperCase()}] ${p.file}:${p.line}:${p.col} - ${p.message}`).join('\n')
                  } else if (bottomTab === 'console') {
                    text = consoleLogs.map(l => `${new Date(l.timestamp).toLocaleTimeString()} ${l.type.toUpperCase()}: ${l.message}`).join('\n')
                  } else if (bottomTab === 'analysis') {
                    text = aiResultsText || ''
                  }
                  if (text) {
                    navigator.clipboard.writeText(text)
                    // Focus AIChat input
                    window.dispatchEvent(new CustomEvent('aichat:focus'))
                  }
                }}
                title="Kopēt"
              >
                📋 Kopēt
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
              {bottomTab === 'console' && consoleLogs.length > 0 && (
                <button
                  className="btn btn-sm"
                  style={{ fontSize: 9, padding: '1px 4px', height: 18 }}
                  onClick={() => setConsoleLogs([])}
                >
                  🧹 {t('editor.clearConsole')}
                </button>
              )}
              <span onClick={() => setShowBottomPanel(!showBottomPanel)} style={{ fontSize: 9, cursor: 'pointer', opacity: 0.7 }}>
                {showBottomPanel ? '▼' : '▲'}
              </span>
            </div>
          </div>
          {showBottomPanel && (
            <div ref={problemsRef} style={{ height: 120, overflow: 'auto', padding: 8, background: 'var(--bg-primary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {bottomTab === 'problems' ? (
                problems.length === 0 ? (
                  <div style={{ padding: 8, color: 'var(--text-muted)', textAlign: 'center' }}>
                    {t('editor.noProblems')}
                  </div>
                ) : (
                  problems.map((p, i) => (
                    <div key={i} style={{
                      padding: '2px 4px', display: 'flex', gap: 6, alignItems: 'flex-start',
                      color: p.severity === 'error' ? 'var(--danger)' : p.severity === 'warning' ? 'var(--warning)' : 'var(--text-muted)',
                      borderBottom: '1px solid var(--border-color)',
                    }}>
                      <span style={{ flexShrink: 0, fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                        [{p.source || 'Monaco'}] {p.file.split(/[\\/]/).pop()}:{p.line}:{p.col}
                      </span>
                      <span style={{ wordBreak: 'break-word' }}>{p.message}</span>
                    </div>
                  ))
                )
              ) : bottomTab === 'console' ? (
                consoleLogs.length === 0 ? (
                  <div style={{ padding: 8, color: 'var(--text-muted)', textAlign: 'center' }}>
                    {t('editor.consoleEmpty')}
                  </div>
                ) : (
                  consoleLogs.map((log, i) => (
                    <div key={i} style={{
                      padding: '2px 4px', fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: log.type === 'error' ? 'var(--danger)' : log.type === 'warn' ? 'var(--warning)' : 'var(--text-primary)',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex', gap: 8,
                    }}>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span>
                        {log.type === 'error' ? '🔴' : log.type === 'warn' ? '🟡' : '⚪'} {log.message}
                      </span>
                    </div>
                  ))
                )
              ) : (
                // Analysis tab
                aiResults.length === 0 && !aiResultsText ? (
                  <div style={{ padding: 8, color: 'var(--text-muted)', textAlign: 'center' }}>
                    {t('editor.analysisRunAI')}
                  </div>
                ) : aiResults.length === 0 && aiResultsText ? (
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-secondary)', fontSize: 10, margin: 0 }}>
                    {aiResultsText}
                  </pre>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                    <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--accent)' }}>
                      {t('editor.analysisResults', { count: aiResults.length })}
                    </div>
                    {aiResults.map((issue, i) => (
                      <div key={i} style={{
                        padding: '4px 0',
                        borderBottom: '1px solid var(--border-color)',
                        color: issue.severity === 'error' ? 'var(--danger)' : issue.severity === 'warning' ? 'var(--warning)' : 'var(--text-primary)',
                      }}>
                        <div style={{ fontWeight: 600 }}>
                          [{issue.severity.toUpperCase()}] Line {issue.line}, Col {issue.col}
                        </div>
                        <div style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>
                          {issue.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
