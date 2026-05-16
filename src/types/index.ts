/**
 * NavHub 项目所有 TypeScript 类型定义
 *
 * 包含: 网络类型、书签、分类、主题、布局、搜索引擎、访问记录、书签导入等接口
 */

// ==================== 基础枚举类型 ====================

/** 网络类型：内网、外网或隧道 */
export type NetworkType = 'intranet' | 'extranet' | 'tunnel'

/** 主题模式：浅色、深色、跟随系统 */
export type ThemeMode = 'light' | 'dark' | 'auto'

/** 卡片尺寸 */
export type CardSize = 'tiny' | 'small' | 'medium' | 'large'

/** 工具栏按钮 ID */
export type ToolbarButtonId = 'theme' | 'network' | 'add' | 'expand' | 'filter' | 'backTop' | 'user' | 'refreshIcons'

// ==================== 书签相关 ====================

/** 书签的 URL 地址（支持内网、外网和隧道三地址） */
export interface NavLinkUrl {
  /** 内网地址 */
  intranet?: string
  /** 外网地址 */
  extranet?: string
  /** 隧道地址 */
  tunnel?: string
}

/** 书签/导航链接对象 */
export interface NavLink {
  /** 唯一标识符 */
  id: string
  /** 书签标题 */
  title: string
  /** 图标名称（Lucide 图标名或 emoji） */
  icon: string
  /** 自定义图标 URL（data: URL 或 res:// 引用） */
  iconUrl?: string
  /** 书签描述 */
  description?: string
  /** 所属分类 ID */
  category: string
  /** 内网/外网/隧道 URL */
  urls: NavLinkUrl
  /** 标签数组（用于搜索和筛选） */
  tags: string[]
  /** 访问次数（用于热门排序） */
  accessCount: number
  /** 最后访问时间戳 */
  lastAccessed: number
  /** 是否置顶 */
  pinned: boolean
  /** 排序序号 */
  order: number
  /** 置顶区域排序序号（仅置顶时有意义） */
  pinnedOrder: number
  /** 创建时间戳 */
  createdAt: number
  /** 自定义卡片颜色（hex） */
  color?: string
  /** 自定义卡片透明度 0-1 */
  opacity?: number
  /** 自定义字体颜色（hex） */
  fontColor?: string
  /** 自定义字体颜色透明度 0-1 */
  fontOpacity?: number
  /** 自动缓存的网站图标 Data URL（base64，跨设备可用） */
  cachedIconData?: string
  /** favicon 获取是否已失败（避免重复请求） */
  faviconFetchFailed?: boolean
}

// ==================== 分类相关 ====================

/** 书签分类对象 */
export interface NavCategory {
  /** 唯一标识符 */
  id: string
  /** 分类名称 */
  name: string
  /** 分类图标（Lucide 图标名或 emoji） */
  icon: string
  /** 分类颜色（hex） */
  color: string
  /** 是否折叠 */
  collapsed: boolean
  /** 排序序号 */
  order: number
  /** 网络类型限定（可选，不设则内网外网都显示） */
  networkType?: NetworkType
  /** 父分类 ID（可选，用于实现子分类） */
  parentId?: string
}

// ==================== 主题设置相关 ====================

/** 主题设置 */
export interface ThemeSettings {
  /** 主题模式 */
  mode: ThemeMode
  /** 主题主色（hex） */
  primaryColor: string
  /** 圆角大小（px） */
  borderRadius: number
  /** 背景图 URL（远程 URL 或空） */
  backgroundImage?: string
  /** 背景色（hex，用于无背景图时的纯色背景） */
  backgroundColor?: string
  /** 毛玻璃效果开关 */
  glassEffect?: boolean
  /** 背景遮罩开关 */
  bgOverlay?: boolean
  /** 背景遮罩透明度 0-1 */
  bgOverlayOpacity?: number
  /** 背景模糊强度（px） */
  bgBlur?: number
  /** 搜索框自定义颜色（hex） */
  searchColor?: string
  /** 搜索框透明度 0-1 */
  searchOpacity?: number
  /** 书签卡片自定义颜色（hex） */
  cardColor?: string
  /** 书签卡片透明度 0-1 */
  cardOpacity?: number
  /** 自定义字体颜色（hex） */
  textColor?: string
  /** 自定义字体颜色透明度 0-1 */
  textOpacity?: number
}

// ==================== 布局设置相关 ====================

/** 布局设置 */
export interface LayoutSettings {
  /** 列数（数字或 'auto' 自适应） */
  columns: number | 'auto'
  /** 卡片尺寸 */
  cardSize: CardSize
  /** 是否显示书签描述 */
  showDescription: boolean
  /** 工具栏按钮配置（顺序和可见性） */
  toolbar: ToolbarButtonConfig[]
  /** 显示分类白框 */
  showCategoryCard: boolean
}

/** 工具栏按钮配置 */
export interface ToolbarButtonConfig {
  /** 按钮 ID */
  id: ToolbarButtonId
  /** 是否可见 */
  visible: boolean
}

// ==================== 搜索引擎相关 ====================

/** 搜索设置 */
export interface SearchSettings {
  /** 默认搜索引擎 ID */
  defaultEngine: string
  /** 搜索引擎列表 */
  engines: SearchEngine[]
  /** 输入时即时搜索开关 */
  searchOnType: boolean
}

/** 搜索引擎对象 */
export interface SearchEngine {
  /** 唯一标识符 */
  id: string
  /** 引擎名称 */
  name: string
  /** 快捷键前缀（如 'b' 代表 bing） */
  shortcut: string
  /** URL 模板，{q} 会被替换为搜索词 */
  urlTemplate: string
  /** 引擎图标（emoji） */
  icon?: string
}

// ==================== 用户设置 ====================

/** 用户设置（主对象，包含站点信息、主题、布局、搜索） */
export interface UserSettings {
  /** 站点标题（显示在浏览器标签页） */
  siteTitle: string
  /** 站点描述 */
  siteDescription: string
  /** 主题设置 */
  theme: ThemeSettings
  /** 布局设置 */
  layout: LayoutSettings
  /** 搜索设置 */
  search: SearchSettings
}

// ==================== 访问记录 ====================

/** 书签访问记录 */
export interface AccessRecord {
  /** 被访问的书签 ID */
  linkId: string
  /** 访问时间戳 */
  timestamp: number
  /** 访问时的网络类型 */
  networkType: NetworkType
}

// ==================== 书签导入相关 ====================

/** 导入的书签项 */
export interface BookmarkImportItem {
  /** 书签标题 */
  title: string
  /** 书签 URL */
  url: string
  /** 图标 */
  icon?: string
  /** 分类名 */
  category?: string
  /** 标签 */
  tags?: string[]
}

/** 导入的书签分类（支持嵌套子分类） */
export interface BookmarkImportCategory {
  /** 分类名称 */
  name: string
  /** 父分类 ID */
  parentId?: string
  /** 子分类列表 */
  children: BookmarkImportCategory[]
  /** 该分类下的书签 */
  items: BookmarkImportItem[]
}
