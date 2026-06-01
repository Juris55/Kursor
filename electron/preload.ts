import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('platform', process.platform)

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (filePath: string, content: string) => ipcRenderer.invoke('dialog:saveFile', filePath, content),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  listFiles: (dirPath: string) => ipcRenderer.invoke('fs:listFiles', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  openExternal: (url: string, browser?: string) => ipcRenderer.invoke('shell:openExternal', url, browser),
  onFileOpened: (callback: (data: { filePath: string; content: string }) => void) => {
    ipcRenderer.on('file:opened', (_event, data) => callback(data))
  },
  onFileRequestSave: (callback: () => void) => {
    ipcRenderer.on('file:request-save', () => callback())
  },
  onFileRequestSaveAs: (callback: (data: { filePath: string }) => void) => {
    ipcRenderer.on('file:request-save-as', (_event, data) => callback(data))
  },
  onFolderOpened: (callback: (data: { folderPath: string }) => void) => {
    ipcRenderer.on('folder:opened', (_event, data) => callback(data))
  },

  terminalCreate: (type: string) => ipcRenderer.invoke('terminal:create', type),
  terminalWrite: (id: string, data: string) => {
    ipcRenderer.send('terminal:write', id, data)
  },
  terminalResize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
  terminalKill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
  terminalKillAll: () => ipcRenderer.invoke('terminal:killAll'),
  onTerminalData: (id: string, callback: (data: string) => void) => {
    ipcRenderer.on(`terminal:data:${id}`, (_event, data) => callback(data))
  },
  onTerminalClose: (id: string, callback: () => void) => {
    ipcRenderer.on(`terminal:close:${id}`, () => callback())
  },
  readFileBase64: (filePath: string) => ipcRenderer.invoke('fs:readFileBase64', filePath),
  createFile: (filePath: string) => ipcRenderer.invoke('fs:createFile', filePath),
  createFolder: (dirPath: string) => ipcRenderer.invoke('fs:createFolder', dirPath),
  renameItem: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renameItem', oldPath, newPath),
  deleteItem: (itemPath: string) => ipcRenderer.invoke('fs:deleteItem', itemPath),
  saveConfig: (data: any) => ipcRenderer.invoke('config:save', data),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  changeMenuLanguage: (lang: string) => ipcRenderer.invoke('menu:changeLanguage', lang),
  setTheme: (theme: 'dark' | 'light') => ipcRenderer.invoke('app:setTheme', theme),
  previewInBrowser: (content: string, filename: string, browser?: string) => ipcRenderer.invoke('fs:previewInBrowser', content, filename, browser),
  openFileInBrowser: (filePath: string, browser?: string) => ipcRenderer.invoke('fs:openFileInBrowser', filePath, browser),
  testBrowser: (filePath: string) => ipcRenderer.invoke('fs:testBrowser', filePath),
  proxyFetch: (url: string, options: any) => ipcRenderer.invoke('http:proxyFetch', url, options),
  showMessageBox: (options: { type: string; title: string; message: string; buttons: string[] }) => ipcRenderer.invoke('dialog:showMessageBox', options),
  toggleFullscreen: () => ipcRenderer.invoke('app:toggleFullscreen'),
  toggleDevTools: () => ipcRenderer.invoke('app:toggleDevTools'),
  getLocalIP: () => ipcRenderer.invoke('app:getLocalIP'),
})
