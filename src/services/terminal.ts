import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'

interface TerminalSession {
  id: string
  type: 'powershell' | 'cmd' | 'bash' | 'zsh'
  term: Terminal
  fit: FitAddon
  processId: string | null
  container: HTMLElement
  generation: number
}

const sessions = new Map<string, TerminalSession>()
let activeSessionId: string | null = null
let sessionCounter = 0

export function getActiveSession(): TerminalSession | null {
  return activeSessionId ? sessions.get(activeSessionId) || null : null
}

export function getSessions(): Array<{ id: string; type: string }> {
  return Array.from(sessions.values()).map(s => ({ id: s.id, type: s.type }))
}

export function getActiveSessionId(): string | null {
  return activeSessionId
}

const darkTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
}

const lightTheme = {
  background: '#ffffff',
  foreground: '#111111',
  cursor: '#111111',
  selectionBackground: '#add6ff',
  black: '#000000',
  red: '#cd3131',
  green: '#00aa00',
  yellow: '#b8860b',
  blue: '#0451a5',
  magenta: '#bc3fbc',
  cyan: '#0598bc',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#00aa00',
  brightYellow: '#b8860b',
  brightBlue: '#0451a5',
  brightMagenta: '#bc3fbc',
  brightCyan: '#0598bc',
  brightWhite: '#111111',
}

export async function createTerminal(
  container: HTMLElement,
  type: 'powershell' | 'cmd' | 'bash' | 'zsh' = 'powershell',
  colorScheme: 'dark' | 'light' = 'dark',
): Promise<string> {
  const myGen = ++sessionCounter
  const sessionId = `session-${sessionCounter}`

  const term = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: 13,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: colorScheme === 'light' ? lightTheme : darkTheme,
    allowTransparency: false,
    scrollback: 5000,
    cols: 80,
    rows: 24,
  })

  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(container)
  try { fit.fit() } catch {}

  const session: TerminalSession = {
    id: sessionId,
    type,
    term,
    fit,
    processId: null,
    container,
    generation: myGen,
  }

  sessions.set(sessionId, session)
  activeSessionId = sessionId

  // Focus terminal on click
  container.addEventListener('click', () => {
    term.focus()
  })

  // Capture-phase Ctrl+V paste (prevent xterm from generating ^V/\x16 in CMD)
  container.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.code === 'KeyV' || e.keyCode === 86)) {
      e.preventDefault()
      e.stopPropagation()
      navigator.clipboard.readText().then((text) => {
        if (text && session.processId && window.electronAPI) {
          window.electronAPI.terminalWrite(session.processId, text)
        }
      })
    }
  }, true)

  // Copy: Ctrl+C with selection copies to clipboard without sending to process
  term.attachCustomKeyEventHandler((arg) => {
    if (arg.type !== 'keydown') return true
    if (arg.ctrlKey && arg.code === 'KeyC') {
      const selection = term.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection)
        return false
      }
    }
    if ((arg.ctrlKey || arg.metaKey) && (arg.key === 'l' || arg.code === 'KeyL')) {
      if (session.processId && window.electronAPI) {
        window.electronAPI.terminalWrite(session.processId, session.type === 'powershell' ? 'Clear-Host\r\n' : 'cls\r\n')
      }
      return false
    }
    if ((arg.key === 'Delete' || arg.code === 'Delete' || arg.keyCode === 46) && session.processId && window.electronAPI) {
      window.electronAPI.terminalWrite(session.processId, '\x1b[3~')
      document.title = '[DEL] ' + document.title.replace(/^\[DEL[^\]]*\] /, '')
      return false
    }
    return true
  })

  // Focus terminal on click
  container.addEventListener('click', () => {
    term.focus()
  })

  if (window.electronAPI) {
    const id = await window.electronAPI.terminalCreate(type)
    session.processId = id

    window.electronAPI.onTerminalData(id, (data: string) => {
      const s = sessions.get(sessionId)
      if (!s || s.generation !== myGen) return
      try { s.term.write(data) } catch {}
    })

    window.electronAPI.onTerminalClose(id, () => {
      const s = sessions.get(sessionId)
      if (!s || s.generation !== myGen) return
      try { s.term.write('\r\n\x1b[31mTerminālis aizvērts\x1b[0m\r\n') } catch {}
      s.processId = null
    })

    term.onData((data) => {
      const s = sessions.get(sessionId)
      if (!s || s.generation !== myGen) return
      if (s.processId) {
        window.electronAPI.terminalWrite(s.processId, data)
      }
    })

    term.onResize(({ cols, rows }) => {
      const s = sessions.get(sessionId)
      if (!s || s.generation !== myGen || !s.processId) return
      window.electronAPI.terminalResize(s.processId, cols, rows)
    })
  }

  return sessionId
}

