import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store'
import { listDirectory } from '../services/fileSystem'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '4px 6px', fontSize: 11,
  background: 'var(--bg-hover)', border: '1px solid var(--border-color)',
  borderRadius: 4, color: 'var(--text-primary)', outline: 'none',
}

const sectionKeys = ['hero', 'features', 'pricing', 'faq', 'contact', 'gallery', 'testimonials', 'footer'] as const
const styleKeys = ['modern', 'minimalist', 'bold', 'elegant', 'playful'] as const
const colorSchemes = [
  { id: 'default', label: 'designColorDefault' },
  { id: 'dark', label: 'designColorDark' },
  { id: 'light', label: 'designColorLight' },
  { id: 'nature', label: 'designColorNature' },
  { id: 'ocean', label: 'designColorOcean' },
  { id: 'sunset', label: 'designColorSunset' },
  { id: 'midnight', label: 'designColorMidnight' },
  { id: 'forest', label: 'designColorForest' },
  { id: 'lavender', label: 'designColorLavender' },
]

const colorPalettes: Record<string, { primary: string; secondary: string; accent: string; bg: string; text: string }> = {
  default: { primary: '#2563eb', secondary: '#7c3aed', accent: '#f59e0b', bg: '#ffffff', text: '#1e293b' },
  dark: { primary: '#3b82f6', secondary: '#8b5cf6', accent: '#fbbf24', bg: '#0f172a', text: '#f1f5f9' },
  light: { primary: '#0891b2', secondary: '#7c3aed', accent: '#ea580c', bg: '#fafafa', text: '#1e293b' },
  nature: { primary: '#059669', secondary: '#65a30d', accent: '#d97706', bg: '#f0fdf4', text: '#1c1917' },
  ocean: { primary: '#0284c7', secondary: '#06b6d4', accent: '#e11d48', bg: '#f0f9ff', text: '#0c4a6e' },
  sunset: { primary: '#ea580c', secondary: '#d946ef', accent: '#fbbf24', bg: '#fff7ed', text: '#431407' },
  midnight: { primary: '#6366f1', secondary: '#a78bfa', accent: '#34d399', bg: '#020617', text: '#e2e8f0' },
  forest: { primary: '#166534', secondary: '#15803d', accent: '#facc15', bg: '#052e16', text: '#dcfce7' },
  lavender: { primary: '#7c3aed', secondary: '#a855f7', accent: '#f472b6', bg: '#faf5ff', text: '#1e1b4b' },
}

const styleDescriptions: Record<string, string> = {
  modern: 'Mūsdienīgs, tīrs dizains ar gradientiem, ēnām, plūstošām animācijām un noapaļotiem elementiem',
  minimalist: 'Minimālistisks, vienkāršs dizains ar daudz tukšas vietas, plāniem rāmjiem, fontu un krāsu akcentiem',
  bold: 'Drosmīgs, spilgts dizains ar trekniem fontiem, kontrastējošām krāsām, lieliem elementiem',
  elegant: 'Elegants, grezns dizains ar zelta/akcentu detaļām, smalkiem gradientiem, plūstošām līnijām',
  playful: 'Jautrs, radošs dizains ar apaļiem elementiem, spilgtām krāsām, rotaļīgām animācijām un neparastiem izkārtojumiem',
}

