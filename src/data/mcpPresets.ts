export interface MCPPreset {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  group: string
}

export const mcpPresets: MCPPreset[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Lasīt/rakstīt failus, veidot mapes',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    group: 'Tools',
  },
  {
    id: 'web-fetch',
    name: 'Web Fetch',
    description: 'Ielādēt tīmekļa lapas un API',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-web'],
    group: 'Tools',
  },
  {
    id: 'python-exec',
    name: 'Python REPL',
    description: 'Izpildīt Python kodu (HTML/CSS/JS rīki)',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-python'],
    group: 'Programming',
  },
  {
    id: 'nodejs-exec',
    name: 'Node.js REPL',
    description: 'Izpildīt JavaScript/TypeScript kodu',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-nodejs'],
    group: 'Programming',
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Git versiju kontroles darbības',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git'],
    group: 'Tools',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub API — repozitoriji, faili, PR',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    group: 'Tools',
  },
  {
    id: 'playwright',
    name: 'Browser (Playwright)',
    description: 'Atvērt pārlūku, testēt HTML lapas',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-playwright'],
    group: 'Tools',
  },
]
