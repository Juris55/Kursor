import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore, selectActiveFolder } from '../store'
import { sendChatMessage, fetchModelsFromProvider, testProviderConnection, MessageContent, ContentPart } from '../services/ai'
import { openFileDialog, openFolderDialog, readFileContent, readFileBase64, getAttachmentType, isTextFile } from '../services/fileSystem'
import { AIProvider, ChatAttachment, ChatMode, MCPServer, ChatMessage, PermissionRequest } from '../types'
import { providerPresets, ProviderPreset } from '../data/providerPresets'
import { proxyPresets } from '../data/proxyPresets'
import { mcpPresets } from '../data/mcpPresets'
import DesignGenerator from './DesignGenerator'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '4px 6px', fontSize: 11,
  background: 'var(--bg-hover)', border: '1px solid var(--border-color)',
  borderRadius: 4, color: 'var(--text-primary)', outline: 'none',
}

const translateProxyName = (name: string, t: any): string => {
  // Map Latvian country names to translation keys
  const countryMap: { [key: string]: string } = {
    'ASV': 'USA', 'Kanāda': 'Canada', 'Brazīlija': 'Brazil',
    'Vācija': 'Germany', 'Nīderlande': 'Netherlands', 'Apvienotā Karaliste': 'UK',
    'Francija': 'France', 'Spānija': 'Spain', 'Itālija': 'Italy',
    'Zviedrija': 'Sweden', 'Polija': 'Poland', 'Japāna': 'Japan',
    'Dienvidkoreja': 'SouthKorea', 'Singapūra': 'Singapore', 'Indija': 'India',
    'Ķīna': 'China', 'Taivāna': 'Taiwan', 'Taizeme': 'Thailand', 'Vjetnama': 'Vietnam',
  }
  
  const cityMap: { [key: string]: string } = {
    'Ņujorka': 'NewYork', 'Čikāga': 'Chicago', 'Maiami': 'Miami', 'Sietla': 'Seattle',
    'Losandželosa': 'LosAngeles', 'Toronto': 'Toronto', 'Sanpaulu': 'SaoPaulo',
    'Frankfurte': 'Frankfurt', 'Berlīne': 'Berlin', 'Amsterdama': 'Amsterdam',
    'Roterdama': 'Rotterdam', 'Londona': 'London', 'Mančestra': 'Manchester',
    'Parīze': 'Paris', 'Marseļa': 'Marseille', 'Madride': 'Madrid', 'Roma': 'Rome',
    'Stokholma': 'Stockholm', 'Varšava': 'Warsaw', 'Tokija': 'Tokyo', 'Osaka': 'Osaka',
    'Seula': 'Seoul', 'Mumbaja': 'Mumbai', 'Honkonga': 'HongKong', 'Taibei': 'Taipei',
    'Bangkoka': 'Bangkok', 'Hanoja': 'Hanoi',
  }
  
  let translated = name
  for (const [latvian, key] of Object.entries(countryMap)) {
    translated = translated.replace(new RegExp(latvian, 'g'), t(`proxyCountries.${key}`))
  }
  for (const [latvian, key] of Object.entries(cityMap)) {
    translated = translated.replace(new RegExp(latvian, 'g'), t(`proxyCountries.${key}`))
  }
  translated = translated.replace(/Optimālais/g, t(`proxyCountries.optimal`))
  translated = translated.replace(/anonīms/g, t(`proxyCountries.anonymous`))
  translated = translated.replace(/Eiropas /g, t(`proxyCountries.europe`) + ' ')
  translated = translated.replace(/Āzijas /g, t(`proxyCountries.asia`) + ' ')
  translated = translated.replace(/Rietumi/g, t(`proxyCountries.west`))
  translated = translated.replace(/Centr\./g, t(`proxyCountries.central`))
  translated = translated.replace(/D\.R\./g, t(`proxyCountries.southeast`))
  
  return translated
}

const estimateTokens = (text: string): number => Math.ceil(text.length / 4)

const getProviderWebsite = (p: AIProvider | undefined): string | undefined => {
  if (!p) return undefined
  if (p.website) return p.website
  try {
    const baseUrl = new URL(p.apiUrl).origin
    switch (p.type) {
      case 'openai': return 'https://platform.openai.com/signup'
      case 'openrouter': return 'https://openrouter.ai/keys'
      case 'ollama': return 'https://ollama.com/'
      case 'lmstudio': return 'https://lmstudio.ai/'
      case 'custom': return baseUrl
    }
  } catch { return undefined }
}