export async function closeTerminal(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId)
  if (!session) return
  if (session.processId && window.electronAPI) {
    await window.electronAPI.terminalKill(session.processId)
  }
  session.term.dispose()
  if (session.container.parentNode) {
    session.container.parentNode.removeChild(session.container)
  }
  sessions.delete(sessionId)
  if (activeSessionId === sessionId) {
    activeSessionId = sessions.size > 0 ? (sessions.keys().next().value as string) : null
  }
}

export function activateTerminal(sessionId: string): void {
  if (sessions.has(sessionId)) {
    activeSessionId = sessionId
    for (const [id, s] of sessions) {
      s.container.style.display = id === sessionId ? 'flex' : 'none'
    }
    const active = sessions.get(sessionId)
    if (active) {
      try { active.fit.fit() } catch {}
      setTimeout(() => active.term.focus(), 0)
    }
  }
}

export function setTerminalTheme(colorScheme: 'dark' | 'light'): void {
  const theme = colorScheme === 'light' ? lightTheme : darkTheme
  for (const [, session] of sessions) {
    session.term.options.theme = theme
    const xtermEl = session.container.querySelector('.xterm') as HTMLElement | null
    if (xtermEl) xtermEl.style.backgroundColor = theme.background || ''
    const viewportEl = session.container.querySelector('.xterm-viewport') as HTMLElement | null
    if (viewportEl) viewportEl.style.backgroundColor = theme.background || ''
  }
}

export function fitTerminal(sessionId?: string): void {
  const s = sessionId ? sessions.get(sessionId) : getActiveSession()
  if (!s) return
  try {
    const rect = s.container.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      s.fit.fit()
    }
  } catch {}
}

export function writeToTerminal(text: string): void {
  const s = getActiveSession()
  try { s?.term.write(text) } catch {}
}

export function clearTerminal(): void {
  const s = getActiveSession()
  if (!s) return
  s.term.clear()
  if (s.processId && window.electronAPI) {
    window.electronAPI.terminalWrite(s.processId, s.type === 'powershell' ? 'Clear-Host\r\n' : 'cls\r\n')
  }
}

export function disposeTerminal(): void {
  for (const [id, session] of sessions) {
    if (session.processId && window.electronAPI) {
      window.electronAPI.terminalKill(session.processId).catch(() => {})
    }
    session.term.dispose()
    sessions.delete(id)
  }
  activeSessionId = null
}

export function getTerminalInstance(): Terminal | null {
  return getActiveSession()?.term || null
}

export function sendCdToTerminal(folderPath: string, shellType: 'powershell' | 'cmd' | 'bash' | 'zsh'): void {
  const s = getActiveSession()
  if (!s?.processId || !window.electronAPI) return
  let cmd: string
  if (shellType === 'cmd') {
    cmd = `cd /d "${folderPath}"\r\n`
  } else if (shellType === 'powershell') {
    cmd = `cd "${folderPath}"\r\n`
  } else {
    cmd = `cd "${folderPath}"\r\n`
  }
  window.electronAPI.terminalWrite(s.processId, cmd)
}
