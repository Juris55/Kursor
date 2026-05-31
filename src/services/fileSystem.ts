import { FileItem } from '../types'

export async function openFileDialog(): Promise<{ filePath: string; content: string } | null> {
  if (window.electronAPI) {
    return await window.electronAPI.openFile()
  }
  return null
}

export async function saveFileDialog(filePath: string, content: string): Promise<string | null> {
  if (window.electronAPI) {
    return await window.electronAPI.saveFile(filePath, content)
  }
  return null
}

export async function openFolderDialog(): Promise<string | null> {
  if (window.electronAPI) {
    const result = await window.electronAPI.openFolder()
    return result?.folderPath || null
  }
  return null
}

export async function listDirectory(dirPath: string): Promise<FileItem[]> {
  if (window.electronAPI) {
    return await window.electronAPI.listFiles(dirPath)
  }
  return []
}

export async function readFileContent(filePath: string): Promise<string> {
  if (window.electronAPI) {
    return await window.electronAPI.readFile(filePath)
  }
  return ''
}

export async function writeFileContent(filePath: string, content: string): Promise<boolean> {
  if (window.electronAPI) {
    return await window.electronAPI.writeFile(filePath, content)
  }
  return false
}

export async function readFileBase64(filePath: string): Promise<string> {
  if (window.electronAPI) {
    return await window.electronAPI.readFileBase64(filePath)
  }
  return ''
}

const imageExtensions = ['jpg','jpeg','png','gif','bmp','webp','svg','ico']
const videoExtensions = ['mp4','webm','avi','mov','mkv','wmv']
const textExtensions = ['txt','md','js','ts','jsx','tsx','py','rb','java','cs','cpp','c','h','hpp','go','rs','php','html','css','scss','less','json','xml','yaml','yml','sql','sh','ps1','bat','csv','ini','cfg','toml','env','gitignore','dockerfile','vue','svelte']

export function getAttachmentType(filename: string): 'image' | 'video' | 'file' {
  const ext = getFileExtension(filename)
  if (imageExtensions.includes(ext)) return 'image'
  if (videoExtensions.includes(ext)) return 'video'
  return 'file'
}

export function isTextFile(filename: string): boolean {
  const ext = getFileExtension(filename)
  return textExtensions.includes(ext)
}

export async function createFile(filePath: string): Promise<boolean> {
  if (window.electronAPI) return await window.electronAPI.createFile(filePath)
  return false
}

export async function createFolder(dirPath: string): Promise<boolean> {
  if (window.electronAPI) return await window.electronAPI.createFolder(dirPath)
  return false
}

export async function renameItem(oldPath: string, newPath: string): Promise<boolean> {
  if (window.electronAPI) return await window.electronAPI.renameItem(oldPath, newPath)
  return false
}

export async function deleteItem(itemPath: string): Promise<boolean> {
  if (window.electronAPI) return await window.electronAPI.deleteItem(itemPath)
  return false
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

export function getLanguageFromExtension(ext: string): string {
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    java: 'java',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    ps1: 'powershell',
    bat: 'bat',
    txt: 'plaintext',
    lv: 'plaintext',
  }
  return langMap[ext] || 'plaintext'
}
