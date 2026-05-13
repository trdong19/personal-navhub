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
    /** 默认圆角 16px，与 global.css 保持一致 */
    borderRadius: 16,
    /** 无默认背景图 */
    backgroundImage: '',
    /** 无默认背景色 */
    backgroundColor: '',
    /** 开启背景遮罩 */
    bgOverlay: true,
    /** 背景遮罩透明度默认值 */
    bgOverlayOpacity: 1,
    /** 背景模糊强度（0 为关闭） */
    bgBlur: 0,
    /** 搜索框自定义颜色 */
    searchColor: '',
    /** 搜索框透明度 */
    searchOpacity: 1,
    /** 书签卡片自定义颜色 */
    cardColor: '',
    /** 书签卡片透明度 */
    cardOpacity: 1,
    /** 字体颜色 */
    textColor: '',
    /** 字体透明度 */
    textOpacity: 1,
  },
  /** 布局设置 */
  layout: {
    /** 列数自适应 */
    columns: 'auto',
    /** 卡片中等尺寸 */
    cardSize: 'small',
    /** 显示书签描述 */
    showDescription: true,
    /** 工具栏按钮配置 */
    toolbar: [
      { id: 'theme', visible: true },
      { id: 'network', visible: true },
      { id: 'filter', visible: true },
      { id: 'add', visible: true },
      { id: 'expand', visible: true },
      { id: 'user', visible: true },
      { id: 'backTop', visible: true },
    ],
    /** 显示分类白框 */
    showCategoryCard: true,
  },
  /** 搜索设置 */
  search: {
    /** 默认搜索引擎: Bing */
    defaultEngine: 'bing',
    /** 开启输入即时搜索 */
    searchOnType: true,
    /** 预置的搜索引擎列表 */
    engines: [
      { id: 'bing', name: 'Bing', shortcut: 'b', urlTemplate: 'https://www.bing.com/search?q={q}' },
      { id: 'baidu', name: '百度', shortcut: 'bd', urlTemplate: 'https://www.baidu.com/s?wd={q}' },
      { id: 'github', name: 'GitHub', shortcut: 'gh', urlTemplate: 'https://github.com/search?q={q}' },
    ],
  },
}
