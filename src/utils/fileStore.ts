/**
 * IndexedDB 文件存储工具 - fileStore
 *
 * 用于存储大文件（背景图、图标、favicon 缓存等）
 * 使用 IndexedDB 而非 localStorage，因为 localStorage 有 5-10MB 限制
 *
 * 数据库名称: navhub_files
 * 对象存储: files（主键为 id）
 * 分类索引: category（用于按类型查询文件）
 *
 * 文件分类:
 * - wallpaper: 壁纸/背景图（id='bg_image'）
 * - icon: 书签自定义图标
 * - favicon-cache: 网站 favicon 缓存（id='favicon:xxx'）
 */

const DB_NAME = 'navhub_files'
const DB_VERSION = 1
const STORE_NAME = 'files'

/**
 * IndexedDB 中存储的文件对象结构
 */
export interface StoredFile {
  /** 文件唯一标识符 */
  id: string
  /** 文件名称 */
  name: string
  /** MIME 类型，如 'image/jpeg'、'image/png' */
  type: string
  /** 文件分类 */
  category: 'wallpaper' | 'icon' | 'favicon-cache'
  /** 文件二进制数据 */
  blob: Blob
  /** 创建/更新时间戳 */
  createdAt: number
}

/**
 * 打开（或创建）IndexedDB 数据库
 * 如果是首次打开，会自动创建 files 对象存储和 category 索引
 * @returns IDBDatabase 实例
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('category', 'category', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * 保存文件到 IndexedDB（已存在则覆盖）
 * @param file - 文件对象（不含 createdAt，会自动添加）
 */
export async function saveFile(file: Omit<StoredFile, 'createdAt'>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ ...file, createdAt: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * 根据 ID 获取文件
 * @param id - 文件 ID
 * @returns 文件对象或 undefined
 */
export async function getFile(id: string): Promise<StoredFile | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * 根据分类获取所有文件
 * @param category - 文件分类名（'wallpaper' | 'icon' | 'favicon-cache'）
 * @returns 该分类下的文件数组
 */
export async function getFilesByCategory(category: string): Promise<StoredFile[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const idx = store.index('category')
    const req = idx.getAll(category)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * 获取所有文件
 * @returns 所有文件的数组
 */
export async function getAllFiles(): Promise<StoredFile[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * 根据 ID 删除文件
 * @param id - 文件 ID
 */
export async function deleteFile(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ==================== favicon 缓存快捷方法 ====================

// ==================== 工具函数 ====================

/**
 * 将 Blob 转换为 data: URL（base64 编码）
 * 用于同步推送时将 Blob 上传到服务器
 * @param blob - Blob 对象
 * @returns data: URL 字符串
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// ==================== 背景图快捷方法 ====================

/**
 * 保存背景图到 IndexedDB
 * 将 data: URL 转为 Blob 后存储（避免 localStorage 的大小限制）
 * @param dataUrl - 背景图的 data: URL
 */
export async function saveBgImage(dataUrl: string): Promise<void> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  await saveFile({ id: 'bg_image', name: 'background', type: blob.type || 'image/jpeg', category: 'wallpaper', blob })
}

/**
 * 获取背景图的 data: URL
 * 注意: 大图转 data: URL 可能很大，显示时建议用 getBgImageObjectUrl()
 * @returns data: URL 字符串，或 null
 */
export async function getBgImage(): Promise<string | null> {
  const file = await getFile('bg_image')
  if (file) {
    return blobToDataUrl(file.blob)
  }
  return null
}

/**
 * 获取背景图的 blob: URL（推荐用于 CSS url() 显示）
 * blob: URL 很短（如 'blob:http://...abc'），不会触发 Chrome 的 2MB data URL 限制
 * @returns blob: URL 字符串，或 null
 */
export async function getBgImageObjectUrl(): Promise<string | null> {
  const file = await getFile('bg_image')
  if (file) {
    return URL.createObjectURL(file.blob)
  }
  return null
}

/**
 * 获取背景图的原始 Blob 对象
 * 用于同步推送时转为 data: URL 上传
 * @returns Blob 对象，或 null
 */
export async function getBgImageBlob(): Promise<Blob | null> {
  const file = await getFile('bg_image')
  return file?.blob || null
}

/**
 * 删除背景图
 */
export async function deleteBgImage(): Promise<void> {
  await deleteFile('bg_image')
}

/**
 * 清空指定分类的所有文件
 * @param category - 文件分类名
 */
export async function clearFilesByCategory(category: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const idx = store.index('category')
  const req = idx.openCursor(IDBKeyRange.only(category))
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
