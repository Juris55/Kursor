import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { AppSettings } from '../types'
import { setLanguage } from '../i18n'

interface Props {
  onClose: () => void
}

export default function SettingsDialog({ onClose }: Props) {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>{t('settings.title')}</span>
          <button onClick={onClose} style={{ fontSize: 18, opacity: 0.7, background: 'none' }}>×</button>
        </div>
        <div className="dialog-body">
          <div className="form-group">
            <label>{t('settings.theme')}</label>
            <select
              value={settings.theme}
              onChange={(e) => {
                const newTheme = e.target.value as 'dark' | 'light'
                setSettings({ ...settings, theme: newTheme })
                window.electronAPI?.setTheme(newTheme)
              }}
            >
              <option value="dark">{t('view.darkMode')}</option>
              <option value="light">{t('view.lightMode')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('settings.language')}</label>
            <select
              value={settings.language}
              onChange={(e) => {
                const lang = e.target.value as 'lv' | 'en' | 'ru'
                setSettings({ ...settings, language: lang })
                setLanguage(lang)
                if ((window as any).electronAPI && typeof (window as any).electronAPI.changeMenuLanguage === 'function') {
                  (window as any).electronAPI.changeMenuLanguage(lang)
                }
              }}
            >
              <option value="lv">Latviešu</option>
              <option value="en">English</option>
              <option value="ru">Русский</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('settings.fontSize')}</label>
            <input
              type="number"
              min={10}
              max={30}
              value={settings.fontSize}
              onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) || 14 })}
            />
          </div>
          <div className="form-group">
            <label>{t('settings.defaultTerminal')}</label>
            <select
              value={settings.terminal}
              onChange={(e) => setSettings({ ...settings, terminal: e.target.value as 'powershell' | 'cmd' | 'bash' | 'zsh' })}
            >
              {(window as any).platform === 'darwin' ? (
                <>
                  <option value="zsh">Zsh</option>
                  <option value="bash">Bash</option>
                </>
              ) : (window as any).platform === 'linux' || (window as any).platform === 'freebsd' ? (
                <>
                  <option value="bash">Bash</option>
                  <option value="zsh">Zsh</option>
                </>
              ) : (
                <>
                  <option value="powershell">PowerShell</option>
                  <option value="cmd">Command Prompt</option>
                </>
              )}
            </select>
          </div>
          <div className="form-group">
            <label>{t('settings.wordWrap')}</label>
            <select
              value={settings.wordWrap ? 'true' : 'false'}
              onChange={(e) => setSettings({ ...settings, wordWrap: e.target.value === 'true' })}
            >
              <option value="true">{t('common.yes')}</option>
              <option value="false">{t('common.no')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('settings.minimap')}</label>
            <select
              value={settings.minimap ? 'true' : 'false'}
              onChange={(e) => setSettings({ ...settings, minimap: e.target.value === 'true' })}
            >
              <option value="true">{t('common.yes')}</option>
              <option value="false">{t('common.no')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('settings.lineNumbers')}</label>
            <select
              value={settings.lineNumbers ? 'true' : 'false'}
              onChange={(e) => setSettings({ ...settings, lineNumbers: e.target.value === 'true' })}
            >
              <option value="true">{t('common.yes')}</option>
              <option value="false">{t('common.no')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('settings.autoSave')}</label>
            <select
              value={settings.autoSave ? 'true' : 'false'}
              onChange={(e) => setSettings({ ...settings, autoSave: e.target.value === 'true' })}
            >
              <option value="true">{t('common.yes')}</option>
              <option value="false">{t('common.no')}</option>
            </select>
          </div>
          <div className="form-group">
            <label>{t('settings.browserLabel')}</label>
            <select
              value={settings.browser}
              onChange={(e) => setSettings({ ...settings, browser: e.target.value as AppSettings['browser'] })}
            >
              <option value="default">{t('settings.browserDefault')}</option>
              <option value="opera">Opera</option>
              <option value="chrome">Chrome</option>
              <option value="firefox">Firefox</option>
              <option value="edge">Edge</option>
              {(window as any).platform === 'darwin' && <option value="safari">Safari</option>}
            </select>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 16, paddingTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{t('settings.layoutTitle')}</div>
            <div className="form-group">
              <label>{t('settings.sidebarWidthLabel')}</label>
              <input type="range" min={150} max={600} value={settings.sidebarWidth}
                onChange={(e) => setSettings({ ...settings, sidebarWidth: parseInt(e.target.value) })}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{settings.sidebarWidth}px</span>
            </div>
            <div className="form-group">
              <label>{t('settings.aiPanelWidthLabel')}</label>
              <input type="range" min={200} max={800} value={settings.aiPanelWidth}
                onChange={(e) => setSettings({ ...settings, aiPanelWidth: parseInt(e.target.value) })}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{settings.aiPanelWidth}px</span>
            </div>
            <div className="form-group">
              <label>{t('settings.terminalHeightLabel')}</label>
              <input type="range" min={80} max={600} value={settings.terminalHeight}
                onChange={(e) => setSettings({ ...settings, terminalHeight: parseInt(e.target.value) })}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{settings.terminalHeight}px</span>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={settings.showSidebar}
                  onChange={(e) => setSettings({ ...settings, showSidebar: e.target.checked })}
                /> {t('settings.showSidebar')}
              </label>
            </div>
            <button className="btn btn-sm" style={{ marginTop: 8 }}
              onClick={() => setSettings({
                ...settings,
                sidebarWidth: 260, terminalHeight: 200, aiPanelWidth: 380,
                showSidebar: true, showTerminal: true, showAIPanel: true,
              })}
            >{t('settings.resetLayout')}</button>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-primary" onClick={onClose}>{t('common.ok')}</button>
        </div>
      </div>
    </div>
  )
}
