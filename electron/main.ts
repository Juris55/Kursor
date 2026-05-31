import { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, unlinkSync, renameSync, rmSync } from 'fs'
import { spawn, execSync } from 'child_process'
import * as pty from 'node-pty'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

let mainWindow: BrowserWindow | null = null

const menuTranslations: Record<string, Record<string, string>> = {
  lv: {
    aboutTitle: 'Par Kursor',
    aboutMessage: 'Kursor v2.0.0\nLatviešu teksta redaktors ar AI atbalstu',
    aboutButton: 'Labi',
    quit: 'Iziet',
    file: 'Fails',
    openFile: 'Atvērt failu',
    save: 'Saglabāt',
    saveAs: 'Saglabāt kā',
    openFolder: 'Atvērt mapi',
    close: 'Aizvērt',
    edit: 'Rediģēt',
    undo: 'Atsaukt',
    redo: 'Atcelt atsaukšanu',
    cut: 'Izgriezt',
    copy: 'Kopēt',
    paste: 'Ielīmēt',
    selectAll: 'Izvēlēties visu',
    view: 'Skats',
    reload: 'Pārlādēt',
    devTools: 'Izstrādātāja rīki',
    zoomIn: 'Pietuvināt',
    zoomOut: 'Attālināt',
    resetZoom: 'Atiestatīt mērogu',
    fullscreen: 'Pilnekrāns',
    help: 'Palīdzība',
  },
  en: {
    aboutTitle: 'About Kursor',
    aboutMessage: 'Kursor v2.0.0\nLatvian text editor with AI support',
    aboutButton: 'OK',
    quit: 'Exit',
    file: 'File',
    openFile: 'Open File',
    save: 'Save',
    saveAs: 'Save As',
    openFolder: 'Open Folder',
    close: 'Close',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    view: 'View',
    reload: 'Reload',
    devTools: 'Developer Tools',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    resetZoom: 'Reset Zoom',
    fullscreen: 'Toggle Full Screen',
    help: 'Help',
  },
  ru: {
    aboutTitle: 'О Kursor',
    aboutMessage: 'Kursor v2.0.0\nЛатышский текстовый редактор с ИИ-поддержкой',
    aboutButton: 'OK',
    quit: 'Выход',
    file: 'Файл',
    openFile: 'Открыть файл',
    save: 'Сохранить',
    saveAs: 'Сохранить как',
    openFolder: 'Открыть папку',
    close: 'Закрыть',
    edit: 'Правка',
    undo: 'Отменить',
    redo: 'Повторить',
    cut: 'Вырезать',
    copy: 'Копировать',
    paste: 'Вставить',
    selectAll: 'Выделить всё',
    view: 'Вид',
    reload: 'Перезагрузить',
    devTools: 'Инструменты разработчика',
    zoomIn: 'Приблизить',
    zoomOut: 'Отдалить',
    resetZoom: 'Сбросить масштаб',
    fullscreen: 'Полный экран',
    help: 'Помощь',
  }
}

function createApplicationMenu(lang: string) {
  // Native menu disabled - using HTML menu bar instead
  Menu.setApplicationMenu(null)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Kursor',
    icon: join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const config = loadConfigFromDisk()
  const savedLang = config?.settings?.language || 'lv'
  const savedTheme = config?.settings?.theme || 'dark'
  nativeTheme.themeSource = savedTheme
  createApplicationMenu(savedLang)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

async function openFile() {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'Visi faili', extensions: ['*'] }],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    const content = readFileSync(filePath, 'utf-8')
    mainWindow?.webContents.send('file:opened', { filePath, content })
  }
}

async function saveFile() {
  mainWindow?.webContents.send('file:request-save')
}

async function saveFileAs() {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [{ name: 'Visi faili', extensions: ['*'] }],
  })
  if (!result.canceled && result.filePath) {
    mainWindow?.webContents.send('file:request-save-as', { filePath: result.filePath })
  }
}

async function openFolder() {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow?.webContents.send('folder:opened', { folderPath: result.filePaths[0] })
  }
}

function listFiles(dirPath: string): any[] {
  const items: any[] = []
  if (!existsSync(dirPath)) return items
  const entries = readdirSync(dirPath)
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    if (entry === 'node_modules') continue
    const fullPath = join(dirPath, entry)
    try {
      const stats = statSync(fullPath)
      items.push({
        name: entry,
        path: fullPath,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modifiedAt: stats.mtimeMs,
      })
    } catch { }
  }
  return items.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

function readFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

