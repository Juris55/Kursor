import { create } from 'zustand'
import { OpenFile, FileItem, AIConfig, ChatMessage, AppSettings, PermissionRequest, Plugin } from '../types'
import { setLanguage } from '../i18n'

interface AppStore {
  openFiles: OpenFile[]
  activeFileIndex: number
  currentFolder: string | null
  workspaceFolders: string[]
  activeFolderIndex: number
  folderFiles: FileItem[]
  aiConfig: AIConfig
  chatMessages: ChatMessage[]
  isChatLoading: boolean
  settings: AppSettings
  showTerminal: boolean
  showAIPanel: boolean
  showSettings: boolean
  autoRespond: boolean
  plugins: Plugin[]
  showExtensions: boolean

  setOpenFiles: (files: OpenFile[]) => void
  setActiveFileIndex: (index: number) => void
  openFileInEditor: (file: OpenFile) => void
  closeFile: (index: number) => void
  updateFileContent: (index: number, content: string) => void
  setCurrentFolder: (path: string | null) => void
  setCurrentFolderOnly: (path: string | null) => void
  addWorkspaceFolder: (path: string) => void
  removeWorkspaceFolder: (index: number) => void
  setActiveFolderIndex: (index: number) => void
  setFolderFiles: (files: FileItem[]) => void
  setAIConfig: (config: AIConfig) => void
  setChatMessages: (messages: ChatMessage[]) => void
  addChatMessage: (message: ChatMessage) => void
  setIsChatLoading: (loading: boolean) => void
  setSettings: (settings: AppSettings) => void
  setShowTerminal: (show: boolean) => void
  setShowAIPanel: (show: boolean) => void
  setShowSettings: (show: boolean) => void
  setAutoRespond: (val: boolean) => void
  setPlugins: (plugins: Plugin[]) => void
  setShowExtensions: (show: boolean) => void
  pendingPermission: PermissionRequest | null
  setPendingPermission: (req: PermissionRequest | null) => void
  pendingTerminalAction: 'new' | 'close' | null
  setPendingTerminalAction: (action: 'new' | 'close' | null) => void
  permissionHistory: PermissionRequest[]
  addPermissionHistory: (req: PermissionRequest) => void
  analyzeWithAI: (() => Promise<void>) | null
  isAnalyzing: boolean
  setAnalyzeWithAI: (fn: (() => Promise<void>) | null) => void
  setIsAnalyzing: (val: boolean) => void
}

export const selectActiveFolder = (s: AppStore) =>
  s.activeFolderIndex >= 0 && s.workspaceFolders[s.activeFolderIndex] ? s.workspaceFolders[s.activeFolderIndex] : null

function getDefaultTerminal(): 'powershell' | 'cmd' | 'bash' | 'zsh' {
  const p = (typeof window !== 'undefined' && (window as any).platform) || ''
  if (p === 'darwin') return 'zsh'
  if (p === 'linux' || p === 'freebsd') return 'bash'
  return 'powershell'
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  fontSize: 14,
  language: 'lv',
  terminal: getDefaultTerminal(),
  sidebarWidth: 260,
  terminalHeight: 200,
  aiPanelWidth: 380,
  showSidebar: true,
  showTerminal: true,
  showAIPanel: true,
  autoSave: true,
  wordWrap: true,
  minimap: true,
  lineNumbers: true,
  browser: 'default',
  swapLayout: false,
}

const defaultAIConfig: AIConfig = {
  providers: [
    {
      id: 'ollama',
      name: 'Ollama',
      type: 'ollama',
      apiUrl: 'http://localhost:11434',
      models: [],
      active: true,
    },
    {
      id: 'lmstudio',
      name: 'LM Studio',
      type: 'lmstudio',
      apiUrl: 'http://localhost:1234',
      models: [],
      active: false,
    },
  ],
  activeProviderId: null,
  activeModelId: null,
  systemPrompt: 'Tu esi noderīgs palīgs, kas palīdz ar programmēšanu un teksta rediģēšanu. Atbildi latviešu valodā.',
  chatMode: 'chat',
  mcpServers: [],
  customPrompts: [],
  activeCustomPromptId: null,
  thinkingDepth: 'high',
}

