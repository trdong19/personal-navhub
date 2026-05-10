/**
 * 书签/导航数据 Pinia Store - useNavStore
 *
 * 核心职责:
 * 1. 管理书签（NavLink）和分类（NavCategory）的增删改查
 * 2. 提供搜索、排序、置顶、导入导出等功能
 * 3. 记录书签访问次数和历史
 * 4. 每次数据变更后自动保存到 localStorage 并触发同步推送
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NavLink, NavCategory, AccessRecord } from '@/types'
import { storageGet, storageSet } from '@/utils/storage'
import { defaultLinks, defaultCategories } from '@/utils/defaults'
import { generateId, getFaviconUrl } from '@/utils/helpers'
import { useAuth } from '@/composables/useAuth'

export type LinkFilter = 'all' | 'intranet' | 'extranet' | 'tunnel' | 'tunnel_intranet' | 'tunnel_extranet'

export const useNavStore = defineStore('nav', () => {
  // ==================== 状态 ====================

  function ensurePinnedOrder(list: NavLink[]) {
    return list.map((l, i) => ({
      ...l,
      pinnedOrder: l.pinnedOrder ?? (l.pinned ? i : 0),
    }))
  }

  function filterByAddress(links: NavLink[], filter: LinkFilter): NavLink[] {
    if (filter === 'all') return links
    return links.filter(l => {
      switch (filter) {
        case 'intranet': return !!l.urls.intranet
        case 'extranet': return !!l.urls.extranet
        case 'tunnel': return !!l.urls.tunnel
        case 'tunnel_intranet': return !!l.urls.tunnel || !!l.urls.intranet
        case 'tunnel_extranet': return !!l.urls.tunnel || !!l.urls.extranet
        default: return true
      }
    })
  }

  /** 所有书签列表 */
  const links = ref<NavLink[]>(ensurePinnedOrder(storageGet('navLinks', defaultLinks)))
  /** 所有分类列表 */
  const categories = ref<NavCategory[]>(storageGet('navCategories', defaultCategories))
  /** 访问记录（最近 1000 条） */
  const accessRecords = ref<AccessRecord[]>(storageGet('accessRecords', []))
  /** 当前搜索关键词 */
  const searchQuery = ref('')
  /** 链接筛选模式 */
  const linkFilter = ref<LinkFilter>('all')

  /** 获取防抖同步推送函数 */
  const { debouncePush } = useAuth()

  // ==================== 计算属性 ====================

  /** 按 order 排序后的分类列表 */
  const sortedCategories = computed(() =>
    [...categories.value].sort((a, b) => a.order - b.order)
  )

  /** 所有置顶的书签（按 pinnedOrder 排序，应用筛选） */
  const pinnedLinks = computed(() =>
    filterByAddress(
      links.value.filter(l => l.pinned).sort((a, b) => a.pinnedOrder - b.pinnedOrder),
      linkFilter.value
    )
  )

  /**
   * 根据搜索关键词过滤书签
   * 搜索范围：标题、描述、标签、内网地址、外网地址
   */
  const filteredLinks = computed(() => {
    if (!searchQuery.value.trim()) return []
    const q = searchQuery.value.toLowerCase()
    return links.value.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.description?.toLowerCase().includes(q) ||
      l.tags.some(t => t.toLowerCase().includes(q)) ||
      l.urls.intranet?.toLowerCase().includes(q) ||
      l.urls.extranet?.toLowerCase().includes(q) ||
      l.urls.tunnel?.toLowerCase().includes(q)
    ).sort((a, b) => a.order - b.order)
  })

  /**
   * 获取指定分类下的书签
   * @param categoryId - 分类 ID
   * @returns 该分类下的书签数组
   */
  function getLinksByCategory(categoryId: string) {
    return linksByCategory.value.get(categoryId) || []
  }

  /** 按分类分组的书签 Map（key=分类ID, value=书签数组，已按 order 排序，应用筛选） */
  const linksByCategory = computed(() => {
    const map = new Map<string, NavLink[]>()
    const filtered = filterByAddress(links.value, linkFilter.value)
    for (const link of filtered) {
      const list = map.get(link.category)
      if (list) {
        list.push(link)
      } else {
        map.set(link.category, [link])
      }
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.order - b.order)
    }
    return map
  })

  function getTotalLinksByCategory(categoryId: string): number {
    const directCount = getLinksByCategory(categoryId).length
    const children = categories.value.filter(c => c.parentId === categoryId)
    let totalCount = directCount
    for (const child of children) {
      totalCount += getTotalLinksByCategory(child.id)
    }
    return totalCount
  }

  function setLinkFilter(filter: LinkFilter) {
    linkFilter.value = filter
  }

  // ==================== 数据持久化 ====================

  /** 保存书签到 localStorage 并触发同步 */
  function saveLinks() {
    storageSet('navLinks', links.value)
    debouncePush()
  }

  /** 保存分类到 localStorage 并触发同步 */
  function saveCategories() {
    storageSet('navCategories', categories.value)
    debouncePush()
  }

  // ==================== 书签操作 ====================

  /**
   * 添加书签
   * 自动生成 id、初始访问次数、排序值和创建时间
   * @param link - 书签数据（不含 id, accessCount, lastAccessed, createdAt, order）
   * @returns 新创建的书签对象
   */
  function addLink(link: Omit<NavLink, 'id' | 'accessCount' | 'lastAccessed' | 'createdAt' | 'order' | 'pinnedOrder'>) {
    const maxOrder = links.value.length > 0
      ? Math.max(...links.value.map(l => l.order))
      : -1
    const maxPinnedOrder = links.value.filter(l => l.pinned).length > 0
      ? Math.max(...links.value.filter(l => l.pinned).map(l => l.pinnedOrder))
      : -1
    const newLink: NavLink = {
      ...link,
      id: generateId(),
      accessCount: 0,
      lastAccessed: 0,
      order: maxOrder + 1,
      pinnedOrder: link.pinned ? maxPinnedOrder + 1 : 0,
      createdAt: Date.now(),
    }
    links.value.push(newLink)
    saveLinks()
    fetchAndCacheFavicon(newLink)
    return newLink
  }

  /**
   * 更新书签
   * @param id - 书签 ID
   * @param data - 要更新的字段（部分 NavLink）
   */
  function updateLink(id: string, data: Partial<NavLink>) {
    const idx = links.value.findIndex(l => l.id === id)
    if (idx !== -1) {
      if (data.iconUrl || data.cachedIconData) {
        data.faviconFetchFailed = false
      }
      if (data.pinned === true && !links.value[idx].pinned) {
        const maxPinnedOrder = links.value.filter(l => l.pinned).length > 0
          ? Math.max(...links.value.filter(l => l.pinned).map(l => l.pinnedOrder))
          : -1
        data.pinnedOrder = maxPinnedOrder + 1
      }
      links.value[idx] = { ...links.value[idx], ...data }
      saveLinks()
    }
  }

  /**
   * 删除书签
   * @param id - 书签 ID
   */
  function deleteLink(id: string) {
    links.value = links.value.filter(l => l.id !== id)
    saveLinks()
  }

  /**
   * 记录书签访问
   * 增加访问次数、更新最后访问时间，并添加访问记录
   * 访问记录超过 1000 条时自动裁剪到 500 条
   */
  function recordAccess(linkId: string, networkType: string) {
    const link = links.value.find(l => l.id === linkId)
    if (link) {
      link.accessCount++
      link.lastAccessed = Date.now()
      saveLinks()
    }
    accessRecords.value.push({
      linkId,
      timestamp: Date.now(),
      networkType: networkType as AccessRecord['networkType'],
    })
    // 裁剪访问记录，保留最近 500 条
    if (accessRecords.value.length > 1000) {
      accessRecords.value = accessRecords.value.slice(-500)
    }
    storageSet('accessRecords', accessRecords.value)
    debouncePush()
  }

  /**
   * 重新排序书签（拖拽排序后调用）
   * @param orderedIds - 按新顺序排列的书签 ID 数组
   */
  function reorderLinks(orderedIds: string[]) {
    orderedIds.forEach((id, index) => {
      const link = links.value.find(l => l.id === id)
      if (link) link.order = index
    })
    saveLinks()
  }

  /**
   * 重新排序置顶书签（仅更新 pinnedOrder，不影响 order）
   * @param orderedIds - 按新顺序排列的置顶书签 ID 数组
   */
  function reorderPinnedLinks(orderedIds: string[]) {
    orderedIds.forEach((id, index) => {
      const link = links.value.find(l => l.id === id)
      if (link) link.pinnedOrder = index
    })
    saveLinks()
  }

  // ==================== 分类操作 ====================

  /**
   * 切换分类的折叠/展开状态
   * @param categoryId - 分类 ID
   */
  function toggleCategory(categoryId: string) {
    const cat = categories.value.find(c => c.id === categoryId)
    if (cat) {
      cat.collapsed = !cat.collapsed
      saveCategories()
    }
  }

  function expandAllCategories() {
    categories.value.forEach(cat => { cat.collapsed = false })
    saveCategories()
  }

  function collapseAllCategories() {
    categories.value.forEach(cat => { cat.collapsed = true })
    saveCategories()
  }

  /**
   * 添加分类
   * @param name - 分类名称
   * @param icon - 分类图标
   * @param color - 分类颜色
   * @param parentId - 父分类 ID（可选，用于子分类）
   * @returns 新创建的分类对象
   */
  function addCategory(name: string, icon: string, color: string, parentId?: string) {
    const newCat: NavCategory = {
      id: generateId(),
      name,
      icon,
      color,
      collapsed: false,
      order: categories.value.length,
      parentId,
    }
    categories.value.push(newCat)
    saveCategories()
    return newCat
  }

  /**
   * 删除分类（同时删除子分类和关联的书签）
   * @param id - 分类 ID
   */
  function deleteCategory(id: string) {
    // 找出所有子分类 ID
    const childIds = categories.value
      .filter(c => c.parentId === id)
      .map(c => c.id)
    const allIds = [id, ...childIds]
    // 删除分类和关联书签
    categories.value = categories.value.filter(c => !allIds.includes(c.id))
    links.value = links.value.filter(l => !allIds.includes(l.category))
    saveCategories()
    saveLinks()
  }

  /**
   * 更新分类信息
   * @param id - 分类 ID
   * @param data - 要更新的字段（部分 NavCategory）
   */
  function updateCategory(id: string, data: Partial<NavCategory>) {
    const idx = categories.value.findIndex(c => c.id === id)
    if (idx !== -1) {
      categories.value[idx] = { ...categories.value[idx], ...data }
      saveCategories()
    }
  }

  // ==================== 导入导出 ====================

  /**
   * 批量导入书签（去重：URL 相同的跳过）
   * @param items - 要导入的书签数组
   * @returns 实际导入的数量
   */
  function importLinks(items: { title: string; url: string; category?: string; tags?: string[] }[]) {
    let imported = 0
    for (const item of items) {
      const exists = links.value.some(l =>
        l.urls.intranet === item.url ||
        l.urls.extranet === item.url ||
        l.urls.tunnel === item.url
      )
      if (!exists) {
        addLink({
          title: item.title,
          icon: 'link',
          category: item.category || 'tools',
          urls: { extranet: item.url },
          tags: item.tags || [],
          pinned: false,
        })
        imported++
      }
    }
    return imported
  }

  /**
   * 导出所有数据为 JSON 字符串
   * @returns 格式化的 JSON 字符串
   */
  function exportData() {
    return JSON.stringify({ links: links.value, categories: categories.value }, null, 2)
  }

  /**
   * 从 JSON 字符串导入数据
   * @param json - JSON 字符串
   * @returns 是否导入成功
   */
  function importData(json: string) {
    try {
      const data = JSON.parse(json)
      if (data.links) {
        links.value = data.links.map((l: NavLink, i: number) => ({
          ...l,
          pinnedOrder: l.pinnedOrder ?? (l.pinned ? i : 0),
        }))
        saveLinks()
      }
      if (data.categories) {
        categories.value = data.categories
        saveCategories()
      }
      return true
    } catch {
      return false
    }
  }

  // ==================== 统计查询 ====================

  /**
   * 获取访问次数最多的 Top N 书签
   * @param limit - 返回数量，默认 10
   */
  function getTopLinks(limit = 10) {
    return [...links.value]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit)
  }

  /**
   * 获取最近访问的 Top N 书签
   * @param limit - 返回数量，默认 10
   */
  function getRecentLinks(limit = 10) {
    return [...links.value]
      .filter(l => l.lastAccessed > 0)
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, limit)
  }

  /**
   * 重新排序分类（拖拽排序后调用）
   * @param orderedIds - 按新顺序排列的分类 ID 数组
   */
  function reorderCategories(orderedIds: string[]) {
    orderedIds.forEach((id, index) => {
      const cat = categories.value.find(c => c.id === id)
      if (cat) cat.order = index
    })
    saveCategories()
  }

  /**
   * 从 localStorage 重新加载所有数据（pull 后调用）
   * 确保同步拉取的数据能立即反映到 UI
   */
  function reloadFromStorage() {
    links.value = ensurePinnedOrder(storageGet('navLinks', defaultLinks))
    categories.value = storageGet('navCategories', defaultCategories)
    accessRecords.value = storageGet('accessRecords', [])
  }

  async function fetchAndCacheFavicon(link: NavLink): Promise<void> {
    if (link.cachedIconData || link.iconUrl || link.faviconFetchFailed) return
    const url = link.urls.extranet || link.urls.intranet
    if (!url) return
    const faviconUrl = getFaviconUrl(url)
    if (!faviconUrl) return
    try {
      const resp = await fetch(faviconUrl, { signal: AbortSignal.timeout(2000) })
      if (!resp.ok) {
        markFaviconFailed(link.id)
        return
      }
      const blob = await resp.blob()
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        if (dataUrl && dataUrl.startsWith('data:')) {
          const idx = links.value.findIndex(l => l.id === link.id)
          if (idx !== -1) {
            links.value[idx].cachedIconData = dataUrl
            saveLinks()
          }
        }
      }
      reader.readAsDataURL(blob)
    } catch {
      markFaviconFailed(link.id)
    }
  }

  function markFaviconFailed(linkId: string) {
    const idx = links.value.findIndex(l => l.id === linkId)
    if (idx !== -1) {
      links.value[idx].faviconFetchFailed = true
      saveLinks()
    }
  }

  async function batchFetchFavicons(): Promise<void> {
    const targets = links.value.filter(l => !l.cachedIconData && !l.iconUrl && !l.faviconFetchFailed)
    const BATCH_SIZE = 4
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(batch.map(l => fetchAndCacheFavicon(l)))
    }
  }

  // ==================== 导出 ====================

  return {
    links,
    categories,
    accessRecords,
    searchQuery,
    linkFilter,
    sortedCategories,
    pinnedLinks,
    filteredLinks,
    getLinksByCategory,
    getTotalLinksByCategory,
    addLink,
    updateLink,
    deleteLink,
    recordAccess,
    reorderLinks,
    reorderPinnedLinks,
    toggleCategory,
    expandAllCategories,
    collapseAllCategories,
    addCategory,
    deleteCategory,
    updateCategory,
    setLinkFilter,
    importLinks,
    exportData,
    importData,
    getTopLinks,
    getRecentLinks,
    reorderCategories,
    reloadFromStorage,
    fetchAndCacheFavicon,
    batchFetchFavicons,
  }
})