function writeFile(filePath: string, content: string): void {
  const dir = join(filePath, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(filePath, content, 'utf-8')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'Visi faili', extensions: ['*'] }],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    return { filePath: result.filePaths[0], content: readFileSync(result.filePaths[0], 'utf-8') }
  }
  return null
})

ipcMain.handle('dialog:saveFile', async (_event, filePath: string, content: string) => {
  if (!filePath) {
    const result = await dialog.showSaveDialog(mainWindow!, {
      filters: [{ name: 'Visi faili', extensions: ['*'] }],
    })
    if (result.canceled || !result.filePath) return null
    filePath = result.filePath
  }
  writeFile(filePath, content)
  return filePath
})

ipcMain.handle('dialog:showMessageBox', async (_event, options) => {
  const result = await dialog.showMessageBox(mainWindow!, options)
  return result.response
})

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    return { folderPath: result.filePaths[0] }
  }
  return null
})

ipcMain.handle('fs:listFiles', (_event, dirPath: string) => {
  return listFiles(dirPath)
})

ipcMain.handle('fs:readFile', (_event, filePath: string) => {
  return readFile(filePath)
})

ipcMain.handle('fs:writeFile', (_event, filePath: string, content: string) => {
  writeFile(filePath, content)
  return true
})

ipcMain.handle('fs:readFileBase64', (_event, filePath: string) => {
  const data = readFileSync(filePath)
  return data.toString('base64')
})

ipcMain.handle('fs:createFile', (_event, filePath: string) => {
  writeFileSync(filePath, '', 'utf-8')
  return true
})

ipcMain.handle('fs:createFolder', (_event, dirPath: string) => {
  mkdirSync(dirPath, { recursive: true })
  return true
})

ipcMain.handle('fs:renameItem', (_event, oldPath: string, newPath: string) => {
  renameSync(oldPath, newPath)
  return true
})

ipcMain.handle('fs:deleteItem', (_event, itemPath: string) => {
  const stats = statSync(itemPath)
  if (stats.isDirectory()) {
    rmSync(itemPath, { recursive: true, force: true })
  } else {
    unlinkSync(itemPath)
  }
  return true
})

function getBrowserPath(browser: string): string | null {
  if (process.platform === 'darwin') {
    const macPaths: Record<string, string[]> = {
      chrome: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
      firefox: ['/Applications/Firefox.app/Contents/MacOS/firefox'],
      edge: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
      opera: ['/Applications/Opera.app/Contents/MacOS/Opera'],
      safari: ['/Applications/Safari.app/Contents/MacOS/Safari'],
    }
    const candidates = macPaths[browser] || []
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    return null
  }
  if (process.platform === 'linux') {
    try {
      const result = execSync(`which ${browser} 2>/dev/null || command -v ${browser} 2>/dev/null`, { encoding: 'utf-8', timeout: 3000 })
      const p = result.trim().split('\n')[0]
      if (p) return p
    } catch {}
    const linuxPaths: Record<string, string[]> = {
      chrome: ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'],
      firefox: ['firefox'],
      edge: ['microsoft-edge', 'microsoft-edge-stable'],
      opera: ['opera'],
    }
    const candidates = linuxPaths[browser] || []
    for (const cmd of candidates) {
      try {
        const p = execSync(`command -v ${cmd} 2>/dev/null`, { encoding: 'utf-8', timeout: 3000 }).trim()
        if (p) return p
      } catch {}
    }
    return null
  }
  const localAppData = process.env.LOCALAPPDATA || ''
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files'
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const winPaths: Record<string, string[]> = {
    opera: [
      join(programFiles, 'Opera', 'launcher.exe'),
      join(programFiles, 'Opera', 'opera.exe'),
      join(programFilesX86, 'Opera', 'launcher.exe'),
      join(programFilesX86, 'Opera', 'opera.exe'),
      join(localAppData, 'Programs', 'Opera', 'launcher.exe'),
      join(localAppData, 'Programs', 'Opera', 'opera.exe'),
      join(localAppData, 'Programs', 'Opera GX', 'launcher.exe'),
      join(localAppData, 'Programs', 'Opera GX', 'opera.exe'),
      join(programFiles, 'Opera GX', 'launcher.exe'),
      join(programFiles, 'Opera GX', 'opera.exe'),
      join(programFilesX86, 'Opera GX', 'launcher.exe'),
      join(programFilesX86, 'Opera GX', 'opera.exe'),
    ],
    chrome: [
      join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ],
    firefox: [
      join(programFiles, 'Mozilla Firefox', 'firefox.exe'),
      join(programFilesX86, 'Mozilla Firefox', 'firefox.exe'),
    ],
    edge: [
      join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ],
  }
  const candidates = winPaths[browser] || []
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return null
}

const configPath = join(app.getPath('userData'), 'config.json')

