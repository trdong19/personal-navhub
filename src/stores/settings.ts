/**
 * 设置 Pinia Store - useSettingsStore
 *
 * 核心职责:
 * 1. 管理用户设置（站点信息、主题、布局、搜索引擎）
 * 2. applyTheme() 是核心函数，将所有主题设置应用到 DOM（CSS 变量 + class 切换）
 * 3. 背景图管理：支持 URL 和本地上传，大图存 IndexedDB，用 blob: URL 显示
 * 4. 每次设置变更后自动保存到 localStorage 并触发同步推送
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { UserSettings, ThemeMode, SearchEngine, ToolbarButtonId, ToolbarButtonConfig, CategoryLayout } from '@/types'
import { storageGet, storageSet, storageRemove } from '@/utils/storage'
import { defaultSettings } from '@/utils/defaults'
import { useAuth } from '@/composables/useAuth'
import { saveBgImage, deleteBgImage, getBgImageBlob } from '@/utils/fileStore'

// ==================== 颜色工具函数 ====================

/**
 * 将十六进制颜色转为 RGB 数组
 * @param hex - 颜色值，如 '#ff0000'
 * @returns [r, g, b] 数组或 null（解析失败时）
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return null
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

/**
 * 计算颜色的相对亮度（WCAG 标准）
 * 用于判断背景色深浅，从而决定文字用深色还是浅色
 * @param r - 红色分量 0-255
 * @param g - 绿色分量 0-255
 * @param b - 蓝色分量 0-255
 * @returns 亮度值 0-1，< 0.3 视为深色
 */
function luminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
}

/**
 * 颜色混合函数：将 hex 颜色向目标颜色混合
 * 用于自动生成卡片、hover、边框等衍生颜色
 * @param hex - 原始颜色
 * @param amount - 混合比例 0-1（越大越接近目标颜色）
 * @param toward - 目标颜色，默认白色
 * @returns 混合后的 hex 颜色字符串
 */
