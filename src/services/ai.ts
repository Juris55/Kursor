import { AIProvider, AIModel } from '../types'

export type ContentPart = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type MessageContent = string | ContentPart[]

async function fetchWithProxy(url: string, options: RequestInit & { proxy?: AIProvider['proxy'] }): Promise<Response> {
  const { proxy, ...fetchOpts } = options
  if (proxy && proxy.host && proxy.port && window.electronAPI?.proxyFetch) {
    const headers = (fetchOpts.headers || {}) as Record<string, string>
    const result = await window.electronAPI.proxyFetch(url, {
      method: fetchOpts.method || 'GET',
      headers,
      body: fetchOpts.body,
      proxy,
    })
    return {
      ok: result.ok,
      status: result.status || 0,
      json: async () => JSON.parse(result.body || '{}'),
      text: async () => result.body || '',
      headers: new Headers(),
    } as Response
  }
  return fetch(url, fetchOpts)
}

export async function fetchModelsFromProvider(provider: AIProvider): Promise<AIModel[]> {
  switch (provider.type) {
    case 'ollama':
      return fetchOllamaModels(provider)
    case 'lmstudio':
      return fetchLMStudioModels(provider)
    case 'openai':
    case 'openrouter':
      return fetchOpenAIModels(provider)
    case 'google':
      return fetchGoogleModels(provider)
    case 'custom':
      return fetchCustomModels(provider)
    default:
      return []
  }
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

async function fetchGoogleModels(provider: AIProvider): Promise<AIModel[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`
  const response = await fetchWithProxy(`${provider.apiUrl}/models`, { headers, signal: AbortSignal.timeout(15000), proxy: provider.proxy })
  if (!response.ok) {
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

async function fetchCustomModels(provider: AIProvider): Promise<AIModel[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`

  const response = await fetchWithProxy(`${provider.apiUrl}/v1/models`, { headers, signal: AbortSignal.timeout(15000), proxy: provider.proxy })
  if (!response.ok) {
    return [{ id: 'custom-model', name: 'Pielāgots modelis', providerId: provider.id }]
  }
  const data = await response.json()
  return (data.data || []).map((m: any) => ({
    id: m.id,
    name: m.id,
    providerId: provider.id,
  }))
}

async function parseHttpError(response: Response): Promise<string> {
  const errText = await response.text()
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
  const isGoogle = provider.type === 'google'
  const url = isGoogle ? `${provider.apiUrl}/chat/completions` : `${provider.apiUrl}/v1/chat/completions`
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

  const response = await fetchWithProxy(url, { method: 'POST', headers, body, signal, proxy: provider.proxy })

  if (!response.ok) throw new Error(await parseHttpError(response))

  if (!useStream) {
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

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
        const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || ''
        if (content) {
          fullContent += content
          onChunk(content)
        }
      } catch { }
    }
  }

  return fullContent
}

export async function testProviderConnection(provider: AIProvider): Promise<boolean> {
  try {
    const models = await fetchModelsFromProvider(provider)
    return models.length > 0
  } catch {
    return false
  }
}