function saveConfigToDisk(data: any): void {
  try {
    const json = JSON.stringify(data, null, 2)
    writeFileSync(configPath, json, 'utf-8')
    console.log('Config saved OK:', configPath, Object.keys(data))
  } catch (e) {
    console.error('Failed to save config:', e)
  }
}

function loadConfigFromDisk(): any {
  try {
    if (!existsSync(configPath)) {
      console.log('No config file at:', configPath)
      return null
    }
    const json = readFileSync(configPath, 'utf-8')
    console.log('Config loaded OK:', configPath, json.length, 'bytes')
    return JSON.parse(json)
  } catch (e) {
    console.error('Failed to load config:', e)
    return null
  }
}

ipcMain.handle('config:save', (_event, data: any) => {
  saveConfigToDisk(data)
  return true
})

ipcMain.handle('config:load', () => {
  return loadConfigFromDisk()
})

ipcMain.handle('menu:changeLanguage', (_event, lang: string) => {
  createApplicationMenu(lang)
  return true
})

ipcMain.handle('app:setTheme', (_event, theme: 'dark' | 'light') => {
  nativeTheme.themeSource = theme
})

ipcMain.handle('fs:previewInBrowser', async (_event, content: string, filename: string, browser?: string) => {
  const previewDir = join(app.getPath('temp'), 'kursor-preview')
  if (!existsSync(previewDir)) mkdirSync(previewDir, { recursive: true })
  const filePath = join(previewDir, filename)
  writeFileSync(filePath, content, 'utf-8')
  if (!browser || browser === 'default') {
    shell.openPath(filePath)
  } else {
    const browserPath = getBrowserPath(browser)
    if (browserPath) {
      const child = spawn(browserPath, [filePath], { detached: true, stdio: 'ignore' })
      child.unref()
    } else {
      shell.openPath(filePath)
    }
  }
})

ipcMain.handle('fs:openFileInBrowser', (_event, filePath: string, browser?: string) => {
  const normalizedPath = process.platform === 'win32' ? filePath.replace(/\//g, '\\') : filePath
  if (!existsSync(normalizedPath)) { return }
  if (!browser || browser === 'default') {
    shell.openPath(normalizedPath).catch(() => {})
  } else {
    const browserPath = getBrowserPath(browser)
    if (browserPath) {
      const child = spawn(browserPath, [normalizedPath], { detached: true, stdio: 'ignore' })
      child.unref()
    } else {
      shell.openPath(normalizedPath).catch(() => {})
    }
  }
})

ipcMain.handle('shell:openExternal', (_event, url: string, browser?: string) => {
  if (!browser || browser === 'default') {
    shell.openExternal(url)
    return
  }
  const browserPath = getBrowserPath(browser)
  if (browserPath) {
    const child = spawn(browserPath, [url], { detached: true, stdio: 'ignore' })
    child.unref()
  } else {
    shell.openExternal(url)
  }
})

// Terminal management
const terminalProcesses = new Map<string, pty.IPty>()
let terminalCounter = 0

ipcMain.handle('terminal:create', (_event, type: string) => {
  const id = `term-${terminalCounter++}`
  let shellCmd: string
  let shellArgs: string[] = []
  if (process.platform === 'win32') {
    if (type === 'cmd') {
      shellCmd = 'cmd.exe'
      shellArgs = []
    } else if (type === 'powershell') {
      shellCmd = 'powershell.exe'
      shellArgs = []
    } else {
      shellCmd = 'powershell.exe'
      shellArgs = []
    }
  } else if (process.platform === 'darwin') {
    shellCmd = type === 'bash' ? '/bin/bash' : '/bin/zsh'
    shellArgs = []
  } else {
    shellCmd = type === 'zsh' ? '/bin/zsh' : '/bin/bash'
    shellArgs = []
  }

  const term = pty.spawn(shellCmd, shellArgs, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || process.env.USERPROFILE,
    env: { ...process.env, TERM: 'xterm-256color' },
    useConpty: process.platform === 'win32' ? true : undefined,
  })

  terminalProcesses.set(id, term)

  term.onData((data: string) => {
    mainWindow?.webContents.send(`terminal:data:${id}`, data)
  })

  term.onExit(({ exitCode, signal }) => {
    terminalProcesses.delete(id)
    mainWindow?.webContents.send(`terminal:close:${id}`)
  })

  return id
})

ipcMain.on('terminal:write', (_event, id: string, data: string) => {
  const term = terminalProcesses.get(id)
  if (term) {
    try {
      if (data === '\x1b[3~') console.log('[terminal:write] DELETE seq sent to', id)
      term.write(data)
    } catch {}
  }
})

