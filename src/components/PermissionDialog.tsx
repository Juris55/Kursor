import { useTranslation } from 'react-i18next'
import { useAppStore, selectActiveFolder } from '../store'
import { writeFileContent, readFileContent } from '../services/fileSystem'

export default function PermissionDialog() {
  const req = useAppStore((s) => s.pendingPermission)
  const setPending = useAppStore((s) => s.setPendingPermission)
  const addHistory = useAppStore((s) => s.addPermissionHistory)
  const currentFolder = useAppStore(selectActiveFolder)
  const openFileInEditorStore = useAppStore((s) => s.openFileInEditor)
  const setFolderFiles = useAppStore((s) => s.setFolderFiles)
  const settings = useAppStore((s) => s.settings)
  const { t } = useTranslation()

  if (!req) return null

  const action = req.action
  const resource = req.resource

  const isPathOutside = (path: string) => {
    if (!currentFolder) return true
    const normalizedFolder = currentFolder.replace(/\\/g, '/').toLowerCase()
    const normalizedPath = path.replace(/\\/g, '/').toLowerCase()
    return !normalizedPath.startsWith(normalizedFolder)
  }

  const isDangerous = (action === 'write-file' || action === 'delete-file' || action === 'run-command') && 
                     (resource.includes(':') || resource.startsWith('/') || resource.startsWith('\\')) &&
                     isPathOutside(resource)

  const handleAllow = async () => {
    addHistory({ ...req, allowed: true })
    setPending(null)

    try {
      if (action === 'open-url') {
        if (resource.startsWith('file://')) {
          const filePath = resource.replace(/^file:\/+/i, '').replace(/\//g, '\\')
          window.electronAPI?.openFileInBrowser(filePath, settings.browser)
        } else {
          window.electronAPI?.openExternal(resource, settings.browser)
        }
      } else if (action === 'test-browser') {
        const filePath = resource.replace(/^file:\/+/i, '').replace(/\//g, '\\')
        const result = await window.electronAPI?.testBrowser(filePath)
        if (result) {
          const store = useAppStore.getState()
          const errBlock = result.errors?.length ? result.errors.map((e: string) => `- ${e}`).join('\n') : t('permission.noErrors')
          const diag = result.diagnostics || {}
          const content = `📸 ${t('permission.browserTestResults')}\n\n` +
            `${t('permission.consoleErrors')}\n${errBlock}\n\n` +
            `${t('permission.pageInfo')}\n- ${t('permission.title_')}: ${diag.title || t('permission.none')}\n- ${t('permission.elementsTotal')}: ${diag.elements?.total || 0}\n- ${t('permission.images')}: ${diag.elements?.images || 0}\n- ${t('permission.scripts')}: ${diag.elements?.scripts || 0}\n- ${t('permission.view_')}: ${diag.viewport?.w || '?'}x${diag.viewport?.h || '?'}\n\n` +
            `${t('permission.visibleText')}\n${(diag.visibleText || t('permission.empty')).substring(0, 300)}\n\n` +
            (result.screenshot ? `![${t('permission.screenshot')}](${result.screenshot})` : '')
          store.addChatMessage({ role: 'user', content, timestamp: Date.now() })
          store.setAutoRespond(true)
        }
      } else if (action === 'write-file') {
        const fullPath = resource.includes(':') || resource.startsWith('/') || resource.startsWith('\\')
          ? resource
          : currentFolder ? `${currentFolder}/${resource}` : resource
        await writeFileContent(fullPath, req.description)
        openFileInEditorStore({ filePath: fullPath, content: req.description, isModified: false })
        if (currentFolder) {
          const { listDirectory } = await import('../services/fileSystem')
          const files = await listDirectory(currentFolder)
          setFolderFiles(files)
        }
      } else if (action === 'read-file') {
        const content = await readFileContent(resource)
        alert(`${t('permission.fileContent', { resource })}\n\n${content}`)
      } else if (action === 'run-command') {
        const { getActiveSession } = await import('../services/terminal')
        const session = getActiveSession()
        if (session?.processId && window.electronAPI) {
          window.electronAPI.terminalWrite(session.processId, resource + '\r\n')
        }
        const store = useAppStore.getState()
        if (!store.showTerminal) {
          store.setShowTerminal(true)
        }
      }
    } catch (e: any) {
      alert(t('permission.errorGeneric', { msg: e.message }))
    }
  }

  const handleDeny = () => {
    addHistory({ ...req, allowed: false })
    setPending(null)
  }

  const actionLabels: Record<string, string> = {
    'open-url': t('permission.actionOpenUrl'),
    'read-file': t('permission.actionReadFile'),
    'write-file': t('permission.actionWriteFile'),
    'delete-file': t('permission.actionDeleteFile'),
    'run-command': t('permission.actionRunCommand'),
    'test-browser': t('permission.actionTestBrowser'),
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }}>
      <div style={{
        background: 'var(--bg-primary)', borderRadius: 8,
        padding: 24, minWidth: 380, maxWidth: 500,
        border: isDangerous ? '2px solid var(--danger)' : '1px solid var(--border-color)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: isDangerous ? 'var(--danger)' : 'var(--text-primary)' }}>
          {isDangerous ? '⚠️ ' + t('permission.dangerousTitle', { defaultValue: 'Bīstama darbība!' }) : '🔒 ' + t('permission.title')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
          {isDangerous ? t('permission.dangerousSubtitle', { defaultValue: 'AI mēģina veikt izmaiņas ārpus atvērtās mapes!' }) : t('permission.subtitle')}
        </div>

        <div style={{
          padding: 12, borderRadius: 6,
          background: 'var(--bg-tertiary)', marginBottom: 16,
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {actionLabels[req.action] || req.action}
          </div>
          <div style={{ color: 'var(--text-muted)', wordBreak: 'break-all', maxHeight: 150, overflow: 'auto' }}>
            {req.description}
          </div>
          <div style={{ color: isDangerous ? 'var(--danger)' : 'var(--text-secondary)', marginTop: 6, fontSize: 11, fontWeight: isDangerous ? 600 : 400 }}>
            {t('permission.resource')}: {req.resource}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" style={{ fontSize: 12 }} onClick={handleDeny}>
            ❌ {t('permission.deny')}
          </button>
          <button className="btn btn-primary" style={{ fontSize: 12, background: isDangerous ? 'var(--danger)' : undefined }} onClick={handleAllow}>
            ✅ {t('permission.allow')}
          </button>
        </div>
      </div>
    </div>
  )
}