function mixColor(hex: string, amount: number, toward: string = '#ffffff'): string {
  const a = hexToRgb(hex)
  const b = hexToRgb(toward)
  if (!a || !b) return hex
  const r = Math.round(a[0] + (b[0] - a[0]) * amount)
  const g = Math.round(a[1] + (b[1] - a[1]) * amount)
  const bl = Math.round(a[2] + (b[2] - a[2]) * amount)
  return `#${[r, g, bl].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

// ==================== Store 定义 ====================

export const useSettingsStore = defineStore('settings', () => {
  /** 用户设置（从 localStorage 读取，无则用默认值） */
  const settings = ref<UserSettings>(storageGet('userSettings', defaultSettings))

  /**
   * 本地背景图的显示 URL
   * - 如果是本地上传的大图，值为 'blob:...'（由 URL.createObjectURL 生成）
   * - 如果是远程 URL，值为空（settings.theme.backgroundImage 存 URL）
   * - 注意: blob: URL 很短，不会触发 Chrome 的 2MB data URL 限制
   */
  const localBgImage = ref<string>(localStorage.getItem('nav_local_bg_image') || '')

  /** 是否为深色模式 */
  const isDark = ref(false)

  /** 获取防抖同步推送函数 */
  const { debouncePush } = useAuth()

  /**
   * 释放旧的 blob: URL（避免内存泄漏）
   * 在设置新背景图前调用
   */
  function revokeBgUrl() {
    if (localBgImage.value && localBgImage.value.startsWith('blob:')) {
      URL.revokeObjectURL(localBgImage.value)
    }
  }

  /**
   * 保存设置到 localStorage 并触发自动同步
   */
  async function save() {
    const copy = { ...settings.value }
    storageSet('userSettings', copy)
    try { localStorage.setItem('nav_local_bg_image', localBgImage.value || '') } catch {}
    debouncePush()
  }

  /**
   * 核心函数: 应用主题到 DOM
   *
   * 所有主题变化最终通过此函数生效，它会:
   * 1. 设置深色/浅色模式（html.dark class）
   * 2. 设置 CSS 变量 --primary、--radius
   * 3. 设置背景图 --bg-image 和 html.has-bg class
   * 4. 根据背景色自动生成卡片、文字、边框等衍生颜色
   * 5. 设置毛玻璃效果 --bg-blur 和 html.has-glass class
   * 6. 设置搜索框和书签卡片的自定义颜色（rgba 格式）
   * 7. 设置页面标题
   */
  function applyTheme() {
    // 处理深色/浅色模式
    const mode = settings.value.theme.mode
    let dark = false
    if (mode === 'dark') {
      dark = true
    } else if (mode === 'auto') {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    isDark.value = dark
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.setProperty('--primary', settings.value.theme.primaryColor)
    document.documentElement.style.setProperty('--radius', settings.value.theme.borderRadius + 'px')

    // 处理背景图
    const bg = settings.value.theme.backgroundImage || localBgImage.value
    const bgColor = settings.value.theme.backgroundColor
    const glass = settings.value.theme.glassEffect

    if (bg) {
      document.documentElement.style.setProperty('--bg-image', `url(${bg})`)
      document.documentElement.classList.add('has-bg')
    } else {
      document.documentElement.style.removeProperty('--bg-image')
      document.documentElement.classList.remove('has-bg')
    }

    // 处理背景色：根据背景色深浅自动调整衍生颜色
    if (bgColor) {
      document.documentElement.style.setProperty('--bg', bgColor)
      document.documentElement.classList.add('has-bg-color')
      const rgb = hexToRgb(bgColor)
      if (rgb) {
        const lum = luminance(...rgb)
        const isDarkBg = lum < 0.3
        if (isDarkBg) {
          // 深色背景：衍生颜色向白色偏移，文字用浅色
          document.documentElement.style.setProperty('--bg-card', mixColor(bgColor, 0.12))
          document.documentElement.style.setProperty('--bg-hover', mixColor(bgColor, 0.2))
          document.documentElement.style.setProperty('--bg-secondary', mixColor(bgColor, 0.08))
          document.documentElement.style.setProperty('--text', '#f1f5f9')
          document.documentElement.style.setProperty('--text-secondary', '#94a3b8')
          document.documentElement.style.setProperty('--text-muted', '#64748b')
          document.documentElement.style.setProperty('--border', mixColor(bgColor, 0.15))
          document.documentElement.style.setProperty('--shadow', '0 1px 3px rgba(0,0,0,0.3)')
          document.documentElement.style.setProperty('--shadow-lg', '0 10px 25px rgba(0,0,0,0.3)')
        } else {
          // 浅色背景：衍生颜色向黑色偏移，文字用深色
          document.documentElement.style.setProperty('--bg-card', mixColor(bgColor, 0.1, '#ffffff'))
          document.documentElement.style.setProperty('--bg-hover', mixColor(bgColor, 0.05, '#000000'))
          document.documentElement.style.setProperty('--bg-secondary', mixColor(bgColor, 0.06, '#000000'))
          document.documentElement.style.setProperty('--text', '#0f172a')
          document.documentElement.style.setProperty('--text-secondary', '#64748b')
          document.documentElement.style.setProperty('--text-muted', '#94a3b8')
          document.documentElement.style.setProperty('--border', mixColor(bgColor, 0.08, '#000000'))
          document.documentElement.style.setProperty('--shadow', '0 1px 3px rgba(0,0,0,0.1)')
          document.documentElement.style.setProperty('--shadow-lg', '0 10px 25px rgba(0,0,0,0.1)')
        }
      }
    } else {
      // 无背景色：清除所有自定义 CSS 变量
      document.documentElement.style.removeProperty('--bg')
      document.documentElement.classList.remove('has-bg-color')
      const varNames = ['--bg-card', '--bg-hover', '--bg-secondary', '--text', '--text-secondary', '--text-muted', '--border', '--shadow', '--shadow-lg']
      varNames.forEach(v => document.documentElement.style.removeProperty(v))
    }

    // 毛玻璃效果开关
    document.documentElement.classList.toggle('has-glass', !!glass)
    // 背景遮罩开关
    document.documentElement.classList.toggle('no-bg-overlay', settings.value.theme.bgOverlay === false)
    // 页面标题
    document.title = settings.value.siteTitle || 'NavHub'

    // 背景遮罩透明度
    const bgOverlayOpacity = settings.value.theme.bgOverlayOpacity
    document.documentElement.style.setProperty('--bg-overlay-opacity', String(bgOverlayOpacity ?? 0.12))

    // 背景模糊强度
    const bgBlur = settings.value.theme.bgBlur
    if (bgBlur !== undefined && bgBlur > 0) {
      document.documentElement.style.setProperty('--bg-blur', bgBlur + 'px')
    } else {
      document.documentElement.style.removeProperty('--bg-blur')
    }

    // 搜索框自定义颜色（rgba 格式，支持透明度）
    const searchColor = settings.value.theme.searchColor
    const searchOpacity = settings.value.theme.searchOpacity ?? 1
    if (searchColor) {
      const rgb = hexToRgb(searchColor)
      if (rgb) {
        document.documentElement.style.setProperty('--search-bg', `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${searchOpacity})`)
      } else {
        document.documentElement.style.setProperty('--search-bg', searchColor)
      }
      document.documentElement.classList.add('has-search-color')
    } else {
      document.documentElement.style.removeProperty('--search-bg')
      document.documentElement.classList.remove('has-search-color')
    }

    // 书签卡片自定义颜色（rgba 格式，支持透明度）
    const cardColor = settings.value.theme.cardColor
    const cardOpacity = settings.value.theme.cardOpacity ?? 1
    if (cardColor) {
      const rgb = hexToRgb(cardColor)
      if (rgb) {
        document.documentElement.style.setProperty('--card-bg', `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${cardOpacity})`)
      } else {
        document.documentElement.style.setProperty('--card-bg', cardColor)
      }
      document.documentElement.classList.add('has-card-color')
    } else {
      document.documentElement.style.removeProperty('--card-bg')
      document.documentElement.classList.remove('has-card-color')
    }

    // 自定义字体颜色 + 透明度
    const textColor = settings.value.theme.textColor
    const textOpacity = settings.value.theme.textOpacity ?? 1
    if (textColor || textOpacity < 1) {
      let finalColor: string
      if (textColor) {
        const rgb = hexToRgb(textColor)
        if (rgb) {
          finalColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${textOpacity})`
        } else {
          finalColor = textColor
        }
      } else {
        const fallback = dark ? '#f1f5f9' : '#0f172a'
        const rgb = hexToRgb(fallback)!
        finalColor = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${textOpacity})`
      }
      document.documentElement.style.setProperty('--text-color-custom', finalColor)
      document.documentElement.classList.add('has-text-color')
    } else {
      document.documentElement.style.removeProperty('--text-color-custom')
      document.documentElement.classList.remove('has-text-color')
    }
  }

  // ==================== 设置修改方法 ====================

  /** 设置站点标题 */
  function setSiteTitle(title: string) {
    settings.value.siteTitle = title
    save()
    applyTheme()
  }

  /** 设置站点描述 */
  function setSiteDescription(desc: string) {
    settings.value.siteDescription = desc
    save()
  }

  /** 设置主题模式（light / dark / auto） */
  function setThemeMode(mode: ThemeMode) {
    settings.value.theme.mode = mode
    save()
    applyTheme()
  }

  /** 设置主题主色 */
  function setPrimaryColor(color: string) {
    settings.value.theme.primaryColor = color
    save()
    applyTheme()
  }

  /** 设置圆角大小 */
  function setBorderRadius(radius: number) {
    settings.value.theme.borderRadius = radius
    save()
    applyTheme()
  }

  /**
   * 设置背景图
   * - 传入 data: URL（本地上传）→ 存入 IndexedDB，用 blob: URL 显示
   * - 传入空字符串 → 删除背景图
   * - 传入 http(s): URL → 存为远程 URL
   *
   * 关键点：大图用 blob: URL 显示（很短），避免 Chrome 的 2MB data URL 限制
   */
  async function setBackgroundImage(url: string) {
    revokeBgUrl()
    if (url && url.startsWith('data:')) {
      // 本地上传的图片：存入 IndexedDB
      try {
        await saveBgImage(url)
      } catch {}
      try {
        const blob = await getBgImageBlob()
        if (blob) {
          // 用 blob: URL 显示（很短，不会被 Chrome 限制）
          localBgImage.value = URL.createObjectURL(blob)
        } else {
          localBgImage.value = url
        }
      } catch {
        localBgImage.value = url
      }
      settings.value.theme.backgroundImage = ''
    } else if (url === '') {
      // 删除背景图
      localBgImage.value = ''
      settings.value.theme.backgroundImage = ''
      try { await deleteBgImage() } catch {}
    } else {
      // 远程 URL：直接存储 URL
      localBgImage.value = ''
      settings.value.theme.backgroundImage = url
      try { await deleteBgImage() } catch {}
    }
    save()
    applyTheme()
  }

  /** 设置背景色 */
  function setBackgroundColor(color: string) {
    settings.value.theme.backgroundColor = color
    save()
    applyTheme()
  }

  /** 切换毛玻璃效果 */
  function toggleGlassEffect() {
    settings.value.theme.glassEffect = !settings.value.theme.glassEffect
    save()
    applyTheme()
  }

  /** 切换背景遮罩开关 */
  function toggleBgOverlay() {
    settings.value.theme.bgOverlay = settings.value.theme.bgOverlay === false ? true : false
    save()
    applyTheme()
  }

  /** 设置背景遮罩透明度 */
  function setBgOverlayOpacity(value: number) {
    settings.value.theme.bgOverlayOpacity = value
    save()
    applyTheme()
  }

  /** 设置背景模糊强度 */
  function setBgBlur(value: number) {
    settings.value.theme.bgBlur = value
    save()
    applyTheme()
  }

  /** 设置搜索框自定义颜色 */
  function setSearchColor(color: string) {
    settings.value.theme.searchColor = color
    save()
    applyTheme()
  }

  /** 设置搜索框透明度 */
  function setSearchOpacity(value: number) {
    settings.value.theme.searchOpacity = value
    save()
    applyTheme()
  }

  /** 设置书签卡片自定义颜色 */
  function setCardColor(color: string) {
    settings.value.theme.cardColor = color
    save()
    applyTheme()
  }

  /** 设置书签卡片透明度 */
  function setCardOpacity(value: number) {
    settings.value.theme.cardOpacity = value
    save()
    applyTheme()
  }

  /** 设置字体颜色（应用到所有文字元素） */
  function setTextColor(color: string) {
    settings.value.theme.textColor = color
    save()
    applyTheme()
  }

  /** 设置字体颜色透明度 */
  function setTextOpacity(value: number) {
    settings.value.theme.textOpacity = value
    save()
    applyTheme()
  }

  /** 获取工具栏配置（确保旧用户有默认值） */
  function getToolbar(): ToolbarButtonConfig[] {
    if (!settings.value.layout.toolbar) {
      settings.value.layout.toolbar = [
        { id: 'theme', visible: true },
        { id: 'network', visible: true },
        { id: 'add', visible: true },
        { id: 'expand', visible: true },
        { id: 'user', visible: true },
        { id: 'filter', visible: true },
        { id: 'backTop', visible: true },
      ]
    }
    return settings.value.layout.toolbar
  }

  /** 切换工具栏按钮可见性 */
  function toggleToolbarButton(id: ToolbarButtonId) {
    const toolbar = getToolbar()
    const btn = toolbar.find(b => b.id === id)
    if (btn) {
      btn.visible = !btn.visible
      save()
    }
  }

  /** 重新排序工具栏按钮 */
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
    save()
  }

  /** 设置分类布局模式（单列 / 双列） */
  function setCategoryLayout(layout: CategoryLayout) {
    settings.value.layout.categoryLayout = layout
    save()
  }

  /** 设置卡片尺寸（small / medium / large） */
  function setCardSize(size: UserSettings['layout']['cardSize']) {
    settings.value.layout.cardSize = size
    save()
  }

  /** 设置列数（数字或 'auto' 自适应） */
  function setColumns(columns: number | 'auto') {
    settings.value.layout.columns = columns
    save()
  }

  /** 切换是否显示书签描述 */
  function toggleDescription() {
    settings.value.layout.showDescription = !settings.value.layout.showDescription
    save()
  }

  /** 切换紧凑模式 */
  function toggleCompact() {
    settings.value.layout.compactMode = !settings.value.layout.compactMode
    save()
  }

  /** 设置默认搜索引擎 */
  function setDefaultEngine(id: string) {
    settings.value.search.defaultEngine = id
    save()
  }

  /** 添加自定义搜索引擎 */
  function addEngine(engine: Omit<SearchEngine, 'id'>) {
    const id = 'engine_' + Date.now()
    settings.value.search.engines.push({ ...engine, id })
    save()
  }

  /**
   * 删除搜索引擎
   * 至少保留一个引擎；如果删的是当前默认引擎，自动切换到第一个
   */
  function removeEngine(id: string) {
    const engines = settings.value.search.engines
    if (engines.length <= 1) return
    const idx = engines.findIndex(e => e.id === id)
    if (idx === -1) return
    engines.splice(idx, 1)
    if (settings.value.search.defaultEngine === id) {
      settings.value.search.defaultEngine = engines[0].id
    }
    save()
  }

  /** 更新搜索引擎信息 */
  function updateEngine(id: string, data: Partial<Omit<SearchEngine, 'id'>>) {
    const engine = settings.value.search.engines.find(e => e.id === id)
    if (!engine) return
    Object.assign(engine, data)
    save()
  }

  /** 基础设置重置：仅重置设置配置，保留书签数据和背景图 */
  function resetSettingsOnly() {
    revokeBgUrl()
    settings.value = { ...defaultSettings }
    localBgImage.value = ''
    localStorage.removeItem('nav_local_bg_image')
    try { deleteBgImage() } catch {}
    save()
    applyTheme()
  }

  /** 全部重置：重置所有设置并删除所有书签数据，恢复初始状态 */
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
    applyTheme()
  }

  // ==================== 计算属性 ====================

  /** 当前选中的搜索引擎 */
  const currentEngine = computed(() =>
    settings.value.search.engines.find(e => e.id === settings.value.search.defaultEngine) || settings.value.search.engines[0]
  )

  /** 实际生效的背景图 URL（远程 URL 或本地 blob: URL） */
  const effectiveBgImage = computed(() => settings.value.theme.backgroundImage || localBgImage.value || '')

  // ==================== 初始化 ====================

  /**
   * 初始化主题系统
   * 1. 首次应用主题
   * 2. 监听系统深色模式变化（auto 模式下自动切换）
   * 3. 从 IndexedDB 加载背景图，生成 blob: URL 用于显示
   */
  function init() {
    applyTheme()
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (settings.value.theme.mode === 'auto') applyTheme()
    })
    getBgImageBlob().then(blob => {
      if (blob) {
        revokeBgUrl()
        localBgImage.value = URL.createObjectURL(blob)
        applyTheme()
      }
    }).catch(() => {
      // IndexedDB 失败时回退到 localStorage 中的缓存
      const fallback = localStorage.getItem('nav_local_bg_image') || ''
      if (fallback) {
        localBgImage.value = fallback
        applyTheme()
      }
    })
  }

  /**
   * 从 localStorage 和 IndexedDB 重新加载设置（pull 后调用）
   * 确保同步拉取的数据能立即反映到 UI
   */
  async function reloadFromStorage() {
    settings.value = storageGet('userSettings', defaultSettings)
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
    isDark,
    currentEngine,
    effectiveBgImage,
    save,
    init,
    applyTheme,
    reloadFromStorage,
    setSiteTitle,
    setSiteDescription,
    setThemeMode,
    setPrimaryColor,
    setBorderRadius,
    setBackgroundImage,
    setBackgroundColor,
    toggleGlassEffect,
    toggleBgOverlay,
    setBgOverlayOpacity,
    setBgBlur,
    setSearchColor,
    setSearchOpacity,
    setCardColor,
    setCardOpacity,
    setTextColor,
    setTextOpacity,
    getToolbar,
    toggleToolbarButton,
    reorderToolbar,
    setCategoryLayout,
    setCardSize,
    setColumns,
    toggleDescription,
    toggleCompact,
    setDefaultEngine,
    addEngine,
    removeEngine,
    updateEngine,
    resetSettingsOnly,
    resetAll,
  }
})