export default function AIChat() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const aiConfig = useAppStore((s) => s.aiConfig)
  const chatMessages = useAppStore((s) => s.chatMessages)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const isChatLoading = useAppStore((s) => s.isChatLoading)
  const setIsChatLoading = useAppStore((s) => s.setIsChatLoading)
  const setChatMessages = useAppStore((s) => s.setChatMessages)
  const setAIConfig = useAppStore((s) => s.setAIConfig)
  const setPendingPermission = useAppStore((s) => s.setPendingPermission)
  const currentFolder = useAppStore(selectActiveFolder)
  const openFileInEditorStore = useAppStore((s) => s.openFileInEditor)
  const setFolderFiles = useAppStore((s) => s.setFolderFiles)
  const openFilesStore = useAppStore((s) => s.openFiles)
  const activeFileIndex = useAppStore((s) => s.activeFileIndex)
  const settings = useAppStore((s) => s.settings)

  const [showConfig, setShowConfig] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<AIProvider['type']>('ollama')
  const [newUrl, setNewUrl] = useState('http://localhost:11434')
  const [newKey, setNewKey] = useState('')
  const [newProxyType, setNewProxyType] = useState<'http' | 'https' | 'socks' | ''>('')
  const [newProxyHost, setNewProxyHost] = useState('')
  const [newProxyPort, setNewProxyPort] = useState('')
  const [newProxyUser, setNewProxyUser] = useState('')
  const [newProxyPass, setNewProxyPass] = useState('')
  const [newWebsite, setNewWebsite] = useState('')
  const [selectedProxyPresetId, setSelectedProxyPresetId] = useState<string | null>(null)
  const [proxyRegionTab, setProxyRegionTab] = useState<'America' | 'Europe' | 'Asia' | 'Optimal' | ''>('')
  const [editProxyProviderId, setEditProxyProviderId] = useState<string | null>(null)
  const [editProxyType, setEditProxyType] = useState<'http' | 'https' | 'socks' | ''>('')
  const [editProxyHost, setEditProxyHost] = useState('')
  const [editProxyPort, setEditProxyPort] = useState('')
  const [editProxyUser, setEditProxyUser] = useState('')
  const [editProxyPass, setEditProxyPass] = useState('')
  const [editProxyPresetId, setEditProxyPresetId] = useState<string | null>(null)
  const [editProxyRegionTab, setEditProxyRegionTab] = useState<'America' | 'Europe' | 'Asia' | 'Optimal' | ''>('')
  const [editProviderId, setEditProviderId] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [presetSearch, setPresetSearch] = useState('')
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [mcpName, setMcpName] = useState('')
  const [mcpCmd, setMcpCmd] = useState('')
  const [mcpArgs, setMcpArgs] = useState('')
  const [needsConfig, setNeedsConfig] = useState(
    !aiConfig.activeProviderId || !aiConfig.activeModelId
  )
  const [autoSave, setAutoSave] = useState(true)
  const [savedFiles, setSavedFiles] = useState<Record<string, { path: string; status: 'saving' | 'saved' | 'error'; error?: string }>>({})
  const autoRespond = useAppStore((s) => s.autoRespond)
  const setAutoRespond = useAppStore((s) => s.setAutoRespond)
  const [viewMode, setViewMode] = useState<'chat' | 'design'>('chat')
  const [promptName, setPromptName] = useState('')
  const [promptContent, setPromptContent] = useState('')
  const [copiedAll, setCopiedAll] = useState(false)
  const handleCopyAll = () => {
    const text = chatMessages
      .map(m => `${m.role === 'user' ? t('ai.roleUser') : t('ai.roleAssistant')}:\n${m.content}`)
      .join('\n\n')
    navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const modeLabels: Record<ChatMode, string> = { chat: t('ai.modesChat'), think: t('ai.modesThink'), code: t('ai.modesCode'), plan: t('ai.modesPlan') }

  const currentFolderPath = currentFolder || t('ai.folderNotOpen')
  const actionPrompt = '\n\n=== DARBĪBU IZPILDE (DROŠĪBA) ===\n\nTu vari veikt izmaiņas TIKAI failos, kas atrodas atvērtajā mapē: ' + currentFolderPath + '.\nAIZLIEGTS veikt izmaiņas vai lasīt failus ārpus šīs mapes bez lietotāja tiešas atļaujas.\n\nJa vēlies atvērt pārlūku, IERAKSTI:\n[[ACTION:open-url:file:///pilns_ceļš:apraksts]]\n\nTas NAV kods, NAV komanda — tas ir teksta formāts, ko sistēma automātiski atpazīst. Raksti to kā parastu teikumu.\n\nPiemērs (kopē šo precīzi, maini tikai ceļu):\n[[ACTION:open-url:file:///C:/Users/daimo/Desktop/Akvarijs/index.html:Atvērt akvāriju Opera pārlūkā]]\n\n=== TESTĒŠANA PĀRLŪKĀ (AI REDZ REZULTĀTU!) ===\n\nTu vari TESTĒT lapu pārlūkā un REDZĒT rezultātu! Sistēma atvērs lapu, uzņems ekrānšāviņu, savāks kļūdas un nosūtīs tev atpakaļ.\n\nLai testētu, ieraksti:\n[[ACTION:test-browser:file:///C:/Users/daimo/Desktop/Akvarijs/index.html:Pārbaudīt akvārija demonstrāciju]]\n\nPēc testa tu saņemsi:\n- Ekrānšāviņu (lai redzētu, kā lapa izskatās)\n- Konsoles kļūdas\n- Lapas informāciju (elementi, skripti, bildes)\n\n=== CITI FORMATI ===\n[[ACTION:write-file:index.html:<html>...</html>]]\n\nATCERIES:\n- Tu esi ierobežots tikai darbam ar atvērto mapi.\n- Neraksti "nevaru" vai "man nav iespējas" — Tu VARI, izmantojot [[ACTION:...]]\n- Raksti kā parastu tekstu, NEVIS koda blokā\n- Pēc test-browser saņemsi rezultātus un vari tos analizēt\n\n=== BEIGAS ==='
  const codePrompt = `\n\nAtvērtā mape: ${currentFolderPath}\n\nKad raksti kodu, VIENMĒR norādi faila nosaukumu (ar paplašinājumu) tieši PIRMS koda bloka, piemēram:\n\n### fails: index.html\n\`\`\`html\n<kods šeit>\n\`\`\`\n\nSVARĪGI: Veic izmaiņas TIKAI failos, kas atrodas mapē: ${currentFolderPath}.\n\nJa kods paredzēts esošam failam, norādi tā nosaukumu (piem., style.css, script.js).\nJa vēlies izveidot jaunu failu, norādi pilnu nosaukumu ar paplašinājumu.\n\nPēc failu izveides/saglabāšanas atver tos pārlūkā testēšanai ar:\n[[ACTION:open-url:file:///pilns/ceļš/uz/failu:Testēt pārlūkā]]\n\nPēc atvēršanas pajautā lietotājam, ko viņš redz — vai animācija darbojas, vai ir kļūdas. Pamatojoties uz atbildi, piedāvā labojumus un atkārtoti saglabā failus.`

  const systemPrompts: Record<ChatMode, string> = {
    chat: 'Tu esi noderīgs palīgs. Atbildi latviešu valodā.' + actionPrompt,
    think: 'Tu esi analītisks palīgs. Domā soli pa solim, analizē problēmu un piedāvā argumentētu risinājumu. Atbildi latviešu valodā.' + actionPrompt,
    code: 'Tu esi eksperts programmētājs. Raksti tīru, efektīvu kodu ar paskaidrojumiem. Atbildi latviešu valodā.' + actionPrompt + codePrompt,
    plan: 'Tu esi stratēģiskais plānotājs. Izstrādā detalizētus rīcības plānus, sadali uzdevumus un nosaki prioritātes. Atbildi latviešu valodā.' + actionPrompt,
  }

  const activeProvider = aiConfig.providers.find((p) => p.id === aiConfig.activeProviderId)
  const activeModel = activeProvider?.models.find((m) => m.id === aiConfig.activeModelId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (activeProvider && activeModel) {
      setNeedsConfig(false)
    }
  }, [activeProvider?.id, activeModel?.id])

  useEffect(() => {
    if (autoRespond && activeProvider && activeModel && !isChatLoading) {
      setAutoRespond(false)
      const testMsg = 'Analizē testa rezultātus un piedāvā uzlabojumus. Ja ir kļūdas, ierosini labojumus. Ja viss strādā, apstiprini.'
      setTimeout(() => doSend(testMsg), 50)
    }
  }, [autoRespond])

  const handleSend = async () => {
    if (!input.trim() || !activeProvider || !activeModel) return
    const text = input.trim()

    let content: MessageContent = text
    if (attachments.length > 0) {
      const hasImages = attachments.some(a => a.type === 'image')
      if (hasImages) {
        const parts: ContentPart[] = [{ type: 'text', text }]
        for (const a of attachments) {
          if (a.type === 'image' && a.content) {
            const ext = a.name.split('.').pop()?.toLowerCase() || 'png'
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/png'
            parts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${a.content}` } })
          } else if (a.type === 'file') {
            const textContent = a.content || await readFileContent(a.path)
            parts.push({ type: 'text', text: `\n--- ${t('ai.attachFileLabel', { name: a.name })} ---\n${textContent}\n--- ${t('ai.attachFileEnd', { name: a.name })} ---` })
          } else if (a.type === 'folder') {
            const { listDirectory } = await import('../services/fileSystem')
            try {
              const files = await listDirectory(a.path)
              let folderText = `\n--- ${t('ai.attachFolderHeading', { name: a.name })} ---${files.map(f => `\n${f.isDirectory ? '📁' : '📄'} ${f.name}${f.isDirectory ? '/' : ''} (${f.size} B)`).join('')}`
              for (const f of files) {
                if (!f.isDirectory && isTextFile(f.name)) {
                  try {
                    const content = f.size > 51200 ? `\n[${t('ai.fileTooLarge', { name: f.name })}]` : await readFileContent(f.path)
                    folderText += `\n\n--- ${f.name} ---\n${content}`
                  } catch {}
                }
              }
              folderText += `\n--- ${t('ai.attachFolderEnd', { name: a.name })} ---`
              parts.push({ type: 'text', text: folderText })
            } catch {
              parts.push({ type: 'text', text: `\n[${t('ai.attachFolderError', { name: a.name })}]` })
            }
          } else if (a.type === 'video') {
            parts.push({ type: 'text', text: `\n[Video fails: ${a.name}, ceļš: ${a.path}]` })
          }
        }
        content = parts
      } else {
        const parts = [text]
        for (const a of attachments) {
          if (a.type === 'file') {
            const textContent = a.content || await readFileContent(a.path)
            parts.push(`\n--- ${t('ai.attachFileLabel', { name: a.name })} ---\n${textContent}\n--- ${t('ai.attachFileEnd', { name: a.name })} ---`)
          } else if (a.type === 'folder') {
            const { listDirectory } = await import('../services/fileSystem')
            try {
              const files = await listDirectory(a.path)
              let folderText = `\n--- ${t('ai.attachFolderHeading', { name: a.name })} ---${files.map(f => `\n${f.isDirectory ? '📁' : '📄'} ${f.name}${f.isDirectory ? '/' : ''} (${f.size} B)`).join('')}`
              for (const f of files) {
                if (!f.isDirectory && isTextFile(f.name)) {
                  try {
                    const content = f.size > 51200 ? `\n[${t('ai.fileTooLarge', { name: f.name })}]` : await readFileContent(f.path)
                    folderText += `\n\n--- ${f.name} ---\n${content}`
                  } catch {}
                }
              }
              folderText += `\n--- ${t('ai.attachFolderEnd', { name: a.name })} ---`
              parts.push(folderText)
            } catch {
              parts.push(`\n[${t('ai.attachFolderError', { name: a.name })}]`)
            }
          } else if (a.type === 'video') {
            parts.push(`\n[Video fails: ${a.name}, ceļš: ${a.path}]`)
          }
        }
        content = parts.join('\n')
      }
    }
    const userMessage: ChatMessage = {
      role: 'user', content: typeof content === 'string' ? content : content.map(p => p.type === 'text' ? p.text : '[Attēls]').join('\n'),
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    }
    addChatMessage(userMessage)
    setInput('')
    setAttachments([])
    await doSend(content)
  }

  const doSend = async (content: MessageContent) => {
    if (!activeProvider || !activeModel) return
    setIsChatLoading(true)

    const controller = new AbortController()
    setAbortController(controller)

    const assistantMessage: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() }
    addChatMessage(assistantMessage)

    const activeCustomPrompt = aiConfig.customPrompts.find(p => p.id === aiConfig.activeCustomPromptId)
      const depthInstructions: Record<string, string> = {
        maximum: '\n\n=== DOMĀŠANAS DZIĻUMS: MAKSIMĀLAIS ===\nAnalizē problēmu no visiem iespējamiem leņķiem. Izpēti katru detaļu, apsver vairākus risinājumus, izvērtē katra plusus un mīnusus. Atbildi ar pilnīgu, izsmeļošu analīzi.\n',
        high: '\n\n=== DOMĀŠANAS DZIĻUMS: AUGSTS ===\nRūpīgi pārdomā problēmu. Sniedz pamatotus argumentus un pretargumentus. Atbildi ar detalizētu skaidrojumu.\n',
        medium: '\n\n=== DOMĀŠANAS DZIĻUMS: VIDĒJS ===\nApsver galvenos aspektus. Sniedz strukturētu atbildi ar saprātīgu detalizāciju.\n',
        low: '\n\n=== DOMĀŠANAS DZIĻUMS: ZEMS ===\nSniedz īsu, tiešu atbildi bez liekām detaļām. Koncentrējies uz galveno.\n',
      }
      const customPromptText = activeCustomPrompt ? `\n\n=== LIETOTĀJA NORĀDĪJUMS (IZMANTO ŠO!) ===\n${activeCustomPrompt.content}\n=== NORĀDĪJUMA BEIGAS ===\n\n` : ''
      const allMessages: { role: string; content: MessageContent }[] = [
        { role: 'system', content: systemPrompts[aiConfig.chatMode] + depthInstructions[aiConfig.thinkingDepth] + customPromptText },
      ...chatMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ]

    try {
      await sendChatMessage(
        activeProvider,
        activeModel.id,
        allMessages,
        (chunk) => {
          const msgs = [...useAppStore.getState().chatMessages]
          const lastMsg = msgs[msgs.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content += chunk
            useAppStore.getState().setChatMessages([...msgs])
          }
        },
        controller.signal
      )
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const msgs = [...useAppStore.getState().chatMessages]
        const lastMsg = msgs[msgs.length - 1]
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content += `\n\n${t('ai.chatError', { msg: err?.message || String(err) })}`
          useAppStore.getState().setChatMessages([...msgs])
        }
      }
    } finally {
      setIsChatLoading(false)
      setAbortController(null)
      const msgs = useAppStore.getState().chatMessages
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg?.role === 'assistant') {
        const hasTestPhrase = /atvērt.*pārlūk|testēt.*pārlūk|pārbaudīt.*pārlūk/i.test(lastMsg.content)
        parseActions(lastMsg.content)
        if (autoSave) {
          await autoSaveCodeBlocks(lastMsg.content)
        }
        if (hasTestPhrase && !/\[\[ACTION:open-url/.test(lastMsg.content) && currentFolder) {
          const { listDirectory } = await import('../services/fileSystem')
          const files = await listDirectory(currentFolder)
          const htmlFile = files.find(f => !f.isDirectory && /\.html?$/i.test(f.name))
          if (htmlFile) {
            const req = {
              id: `perm-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              action: 'open-url' as const,
              resource: `file:///${htmlFile.path.replace(/\\/g, '/')}`,
              description: t('ai.browserTestDescription'),
              timestamp: Date.now(),
            }
            useAppStore.getState().setPendingPermission(req)
          }
        }
      }
    }
  }

  const parseActions = (content: string) => {
    const actionRegex = /\[\[ACTION:([\w-]+):(.+):([^\]]*?)\]\]/g
    let match
    while ((match = actionRegex.exec(content)) !== null) {
      const [, actionType, resource, desc] = match
      const req: PermissionRequest = {
        id: `perm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: actionType as PermissionRequest['action'],
        resource: resource.trim(),
        description: desc.trim() || `${actionType} — ${resource}`,
        timestamp: Date.now(),
      }
      setPendingPermission(req)
    }
  }

  const autoSaveCodeBlocks = async (content: string) => {
    if (!currentFolder) return
    const blockRegex = /```(\w*)\r?\n([\s\S]*?)```/g
    let match
    let unnamedIndex = 0
    while ((match = blockRegex.exec(content)) !== null) {
      const lang = match[1] || ''
      const code = match[2]
      unnamedIndex++
      const suggestedName = extractFilename(content, match.index)
      const filename = suggestedName || `kods_${unnamedIndex}.${lang || 'txt'}`
      const path = `${currentFolder}/${filename}`.replace(/\//g, '\\')
      const key = `${filename}-${code.slice(0, 40)}`
      setSavedFiles(prev => ({ ...prev, [key]: { path, status: 'saving' } }))
      try {
        const { writeFileContent, listDirectory } = await import('../services/fileSystem')
        await writeFileContent(path, code)
        openFileInEditorStore({ filePath: path, content: code, isModified: false })
        setSavedFiles(prev => ({ ...prev, [key]: { path, status: 'saved' } }))
      } catch (e: any) {
        setSavedFiles(prev => ({ ...prev, [key]: { path, status: 'error', error: e?.message || String(e) } }))
      }
    }
    if (currentFolder) {
      const { listDirectory } = await import('../services/fileSystem')
      const files = await listDirectory(currentFolder)
      setFolderFiles(files)
    }
  }

  const handleSaveCodeBlock = async (code: string, lang: string, suggestedName?: string) => {
    if (!currentFolder) {
      alert(t('ai.saveFolderFirst'))
      return
    }
    let name: string | undefined = suggestedName
    if (!name) {
      const result = prompt(t('ai.saveAsPrompt'), `kods.${lang || 'txt'}`)
      if (!result) return
      name = result
    }
    const path = `${currentFolder}/${name}`.replace(/\//g, '\\')
    try {
      const { writeFileContent, listDirectory } = await import('../services/fileSystem')
      await writeFileContent(path, code)
      openFileInEditorStore({ filePath: path, content: code, isModified: false })
      const files = await listDirectory(currentFolder)
      setFolderFiles(files)
    } catch (e: any) {
      alert(t('ai.saveError', { msg: e?.message || String(e) }))
    }
  }

  const extractFilename = (content: string, blockStartIndex: number): string | undefined => {
    const before = content.slice(Math.max(0, blockStartIndex - 300), blockStartIndex)
    const patterns = [
      /(?:#{2,4}|\*\*)\s*(?:fails?|file|datotek[ae])\s*[:：]\s*["'`]?(.+?)["'`]?(?:\s*\n|$)/im,
      /(?:saglabā|save)\s+(?:kā|as)\s+["'`]?(.+?)["'`]?(?:\s*\n|$)/i,
      /["'`]?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,6})["'`]?\s*[:：]?\s*(?:saturs|kods|pirmkods|code)?\s*\n/i,
    ]
    for (const p of patterns) {
      const m = before.match(p)
      if (m) {
        const name = m[1].trim()
        if (/^[a-zA-Z0-9_\-./]{1,100}$/.test(name) && name.includes('.')) return name
      }
    }
    return undefined
  }

  const renderTextWithUrls = (text: string, keyPrefix: string): JSX.Element[] => {
    const els: JSX.Element[] = []
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g
    let last = 0
    let m
    let idx = 0
    while ((m = urlRegex.exec(text)) !== null) {
      if (m.index > last) {
        els.push(<span key={`${keyPrefix}-t-${idx}`}>{text.slice(last, m.index)}</span>)
        idx++
      }
      const url = m[1]
      els.push(
        <span key={`${keyPrefix}-url-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); handleOpenUrl(url) }} style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}>
            {url}
          </a>
          <button
            className="btn btn-sm"
            style={{ fontSize: 9, padding: '0 4px', lineHeight: '18px' }}
            onClick={() => handleOpenUrl(url)}
            title={t('ai.openBrowser')}
          >🔗</button>
        </span>
      )
      idx++
      last = m.index + m[0].length
    }
    if (last < text.length) {
      els.push(<span key={`${keyPrefix}-end`}>{text.slice(last)}</span>)
    }
    return els
  }

  const handleOpenUrl = (url: string) => {
    const { setPendingPermission } = useAppStore.getState()
    const req: PermissionRequest = {
      id: `perm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action: 'open-url',
      resource: url,
      description: t('ai.openUrlDescription', { url }),
      timestamp: Date.now(),
    }
    setPendingPermission(req)
  }

  const handleTestSavedFile = async (filePath: string) => {
    if (!window.electronAPI) { alert(t('ai.systemError')); return }
    try {
      const browser = useAppStore.getState().settings.browser
      await window.electronAPI.openFileInBrowser(filePath, browser)
    } catch (e: any) {
      alert(t('ai.openFileError', { msg: e?.message || String(e) }))
    }
  }

  const renderContent = (content: string) => {
    const parts: JSX.Element[] = []
    const blockRegex = /```(\w*)\r?\n([\s\S]*?)```/g
    let lastIdx = 0
    let match
    let blockIndex = 0
    let unnamedIndex = 0

    while ((match = blockRegex.exec(content)) !== null) {
      if (match.index > lastIdx) {
        const textSegment = content.slice(lastIdx, match.index)
        parts.push(...renderTextWithUrls(textSegment, `t-${lastIdx}`))
      }
      const lang = match[1] || ''
      const code = match[2]
      blockIndex++
      unnamedIndex++

      const suggestedName = extractFilename(content, match.index)
      const displayName = suggestedName || `kods_${unnamedIndex}.${lang || 'txt'}`
      const key = suggestedName ? `${suggestedName}-${code.slice(0, 40)}` : ''
      const fileInfo = savedFiles[key]

      const statusEl = fileInfo ? (
        fileInfo.status === 'saving' ? (
          <span style={{ color: 'var(--accent)', fontSize: 10 }}>{t('ai.savingStatus')}</span>
        ) : fileInfo.status === 'saved' ? (
          <span style={{ color: 'var(--success)', fontSize: 10 }}>{t('ai.savedStatus', { name: suggestedName })}</span>
        ) : (
          <span style={{ color: 'red', fontSize: 10 }}>{t('ai.saveErrorStatus', { msg: fileInfo.error })}</span>
        )
      ) : null

      parts.push(
        <div key={`b-${blockIndex}`} style={{
          margin: '6px 0', borderRadius: 4, overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '2px 8px', fontSize: 10,
            background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
            gap: 6,
          }}>
            <span>{lang || t('ai.codeBlockLabel')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              {statusEl}
              {!fileInfo?.status && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{displayName}</span>
              )}
              {fileInfo?.status === 'saved' && (
                <span style={{ fontSize: 9, color: 'var(--success)' }}>{fileInfo.path.split('/').pop() || fileInfo.path.split('\\').pop()}</span>
              )}
              <button
                className="btn btn-sm"
                style={{ fontSize: 10, padding: '1px 6px' }}
                onClick={() => handleSaveCodeBlock(code, lang, displayName)}
                disabled={fileInfo?.status === 'saving'}
              >{t('ai.saveButton')}</button>
            </div>
          </div>
          <pre style={{
            margin: 0, padding: 8, fontSize: 11, overflow: 'auto',
            background: '#1e1e1e', color: '#d4d4d4',
          }}><code>{code}</code></pre>
        </div>
      )
      lastIdx = match.index + match[0].length
    }

    if (lastIdx < content.length) {
      const textSegment = content.slice(lastIdx)
      parts.push(...renderTextWithUrls(textSegment, 't-end'))
    }

    const savedEntries = Object.values(savedFiles).filter(f => f.status === 'saved')
    if (savedEntries.length > 0) {
      parts.push(
        <div key="saved-summary" style={{
          marginTop: 8, padding: '6px 8px',
          background: 'rgba(40,167,69,0.1)',
          border: '1px solid var(--success)',
          borderRadius: 4, fontSize: 10,
        }}>
          <strong>{t('ai.savedFilesHeader')}</strong>
          {savedEntries.map((f, i) => (
            <div key={i} style={{ marginLeft: 8, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <span>📄 {f.path}</span>
              <button
                className="btn btn-sm"
                style={{ fontSize: 9, padding: '0 4px', lineHeight: '18px', color: 'var(--accent)' }}
                onClick={() => handleTestSavedFile(f.path.replace(/\//g, '\\'))}
                title={t('ai.browserTestDescription')}
              >{t('ai.testButton')}</button>
            </div>
          ))}
        </div>
      )
    }

    return parts.length > 0 ? parts : <span>{content}</span>
  }

  const handleStop = () => {
    abortController?.abort()
  }

  const handleClear = () => {
    setChatMessages([
      {
        role: 'assistant',
        content: t('ai.welcomeMessage'),
        timestamp: Date.now(),
      },
    ])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAddProvider = async () => {
    if (!newName || !newUrl) return
    const proxy = newProxyType && newProxyHost && newProxyPort ? {
      type: newProxyType as 'http' | 'https' | 'socks',
      host: newProxyHost,
      port: parseInt(newProxyPort),
      ...(newProxyUser ? { auth: { username: newProxyUser, password: newProxyPass } } : {}),
    } : undefined
    
    if (editProviderId) {
      const providers = aiConfig.providers.map(p => 
        p.id === editProviderId ? { ...p, name: newName, type: newType, apiUrl: newUrl, apiKey: newKey || undefined, website: newWebsite || undefined, proxy } : p
      )
      setAIConfig({ ...aiConfig, providers })
      setEditProviderId(null)
    } else {
      const provider: AIProvider = {
        id: `provider-${Date.now()}`,
        name: newName,
        type: newType,
        apiUrl: newUrl,
        apiKey: newKey || undefined,
        models: [],
        active: true,
        proxy,
        website: newWebsite || undefined,
      }
      const providers = [...aiConfig.providers, provider]
      setAIConfig({ ...aiConfig, providers, activeProviderId: provider.id, activeModelId: null })
    }

    setNewName('')
    setNewUrl(newType === 'ollama' ? 'http://localhost:11434' : newType === 'lmstudio' ? 'http://localhost:1234' : '')
    setNewKey('')
    setNewWebsite('')
    setNewProxyType('')
    setNewProxyHost('')
    setNewProxyPort('')
    setNewProxyUser('')
    setNewProxyPass('')
    setSelectedProxyPresetId(null)
    setProxyRegionTab('')
    setTestMsg('')
  }

  const handleEditProviderOpen = (p: AIProvider) => {
    setEditProviderId(p.id)
    setNewName(p.name)
    setNewType(p.type)
    setNewUrl(p.apiUrl)
    setNewKey(p.apiKey || '')
    setNewWebsite(p.website || '')
    if (p.proxy) {
      setNewProxyType(p.proxy.type)
      setNewProxyHost(p.proxy.host)
      setNewProxyPort(String(p.proxy.port))
      setNewProxyUser(p.proxy.auth?.username || '')
      setNewProxyPass(p.proxy.auth?.password || '')
    } else {
      setNewProxyType('')
      setNewProxyHost('')
      setNewProxyPort('')
      setNewProxyUser('')
      setNewProxyPass('')
    }
  }

  const handleEditProviderCancel = () => {
    setEditProviderId(null)
    setNewName('')
    setNewUrl('')
    setNewKey('')
    setNewWebsite('')
    setNewProxyType('')
    setNewProxyHost('')
    setNewProxyPort('')
    setNewProxyUser('')
    setNewProxyPass('')
  }

  const handleEditProxyOpen = (p: AIProvider) => {
    setEditProxyProviderId(p.id)
    setEditProxyType(p.proxy?.type || '')
    setEditProxyHost(p.proxy?.host || '')
    setEditProxyPort(String(p.proxy?.port || ''))
    setEditProxyUser(p.proxy?.auth?.username || '')
    setEditProxyPass(p.proxy?.auth?.password || '')
    setEditProxyPresetId(null)
    setEditProxyRegionTab('')
  }

  const handleEditProxyCancel = () => {
    setEditProxyProviderId(null)
    setEditProxyType('')
    setEditProxyHost('')
    setEditProxyPort('')
    setEditProxyUser('')
    setEditProxyPass('')
    setEditProxyPresetId(null)
    setEditProxyRegionTab('')
  }

  const handleEditProxySave = (providerId: string) => {
    const proxy = editProxyType && editProxyHost && editProxyPort ? {
      type: editProxyType as 'http' | 'https' | 'socks',
      host: editProxyHost,
      port: parseInt(editProxyPort),
      ...(editProxyUser ? { auth: { username: editProxyUser, password: editProxyPass } } : {}),
    } : undefined
    console.log('handleEditProxySave:', { providerId, proxy })
    const providers = aiConfig.providers.map(p =>
      p.id === providerId ? { ...p, proxy } : p
    )
    setAIConfig({ ...aiConfig, providers })
    handleEditProxyCancel()
  }

  const handleEditProxyRemove = (providerId: string) => {
    const providers = aiConfig.providers.map(p =>
      p.id === providerId ? { ...p, proxy: undefined } : p
    )
    setAIConfig({ ...aiConfig, providers })
    handleEditProxyCancel()
  }

  const handleFetch = async (provider: AIProvider) => {
    setTestMsg(t('ai.loadingModels'))
    try {
      const models = await fetchModelsFromProvider(provider)
      const providers = aiConfig.providers.map((p) =>
        p.id === provider.id ? { ...p, models } : p
      )
      setAIConfig({ ...aiConfig, providers })
      setTestMsg(models.length > 0 ? t('ai.modelsFound', { count: models.length }) : t('ai.modelsNotFound'))
    } catch (err: any) {
      setTestMsg(t('ai.modelsError', { msg: err?.message || String(err) }))
    }
  }

  const handleTest = async (provider: AIProvider) => {
    setIsTesting(true)
    setTestMsg(t('ai.testingConnection'))
    const ok = await testProviderConnection(provider)
    setTestMsg(ok ? t('ai.connectionSuccess') : t('ai.connectionFail'))
    setIsTesting(false)
  }

  const handleSelectProvider = (id: string) => {
    setAIConfig({ ...aiConfig, activeProviderId: id, activeModelId: null })
    const p = aiConfig.providers.find(p => p.id === id)
    if (p && p.models.length === 0) handleFetch(p)
  }

  const handleSelectModel = (providerId: string, modelId: string) => {
    setAIConfig({ ...aiConfig, activeProviderId: providerId, activeModelId: modelId })
    setShowConfig(false)
  }

  const handleRemoveProvider = (id: string) => {
    const providers = aiConfig.providers.filter(p => p.id !== id)
    setAIConfig({ ...aiConfig, providers, activeProviderId: providers[0]?.id || null, activeModelId: null })
  }

  const handleAttachFile = async () => {
    const result = await openFileDialog()
    if (!result) return
    const attType = getAttachmentType(result.filePath)
    let content = result.content
    if (attType === 'image') {
      content = await readFileBase64(result.filePath)
    }
    const att: ChatAttachment = {
      id: `att-${Date.now()}`,
      type: attType,
      name: result.filePath.split('\\').pop() || result.filePath.split('/').pop() || result.filePath,
      path: result.filePath,
      content,
    }
    setAttachments([...attachments, att])
  }

  const handleAttachFolder = async () => {
    const folderPath = await openFolderDialog()
    if (!folderPath) return
    setAttachments([...attachments, {
      id: `att-${Date.now()}`,
      type: 'folder',
      name: folderPath.split('\\').pop() || folderPath.split('/').pop() || folderPath,
      path: folderPath,
    }])
  }

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id))
  }

  const handleSetMode = (mode: ChatMode) => {
    setAIConfig({ ...aiConfig, chatMode: mode, systemPrompt: systemPrompts[mode] })
  }

  const depthLabels: Record<string, string> = { maximum: t('ai.depthMaximum'), high: t('ai.depthHigh'), medium: t('ai.depthMedium'), low: t('ai.depthLow') }

  const handleSetDepth = (depth: 'maximum' | 'high' | 'medium' | 'low') => {
    setAIConfig({ ...aiConfig, thinkingDepth: depth })
  }

  const handleAddMcp = () => {
    if (!mcpName || !mcpCmd) return
    const server: MCPServer = {
      id: `mcp-${Date.now()}`,
      name: mcpName,
      command: mcpCmd,
      args: mcpArgs.split(' ').filter(Boolean),
      enabled: true,
    }
    setAIConfig({ ...aiConfig, mcpServers: [...aiConfig.mcpServers, server] })
    setMcpName('')
    setMcpCmd('')
    setMcpArgs('')
  }

  const handleRemoveMcp = (id: string) => {
    setAIConfig({ ...aiConfig, mcpServers: aiConfig.mcpServers.filter(s => s.id !== id) })
  }

  const handleAddPrompt = () => {
    if (!promptName.trim() || !promptContent.trim()) return
    const prompt = { id: `prompt-${Date.now()}`, name: promptName.trim(), content: promptContent.trim() }
    setAIConfig({ ...aiConfig, customPrompts: [...aiConfig.customPrompts, prompt], activeCustomPromptId: prompt.id })
    setPromptName('')
    setPromptContent('')
  }

  const handleRemovePrompt = (id: string) => {
    const filtered = aiConfig.customPrompts.filter(p => p.id !== id)
    setAIConfig({ ...aiConfig, customPrompts: filtered, activeCustomPromptId: aiConfig.activeCustomPromptId === id ? null : aiConfig.activeCustomPromptId })
  }

  const handleSelectPrompt = (id: string | null) => {
    setAIConfig({ ...aiConfig, activeCustomPromptId: id })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '8px 12px',
        fontWeight: 600,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--text-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {(Object.keys(modeLabels) as ChatMode[]).map(m => (
            <button
              key={m}
              className="btn btn-sm"
              style={{
                fontSize: 10, padding: '2px 6px',
                background: aiConfig.chatMode === m ? 'var(--accent)' : 'transparent',
                color: aiConfig.chatMode === m ? '#fff' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: aiConfig.chatMode === m ? 'var(--accent)' : 'var(--border-color)',
              }}
              onClick={() => handleSetMode(m)}
            >{modeLabels[m]}</button>
          ))}
          <span style={{ width: 1, height: 16, background: 'var(--border-color)', margin: '0 4px' }} />
          <span style={{ fontSize: 9, color: 'var(--text-muted)', marginRight: 2, whiteSpace: 'nowrap' }}>{t('ai.depthLabel')}</span>
          {(Object.keys(depthLabels) as Array<'maximum' | 'high' | 'medium' | 'low'>).map(d => (
            <button
              key={d}
              className="btn btn-sm"
              style={{
                fontSize: 9, padding: '1px 5px',
                background: aiConfig.thinkingDepth === d ? 'var(--accent)' : 'transparent',
                color: aiConfig.thinkingDepth === d ? '#fff' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: aiConfig.thinkingDepth === d ? 'var(--accent)' : 'var(--border-color)',
              }}
              onClick={() => handleSetDepth(d)}
            >{depthLabels[d]}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {activeProvider && getProviderWebsite(activeProvider) && (
            <button className="btn btn-sm" style={{ fontSize: 9, padding: '1px 6px' }}
              onClick={() => { const url = getProviderWebsite(activeProvider); if (url) window.electronAPI?.openExternal(url, settings.browser) }}
              title={getProviderWebsite(activeProvider) || ''}
            >🔗 {t('ai.visitWebsite')}</button>
          )}
          <button className="btn btn-sm" onClick={() => setViewMode(viewMode === 'chat' ? 'design' : 'chat')}
            style={{
              background: viewMode === 'design' ? 'var(--accent)' : 'transparent',
              color: viewMode === 'design' ? '#fff' : 'var(--text-secondary)',
              border: '1px solid', borderColor: viewMode === 'design' ? 'var(--accent)' : 'var(--border-color)',
            }}
          >{viewMode === 'design' ? t('ai.viewChat') : t('ai.viewDesign')}</button>
          <button className="btn btn-sm" onClick={() => setShowConfig(!showConfig)}
            style={{
              background: showConfig ? 'var(--accent)' : 'transparent',
              color: showConfig ? '#fff' : 'var(--text-secondary)',
              border: '1px solid', borderColor: showConfig ? 'var(--accent)' : 'var(--border-color)',
            }}
          >{showConfig ? t('ai.closeSettings') : t('ai.settings')}</button>
          {activeModel && viewMode === 'chat' && <button className="btn btn-sm" onClick={handleClear}>{t('ai.clear')}</button>}
          {activeModel && viewMode === 'chat' && (
            <button className="btn btn-sm" onClick={handleCopyAll} title={t('ai.copyAll')}>
              {copiedAll ? `✓ ${t('ai.copied')}` : `📋 ${t('ai.copyAll')}`}
            </button>
          )}
        </div>
      </div>

      {viewMode === 'design' && !showConfig ? (
        <DesignGenerator />
      ) : showConfig ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {aiConfig.providers.map((p) => (
            <div key={p.id} style={{
              padding: '8px 10px',
              borderRadius: 6,
              marginBottom: 6,
              border: '1px solid var(--border-color)',
              background: aiConfig.activeProviderId === p.id ? 'var(--bg-active)' : 'var(--bg-tertiary)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{p.name}</div>
                    <button className="btn btn-sm" style={{ fontSize: 9, padding: '0 4px', opacity: 0.7 }}
                      onClick={() => handleEditProviderOpen(p)}
                      title={t('common.edit')}
                    >✎</button>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.type} · {p.apiUrl}</div>
                  {editProxyProviderId === p.id ? null : (
                    <>
                      {p.proxy ? (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                          🔒 Proxy: {p.proxy.type}://{p.proxy.host}:{p.proxy.port}
                          <button className="btn btn-sm" style={{ fontSize: 8, padding: '0 4px', marginLeft: 4 }}
                            onClick={() => handleEditProxyOpen(p)}
                          >✎</button>
                        </div>
                      ) : (
                        <button className="btn btn-sm" style={{ fontSize: 9, padding: '1px 6px', marginTop: 2 }}
                          onClick={() => handleEditProxyOpen(p)}
                        >🔒 {t('ai.setProxy')}</button>
                      )}
                      {getProviderWebsite(p) && <div style={{ marginTop: 4 }}>
                        <button className="btn btn-sm" style={{ fontSize: 9, padding: '1px 6px' }}
                          onClick={() => { const url = getProviderWebsite(p); if (url) window.electronAPI?.openExternal(url, settings.browser) }}
                          title={getProviderWebsite(p) || ''}
                        >🔗 {t('ai.visitWebsite')}</button>
                      </div>}
                    </>
                  )}
                  {editProxyProviderId === p.id && (
                    <div style={{ marginTop: 6, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>{t('ai.proxySection')}</div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                        <select value={editProxyType} onChange={e => { setEditProxyType(e.target.value as any); if (!e.target.value) { setEditProxyHost(''); setEditProxyPort(''); setEditProxyUser(''); setEditProxyPass(''); setEditProxyPresetId(null) } }}
                          style={{ width: 72, padding: '3px 4px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }}>
                          <option value="">{t('ai.proxyTypeNone')}</option>
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                          <option value="socks">SOCKS5</option>
                        </select>
                        <input value={editProxyHost} onChange={e => { setEditProxyHost(e.target.value); setEditProxyPresetId(null) }} placeholder="Host"
                          style={{ flex: 1, padding: '3px 4px', fontSize: 11, minWidth: 80, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }} />
                        <input value={editProxyPort} onChange={e => { setEditProxyPort(e.target.value); setEditProxyPresetId(null) }} placeholder="Port"
                          style={{ width: 60, padding: '3px 4px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }} />
                      </div>
                      {editProxyType && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                          <input value={editProxyUser} onChange={e => setEditProxyUser(e.target.value)} placeholder={t('ai.proxyUserPlaceholder')}
                            style={{ flex: 1, padding: '3px 4px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }} />
                          <input value={editProxyPass} onChange={e => setEditProxyPass(e.target.value)} placeholder={t('ai.proxyPassPlaceholder')} type="password"
                            style={{ flex: 1, padding: '3px 4px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }} />
                        </div>
                      )}
                      {editProxyPresetId && (
                        <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6, padding: '2px 8px', background: 'var(--accent-alpha, rgba(0,120,212,0.08))', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>✓</span>
                          <span style={{ fontWeight: 600 }}>{translateProxyName(proxyPresets.find(x => x.id === editProxyPresetId)?.name || '', t)}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{proxyPresets.find(x => x.id === editProxyPresetId)?.host}:{proxyPresets.find(x => x.id === editProxyPresetId)?.port}</span>
                        </div>
                      )}
                      <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 4, marginTop: 4 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{t('ai.vpnCountries')}</div>
                        <div style={{ marginBottom: 4 }}>
                          {(['America', 'Europe', 'Asia', 'Optimal'] as const).map(region => (
                            <button key={region} className="btn btn-sm"
                              style={{
                                fontSize: 9, padding: '1px 8px', marginRight: 3, marginBottom: 3,
                                background: proxyPresets.filter(x => x.region === region).some(x => x.id === editProxyPresetId) ? 'var(--accent)' : 'var(--bg-hover)',
                                color: proxyPresets.filter(x => x.region === region).some(x => x.id === editProxyPresetId) ? '#fff' : 'var(--text-primary)',
                                border: '1px solid ' + (proxyPresets.filter(x => x.region === region).some(x => x.id === editProxyPresetId) ? 'var(--accent)' : 'var(--border-color)'),
                              }}
                              onClick={() => setEditProxyRegionTab(region === editProxyRegionTab ? '' : region)}
                            >{t(`ai.regions${region}`)}</button>
                          ))}
                        </div>
                        {editProxyRegionTab && (
                          <div style={{ maxHeight: 120, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: 4, marginBottom: 6 }}>
                            {proxyPresets.filter(x => x.region === editProxyRegionTab).map(x => {
                              const isSelected = editProxyPresetId === x.id
                              return (
                                <div key={x.id} style={{
                                  padding: '3px 6px', cursor: 'pointer', fontSize: 10,
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  background: isSelected ? 'var(--accent)' : 'transparent',
                                  color: isSelected ? '#fff' : 'var(--text-primary)',
                                  borderBottom: '1px solid var(--border-color)',
                                }}
                                  onClick={() => {
                                    setEditProxyType(x.type)
                                    setEditProxyHost(x.host)
                                    setEditProxyPort(String(x.port))
                                    setEditProxyUser('')
                                    setEditProxyPass('')
                                    setEditProxyPresetId(x.id)
                                  }}
                                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                                >
                                  <span style={{ width: 14, textAlign: 'center', opacity: 0.7 }}>{x.type === 'socks' ? '🔒' : '🌐'}</span>
                                  <span style={{ flex: 1 }}>{translateProxyName(x.name, t)}</span>
                                  <span style={{ fontSize: 9, opacity: 0.7, fontFamily: 'monospace' }}>{x.host}:{x.port}</span>
                                  {isSelected && <span style={{ fontSize: 11 }}>✓</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                        {t('ai.proxyDisclaimer')}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        <button className="btn btn-sm btn-primary" onClick={() => handleEditProxySave(p.id)}>{t('common.save')}</button>
                        <button className="btn btn-sm" onClick={() => { if (p.proxy) handleEditProxyRemove(p.id) }} style={p.proxy ? { color: 'var(--danger)', border: '1px solid var(--danger)' } : { display: 'none' }}>{t('common.remove')}</button>
                        <button className="btn btn-sm" onClick={handleEditProxyCancel}>{t('common.cancel')}</button>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-sm" onClick={() => handleTest(p)} disabled={isTesting}>{t('ai.testButton')}</button>
                  <button className="btn btn-sm" onClick={() => handleFetch(p)}>{t('ai.loadModelsBtn')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleRemoveProvider(p.id)}>×</button>
                </div>
              </div>
              {p.models.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <input
                    value={modelSearch}
                    onChange={e => setModelSearch(e.target.value)}
                    placeholder={t('ai.searchModels', { count: p.models.length })}
                    style={{
                      width: '100%', padding: '4px 6px', fontSize: 11, marginBottom: 6,
                      background: 'var(--bg-hover)', border: '1px solid var(--border-color)',
                      borderRadius: 4, color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 200, overflow: 'auto' }}>
                  {p.models.filter(m => !modelSearch || m.name.toLowerCase().includes(modelSearch.toLowerCase())).map((m) => (
                    <button
                      key={m.id}
                      className="btn btn-sm"
                      style={{
                        background: aiConfig.activeModelId === m.id ? 'var(--accent)' : 'var(--bg-hover)',
                        color: aiConfig.activeModelId === m.id ? '#fff' : 'var(--text-primary)',
                      }}
                      onClick={() => handleSelectModel(p.id, m.id)}
                    >
                      {m.name}
                    </button>
                  ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div style={{
            marginTop: 12,
            padding: 12,
            border: '1px dashed var(--border-color)',
            borderRadius: 6,
          }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
              + {t('ai.addProvider')}
            </div>
            <input
              value={presetSearch}
              onChange={e => setPresetSearch(e.target.value)}
              placeholder={t('ai.searchProviders')}
              style={{ width: '100%', padding: '4px 6px', fontSize: 11, marginBottom: 6, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)', outline: 'none' }}
            />
            {presetSearch && (
              <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 8, border: '1px solid var(--border-color)', borderRadius: 4 }}>
                {(() => {
                  const query = presetSearch.toLowerCase()
                  const filtered = providerPresets.filter(p => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query) || p.group.toLowerCase().includes(query))
                  const grouped: Record<string, ProviderPreset[]> = {}
                  for (const p of filtered) {
                    if (!grouped[p.group]) grouped[p.group] = []
                    grouped[p.group].push(p)
                  }
                  return Object.entries(grouped).map(([group, presets]) => (
                    <div key={group}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 8px', background: 'var(--bg-tertiary)', fontWeight: 600 }}>{group}</div>
                      {presets.map(p => (
                        <div key={p.id}
                          style={{ padding: '6px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onClick={() => {
                            setNewType(p.type)
                            setNewUrl(p.apiUrl)
                            setNewName(p.name)
                            setNewKey('')
                            setNewWebsite(p.website || '')
                            setNewProxyType('')
                            setNewProxyHost('')
                            setNewProxyPort('')
                            setNewProxyUser('')
                            setNewProxyPass('')
                            setSelectedProxyPresetId(null)
                            setProxyRegionTab('')
                            setTestMsg('')
                            setPresetSearch('')
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span>{translateProxyName(p.name, t)}</span>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{p.needsKey ? '🔑' : '🆓'}</span>
                        </div>
                      ))}
                    </div>
                  ))
                })()}
              </div>
            )}
            <div className="form-group">
              <label>{t('ai.providerName')}</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('ai.providerNamePlaceholder')} />
            </div>
            <div className="form-group">
              <label>{t('ai.apiUrl')}</label>
              <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
            </div>
            <div className="form-group">
              <label>{t('ai.apiKey')}</label>
              <input type="password" value={newKey} onChange={e => setNewKey(e.target.value)} placeholder={t('ai.apiKeyPlaceholder')} />
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 8, paddingTop: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 6, color: 'var(--text-muted)' }}>{t('ai.proxySection')}</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                <select value={newProxyType} onChange={e => { setNewProxyType(e.target.value as any); if (!e.target.value) { setNewProxyHost(''); setNewProxyPort(''); setNewProxyUser(''); setNewProxyPass(''); setSelectedProxyPresetId(null) } }}
                  style={{ width: 72, padding: '3px 4px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }}>
                  <option value="">{t('ai.proxyTypeNone')}</option>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks">SOCKS5</option>
                </select>
                <input value={newProxyHost} onChange={e => { setNewProxyHost(e.target.value); setSelectedProxyPresetId(null) }} placeholder="Host"
                  style={{ flex: 1, padding: '3px 4px', fontSize: 11, minWidth: 100, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }} />
                <input value={newProxyPort} onChange={e => { setNewProxyPort(e.target.value); setSelectedProxyPresetId(null) }} placeholder="Port"
                  style={{ width: 60, padding: '3px 4px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }} />
                {newProxyType && (
                  <button className="btn btn-sm" style={{ fontSize: 9, padding: '2px 6px', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                    onClick={() => { setNewProxyType(''); setNewProxyHost(''); setNewProxyPort(''); setNewProxyUser(''); setNewProxyPass(''); setSelectedProxyPresetId(null); setProxyRegionTab('') }}
                  >×</button>
                )}
              </div>
              {newProxyType && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <input value={newProxyUser} onChange={e => setNewProxyUser(e.target.value)} placeholder={t('ai.proxyUserPlaceholder')}
                    style={{ flex: 1, padding: '3px 4px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }} />
                  <input value={newProxyPass} onChange={e => setNewProxyPass(e.target.value)} placeholder={t('ai.proxyPassPlaceholder')} type="password"
                    style={{ flex: 1, padding: '3px 4px', fontSize: 11, background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }} />
                </div>
              )}
              {selectedProxyPresetId && (
                <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6, padding: '2px 8px', background: 'var(--accent-alpha, rgba(0,120,212,0.08))', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓</span>
                  <span style={{ fontWeight: 600 }}>{translateProxyName(proxyPresets.find(p => p.id === selectedProxyPresetId)?.name || '', t)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{proxyPresets.find(p => p.id === selectedProxyPresetId)?.host}:{proxyPresets.find(p => p.id === selectedProxyPresetId)?.port}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.6 }}>{proxyPresets.find(p => p.id === selectedProxyPresetId)?.type?.toUpperCase()}</span>
                </div>
              )}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{t('ai.vpnCountries')}</div>
                <div style={{ marginBottom: 4 }}>
                  {(['America', 'Europe', 'Asia', 'Optimal'] as const).map(region => (
                    <button key={region} className="btn btn-sm"
                      style={{
                        fontSize: 10, padding: '2px 10px', marginRight: 4, marginBottom: 4,
                        background: proxyPresets.filter(p => p.region === region).some(p => p.id === selectedProxyPresetId) ? 'var(--accent)' : 'var(--bg-hover)',
                        color: proxyPresets.filter(p => p.region === region).some(p => p.id === selectedProxyPresetId) ? '#fff' : 'var(--text-primary)',
                        border: '1px solid ' + (proxyPresets.filter(p => p.region === region).some(p => p.id === selectedProxyPresetId) ? 'var(--accent)' : 'var(--border-color)'),
                      }}
                      onClick={() => {
                        setProxyRegionTab(region === proxyRegionTab ? '' : region)
                      }}
                    >{t(`ai.regions${region}`)}</button>
                  ))}
                </div>
                {proxyRegionTab && (
                  <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: 4 }}>
                    {proxyPresets.filter(p => p.region === proxyRegionTab).map(p => {
                      const isSelected = selectedProxyPresetId === p.id
                      return (
                        <div key={p.id} style={{
                          padding: '5px 8px', cursor: 'pointer', fontSize: 11,
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: isSelected ? 'var(--accent)' : 'transparent',
                          color: isSelected ? '#fff' : 'var(--text-primary)',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                          onClick={() => {
                            setNewProxyType(p.type)
                            setNewProxyHost(p.host)
                            setNewProxyPort(String(p.port))
                            setNewProxyUser('')
                            setNewProxyPass('')
                            setSelectedProxyPresetId(p.id)
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                        >
                          <span style={{ width: 16, textAlign: 'center', opacity: 0.7 }}>{p.type === 'socks' ? '🔒' : '🌐'}</span>
                          <span style={{ flex: 1 }}>{translateProxyName(p.name, t)}</span>
                          <span style={{ fontSize: 10, opacity: 0.7, fontFamily: 'monospace' }}>{p.host}:{p.port}</span>
                          {isSelected && <span style={{ fontSize: 12 }}>✓</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                {t('ai.proxyDisclaimer')}
              </div>
            </div>
            {testMsg && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{testMsg}</div>}
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-primary" onClick={handleAddProvider} disabled={!newName || !newUrl}>
                {editProviderId ? t('common.save') : t('common.add')}
              </button>
              {editProviderId && (
                <button className="btn btn-sm" onClick={handleEditProviderCancel}>
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </div>

          {/* MCP Servers */}
          <div style={{
            marginTop: 12, padding: 12,
            border: '1px dashed var(--border-color)', borderRadius: 6,
          }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--text-secondary)' }}>
              {t('ai.mcpTitle')}
            </div>
            {aiConfig.mcpServers.map(s => (
              <div key={s.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 8px', marginBottom: 4,
                background: 'var(--bg-tertiary)', borderRadius: 4, fontSize: 11,
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{s.command} {s.args.join(' ')}</div>
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => handleRemoveMcp(s.id)}>×</button>
              </div>
            ))}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{t('ai.mcpPresets')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {mcpPresets.map(preset => (
                  <button key={preset.id} className="btn btn-sm"
                    style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg-hover)', border: '1px solid var(--border-color)', borderRadius: 3, color: 'var(--text-primary)' }}
                    title={preset.description}
                    onClick={() => {
                      setMcpName(preset.name)
                      setMcpCmd(preset.command)
                      setMcpArgs(preset.args.join(' '))
                    }}
                  >+ {preset.name}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              <input value={mcpName} onChange={e => setMcpName(e.target.value)} placeholder={t('common.name')} style={inputStyle} />
              <input value={mcpCmd} onChange={e => setMcpCmd(e.target.value)} placeholder={t('ai.mcpCmdPlaceholder')} style={inputStyle} />
              <input value={mcpArgs} onChange={e => setMcpArgs(e.target.value)} placeholder={t('ai.mcpArgsPlaceholder')} style={inputStyle} />
              <button className="btn btn-sm btn-primary" onClick={handleAddMcp} disabled={!mcpName || !mcpCmd}>{t('ai.mcpAddButton')}</button>
            </div>
          </div>

          {/* Custom Prompts */}
          <div style={{
            marginTop: 12, padding: 12,
            border: '1px dashed var(--border-color)', borderRadius: 6,
          }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--text-secondary)' }}>
              {t('ai.promptsTitle')}
            </div>
            {(!aiConfig.customPrompts || aiConfig.customPrompts.length === 0) ? (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>
                {t('ai.promptsEmpty')}
              </div>
            ) : (
              <div style={{ marginBottom: 8 }}>
                {aiConfig.customPrompts.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px', marginBottom: 4,
                    background: aiConfig.activeCustomPromptId === p.id ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: aiConfig.activeCustomPromptId === p.id ? '#fff' : 'var(--text-primary)',
                    borderRadius: 4, fontSize: 11, cursor: 'pointer',
                  }}
                    onClick={() => handleSelectPrompt(aiConfig.activeCustomPromptId === p.id ? null : p.id)}
                    title={p.content.slice(0, 200)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{aiConfig.activeCustomPromptId === p.id ? '✓' : '○'}</span>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                    </div>
                    <button className="btn btn-sm" onClick={e => { e.stopPropagation(); handleRemovePrompt(p.id) }}
                      style={{ fontSize: 10, padding: '1px 6px', background: 'transparent', border: '1px solid ' + (aiConfig.activeCustomPromptId === p.id ? 'rgba(255,255,255,0.3)' : 'var(--border-color)') }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              <input value={promptName} onChange={e => setPromptName(e.target.value)} placeholder={t('ai.promptNamePlaceholder')} style={inputStyle} />
              <textarea value={promptContent} onChange={e => setPromptContent(e.target.value)}
                placeholder={t('ai.promptContentPlaceholder')}
                style={{ ...inputStyle, height: 60, resize: 'vertical', fontSize: 10 }}
              />
              <button className="btn btn-sm btn-primary" onClick={handleAddPrompt} disabled={!promptName.trim() || !promptContent.trim()}>{t('ai.promptAdd')}</button>
            </div>
          </div>
        </div>
      ) : (
        <>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 0,
        }}>
          {needsConfig ? (
            <div style={{
              padding: 32,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{ fontSize: 40, opacity: 0.2 }}>AI</div>
              <p>{t('ai.needsConfigTitle')}</p>
              <p style={{ fontSize: 11 }}>{t('ai.needsConfigDesc')}</p>
              <button className="btn btn-primary" onClick={() => setShowConfig(true)}>
                {t('ai.addProvider')}
              </button>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  lineHeight: 1.5,
                  background: msg.role === 'user' ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  position: 'relative',
                }}
              >
                <button
                  className="btn btn-sm"
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    fontSize: 10,
                    padding: '2px 6px',
                    opacity: 0.5,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                  onClick={(e) => {
                    navigator.clipboard.writeText(msg.content)
                    const target = e.currentTarget
                    const oldText = target.innerText
                    target.innerText = '✓'
                    setTimeout(() => {
                      if (target) target.innerText = oldText
                    }, 2000)
                  }}
                  title={t('ai.copyMessage')}
                >
                  📋
                </button>
                <div style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: msg.role === 'user' ? 'var(--accent)' : 'var(--success)',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                }}>
                  {msg.role === 'user' ? t('ai.roleUser') : t('ai.roleAssistant')}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {renderContent(msg.content)}
                </div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {msg.attachments.map(a => (
                      <div key={a.id} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 6px', borderRadius: 4, fontSize: 10,
                        background: 'var(--bg-hover)', border: '1px solid var(--border-color)',
                      }}>
                        <span>{a.type === 'image' ? '🖼' : a.type === 'folder' ? '📁' : a.type === 'video' ? '🎬' : '📄'}</span>
                        <span>{a.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {isChatLoading && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
              {t('ai.thinking')}
            </div>
          )}
          {chatMessages.length > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'center', gap: 16,
              padding: '4px 8px', fontSize: 9, color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-color)', marginTop: 4,
            }}>
              <span>{t('ai.tokensInput', { count: estimateTokens(chatMessages.filter(m => m.role === 'user').map(m => m.content).join(' ')) })}</span>
              <span>{t('ai.tokensOutput', { count: estimateTokens(chatMessages.filter(m => m.role === 'assistant').map(m => m.content).join(' ')) })}</span>
              <span>{t('ai.tokensTotal', { count: estimateTokens(chatMessages.map(m => m.content).join(' ')) })}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{
          padding: '8px',
          borderTop: '1px solid var(--border-color)',
          flexShrink: 0,
          display: viewMode === 'design' && !showConfig ? 'none' : undefined,
        }}>
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {attachments.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 6px', borderRadius: 4, fontSize: 10,
                background: 'var(--bg-hover)', border: '1px solid var(--border-color)',
              }}>
                <span>{a.type === 'image' ? '🖼' : a.type === 'folder' ? '📁' : a.type === 'video' ? '🎬' : '📄'}</span>
                <span>{a.name}</span>
                <button className="btn btn-sm" style={{ padding: 0, fontSize: 10, lineHeight: 1, minWidth: 14, height: 14 }} onClick={() => handleRemoveAttachment(a.id)}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoSave} onChange={e => { setAutoSave(e.target.checked); setSavedFiles({}) }} />
            {t('ai.autoSaveLabel')}
          </label>
          {currentFolder && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              📁 {currentFolder.split('\\').pop() || currentFolder.split('/').pop()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button className="btn btn-sm" onClick={handleAttachFile} title={t('ai.attachFileTooltip')} style={{ fontSize: 14, padding: '2px 6px' }}>📎</button>
            <button className="btn btn-sm" onClick={handleAttachFolder} title={t('ai.attachFolderTooltip')} style={{ fontSize: 14, padding: '2px 6px' }}>📁</button>
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              // Allow default paste behavior
              setTimeout(() => inputRef.current?.focus(), 0)
            }}
            placeholder={needsConfig ? t('ai.chatInputPlaceholderNoConfig') : t('ai.chatInputPlaceholder')}
            rows={2}
            style={{
              flex: 1,
              resize: 'none',
              padding: '6px 8px',
              borderRadius: 4,
              fontSize: 12,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {isChatLoading ? (
              <button className="btn btn-danger" onClick={handleStop}>
                {t('ai.stop')}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim() || !activeModel}>
                {t('ai.send')}
              </button>
            )}
          </div>
        </div>
        </div>
        </>
      )}
    </div>
  )
}