export default function DesignGenerator() {
  const { t } = useTranslation()
  const aiConfig = useAppStore((s) => s.aiConfig)
  const [urls, setUrls] = useState('')
  const [description, setDescription] = useState('')
  const [generatedHtml, setGeneratedHtml] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [streamed, setStreamed] = useState('')
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(['hero', 'features', 'footer']))
  const [selectedStyle, setSelectedStyle] = useState('modern')
  const [selectedColor, setSelectedColor] = useState('default')

  const activeProvider = aiConfig.providers.find((p) => p.id === aiConfig.activeProviderId)
  const activeModel = activeProvider?.models.find((m) => m.id === aiConfig.activeModelId)

  const toggleSection = (key: string) => {
    const next = new Set(selectedSections)
    if (next.has(key)) next.delete(key); else next.add(key)
    setSelectedSections(next)
  }

  const handleGenerate = async () => {
    if (!activeProvider || !activeModel) {
      setError(t('ai.designSelectProvider'))
      return
    }
    if (!description.trim()) {
      setError(t('ai.designEnterDescription'))
      return
    }
    const palette = colorPalettes[selectedColor] || colorPalettes.default
    const styleDesc = styleDescriptions[selectedStyle] || styleDescriptions.modern
    const sections = selectedSections.size > 0
      ? [...selectedSections].map(k => `- ${t(`ai.design${k.charAt(0).toUpperCase() + k.slice(1)}`)}`).join('\n')
      : t('ai.designHero')

    setIsGenerating(true)
    setError('')
    setGeneratedHtml('')
    setStreamed('')

    const systemPrompt = `Tu esi tīmekļa dizaina eksperts. Tavs uzdevums ir izveidot pilnīgu HTML lapu ar iegultu CSS, kas ir ļoti skaista, moderna un profesionāla.

IZVĒLĒTĀS SADAĻAS:
${sections}

DIZAINA STILS: ${styleDesc}

KRĀSU SHĒMA:
- Primārā: ${palette.primary}
- Sekundārā: ${palette.secondary}
- Akcenta: ${palette.accent}
- Fons: ${palette.bg}
- Teksts: ${palette.text}

PRASĪBAS:
- Atbildi TIKAI ar HTML kodu — bez paskaidrojumiem, bez ievada, bez komentāriem ārpus koda
- HTML jābūt pilnīgam (sākas ar <!DOCTYPE html>, beidzas ar </html>)
- CSS jābūt ievietotam <style> tagā <head> iekšpusē
- Lieto modernus CSS: flexbox, grid, gradients, shadows, transitions, animations
- Iekļauj TIKAI norādītās sadaļas iepriekš minētajā secībā
- KATRAI sadaļai piešķir id attribūtu (piem., id="hero", id="features")
- Katrai sadaļai jābūt vizuāli pilnvērtīgai ar atbilstošu saturu
- Pievieno interaktivitāti (hover efekti, vienmērīgas pārejas, pogas)
- Satura aizpildei izmanto Lorem ipsum vai reālistisku tekstu
- Pievieno responsive dizainu (media queries)
- Ja lietotājs norādījis atsauces URL, iedvesmojies no šo vietņu dizaina, NEVIS kopē to saturu
- Lapai jābūt vizuāli iespaidīgai ar gradienta fonu, modernu tipogrāfiju, noapaļotiem elementiem, dziļuma efektiem (box-shadow), un vizuālu hierarhiju
- Izmanto norādīto krāsu shēmu visā dizainā
- Navigācijai un kājenes saites var būt vietturi (#)`

    const userPrompt = `${description}${urls.trim() ? `\n\nAtsauces vietnes (iedvesmojies no to dizaina):\n${urls}` : ''}`

    try {
      const url = `${activeProvider.apiUrl}/v1/chat/completions`
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (activeProvider.apiKey) headers['Authorization'] = `Bearer ${activeProvider.apiKey}`

      const body = JSON.stringify({
        model: activeModel.id,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
      })

      const response = await fetch(url, { method: 'POST', headers, body })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error(t('ai.designNoData'))

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || ''
            if (content) {
              fullContent += content
              setStreamed((prev) => prev + content)
            }
          } catch { }
        }
      }

      const html = extractHtml(fullContent)
      if (html) {
        setGeneratedHtml(html)
        setStreamed('')
      } else {
        setGeneratedHtml(fullContent)
        setStreamed('')
      }
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePreview = async () => {
    if (!generatedHtml || !window.electronAPI) return
    try {
      await window.electronAPI.previewInBrowser(generatedHtml, 'dizains.html', undefined)
    } catch (e: any) {
      setError(t('ai.designError', { msg: e?.message || String(e) }))
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedHtml)
    } catch { }
  }

  const handleSave = async () => {
    if (!generatedHtml || !window.electronAPI) return
    try {
      const state = useAppStore.getState()
      const folder = state.currentFolder || (state.workspaceFolders && state.workspaceFolders[state.activeFolderIndex])
      if (!folder) { setError(t('ai.designOpenFolderFirst')); return }
      const name = `dizains-${Date.now()}.html`
      const path = `${folder}\\${name}`
      await window.electronAPI.writeFile(path, generatedHtml)
      const files = await listDirectory(folder)
      state.setFolderFiles(files)
      setError(t('ai.designSavedAs', { name }))
    } catch (e: any) {
      setError(t('ai.designError', { msg: e?.message || String(e) }))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, flex: 1, overflow: 'auto', fontSize: 11 }}>
      {(!activeProvider || !activeModel) ? (
        t('ai.designNoProvider')
      ) : (
        <>
          <div className="form-group">
            <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
              {t('ai.designSections')}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {sectionKeys.map(k => {
                const key = k.charAt(0).toUpperCase() + k.slice(1)
                const isSelected = selectedSections.has(k)
                return (
                  <button key={k} className="btn btn-sm"
                    style={{
                      fontSize: 10, padding: '2px 8px',
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      color: isSelected ? '#fff' : 'var(--text-primary)',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)',
                    }}
                    onClick={() => toggleSection(k)}
                  >{t(`ai.design${key}`)}</button>
                )
              })}
            </div>
          </div>
          <div className="form-group">
            <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
              {t('ai.designStyle')}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {styleKeys.map(k => {
                const key = k.charAt(0).toUpperCase() + k.slice(1)
                const isSelected = selectedStyle === k
                return (
                  <button key={k} className="btn btn-sm"
                    style={{
                      fontSize: 10, padding: '2px 8px',
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      color: isSelected ? '#fff' : 'var(--text-primary)',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)',
                    }}
                    onClick={() => setSelectedStyle(k)}
                    title={styleDescriptions[k]}
                  >{t(`ai.designStyle${key}`)}</button>
                )
              })}
            </div>
          </div>
          <div className="form-group">
            <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>
              {t('ai.designColorScheme')}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {colorSchemes.map(cs => {
                const isSelected = selectedColor === cs.id
                const palette = colorPalettes[cs.id]
                return (
                  <button key={cs.id} className="btn btn-sm"
                    style={{
                      fontSize: 10, padding: '2px 6px',
                      background: isSelected ? palette.primary : 'transparent',
                      color: isSelected ? '#fff' : 'var(--text-primary)',
                      border: '1px solid',
                      borderColor: isSelected ? palette.primary : 'var(--border-color)',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                    onClick={() => setSelectedColor(cs.id)}
                  >
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
                      border: '1px solid rgba(255,255,255,0.2)',
                    }} />
                    {t(`ai.${cs.label}`)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="form-group">
            <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('ai.designRefUrls')}</label>
            <textarea
              value={urls}
              onChange={e => setUrls(e.target.value)}
              onPaste={(e) => {
                // Allow default paste behavior
                setTimeout(() => (e.target as HTMLTextAreaElement)?.focus(), 0)
              }}
              placeholder={t('ai.designDescPlaceholder')}
              style={{ ...inputStyle, height: 40, resize: 'vertical', fontSize: 10 }}
            />
          </div>
          <div className="form-group">
            <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('ai.designDescription')}</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onPaste={(e) => {
                // Allow default paste behavior
                setTimeout(() => (e.target as HTMLTextAreaElement)?.focus(), 0)
              }}
              placeholder={t('ai.designDescPlaceholder')}
              style={{ ...inputStyle, height: 50, resize: 'vertical', fontSize: 10 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating || !description.trim()}
              style={{ flex: 1, fontSize: 11, padding: '5px 12px' }}>
              {isGenerating ? t('ai.designGenerating') : '🚀 ' + t('ai.designGenerate')}
            </button>
          </div>

          {error && (
            <div style={{ fontSize: 10, color: 'var(--danger)', padding: '4px 8px', background: 'rgba(255,0,0,0.05)', borderRadius: 4 }}>
              {error}
            </div>
          )}

          {(streamed || generatedHtml) && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, border: '1px solid var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: 'var(--bg-tertiary)', fontSize: 10, borderBottom: '1px solid var(--border-color)' }}>
                {t('ai.designGeneratedHtml')}
                {generatedHtml && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm" onClick={handlePreview}
                      style={{ fontSize: 9, padding: '2px 8px' }}>{`🌐 ${t('ai.designPreview')}`}</button>
                    <button className="btn btn-sm" onClick={handleCopy}
                      style={{ fontSize: 9, padding: '2px 8px' }}>{`📋 ${t('ai.designCopy')}`}</button>
                    <button className="btn btn-sm" onClick={handleSave}
                      style={{ fontSize: 9, padding: '2px 8px' }}>{`💾 ${t('ai.designSave')}`}</button>
                  </div>
                )}
              </div>
              <pre style={{
                flex: 1, margin: 0, padding: 8, fontSize: 10, overflow: 'auto',
                background: '#1e1e1e', color: '#d4d4d4', fontFamily: 'Consolas, monospace',
                lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {streamed || generatedHtml}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function extractHtml(text: string): string | null {
  const match = text.match(/<!DOCTYPE html[\s\S]*?<\/html>/i)
  if (match) return match[0]
  const match2 = text.match(/<html[\s\S]*?<\/html>/i)
  if (match2) return match2[0]
  return null
}