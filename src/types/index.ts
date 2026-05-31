export interface FileItem {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: number
}

export interface OpenFile {
  filePath: string
  content: string
  isModified?: boolean
}

export interface AIProvider {
  id: string
  name: string
  type: 'openai' | 'ollama' | 'lmstudio' | 'openrouter' | 'google' | 'custom'
  apiUrl: string
  apiKey?: string
  models: AIModel[]
  active: boolean
  proxy?: { type: 'http' | 'https' | 'socks'; host: string; port: number; auth?: { username: string; password: string } }
  website?: string
}

export interface AIModel {
  id: string
  name: string
  providerId: string
}

export type ChatMode = 'chat' | 'think' | 'code' | 'plan'

export interface MCPServer {
  id: string
  name: string
  command: string
  args: string[]
  enabled: boolean
}

export interface Plugin {
  id: string
  name: string
  description: string
  type: 'builtin' | 'mcp' | 'custom'
  command?: string
  args?: string[]
  enabled: boolean
  source?: string
}

export interface ChatAttachment {
  id: string
  type: 'file' | 'image' | 'folder' | 'video'
  name: string
  path: string
  content?: string
}

export interface AIConfig {
  providers: AIProvider[]
  activeProviderId: string | null
  activeModelId: string | null
  systemPrompt: string
  chatMode: ChatMode
  mcpServers: MCPServer[]
  customPrompts: CustomPrompt[]
  activeCustomPromptId: string | null
  thinkingDepth: 'maximum' | 'high' | 'medium' | 'low'
}

export interface CustomPrompt {
  id: string
  name: string
  content: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  attachments?: ChatAttachment[]
}

export interface AppSettings {
  theme: 'dark' | 'light'
  fontSize: number
  language: 'lv' | 'en' | 'ru'
  terminal: 'powershell' | 'cmd' | 'bash' | 'zsh'
  sidebarWidth: number
  terminalHeight: number
  aiPanelWidth: number
  showSidebar: boolean
  showTerminal: boolean
  showAIPanel: boolean
  autoSave: boolean
  wordWrap: boolean
  minimap: boolean
  lineNumbers: boolean
  browser: 'default' | 'opera' | 'chrome' | 'firefox' | 'edge' | 'safari'
  swapLayout: boolean
}

export interface PermissionRequest {
  id: string
  action: 'open-url' | 'read-file' | 'write-file' | 'delete-file' | 'run-command' | 'openurl' | 'test-browser'
  resource: string
  description: string
  timestamp: number
  allowed?: boolean
}

export interface BrowserProgress {
  status: 'idle' | 'ready' | 'executing' | 'completed' | 'error'
  currentAction?: string
  completedActions: number
  totalActions: number
  percentage: number
  message: string
}

export interface BrowserAction {
  type: 'click' | 'scroll' | 'type' | 'navigate'
  options: any
}

export interface BrowserClickOptions {
  selector?: string
  x?: number
  y?: number
}

export interface BrowserScrollOptions {
  direction: 'up' | 'down' | 'left' | 'right'
  amount?: number
}

export interface BrowserTypeOptions {
  selector?: string
  text: string
  delay?: number
}

export interface BrowserNavigateOptions {
  url: string
}

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<{ filePath: string; content: string } | null>
      saveFile: (filePath: string, content: string) => Promise<string | null>
      openFolder: () => Promise<{ folderPath: string } | null>
      listFiles: (dirPath: string) => Promise<FileItem[]>
      readFile: (filePath: string) => Promise<string>
      writeFile: (filePath: string, content: string) => Promise<boolean>
      openExternal: (url: string, browser?: string) => Promise<void>
      onFileOpened: (callback: (data: { filePath: string; content: string }) => void) => void
      onFileRequestSave: (callback: () => void) => void
      onFileRequestSaveAs: (callback: (data: { filePath: string }) => void) => void
      onFolderOpened: (callback: (data: { folderPath: string }) => void) => void
      terminalCreate: (type: string) => Promise<string>
      terminalWrite: (id: string, data: string) => Promise<void>
      terminalResize: (id: string, cols: number, rows: number) => Promise<void>
      terminalKill: (id: string) => Promise<void>
      terminalKillAll: () => Promise<void>
      onTerminalData: (id: string, callback: (data: string) => void) => void
      onTerminalClose: (id: string, callback: () => void) => void
      readFileBase64: (filePath: string) => Promise<string>
      createFile: (filePath: string) => Promise<boolean>
      createFolder: (dirPath: string) => Promise<boolean>
      renameItem: (oldPath: string, newPath: string) => Promise<boolean>
      deleteItem: (itemPath: string) => Promise<boolean>
      saveConfig: (data: any) => Promise<boolean>
      loadConfig: () => Promise<any>
      changeMenuLanguage: (lang: string) => Promise<boolean>
      setTheme: (theme: 'dark' | 'light') => Promise<void>
      previewInBrowser: (content: string, filename: string, browser?: string) => Promise<void>
      openFileInBrowser: (filePath: string, browser?: string) => Promise<void>
      testBrowser: (filePath: string) => Promise<{ screenshot?: string; errors?: string[]; diagnostics?: any; error?: string }>
      proxyFetch: (url: string, options: any) => Promise<{ ok: boolean; status?: number; body?: string; error?: string }>
      showMessageBox: (options: { type: string; title: string; message: string; buttons: string[] }) => Promise<number>
      toggleFullscreen: () => Promise<void>
      toggleDevTools: () => Promise<void>
      getLocalIP: () => Promise<string>
    }
    platform: string
  }
}
