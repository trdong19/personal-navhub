/**
 * 设置 Pinia Store - useSettingsStore
 *
 * 核心职责:
 * 1. 管理用户设置（站点信息、主题模式、布局、搜索引擎）
 * 2. applyTheme() 将主题设置应用到 DOM（深浅模式 + 背景图 + 毛玻璃）
 * 3. 背景图管理：支持 URL 和本地上传，大图存 IndexedDB，用 blob: URL 显示
 * 4. 每次设置变更后自动保存到 localStorage 并触发同步推送
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserSettings, ThemeMode, SearchEngine, ToolbarButtonId, ToolbarButtonConfig } from '@/types'
import { storageGet, storageSet, storageRemove } from '@/utils/storage'
import { defaultSettings } from '@/utils/defaults'
import { useAuth } from '@/composables/useAuth'
import { saveBgImage, deleteBgImage, getBgImageBlob } from '@/utils/fileStore'

// ==================== Store 定义 ====================

export const useSettingsStore = defineStore('settings', () => {
  /**
   * 深度合并：用默认值填充 localStorage 中缺失的字段
   */
  function deepMergeWithDefaults(stored: any, defaults: any): UserSettings {
    if (!stored || typeof stored !== 'object') return { ...defaults }
    const result = { ...defaults }
    for (const key of Object.keys(defaults)) {
      if (key in stored && stored[key] != null) {
        if (typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
          result[key] = deepMergeWithDefaults(stored[key], defaults[key])
        } else {
          result[key] = stored[key]
        }
      }
    }
    return result as UserSettings
  }

  const settings = ref<UserSettings>(deepMergeWithDefaults(storageGet('userSettings', {}), defaultSettings))
  const localBgImage = ref<string>(localStorage.getItem('nav_local_bg_image') || '')
  const isDark = ref(false)
  const { incrementalSync } = useAuth()

  function revokeBgUrl() {
    if (localBgImage.value && localBgImage.value.startsWith('blob:')) {
      URL.revokeObjectURL(localBgImage.value)
    }
  }

  function save() {
    const copy = { ...settings.value }
    storageSet('userSettings', copy)
    try { localStorage.setItem('nav_local_bg_image', localBgImage.value || '') } catch {}
  }

  function saveAndSync() {
    save()
    incrementalSync('update-settings', { settings: settings.value }).catch(() => {})
  }

  // ==================== 快照机制 ====================

  let snapshot: any = null
  let snapshotLocalBgImage = ''

  function takeSnapshot() {
    snapshot = JSON.parse(JSON.stringify(settings.value))
    snapshotLocalBgImage = localBgImage.value
  }

  function revertSettings() {
    if (!snapshot) return
    revokeBgUrl()
    settings.value = JSON.parse(JSON.stringify(snapshot))
    localBgImage.value = snapshotLocalBgImage
    try { localStorage.setItem('nav_local_bg_image', snapshotLocalBgImage || '') } catch {}
    applyTheme()
  }

  function hasChanges(): boolean {
    if (!snapshot) return false
    return JSON.stringify(settings.value) !== JSON.stringify(snapshot)
  }

  /**
   * 核心函数: 应用主题到 DOM
   *
   * 动森风格固定设计 token，仅支持:
   * 1. 深色/浅色模式切换
   * 2. 背景图
   * 3. 毛玻璃/遮罩/模糊
   * 4. 页面标题
   */
  function applyTheme() {
    const theme = settings.value?.theme ?? defaultSettings.theme
    const mode = theme.mode ?? 'auto'
    let dark = false
    if (mode === 'dark') {
      dark = true
    } else if (mode === 'auto') {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    isDark.value = dark
    document.documentElement.classList.toggle('dark', dark)

    // 背景图
    const bg = theme.backgroundImage || localBgImage.value
    if (bg) {
      document.documentElement.style.setProperty('--bg-image', `url(${bg})`)
      document.documentElement.classList.add('has-bg')
    } else {
      document.documentElement.style.removeProperty('--bg-image')
      document.documentElement.classList.remove('has-bg')
    }

    // 毛玻璃效果
    document.documentElement.classList.toggle('has-glass', !!theme.glassEffect)
    // 背景遮罩
    document.documentElement.classList.toggle('no-bg-overlay', theme.bgOverlay === false)
    // 背景遮罩透明度
    document.documentElement.style.setProperty('--bg-overlay-opacity', String(theme.bgOverlayOpacity ?? 1))
    // 背景模糊
    if (theme.bgBlur !== undefined && theme.bgBlur > 0) {
      document.documentElement.style.setProperty('--bg-blur', theme.bgBlur + 'px')
    } else {
      document.documentElement.style.removeProperty('--bg-blur')
    }
    // 页面标题
    document.title = settings.value.siteTitle || 'NavHub'
  }

  // ==================== 设置修改方法 ====================

  function setSiteTitle(title: string) {
    settings.value.siteTitle = title
    applyTheme()
  }

  function setSiteDescription(desc: string) {
    settings.value.siteDescription = desc
  }

  function setThemeMode(mode: ThemeMode) {
    settings.value.theme.mode = mode
    applyTheme()
  }

  async function setBackgroundImage(url: string) {
    revokeBgUrl()
    if (url && url.startsWith('data:')) {
      try { await saveBgImage(url) } catch {}
      try {
        const blob = await getBgImageBlob()
        if (blob) {
          localBgImage.value = URL.createObjectURL(blob)
        } else {
          localBgImage.value = url
        }
      } catch {
        localBgImage.value = url
      }
      settings.value.theme.backgroundImage = ''
    } else if (url === '') {
      localBgImage.value = ''
      settings.value.theme.backgroundImage = ''
      try { await deleteBgImage() } catch {}
    } else {
      localBgImage.value = ''
      settings.value.theme.backgroundImage = url
      try { await deleteBgImage() } catch {}
    }
    if (url && url.startsWith('data:')) {
      incrementalSync('push-resources', { resources: { bg: url } }).catch(() => {})
    } else if (url === '') {
      incrementalSync('delete-resource', { resourceId: 'bg' }).catch(() => {})
    }
  }

  function toggleGlassEffect() {
    settings.value.theme.glassEffect = !settings.value.theme.glassEffect
    applyTheme()
  }

  function toggleBgOverlay() {
    settings.value.theme.bgOverlay = settings.value.theme.bgOverlay === false ? true : false
    applyTheme()
  }

  function setBgOverlayOpacity(value: number) {
    settings.value.theme.bgOverlayOpacity = value
    applyTheme()
  }

  function setBgBlur(value: number) {
    settings.value.theme.bgBlur = value
    applyTheme()
  }

  function getToolbar(): ToolbarButtonConfig[] {
    const defaults: ToolbarButtonConfig[] = [
      { id: 'theme', visible: true },
      { id: 'network', visible: true },
      { id: 'filter', visible: true },
      { id: 'add', visible: true },
      { id: 'expand', visible: true },
      { id: 'refreshIcons', visible: true },
      { id: 'user', visible: true },
      { id: 'backTop', visible: true },
    ]
    if (!settings.value.layout.toolbar) {
      settings.value.layout.toolbar = defaults
    } else {
      const existingIds = new Set(settings.value.layout.toolbar.map(b => b.id))
      for (const btn of defaults) {
        if (!existingIds.has(btn.id)) {
          settings.value.layout.toolbar.push(btn)
        }
      }
    }
    return settings.value.layout.toolbar
  }

  function toggleToolbarButton(id: ToolbarButtonId) {
    const toolbar = getToolbar()
    const btn = toolbar.find(b => b.id === id)
    if (btn) {
      btn.visible = !btn.visible
      save()
    }
  }

  function reorderToolbar(orderedIds: ToolbarButtonId[]) {
    const toolbar = getToolbar()
    const reordered: ToolbarButtonConfig[] = []
    for (const id of orderedIds) {
      const existing = toolbar.find(b => b.id === id)
      if (existing) {
        reordered.push(existing)
      } else {
        reordered.push({ id, visible: true })
      }
    }
    settings.value.layout.toolbar = reordered
  }

  function setCardSize(size: UserSettings['layout']['cardSize']) {
    settings.value.layout.cardSize = size
  }

  function setColumns(columns: number | 'auto') {
    settings.value.layout.columns = columns
  }

  function toggleDescription() {
    settings.value.layout.showDescription = !settings.value.layout.showDescription
  }

  function toggleCategoryCard() {
    settings.value.layout.showCategoryCard = !settings.value.layout.showCategoryCard
  }

  function setDefaultEngine(id: string) {
    settings.value.search.defaultEngine = id
  }

  function addEngine(engine: Omit<SearchEngine, 'id'>) {
    const id = 'engine_' + Date.now()
    settings.value.search.engines.push({ ...engine, id })
  }

  function removeEngine(id: string) {
    const engines = settings.value.search.engines
    if (engines.length <= 1) return
    const idx = engines.findIndex(e => e.id === id)
    if (idx === -1) return
    engines.splice(idx, 1)
    if (settings.value.search.defaultEngine === id) {
      settings.value.search.defaultEngine = engines[0].id
    }
  }

  function updateEngine(id: string, data: Partial<Omit<SearchEngine, 'id'>>) {
    const engine = settings.value.search.engines.find(e => e.id === id)
    if (!engine) return
    Object.assign(engine, data)
  }

  function resetSettingsOnly() {
    revokeBgUrl()
    settings.value = { ...defaultSettings }
    localBgImage.value = ''
    localStorage.removeItem('nav_local_bg_image')
    try { deleteBgImage() } catch {}
    saveAndSync()
    applyTheme()
  }

  function resetAll() {
    revokeBgUrl()
    settings.value = { ...defaultSettings }
    localBgImage.value = ''
    localStorage.removeItem('nav_local_bg_image')
    storageRemove('navLinks')
    storageRemove('navCategories')
    storageRemove('accessRecords')
    try { deleteBgImage() } catch {}
    save()
    incrementalSync('import-data', { settings: settings.value, links: [], categories: [], accessRecords: [] }).catch(() => {})
    applyTheme()
  }

  // ==================== 计算属性 ====================

  const currentEngine = computed(() =>
    settings.value.search.engines.find(e => e.id === settings.value.search.defaultEngine) || settings.value.search.engines[0]
  )

  const effectiveBgImage = computed(() => settings.value.theme.backgroundImage || localBgImage.value || '')

  // ==================== 初始化 ====================

  function init() {
    applyTheme()
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (settings.value?.theme?.mode === 'auto') applyTheme()
    })
    getBgImageBlob().then(blob => {
      if (blob) {
        revokeBgUrl()
        localBgImage.value = URL.createObjectURL(blob)
        applyTheme()
      }
    }).catch(() => {
      const fallback = localStorage.getItem('nav_local_bg_image') || ''
      if (fallback) {
        localBgImage.value = fallback
        applyTheme()
      }
    })
  }

  async function reloadFromStorage() {
    settings.value = deepMergeWithDefaults(storageGet('userSettings', {}), defaultSettings)
    try {
      const blob = await getBgImageBlob()
      revokeBgUrl()
      localBgImage.value = blob ? URL.createObjectURL(blob) : ''
    } catch {
      localBgImage.value = localStorage.getItem('nav_local_bg_image') || ''
    }
    applyTheme()
  }

  // ==================== 导出 ====================

  return {
    settings,
    currentEngine,
    effectiveBgImage,
    init,
    applyTheme,
    reloadFromStorage,
    save,
    saveAndSync,
    takeSnapshot,
    revertSettings,
    hasChanges,
    setThemeMode,
    setBackgroundImage,
    toggleGlassEffect,
    toggleBgOverlay,
    setBgOverlayOpacity,
    setBgBlur,
    getToolbar,
    toggleToolbarButton,
    reorderToolbar,
    setCardSize,
    toggleDescription,
    toggleCategoryCard,
    setDefaultEngine,
    addEngine,
    removeEngine,
    updateEngine,
    resetSettingsOnly,
    resetAll,
  }
})
