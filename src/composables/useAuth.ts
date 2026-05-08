/**
 * 认证组合式函数 - useAuth
 *
 * 这是一个"共享状态"的组合式函数（不是传统 composable）
 * 模块级别的 ref 在所有组件调用 useAuth() 时返回同一份引用
 * 因此 token、username、role 等状态全局共享
 */
import { ref, computed } from 'vue'
import { saveBgImage, getBgImage, blobToDataUrl, getFilesByCategory, getBgImageBlob, saveFile } from '@/utils/fileStore'

// localStorage 中 token 和用户名的存储 key
const TOKEN_KEY = 'nav_auth_token'
const USERNAME_KEY = 'nav_auth_username'

// 模块级别的共享状态（所有组件调用 useAuth() 拿到的是同一份）
/** JWT token */
const token = ref(localStorage.getItem(TOKEN_KEY) || '')
/** 当前登录用户名 */
const username = ref(localStorage.getItem(USERNAME_KEY) || '')
/** 用户角色: 'admin' | 'user' */
const role = ref<string>(localStorage.getItem('nav_auth_role') || '')
/** 认证状态: idle=空闲, loading=进行中, success=成功, error=失败 */
const authStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
/** 认证状态消息（用于 UI 显示） */
const authMessage = ref('')
/** 自动同步的防抖定时器 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 获取 API 基础路径
 * 开发环境 Vite 代理到 localhost:3456，所以直接用 /api
 */
function getApiBase(): string {
  return '/api'
}

/**
 * 构造带认证 token 的请求头
 * @returns 请求头对象，包含 Content-Type 和 Authorization
 */
function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token.value) h['Authorization'] = `Bearer ${token.value}`
  return h
}

/**
 * useAuth 组合式函数
 * 提供登录、注册、登出、数据同步（push/pull）、管理员操作等功能
 */