ipcMain.handle('terminal:resize', (_event, id: string, cols: number, rows: number) => {
  const term = terminalProcesses.get(id)
  if (term) {
    try { term.resize(cols, rows) } catch {}
  }
})

ipcMain.handle('terminal:kill', (_event, id: string) => {
  const term = terminalProcesses.get(id)
  if (term) {
    try { term.kill() } catch {}
    terminalProcesses.delete(id)
  }
})

ipcMain.handle('terminal:killAll', () => {
  for (const [, term] of terminalProcesses) {
    try { term.kill() } catch {}
  }
  terminalProcesses.clear()
})

ipcMain.handle('fs:testBrowser', async (_event, filePath: string) => {
  const normalizedPath = process.platform === 'win32' ? filePath.replace(/\//g, '\\') : filePath
  if (!existsSync(normalizedPath)) {
    return { error: 'Fails nav atrasts: ' + normalizedPath }
  }

  let testWin: BrowserWindow | null = null
  try {
    testWin = new BrowserWindow({
      show: false,
      width: 1280,
      height: 720,
      webPreferences: { contextIsolation: false, nodeIntegration: false },
    })

    const errors: string[] = []
    testWin.webContents.on('console-message', (_e, level, message) => {
      if (level >= 2) errors.push(message)
    })

    const fileUrl = 'file:///' + normalizedPath.replace(/\\/g, '/')
    await testWin.loadURL(fileUrl)
    await new Promise((r) => setTimeout(r, 2000))

    const screenshot = await testWin.webContents.capturePage()
    const pngBuffer = screenshot.toPNG()
    const base64 = pngBuffer.toString('base64')

    const diagnostics = await testWin.webContents.executeJavaScript(`
      (function(){
        const info = {
          title: document.title || '',
          bodyHtml: document.body ? document.body.innerHTML.substring(0, 500) : '',
          visibleText: document.body ? document.body.innerText.substring(0, 300) : '',
          elements: {
            total: document.querySelectorAll('*').length,
            images: document.querySelectorAll('img').length,
            scripts: document.querySelectorAll('script').length,
            links: document.querySelectorAll('a').length,
          },
          viewport: { w: window.innerWidth, h: window.innerHeight },
        }
        return info
      })()
    `)

    testWin.close()
    testWin = null

    return {
      screenshot: `data:image/png;base64,${base64}`,
      errors,
      diagnostics,
    }
  } catch (e: any) {
    if (testWin) { testWin.close() }
    return { error: e.message }
  }
})

ipcMain.handle('http:proxyFetch', async (_event, url: string, options: {
  method?: string
  headers?: Record<string, string>
  body?: string
  proxy: { type: string; host: string; port: number; auth?: { username: string; password: string } }
}) => {
  const { proxy } = options
  if (!proxy || !proxy.host || !proxy.port) {
    try {
      const res = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
      })
      return { ok: res.ok, status: res.status, body: await res.text() }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  const proxyUrl = proxy.auth
    ? `${proxy.type}://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`
    : `${proxy.type}://${proxy.host}:${proxy.port}`

  const agent = proxy.type === 'socks' ? new SocksProxyAgent(proxyUrl) : new HttpsProxyAgent(proxyUrl)

  try {
    const urlObj = new URL(url)
    const httpModule = urlObj.protocol === 'https:' ? require('https') : require('http')
    const res = await new Promise<any>((resolve, reject) => {
      const req = httpModule.request(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        agent,
      }, (res: any) => {
        let data = ''
        res.on('data', (chunk: string) => data += chunk)
        res.on('end', () => resolve({ ok: res.statusCode < 400, status: res.statusCode, body: data }))
      })
      req.on('error', (e: Error) => reject(e))
      if (options.body) req.write(options.body)
      req.end()
    })
    return res
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('app:getLocalIP', () => {
  const os = require('os')
  const interfaces = os.networkInterfaces()
  let fallback = ''
  const vpnKeywords = ['tun', 'tap', 'vpn', 'ppp', 'wg', 'utun', 'tailscale', 'zerotier', 'nordlynx']
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const lower = name.toLowerCase()
        const isVpn = vpnKeywords.some(k => lower.includes(k))
        if (isVpn) return iface.address
        if (!fallback) fallback = iface.address
      }
    }
  }
  return fallback || '127.0.0.1'
})

ipcMain.handle('app:toggleFullscreen', () => {
  const isFull = mainWindow?.isFullScreen()
  mainWindow?.setFullScreen(!isFull)
})

ipcMain.handle('app:toggleDevTools', () => {
  mainWindow?.webContents.toggleDevTools()
})
