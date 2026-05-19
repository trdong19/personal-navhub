/**
 * 认证组合式函数 - 单密码认证
 */
import { ref } from 'vue'
import { saveBgImage, blobToDataUrl, getBgImageBlob, saveFile, deleteFile } from '@/utils/fileStore'
import { storageSet } from '@/utils/storage'

function safeSetItem(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch {}
}

const PULL_RES_HASH_KEY = 'nav_pull_res_hashes'

const TOKEN_KEY = 'nav_auth_token'

const token = ref(localStorage.getItem(TOKEN_KEY) || '')
const authStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const authMessage = ref('')
const isLoggedIn = ref(!!token.value)
const authReady = ref(false)
const CACHED_VERSION_KEY = 'nav_cached_server_version'

function getApiBase(): string {
  return '/api'
}

async function safeJson(res: Response) {
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('json')) {
    throw new Error(`服务未就绪（HTTP ${res.status}），请检查服务是否正常运行`)
  }
  return res.json()
}

function headers(method: string = 'POST'): Record<string, string> {
  const h: Record<string, string> = {}
  if (method !== 'GET') h['Content-Type'] = 'application/json'
  if (token.value) h['Authorization'] = `Bearer ${token.value}`
  return h
}

export function useAuth() {

  function setAuth(t: string) {
    token.value = t
    localStorage.setItem(TOKEN_KEY, t)
    isLoggedIn.value = true
  }

  function clearAuth() {
    token.value = ''
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(PULL_RES_HASH_KEY)
    localStorage.removeItem('nav_cached_resources')
    localStorage.removeItem(CACHED_VERSION_KEY)
    isLoggedIn.value = false
  }

  /** 检查是否已设置密码 */
  async function checkSetup(): Promise<boolean> {
    try {
      const res = await fetch(`${getApiBase()}/status`)
      const data = await safeJson(res)
      return data.hasPassword === true
    } catch {
      return false
    }
  }

  /** 首次设置密码 */
  async function setup(p: string): Promise<boolean> {
    authStatus.value = 'loading'
    authMessage.value = '设置密码中...'
    try {
      const res = await fetch(`${getApiBase()}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: p }),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error || '设置失败')
      setAuth(data.token)
      authStatus.value = 'success'
      authMessage.value = '密码设置成功'
      return true
    } catch (err: any) {
      authStatus.value = 'error'
      authMessage.value = err.message || '设置失败'
      return false
    }
  }

  /** 登录 */
  async function login(p: string): Promise<boolean> {
    authStatus.value = 'loading'
    authMessage.value = '登录中...'
    try {
      const res = await fetch(`${getApiBase()}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: p }),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.error || '登录失败')
      setAuth(data.token)
      authStatus.value = 'success'
      authMessage.value = '登录成功'
      return true
    } catch (err: any) {
      authStatus.value = 'error'
      authMessage.value = err.message || '登录失败'
      return false
    }
  }

  /** 登出 */
  async function logout(): Promise<void> {
    try {
      await fetch(`${getApiBase()}/logout`, { method: 'POST', headers: headers() })
    } catch {}
    clearAuth()
    authStatus.value = 'idle'
    authMessage.value = ''
  }

  // ==================== 增量同步 ====================

  async function incrementalSync(op: string, data: Record<string, unknown> = {}): Promise<{ success: boolean; version: number } | null> {
    if (!token.value) return null
    try {
      const res = await fetch(`${getApiBase()}/incremental`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ op, ...data }),
      })
      if (res.status === 401) { clearAuth(); return null }
      const result = await safeJson(res)
      if (!res.ok) { console.error('[incrementalSync]', result.error); return null }
      if (result.version) safeSetItem(CACHED_VERSION_KEY, String(result.version))
      return result
    } catch (e) {
      console.error('[incrementalSync] network error', e)
      return null
    }
  }

  async function pull(): Promise<boolean> {
    if (!token.value) return false
    try {
      const res = await fetch(`${getApiBase()}/pull`, {
        method: 'POST',
        headers: headers(),
      })
      if (res.status === 401) {
        clearAuth()
        throw new Error('登录已过期，请重新登录')
      }
      const result = await safeJson(res)
      if (!res.ok) throw new Error(result.error || '拉取失败')
      if (!result.data) {
        console.log('[pull] 服务器返回 data: null')
        return true
      }

      const resourcesMeta: Record<string, string> = result.data.resourcesMeta || {}
      console.log('[pull] resourcesMeta:', Object.keys(resourcesMeta))

      const localResRaw = localStorage.getItem('nav_cached_resources')
      const localRes: Record<string, string> = localResRaw ? JSON.parse(localResRaw) : {}
      const localMetaRaw = localStorage.getItem(PULL_RES_HASH_KEY)
      const localMeta: Record<string, string> = localMetaRaw ? JSON.parse(localMetaRaw) : {}

      const needFetchIds: string[] = []
      for (const [resId, serverHash] of Object.entries(resourcesMeta)) {
        if (localMeta[resId] !== serverHash || !localRes[resId]) {
          needFetchIds.push(resId)
        }
      }
      console.log('[pull] needFetchIds:', needFetchIds)

      let fetchedResources: Record<string, string> = {}
      if (needFetchIds.length > 0) {
        // 分批拉取，每批 20 个，避免请求过大导致 500
        const BATCH_SIZE = 20
        console.log(`[pull] 分批拉取 ${needFetchIds.length} 个资源, 每批 ${BATCH_SIZE} 个`)
        for (let i = 0; i < needFetchIds.length; i += BATCH_SIZE) {
          const batch = needFetchIds.slice(i, i + BATCH_SIZE)
          try {
            const batchRes = await fetch(`${getApiBase()}/pull-resources`, {
              method: 'POST',
              headers: headers(),
              body: JSON.stringify({ ids: batch }),
            })
            if (batchRes.ok) {
              const batchData = await safeJson(batchRes)
              Object.assign(fetchedResources, batchData.resources || {})
            } else {
              console.log(`[pull] 批次 ${i / BATCH_SIZE + 1} 失败:`, batchRes.status)
            }
          } catch (e) {
            console.log(`[pull] 批次 ${i / BATCH_SIZE + 1} 异常:`, e)
          }
        }
        console.log('[pull] fetchedResources 总数:', Object.keys(fetchedResources).length)
      }

      const resources: Record<string, string> = {}
      for (const resId of Object.keys(resourcesMeta)) {
        resources[resId] = fetchedResources[resId] || localRes[resId] || ''
      }

      const newLocalRes: Record<string, string> = {}
      for (const resId of Object.keys(resourcesMeta)) {
        if (resources[resId]) {
          newLocalRes[resId] = resources[resId]
        }
      }
      safeSetItem('nav_cached_resources', JSON.stringify(newLocalRes))
      safeSetItem(PULL_RES_HASH_KEY, JSON.stringify(resourcesMeta))

      if (result.data.links) {
        for (const link of result.data.links) {
          if (link.iconUrl && typeof link.iconUrl === 'string' && link.iconUrl.startsWith('res://')) {
            const resId = link.iconUrl.replace('res://', '')
            if (resources[resId]) {
              link.iconUrl = resources[resId]
            } else {
              link.iconUrl = ''
            }
          }
          if (link.cachedIconData && typeof link.cachedIconData === 'string' && link.cachedIconData.startsWith('res://')) {
            const resId = link.cachedIconData.replace('res://', '')
            if (resources[resId]) {
              link.cachedIconData = resources[resId]
            } else {
              delete link.cachedIconData
            }
          }
        }
      }

      if (result.data.settings) {
        storageSet('userSettings', result.data.settings)
      }
      if (result.data.links) {
        storageSet('navLinks', result.data.links)
      }
      if (result.data.categories) {
        storageSet('navCategories', result.data.categories)
      }
      if (result.data.accessRecords) {
        storageSet('accessRecords', result.data.accessRecords)
      }

      if (resources['bg']) {
        console.log('[pull] 保存背景图, 长度:', resources['bg'].length)
        try {
          await saveBgImage(resources['bg'])
        } catch (e) {
          console.log('[pull] saveBgImage 失败, 用 localStorage 兜底:', e)
          try { localStorage.setItem('nav_local_bg_image', resources['bg']) } catch {}
        }
      } else {
        console.log('[pull] resources 中没有 bg')
      }

      // 合并服务器的删除列表到本地
      const serverDeleted: string[] = result.data.deletedWallpapers || []
      const localDeleted: string[] = JSON.parse(localStorage.getItem('nav_deleted_bg_images') || '[]')
      const mergedDeleted = [...new Set([...localDeleted, ...serverDeleted])]
      if (mergedDeleted.length > localDeleted.length) {
        localStorage.setItem('nav_deleted_bg_images', JSON.stringify(mergedDeleted))
      }

      const wallpaperKeys = Object.keys(resources).filter(k => k.startsWith('wallpaper:'))
      console.log('[pull] wallpaper 资源:', wallpaperKeys)
      for (const [key, dataUrl] of Object.entries(resources)) {
        if (key === 'bg' || key.startsWith('icon_') || key.startsWith('cachedicon_')) continue
        if (key.startsWith('wallpaper:') && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
          try {
            const fileId = key.replace('wallpaper:', '')
            if (mergedDeleted.includes(fileId)) continue
            const res = await fetch(dataUrl)
            const blob = await res.blob()
            await saveFile({ id: fileId, name: fileId, type: blob.type || 'image/jpeg', category: 'wallpaper', blob })
            console.log('[pull] 壁纸保存成功:', fileId)
          } catch (e) { console.log('[pull] 壁纸保存失败:', key, e) }
        }
      }

      // 清理本地 IndexedDB 中被标记删除的壁纸
      for (const deletedId of mergedDeleted) {
        try { await deleteFile(deletedId) } catch {}
      }

      if (result.version) {
        safeSetItem(CACHED_VERSION_KEY, String(result.version))
      }

      return true
    } catch (err: any) {
      console.error('[pull错误]', err?.message || err)
      return false
    }
  }

  async function checkServerVersion(): Promise<number | null> {
    if (!token.value) return null
    try {
      const res = await fetch(`${getApiBase()}/check-version`, { headers: headers('GET') })
      if (!res.ok) return null
      const data = await res.json()
      return data.version || 0
    } catch {
      return null
    }
  }

  async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    const res = await fetch(`${getApiBase()}/change-password`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ oldPassword, newPassword }),
    })
    const data = await safeJson(res)
    if (!res.ok) throw new Error(data.error || '修改失败')
    return true
  }

  // ==================== 增量 CRUD ====================

  async function crudRequest(action: string, body: Record<string, unknown>): Promise<{ success: boolean; version: number }> {
    const res = await fetch(`${getApiBase()}/${action}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    })
    if (res.status === 401) { clearAuth(); throw new Error('登录已过期') }
    const data = await safeJson(res)
    if (!res.ok) throw new Error(data.error || '操作失败')
    if (data.version) safeSetItem(CACHED_VERSION_KEY, String(data.version))
    return data
  }

  function addLink(link: Record<string, unknown>) { return crudRequest('add-link', { link }) }
  function updateLink(id: string, data: Record<string, unknown>) { return crudRequest('update-link', { id, data }) }
  function deleteLink(id: string) { return crudRequest('delete-link', { id }) }
  function addCategory(category: Record<string, unknown>) { return crudRequest('add-category', { category }) }
  function updateCategory(id: string, data: Record<string, unknown>) { return crudRequest('update-category', { id, data }) }
  function deleteCategory(id: string) { return crudRequest('delete-category', { id }) }

  // ==================== 增量拉取 ====================

  async function pullChanges(): Promise<{ version: number; changes: Array<{ op: string; type: string; id: string; data: unknown }>; fullSync?: boolean } | null> {
    if (!token.value) return null
    try {
      const since = parseInt(localStorage.getItem(CACHED_VERSION_KEY) || '0')
      const res = await fetch(`${getApiBase()}/changes`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ since }),
      })
      if (res.status === 401) { clearAuth(); return null }
      const data = await safeJson(res)
      if (!res.ok) return null
      if (data.version) safeSetItem(CACHED_VERSION_KEY, String(data.version))

      // 检测到全量同步标记，执行完整 pull
      if (data.fullSync) {
        await pull()
        return { version: data.version, changes: [], fullSync: true }
      }

      return data
    } catch {
      return null
    }
  }

  return {
    token,
    isLoggedIn,
    authReady,
    authStatus,
    authMessage,
    checkSetup,
    setup,
    login,
    logout,
    incrementalSync,
    pull,
    checkServerVersion,
    changePassword,
    addLink,
    updateLink,
    deleteLink,
    addCategory,
    updateCategory,
    deleteCategory,
    pullChanges,
  }
}
