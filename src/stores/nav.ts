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
import { pinyinMatch } from '@/utils/pinyin'

export type LinkFilter = 'all' | 'intranet' | 'extranet' | 'tunnel' | 'tunnel_intranet' | 'tunnel_extranet' | 'intranet_extranet'

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
        case 'tunnel_intranet': return !!l.urls.tunnel && !!l.urls.intranet
        case 'tunnel_extranet': return !!l.urls.tunnel && !!l.urls.extranet
        case 'intranet_extranet': return !!l.urls.intranet && !!l.urls.extranet
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
  /** 标签筛选（空数组表示不筛选） */
  const tagFilter = ref<string[]>([])

  /** 获取防抖同步推送函数 */
  const { flushPush } = useAuth()

  const allTags = computed(() => {
    const tagSet = new Set<string>()
    for (const link of links.value) {
      for (const tag of link.tags) {
        tagSet.add(tag)
      }
    }
    return [...tagSet].sort()
  })

  // ==================== 计算属性 ====================

  /** 按 order 排序后的分类列表 */
  const sortedCategories = computed(() =>
    [...categories.value].sort((a, b) => a.order - b.order)
  )

  function applyTagFilter(links: NavLink[]): NavLink[] {
    if (tagFilter.value.length === 0) return links
    return links.filter(l => tagFilter.value.every(tag => l.tags.includes(tag)))
  }

  /** 所有置顶的书签（按 pinnedOrder 排序，应用筛选） */
  const pinnedLinks = computed(() =>
    applyTagFilter(filterByAddress(
      links.value.filter(l => l.pinned).sort((a, b) => a.pinnedOrder - b.pinnedOrder),
      linkFilter.value
    ))
  )

  /**
   * 根据搜索关键词过滤书签
   * 搜索范围：标题、描述、标签、内网地址、外网地址
   */
  const filteredLinks = computed(() => {
    if (!searchQuery.value.trim()) return []
    const q = searchQuery.value.toLowerCase()
    return links.value.filter(l =>
      pinyinMatch(l.title, q) ||
      l.description?.toLowerCase().includes(q) ||
      l.tags.some(t => pinyinMatch(t, q)) ||
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
    const filtered = applyTagFilter(filterByAddress(links.value, linkFilter.value))
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

  function setTagFilter(tags: string[]) {
    tagFilter.value = tags
  }

  function toggleTagFilter(tag: string) {
    const idx = tagFilter.value.indexOf(tag)
    if (idx === -1) {
      tagFilter.value = [...tagFilter.value, tag]
    } else {
      tagFilter.value = tagFilter.value.filter(t => t !== tag)
    }
  }

  // ==================== 批量操作 ====================

  const selectionMode = ref(false)
  const selectedLinkIds = ref<Set<string>>(new Set())
  const lastSelectedLinkId = ref<string | null>(null)
  // 手机端范围选择模式
  const rangeSelectMode = ref(false)
  const rangeStartId = ref<string | null>(null)
  // 拖拽目标卡片ID（触屏端跨分类拖拽时用于目标位置指示）
  const dropTargetLinkId = ref<string | null>(null)

  function enterSelectionMode() {
    selectionMode.value = true
    selectedLinkIds.value = new Set()
  }

  function exitSelectionMode() {
    selectionMode.value = false
    selectedLinkIds.value = new Set()
    lastSelectedLinkId.value = null
    rangeSelectMode.value = false
    rangeStartId.value = null
  }

  // 范围选择模式切换
  function toggleRangeSelectMode() {
    if (rangeSelectMode.value) {
      rangeSelectMode.value = false
      rangeStartId.value = null
    } else {
      rangeSelectMode.value = true
      rangeStartId.value = null
    }
  }

  // 范围选择点击处理
  function handleRangeSelectClick(linkId: string, getLinksInOrder?: () => string[]) {
    if (!rangeStartId.value) {
      // 第一次点击：设置起始点
      rangeStartId.value = linkId
      toggleLinkSelection(linkId)
    } else {
      // 第二次点击：执行范围选择
      shiftSelectLinks(linkId, rangeStartId.value, getLinksInOrder)
      rangeSelectMode.value = false
      rangeStartId.value = null
    }
  }

  function toggleLinkSelection(linkId: string) {
    const newSet = new Set(selectedLinkIds.value)
    if (newSet.has(linkId)) {
      newSet.delete(linkId)
    } else {
      newSet.add(linkId)
    }
    selectedLinkIds.value = newSet
    lastSelectedLinkId.value = linkId
  }

  function shiftSelectLinks(targetLinkId: string, startLinkId?: string, getLinksInOrder?: () => string[]) {
    if (!startLinkId) {
      toggleLinkSelection(targetLinkId)
      return
    }
    if (startLinkId === targetLinkId) {
      return
    }
    const linkIdsInOrder = getLinksInOrder ? getLinksInOrder() : links.value.map(l => l.id)
    const startIndex = linkIdsInOrder.indexOf(startLinkId)
    const targetIndex = linkIdsInOrder.indexOf(targetLinkId)
    if (startIndex === -1 || targetIndex === -1) {
      toggleLinkSelection(targetLinkId)
      return
    }
    const newSet = new Set(selectedLinkIds.value)
    const step = startIndex < targetIndex ? 1 : -1
    for (let i = startIndex; step > 0 ? i <= targetIndex : i >= targetIndex; i += step) {
      newSet.add(linkIdsInOrder[i])
    }
    selectedLinkIds.value = newSet
    lastSelectedLinkId.value = targetLinkId
  }

  function selectAllLinks() {
    selectedLinkIds.value = new Set(links.value.map(l => l.id))
  }

  // 批量操作
  function batchPinLinks(): number {
    const count = selectedLinkIds.value.size
    if (count === 0) return 0
    for (const link of links.value) {
      if (selectedLinkIds.value.has(link.id) && !link.pinned) {
        link.pinned = true
        link.pinnedOrder = (link.pinnedOrder || 0)
      }
    }
    const pinnedLinks = links.value.filter(l => selectedLinkIds.value.has(l.id) && l.pinned)
    const maxPinnedOrder = pinnedLinks.length > 0 
      ? Math.max(...links.value.filter(l => l.pinned).map(l => l.pinnedOrder || 0))
      : -1
    let order = maxPinnedOrder + 1
    for (const link of links.value) {
      if (selectedLinkIds.value.has(link.id) && link.pinned) {
        link.pinnedOrder = order++
      }
    }
    saveLinks()
    exitSelectionMode()
    return count
  }

  // 删除撤回
  const deletedLinksCache = ref<NavLink[]>([])

  // 移动撤回
  interface MoveRecord {
    linkId: string
    oldCategory: string
    oldOrder: number
  }
  const moveCache = ref<MoveRecord[]>([])

  function batchDeleteLinks(): number {
    const count = selectedLinkIds.value.size
    if (count === 0) return 0
    const linksToDelete = links.value.filter(l => selectedLinkIds.value.has(l.id))
    deletedLinksCache.value = [...linksToDelete]
    links.value = links.value.filter(l => !selectedLinkIds.value.has(l.id))
    saveLinks()
    exitSelectionMode()
    return count
  }

  function restoreDeletedLinks(): number {
    const count = deletedLinksCache.value.length
    if (count === 0) return 0
    links.value.push(...deletedLinksCache.value)
    deletedLinksCache.value = []
    saveLinks()
    return count
  }

  function restoreMovedLinks(): number {
    const count = moveCache.value.length
    if (count === 0) return 0
    for (const record of moveCache.value) {
      const link = links.value.find(l => l.id === record.linkId)
      if (link) {
        link.category = record.oldCategory
        link.order = record.oldOrder
      }
    }
    moveCache.value = []
    saveLinks()
    return count
  }

  function recordMove(linkId: string) {
    const link = links.value.find(l => l.id === linkId)
    if (link) {
      moveCache.value = [{ linkId, oldCategory: link.category, oldOrder: link.order }]
    }
  }

  function batchMoveLinks(categoryId: string, targetLinkId?: string): number {
    const count = selectedLinkIds.value.size
    if (count === 0) return 0
    
    const records: MoveRecord[] = []
    for (const link of links.value) {
      if (selectedLinkIds.value.has(link.id)) {
        records.push({ linkId: link.id, oldCategory: link.category, oldOrder: link.order })
      }
    }
    moveCache.value = records
    
    for (const link of links.value) {
      if (selectedLinkIds.value.has(link.id)) {
        link.category = categoryId
      }
    }
    
    if (targetLinkId) {
      const categoryLinks = links.value.filter(l => l.category === categoryId)
      const targetIndex = categoryLinks.findIndex(l => l.id === targetLinkId)
      
      if (targetIndex !== -1) {
        const targetOrder = categoryLinks[targetIndex].order
        
        for (const link of links.value) {
          if (selectedLinkIds.value.has(link.id)) {
            link.order = targetOrder - 0.5
          } else if (link.category === categoryId && link.order >= targetOrder) {
            link.order += count
          }
        }
      }
    }
    
    saveLinks()
    return count
  }

  // ==================== 数据持久化 ====================

  /** 保存书签到 localStorage 并触发同步 */
  function saveLinks() {
    storageSet('navLinks', links.value)
    flushPush()
  }

  /** 保存分类到 localStorage 并触发同步 */
  function saveCategories() {
    storageSet('navCategories', categories.value)
    flushPush()
  }

  // ==================== 书签操作 ====================

  /**
   * 添加书签
   * 自动生成 id、初始访问次数、排序值和创建时间
   * @param link - 书签数据（不含 id, accessCount, lastAccessed, createdAt, order）
   * @returns 新创建的书签对象
   */
  function addLink(link: Omit<NavLink, 'id' | 'accessCount' | 'lastAccessed' | 'createdAt' | 'order' | 'pinnedOrder'>): NavLink | null {
    const duplicate = links.value.some(
      l => l.title === link.title && l.category === link.category
    )
    if (duplicate) return null
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
   * 删除书签（支持撤回）
   * @param id - 书签 ID
   */
  function deleteLink(id: string) {
    const linkToDelete = links.value.find(l => l.id === id)
    if (linkToDelete) {
      deletedLinksCache.value = [linkToDelete]
    }
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
  function addCategory(name: string, icon: string, color: string, parentId?: string): NavCategory | null {
    const duplicate = categories.value.some(
      c => c.name === name && c.parentId === (parentId || undefined)
    )
    if (duplicate) return null
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
    // 触发全局事件通知组件数据已更新
    window.dispatchEvent(new CustomEvent('nav-data-reloaded'))
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
    tagFilter,
    allTags,
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
    setTagFilter,
    toggleTagFilter,
    exportData,
    importData,
    getTopLinks,
    getRecentLinks,
    reorderCategories,
    reloadFromStorage,
    fetchAndCacheFavicon,
    batchFetchFavicons,
    selectionMode,
    selectedLinkIds,
    enterSelectionMode,
    exitSelectionMode,
    toggleLinkSelection,
    selectAllLinks,
    shiftSelectLinks,
    batchDeleteLinks,
    batchMoveLinks,
    batchPinLinks,
    restoreDeletedLinks,
    restoreMovedLinks,
    recordMove,
    deletedLinksCache,
    moveCache,
    lastSelectedLinkId,
    rangeSelectMode,
    rangeStartId,
    dropTargetLinkId,
    toggleRangeSelectMode,
    handleRangeSelectClick,
  }
})
