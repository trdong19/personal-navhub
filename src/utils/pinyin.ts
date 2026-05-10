import { pinyin } from 'pinyin-pro'

const cache = new Map<string, string>()

export function toPinyin(str: string): string {
  if (!str) return ''
  const cached = cache.get(str)
  if (cached !== undefined) return cached
  const result = pinyin(str, { toneType: 'none', type: 'array' }).join('')
  cache.set(str, result)
  return result
}

export function pinyinMatch(text: string, query: string): boolean {
  if (!text || !query) return false
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  if (lower.includes(q)) return true
  const py = toPinyin(text).toLowerCase()
  return py.includes(q)
}
