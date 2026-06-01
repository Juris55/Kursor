import { AIProvider, AIModel } from '../types'

export type ContentPart = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type MessageContent = string | ContentPart[]

async function fetchWithProxy(url: string, options: RequestInit & { proxy?: AIProvider['proxy'] }): Promise<Response> {
  const { proxy, ...fetchOpts } = options
  
  if (window.electronAPI?.proxyFetch) {
    const headers = (fetchOpts.headers || {}) as Record<string, string>
    try {
      const result = await window.electronAPI.proxyFetch(url, {
        method: fetchOpts.method || 'GET',
        headers,
        body: fetchOpts.body,
        proxy,
      })
      
      if (!result.ok && result.error) {
        throw new Error(result.error)
      }

      return {
        ok: result.ok,
        status: result.status || 0,
        json: async () => JSON.parse(result.body || '{}'),
        text: async () => result.body || '',
        headers: new Headers(),
        body: result.body ? {
          getReader: () => {
            const encoder = new TextEncoder()
            const data = encoder.encode(result.body)
            let read = false
            return {
              read: async () => {
                if (read) return { done: true, value: undefined }
                read = true
                return { done: false, value: data }
              }
            }
          }
        } : null
      } as any
    } catch (e) {
      console.error('Electron fetch failed, falling back to browser fetch:', e)
    }
  }
  
  return fetch(url, fetchOpts)
}

export async function fetchModelsFromProvider(provider: AIProvider, throwOnError = false): Promise<AIModel[]> {
  const isOpenCodeZen = provider.id === 'opencode-zen' || 
                        provider.name.toLowerCase().includes('opencode zen') || 
                        provider.apiUrl.includes('opencode.ai')

  switch (provider.type) {
    case 'ollama':
      return fetchOllamaModels(provider)
    case 'lmstudio':
      return fetchLMStudioModels(provider)
    case 'openai':
    case 'openrouter':
      if (isOpenCodeZen) return fetchOpenCodeZenModels(provider, throwOnError)
      return fetchOpenAIModels(provider)
    case 'google':
      return fetchGoogleModels(provider, throwOnError)
    case 'custom':
      return fetchCustomModels(provider, throwOnError)
    default:
      return []
  }
}

