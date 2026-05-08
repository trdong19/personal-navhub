/**
 * 默认数据定义 - defaults
 *
 * 定义新用户或重置时的默认分类、书签和设置
 * 实际使用时分类和书签为空数组（由用户自行添加）
 */

import type { NavCategory, NavLink, UserSettings } from '@/types'

/** 默认分类列表（空，由用户自行创建） */
export const defaultCategories: NavCategory[] = []

/** 默认书签列表（空，由用户自行添加） */
export const defaultLinks: NavLink[] = []

/** 默认用户设置 */
export const defaultSettings: UserSettings = {
  /** 站点标题 */
  siteTitle: 'NavHub',
  /** 站点描述 */
  siteDescription: '个人导航中心',
  /** 主题设置 */
  theme: {
    /** 跟随系统深色模式 */
    mode: 'auto',
    /** 默认主色: 靛蓝色 */
    primaryColor: '#6366f1',
    /** 默认圆角 12px */
    borderRadius: 12,
    /** 无默认背景图 */
    backgroundImage: '',
    /** 无默认背景色 */
    backgroundColor: '',
    /** 开启背景遮罩 */
    bgOverlay: true,
  },
  /** 布局设置 */
  layout: {
    /** 列数自适应 */
    columns: 'auto',
    /** 卡片中等尺寸 */
    cardSize: 'medium',
    /** 显示书签描述 */
    showDescription: true,
    /** 非紧凑模式 */
    compactMode: false,
  },
  /** 搜索设置 */
  search: {
    /** 默认搜索引擎: Bing */
    defaultEngine: 'bing',
    /** 开启输入即时搜索 */
    searchOnType: true,
    /** 预置的搜索引擎列表 */
    engines: [
      { id: 'bing', name: 'Bing', shortcut: 'b', urlTemplate: 'https://www.bing.com/search?q={q}', icon: '🅱️' },
      { id: 'baidu', name: '百度', shortcut: 'bd', urlTemplate: 'https://www.baidu.com/s?wd={q}', icon: '🔎' },
      { id: 'github', name: 'GitHub', shortcut: 'gh', urlTemplate: 'https://github.com/search?q={q}', icon: '🐙' },
      { id: 'duckduckgo', name: 'DuckDuckGo', shortcut: 'ddg', urlTemplate: 'https://duckduckgo.com/?q={q}', icon: '🦆' },
    ],
  },
}