export function useAuth() {
  /** 是否已登录（响应式） */
  const isLoggedIn = ref(!!token.value)

  /**
   * 设置认证信息（登录/注册成功后调用）
   * @param t - JWT token
   * @param u - 用户名
   * @param r - 角色，默认 'user'
   */
  function setAuth(t: string, u: string, r?: string) {
    token.value = t
    username.value = u
    role.value = r || 'user'
    localStorage.setItem(TOKEN_KEY, t)
    localStorage.setItem(USERNAME_KEY, u)
    localStorage.setItem('nav_auth_role', role.value)
    isLoggedIn.value = true
  }

  /** 清除认证信息（登出/token 过期时调用） */
  function clearAuth() {
    token.value = ''
    username.value = ''
    role.value = ''
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USERNAME_KEY)
    localStorage.removeItem('nav_auth_role')
    isLoggedIn.value = false
  }

  /**
   * 用户注册
   * @param u - 用户名
   * @param p - 密码
   * @returns 是否注册成功
   */
  async function register(u: string, p: string): Promise<boolean> {
    authStatus.value = 'loading'
    authMessage.value = '注册中...'
    try {
      const res = await fetch(`${getApiBase()}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '注册失败')
      setAuth(data.token, data.username)
      authStatus.value = 'success'
      authMessage.value = '注册成功'
      return true
    } catch (err: any) {
      authStatus.value = 'error'
      authMessage.value = err.message || '注册失败'
      return false
    }
  }

  /**
   * 用户登录
   * @param u - 用户名
   * @param p - 密码
   * @param rememberMe - 是否记住登录状态
   * @returns 是否登录成功
   */
  async function login(u: string, p: string, rememberMe = false): Promise<boolean> {
    authStatus.value = 'loading'
    authMessage.value = '登录中...'
    try {
      const res = await fetch(`${getApiBase()}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p, rememberMe }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登录失败')
      setAuth(data.token, data.username, data.role)
      authStatus.value = 'success'
      authMessage.value = '登录成功'
      return true
    } catch (err: any) {
      authStatus.value = 'error'
      authMessage.value = err.message || '登录失败'
      return false
    }
  }

  /**
   * 用户登出
   * 通知后端删除 token，同时清除本地认证状态
   */
  async function logout(): Promise<void> {
    try {
      await fetch(`${getApiBase()}/logout`, { method: 'POST', headers: headers() })
    } catch {}
    clearAuth()
    authStatus.value = 'idle'
    authMessage.value = ''
  }

  /**
   * 检查当前会话是否有效
   * 调用 GET /api/me 验证 token 是否仍有效
   * @returns 是否已登录
   */
  async function checkSession(): Promise<boolean> {
    if (!token.value) return false
    try {
      const res = await fetch(`${getApiBase()}/me`, { headers: headers() })
      const data = await res.json()
      if (data.logged_in) {
        username.value = data.username
        role.value = data.role || 'user'
        localStorage.setItem(USERNAME_KEY, data.username)
        localStorage.setItem('nav_auth_role', role.value)
        isLoggedIn.value = true
        return true
      } else {
        clearAuth()
        return false
      }
    } catch {
      return false
    }
  }

  /**
   * 数据同步推送（push）
   * 将本地所有数据打包上传到服务器:
   * 1. 从 localStorage 读取设置、书签、分类、访问记录
   * 2. 从 IndexedDB 读取背景图 Blob → 转 dataUrl
   * 3. 从 IndexedDB 读取 favicon 缓存 → 转 dataUrl
   * 4. 将书签的 dataUrl 图标提取为资源，替换为 res:// 引用
   * 5. 打包 POST 到 /api/sync
   * @returns 是否推送成功
   */
  async function push(): Promise<boolean> {
    if (!token.value) return false
    try {
      // 从 localStorage 读取本地数据
      const settingsData = localStorage.getItem('nav_userSettings')
      const linksData = localStorage.getItem('nav_navLinks')
      const categoriesData = localStorage.getItem('nav_navCategories')
      const recordsData = localStorage.getItem('nav_accessRecords')

      const settings = settingsData ? JSON.parse(settingsData) : null
      const links: any[] = linksData ? JSON.parse(linksData) : []
      const categories = categoriesData ? JSON.parse(categoriesData) : []
      const accessRecords = recordsData ? JSON.parse(recordsData) : []

      const resources: Record<string, string> = {}

      // 收集背景图资源：从 IndexedDB 读取 Blob → 转为 dataUrl
      try {
        const bgBlob = await getBgImageBlob()
        if (bgBlob) {
          resources['bg'] = await blobToDataUrl(bgBlob)
        }
      } catch {
        // 回退：如果 IndexedDB 失败，尝试 localStorage 中的 dataUrl
        const localBg = localStorage.getItem('nav_local_bg_image')
        if (localBg && localBg.startsWith('data:')) {
          resources['bg'] = localBg
        }
      }

      // 收集 FileManager 壁纸文件资源
        try {
          const wallpaperFiles = await getFilesByCategory('wallpaper')
          for (const f of wallpaperFiles) {
            if (f.id === 'bg_image') continue
            const dataUrl = await blobToDataUrl(f.blob)
            resources[`wallpaper:${f.id}`] = dataUrl
          }
        } catch {}

        // 提取书签的 dataUrl 图标为独立资源，用 res:// 协议引用
      for (const link of links) {
        if (link.iconUrl && typeof link.iconUrl === 'string' && link.iconUrl.startsWith('data:')) {
          const resId = `icon_${link.id}`
          resources[resId] = link.iconUrl
          link.iconUrl = `res://${resId}`
        }
        if (link.cachedIconData && typeof link.cachedIconData === 'string' && link.cachedIconData.startsWith('data:')) {
          const resId = `cachedicon_${link.id}`
          resources[resId] = link.cachedIconData
          link.cachedIconData = `res://${resId}`
        }
      }

      const data: any = {
        settings,
        links,
        categories,
        accessRecords,
        updatedAt: Date.now(),
        version: 0,
      }

      if (Object.keys(resources).length > 0) {
        data.resources = resources
      }

      const res = await fetch(`${getApiBase()}/sync`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ data }),
      })
      if (res.status === 401) {
        clearAuth()
        return false
      }
      const result = await res.json()
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * 数据同步拉取（pull）
   * 从服务器下载全部数据并写入本地存储:
   * 1. 下载设置、书签、分类、访问记录 → localStorage
   * 2. 下载资源（背景图 dataUrl → 存入 IndexedDB）
   * 3. 下载 favicon 缓存（dataUrl → 转 Blob → 存入 IndexedDB）
   * 4. 将书签中的 res:// 引用还原为 dataUrl
   * @returns 是否拉取成功
   */
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
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '拉取失败')
      if (!result.data) return false

      const resources = result.data.resources || {}

      // 将书签中的 res:// 引用还原为实际的 dataUrl
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

      // 写入 localStorage
      if (result.data.settings) {
        localStorage.setItem('nav_userSettings', JSON.stringify(result.data.settings))
      }
      if (result.data.links) {
        localStorage.setItem('nav_navLinks', JSON.stringify(result.data.links))
      }
      if (result.data.categories) {
        localStorage.setItem('nav_navCategories', JSON.stringify(result.data.categories))
      }
      if (result.data.accessRecords) {
        localStorage.setItem('nav_accessRecords', JSON.stringify(result.data.accessRecords))
      }

      // 保存背景图到 IndexedDB（dataUrl → Blob → IndexedDB）
      if (resources['bg']) {
        try {
          await saveBgImage(resources['bg'])
        } catch {
          // IndexedDB 失败时回退到 localStorage
          try { localStorage.setItem('nav_local_bg_image', resources['bg']) } catch {}
        }
      }

      // 保存壁纸文件到 IndexedDB
      for (const [key, dataUrl] of Object.entries(resources)) {
        if (key === 'bg' || key.startsWith('icon_') || key.startsWith('cachedicon_')) continue
        if (key.startsWith('wallpaper:') && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
          try {
            const fileId = key.replace('wallpaper:', '')
            const res = await fetch(dataUrl)
            const blob = await res.blob()
            await saveFile({ id: fileId, name: fileId, type: blob.type || 'image/jpeg', category: 'wallpaper', blob })
          } catch {}
        }
      }

      return true
    } catch (err: any) {
      return false
    }
  }

  /**
   * 防抖自动同步
   * 在用户修改数据后调用，延迟 2 秒执行 push
   * 避免频繁操作时反复请求服务器
   */
  function debouncePush() {
    if (!token.value) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => { push() }, 2000)
  }

  /** 是否为管理员（计算属性，响应式） */
  const isAdmin = computed(() => role.value === 'admin')

  // ==================== 管理员 API ====================

  /**
   * 管理员获取所有用户列表
   * @returns 用户数组
   */
  async function adminGetUsers(): Promise<any[]> {
    const res = await fetch(`${getApiBase()}/admin/users`, { method: 'POST', headers: headers() })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '获取失败')
    return data.users
  }

  /**
   * 管理员添加用户
   * @param u - 新用户名
   * @param p - 新用户密码
   * @returns 是否添加成功
   */
  async function adminAddUser(u: string, p: string): Promise<boolean> {
    const res = await fetch(`${getApiBase()}/admin/add-user`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ username: u, password: p }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '添加失败')
    return true
  }

  /**
   * 管理员删除用户
   * @param u - 要删除的用户名
   * @returns 是否删除成功
   */
  async function adminDeleteUser(u: string): Promise<boolean> {
    const res = await fetch(`${getApiBase()}/admin/delete-user`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ username: u }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '删除失败')
    return true
  }

  /**
   * 管理员切换注册功能开关
   * @returns 包含 registrationEnabled 的对象
   */
  async function adminToggleRegistration(): Promise<{ registrationEnabled: boolean }> {
    const res = await fetch(`${getApiBase()}/admin/toggle-registration`, {
      method: 'POST',
      headers: headers(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '操作失败')
    return data
  }

  /**
   * 管理员获取系统状态
   * @returns 包含 registrationEnabled 和 totalUsers 的对象
   */
  async function adminGetStatus(): Promise<{ registrationEnabled: boolean; totalUsers: number }> {
    const res = await fetch(`${getApiBase()}/admin/status`, {
      method: 'POST',
      headers: headers(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '获取失败')
    return data
  }

  /**
   * 修改密码
   * @param oldPassword - 旧密码
   * @param newPassword - 新密码
   * @returns 是否修改成功
   */
  async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    const res = await fetch(`${getApiBase()}/change-password`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ oldPassword, newPassword }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '修改失败')
    return true
  }

  // 返回所有状态和方法供组件使用
  return {
    token,
    username,
    role,
    isLoggedIn,
    isAdmin,
    authStatus,
    authMessage,
    register,
    login,
    logout,
    checkSession,
    push,
    pull,
    debouncePush,
    changePassword,
    adminGetUsers,
    adminAddUser,
    adminDeleteUser,
    adminToggleRegistration,
    adminGetStatus,
  }
}