async function fetchOpenCodeZenModels(provider: AIProvider, throwOnError = false): Promise<AIModel[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`

  try {
    let baseUrl = provider.apiUrl.endsWith('/') ? provider.apiUrl.slice(0, -1) : provider.apiUrl
    const endpoint = `${baseUrl}/v1/models`
    
    const response = await fetchWithProxy(endpoint, { headers, signal: AbortSignal.timeout(10000), proxy: provider.proxy })
    if (response.ok) {
      const data = await response.json()
      const models = data.data || data.models || data
      if (Array.isArray(models) && models.length > 0) {
        return models.map((m: any) => ({
          id: m.id || m.name || m,
          name: m.id || m.name || m,
          providerId: provider.id,
        }))
      }
    } else if (throwOnError) {
      throw new Error(await parseHttpError(response))
    }
  } catch (e) {
    console.error('Failed to fetch OpenCode Zen models:', e)
    if (throwOnError) throw e
  }

  return [
    { id: 'opencode/gpt-5.5-pro', name: 'OpenCode Zen Pro (GPT 5.5)', providerId: provider.id },
    { id: 'opencode/gpt-5.4', name: 'OpenCode Zen v1 (GPT 5.4)', providerId: provider.id },
    { id: 'opencode/big-pickle', name: 'OpenCode Zen Lite', providerId: provider.id },
    { id: 'opencode/grok-code-fast-1', name: 'OpenCode Zen Coder', providerId: provider.id },
    { id: 'opencode-go/deepseek-v4-pro', name: 'DeepSeek Chat (OpenCode Go)', providerId: provider.id },
    { id: 'opencode-go/deepseek-v4-flash', name: 'DeepSeek Coder (OpenCode Go)', providerId: provider.id }
  ]
}

async function fetchOllamaModels(provider: AIProvider): Promise<AIModel[]> {
  const response = await fetchWithProxy(`${provider.apiUrl}/api/tags`, {
    signal: AbortSignal.timeout(15000),
    proxy: provider.proxy,
  })
  if (!response.ok) throw new Error(await parseHttpError(response))
  const data = await response.json()
  return (data.models || []).map((m: any) => ({
    id: m.name,
    name: m.name,
    providerId: provider.id,
  }))
}

async function fetchLMStudioModels(provider: AIProvider): Promise<AIModel[]> {
  const response = await fetchWithProxy(`${provider.apiUrl}/v1/models`, {
    signal: AbortSignal.timeout(15000),
    proxy: provider.proxy,
  })
  if (!response.ok) throw new Error(await parseHttpError(response))
  const data = await response.json()
  return (data.data || []).map((m: any) => ({
    id: m.id,
    name: m.id,
    providerId: provider.id,
  }))
}

async function fetchGoogleModels(provider: AIProvider, throwOnError = false): Promise<AIModel[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`
  try {
    const response = await fetchWithProxy(`${provider.apiUrl}/models`, { headers, signal: AbortSignal.timeout(15000), proxy: provider.proxy })
    if (!response.ok) {
      if (throwOnError) throw new Error(await parseHttpError(response))
      return [{ id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', providerId: provider.id },
              { id: 'gemini-2.5-pro-exp-03-25', name: 'Gemini 2.5 Pro (exp)', providerId: provider.id },
              { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', providerId: provider.id },
              { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', providerId: provider.id }]
    }
    const data = await response.json()
    return (data.data || []).map((m: any) => ({
      id: m.id.replace(/^models\//, ''),
      name: m.id.replace(/^models\//, ''),
      providerId: provider.id,
    }))
  } catch (e) {
    if (throwOnError) throw e
    return [{ id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', providerId: provider.id },
            { id: 'gemini-2.5-pro-exp-03-25', name: 'Gemini 2.5 Pro (exp)', providerId: provider.id },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', providerId: provider.id },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', providerId: provider.id }]
  }
}

async function fetchOpenAIModels(provider: AIProvider): Promise<AIModel[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`

  const response = await fetchWithProxy(`${provider.apiUrl}/v1/models`, { headers, signal: AbortSignal.timeout(15000), proxy: provider.proxy })
  if (!response.ok) throw new Error(await parseHttpError(response))
  const data = await response.json()
  return (data.data || []).map((m: any) => ({
    id: m.id,
    name: m.id,
    providerId: provider.id,
  }))
}

async function fetchCustomModels(provider: AIProvider, throwOnError = false): Promise<AIModel[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`

  try {
    const response = await fetchWithProxy(`${provider.apiUrl}/v1/models`, { headers, signal: AbortSignal.timeout(15000), proxy: provider.proxy })
    if (!response.ok) {
      if (throwOnError) throw new Error(await parseHttpError(response))
      return [{ id: 'custom-model', name: 'Pielāgots modelis', providerId: provider.id }]
    }
    const data = await response.json()
    return (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.id,
      providerId: provider.id,
    }))
  } catch (e) {
    if (throwOnError) throw e
    return [{ id: 'custom-model', name: 'Pielāgots modelis', providerId: provider.id }]
  }
}

async function parseHttpError(response: Response): Promise<string> {
  const errText = await response.text()
  if (response.status === 429) {
    return "Pārsniegts pieprasījumu limits (429: Rate Limit). Lūdzu, uzgaidiet brīdi un mēģiniet vēlreiz vai pārbaudiet sava konta kredītus un limitus attiecīgā pakalpojuma sniedzēja vietnē."
  }
  let msg = `HTTP ${response.status}`
  try {
    const errJson = JSON.parse(errText)
    const raw = errJson?.error?.metadata?.raw || errJson?.error?.message || ''
    if (raw) { msg += `: ${raw}`; return msg }
    const alt = errJson?.error?.message || JSON.stringify(errJson).slice(0, 200)
    if (alt) msg += `: ${alt}`
  } catch { if (errText) msg += `: ${errText}` }
  return msg
}

export async function sendChatMessage(
  provider: AIProvider,
  modelId: string,
  messages: { role: string; content: MessageContent }[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  useStream = true
): Promise<string> {
  const isOpenCodeZen = provider.id === 'opencode-zen' || 
                        provider.name.toLowerCase().includes('opencode zen') || 
                        provider.apiUrl.includes('opencode.ai')

  const isGoogle = provider.type === 'google'
  
  let url = isGoogle ? `${provider.apiUrl}/chat/completions` : `${provider.apiUrl}/v1/chat/completions`
  
  if (isOpenCodeZen && provider.apiUrl.includes('/zen')) {
    if (provider.apiUrl.includes('/v1')) {
       url = `${provider.apiUrl}/chat/completions`
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`

  const body = JSON.stringify({
    model: modelId,
    messages: messages.map((m) => {
      if (Array.isArray(m.content)) {
        return { role: m.role, content: m.content }
      }
      return { role: m.role, content: m.content }
    }),
    stream: useStream,
  })
  
  if (useStream && !provider.proxy) {
    try {
      const response = await fetch(url, { method: 'POST', headers, body, signal })
      if (response.ok) {
        return await handleStreamResponse(response, onChunk)
      }
    } catch (e) {
      console.warn('Browser streaming fetch failed, trying Electron fetch (no stream):', e)
    }
  }

  const response = await fetchWithProxy(url, { method: 'POST', headers, body, signal, proxy: provider.proxy })

  if (!response.ok) throw new Error(await parseHttpError(response))

  if (!useStream || !response.body) {
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    if (content) onChunk(content)
    return content
  }

  return await handleStreamResponse(response, onChunk)
}

async function handleStreamResponse(response: Response, onChunk: (chunk: string) => void): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter((l) => l.trim() !== '')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''
          if (content) {
            fullContent += content
            onChunk(content)
          }
        } catch { }
      }
    }
  }

  return fullContent
}

export async function testProviderConnection(provider: AIProvider): Promise<boolean> {
  try {
    const models = await fetchModelsFromProvider(provider, true)
    return models.length > 0
  } catch (err) {
    console.error('testProviderConnection failed:', err)
    return false
  }
}