export const useAppStore = create<AppStore>((set) => ({
  openFiles: [],
  activeFileIndex: -1,
  currentFolder: null,
  workspaceFolders: [],
  activeFolderIndex: -1,
  folderFiles: [],
  aiConfig: defaultAIConfig,
  chatMessages: [
    {
      role: 'assistant',
      content: 'Sveiks! Esmu Kursor MI palīgs. Kā varu palīdzēt?',
      timestamp: Date.now(),
    },
  ],
  isChatLoading: false,
  settings: defaultSettings,
  showTerminal: true,
  showAIPanel: true,
  showSettings: false,
  autoRespond: false,
  plugins: [],
  showExtensions: false,
  pendingPermission: null,
  pendingTerminalAction: null,
  permissionHistory: [],
  analyzeWithAI: null,
  isAnalyzing: false,

  setOpenFiles: (files) => set({ openFiles: files }),
  setActiveFileIndex: (index) => set({ activeFileIndex: index }),

  openFileInEditor: (file) =>
    set((state) => {
      const existingIndex = state.openFiles.findIndex((f) => f.filePath === file.filePath)
      let newState: Partial<AppStore>
      if (existingIndex >= 0) {
        newState = { activeFileIndex: existingIndex }
      } else {
        newState = {
          openFiles: [...state.openFiles, file],
          activeFileIndex: state.openFiles.length,
        }
      }
      setTimeout(() => persistSession(), 0)
      return newState
    }),

  closeFile: (index) =>
    set((state) => {
      const files = state.openFiles.filter((_, i) => i !== index)
      let activeIdx = state.activeFileIndex
      if (activeIdx >= files.length) activeIdx = files.length - 1
      if (index < state.activeFileIndex) activeIdx = state.activeFileIndex - 1
      setTimeout(() => persistSession(), 0)
      return { openFiles: files, activeFileIndex: activeIdx }
    }),

  updateFileContent: (index, content) =>
    set((state) => {
      const files = [...state.openFiles]
      if (files[index]) {
        files[index] = { ...files[index], content, isModified: true }
      }
      return { openFiles: files }
    }),

  setCurrentFolder: (path) => {
    if (path) {
      const idx = useAppStore.getState().workspaceFolders.indexOf(path)
      if (idx >= 0) {
        set({ currentFolder: path, activeFolderIndex: idx, openFiles: [], activeFileIndex: -1 })
      } else {
        set((s) => ({
          currentFolder: path,
          workspaceFolders: [...s.workspaceFolders, path],
          activeFolderIndex: s.workspaceFolders.length,
          openFiles: [],
          activeFileIndex: -1,
        }))
      }
    } else {
      set({ currentFolder: null, workspaceFolders: [], activeFolderIndex: -1, openFiles: [], activeFileIndex: -1 })
    }
    persistSession()
  },
  setCurrentFolderOnly: (path) => {
    if (path) {
      const idx = useAppStore.getState().workspaceFolders.indexOf(path)
      if (idx >= 0) {
        set({ currentFolder: path, activeFolderIndex: idx })
      } else {
        set((s) => ({
          currentFolder: path,
          workspaceFolders: [...s.workspaceFolders, path],
          activeFolderIndex: s.workspaceFolders.length,
        }))
      }
    }
    persistSession()
  },
  addWorkspaceFolder: (path) => set((s) => {
    if (s.workspaceFolders.includes(path)) return s
    return {
      workspaceFolders: [...s.workspaceFolders, path],
      activeFolderIndex: s.workspaceFolders.length,
      currentFolder: path,
    }
  }),
  removeWorkspaceFolder: (index) => set((s) => {
    const folders = s.workspaceFolders.filter((_, i) => i !== index)
    let newActive = s.activeFolderIndex
    if (newActive >= folders.length) newActive = folders.length - 1
    if (newActive === index) newActive = Math.max(0, folders.length - 1)
    const newCurrent = newActive >= 0 && folders[newActive] ? folders[newActive] : null
    return {
      workspaceFolders: folders,
      activeFolderIndex: newActive,
      currentFolder: newCurrent,
      openFiles: newCurrent !== s.currentFolder ? [] : s.openFiles,
      activeFileIndex: newCurrent !== s.currentFolder ? -1 : s.activeFileIndex,
    }
  }),
  setActiveFolderIndex: (index) => set((s) => ({
    activeFolderIndex: index,
    currentFolder: s.workspaceFolders[index] || null,
    openFiles: [],
    activeFileIndex: -1,
  })),
  setFolderFiles: (files) => set({ folderFiles: files }),

  setAIConfig: (config) => {
    set({ aiConfig: config })
    persistSession()
  },
  setChatMessages: (messages) => set({ chatMessages: messages }),
  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),
  setIsChatLoading: (loading) => set({ isChatLoading: loading }),

  setSettings: (settings) => {
    set({ settings })
    persistSession()
  },
  setShowTerminal: (show) => set((s) => {
    const newSettings = { ...s.settings, showTerminal: show }
    return { showTerminal: show, settings: newSettings }
  }),
  setShowAIPanel: (show) => set((s) => {
    const newSettings = { ...s.settings, showAIPanel: show }
    return { showAIPanel: show, settings: newSettings }
  }),
  setShowSettings: (show) => set({ showSettings: show }),
  setAutoRespond: (val) => set({ autoRespond: val }),
  setPlugins: (plugins) => set({ plugins }),
  setShowExtensions: (show) => set({ showExtensions: show }),
  setPendingPermission: (req) => set({ pendingPermission: req }),
  setPendingTerminalAction: (action) => set({ pendingTerminalAction: action }),
  addPermissionHistory: (req) => set((state) => ({ permissionHistory: [...state.permissionHistory, req] })),
  setAnalyzeWithAI: (fn: (() => Promise<void>) | null) => set({ analyzeWithAI: fn }),
  setIsAnalyzing: (val: boolean) => set({ isAnalyzing: val }),
}))

