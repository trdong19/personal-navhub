/**
 * localStorage 封装工具 - storage
 *
 * 所有 key 自动添加 'nav_' 前缀，避免与其他项目冲突
 * 提供类型安全的读写操作和统一的错误处理
 */

/** localStorage key 前缀 */
const PREFIX = 'nav_'

/**
 * 从 localStorage 读取并解析 JSON
 * @param key - 存储键名（不含前缀）
 * @param fallback - 读取失败时的默认值
 * @returns 解析后的值，或默认值
 */
export function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

/**
 * 将值序列化为 JSON 并存入 localStorage
 * @param key - 存储键名（不含前缀）
 * @param value - 要存储的值
 */
export function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    console.warn('localStorage write failed for key:', key)
  }
}

/**
 * 删除指定 key 的 localStorage 数据
 * @param key - 存储键名（不含前缀）
 */
export function storageRemove(key: string): void {
  localStorage.removeItem(PREFIX + key)
}

/**
 * 清除所有以 'nav_' 为前缀的 localStorage 数据
 * 用于登出或重置时清理
 */
export function storageClear(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX))
  keys.forEach(k => localStorage.removeItem(k))
}
