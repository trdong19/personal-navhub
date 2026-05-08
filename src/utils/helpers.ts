/**
 * 通用工具函数 - helpers
 *
 * 提供 ID 生成、防抖、时间格式化、favicon URL 提取等功能
 */

/**
 * 生成唯一 ID
 * 使用时间戳的 36 进制 + 6 位随机字符串，确保短时间内也不同
 * @returns 类似 'lx7k2m3f4a5b' 格式的唯一字符串
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * 防抖函数
 * 在指定延迟内重复调用时，只执行最后一次
 * @param fn - 要防抖的函数
 * @param delay - 延迟毫秒数
 * @returns 防抖后的函数（类型与原函数一致）
 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as unknown as T
}

/**
 * 格式化时间戳为可读字符串
 * @param timestamp - Unix 时间戳（毫秒）
 * @returns 格式化的日期时间字符串，如 '2025-01-15 14:30'
 */
export function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 从 URL 中提取 favicon 地址
 * 尝试从 URL 的 hostname 获取默认的 /favicon.ico
 * @param url - 网站 URL
 * @returns favicon URL 字符串，解析失败返回空字符串
 */
export function getFaviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url)
    if (!hostname) return ''
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`
  } catch {
    return ''
  }
}

/**
 * 从搜索引擎 URL 模板中提取 favicon 地址
 * 用 'test' 替换 {q} 占位符后解析 hostname
 * @param urlTemplate - URL 模板（如 'https://www.bing.com/search?q={q}'）
 * @returns favicon URL 字符串，解析失败返回空字符串
 */
export function getEngineFavicon(urlTemplate: string): string {
  try {
    const sample = urlTemplate.replace('{q}', 'test')
    const { hostname } = new URL(sample)
    if (!hostname) return ''
    return `https://icons.duckduckgo.com/ip3/${hostname}.ico`
  } catch {
    return ''
  }
}