export function persistSession() {
  if (!window.electronAPI) return
  const state = useAppStore.getState()
  const providers = state.aiConfig.providers
  const proxyCount = providers.filter(p => p.proxy).length
  console.log('persistSession: providers=' + providers.length + ' proxy=' + proxyCount + ' active=' + state.aiConfig.activeProviderId)
  window.electronAPI.saveConfig({
    aiConfig: state.aiConfig,
    settings: state.settings,
    currentFolder: state.currentFolder,
    workspaceFolders: state.workspaceFolders,
    activeFolderIndex: state.activeFolderIndex,
    openFilePaths: state.openFiles.map(f => f.filePath),
    activeFileIndex: state.activeFileIndex,
  })
}

export async function loadSession() {
  if (!window.electronAPI) return
  const saved = await window.electronAPI.loadConfig()
  if (!saved) return
  if (saved.aiConfig) {
    const cfg = saved.aiConfig
    if (!cfg.customPrompts) cfg.customPrompts = []
    if (!cfg.activeCustomPromptId) cfg.activeCustomPromptId = null
    if (!cfg.thinkingDepth) cfg.thinkingDepth = 'high'
    useAppStore.getState().setAIConfig(cfg)
  }
  if (saved.settings) {
    useAppStore.getState().setSettings(saved.settings)
    const st = saved.settings
    useAppStore.setState({ showTerminal: st.showTerminal ?? true, showAIPanel: st.showAIPanel ?? true })
    if (st.language) {
      setLanguage(st.language)
      if ((window as any).electronAPI && typeof (window as any).electronAPI.changeMenuLanguage === 'function') {
        (window as any).electronAPI.changeMenuLanguage(st.language)
      }
    }
  }
  if (saved.workspaceFolders && Array.isArray(saved.workspaceFolders)) {
    useAppStore.setState({
      workspaceFolders: saved.workspaceFolders,
      activeFolderIndex: saved.activeFolderIndex ?? 0,
      currentFolder: saved.workspaceFolders[saved.activeFolderIndex ?? 0] || null,
    })
    const activeFolder = saved.workspaceFolders[saved.activeFolderIndex ?? 0]
    if (activeFolder) {
      const { listDirectory } = await import('../services/fileSystem')
      try {
        const files = await listDirectory(activeFolder)
        useAppStore.getState().setFolderFiles(files)
      } catch {}
    }
  } else if (saved.currentFolder) {
    useAppStore.getState().setCurrentFolderOnly(saved.currentFolder)
    const { listDirectory } = await import('../services/fileSystem')
    try {
      const files = await listDirectory(saved.currentFolder)
      useAppStore.getState().setFolderFiles(files)
    } catch {}
  }
  if (saved.openFilePaths && Array.isArray(saved.openFilePaths)) {
    const { readFileContent } = await import('../services/fileSystem')
    for (const filePath of saved.openFilePaths) {
      try {
        const content = await readFileContent(filePath)
        useAppStore.getState().openFileInEditor({ filePath, content, isModified: false })
      } catch {}
    }
    if (typeof saved.activeFileIndex === 'number') {
      useAppStore.getState().setActiveFileIndex(saved.activeFileIndex)
    }
  }
}
