# 今日修改记录 - 2026-05-12

## 概述

本次主要新增了批量选择和撤回功能，优化了拖拽交互，删除了双列布局。

---

## 1. Shift 多选功能

**文件修改：**
- [src/stores/nav.ts](file:///d:/vscode/gg/src/stores/nav.ts)
- [src/components/navigation/NavCard.vue](file:///d:/vscode/gg/src/components/navigation/NavCard.vue)
- [src/components/navigation/CategorySection.vue](file:///d:/vscode/gg/src/components/navigation/CategorySection.vue)

**新增内容：**
- `lastSelectedLinkId` 状态 - 记录最后点击的链接 ID
- `shiftSelectLinks()` 方法 - Shift 范围选择核心逻辑
- `getCategoryLinkIds()` 方法 - 通过 DOM 查询获取视觉顺序的链接 ID 列表
- NavCard 新增 `linkIds` 和 `categoryId` props

---

## 2. ESC 取消选中

**文件修改：**
- [src/components/navigation/CategorySection.vue](file:///d:/vscode/gg/src/components/navigation/CategorySection.vue)

**新增内容：**
- `handleKeyDown()` 函数 - ESC 键监听
- 键盘事件挂载/卸载逻辑

---

## 3. 批量拖拽优化

**文件修改：**
- [src/components/navigation/CategorySection.vue](file:///d:/vscode/gg/src/components/navigation/CategorySection.vue)
- [src/components/navigation/NavCard.vue](file:///d:/vscode/gg/src/components/navigation/NavCard.vue)

**新增内容：**
- `dropTargetLinkId` 状态 - 记录批量拖拽的插入目标
- `handleDragOver()` 中批量模式提前返回，不触发排序动画
- `handleCategoryDrop()` 支持 `targetLinkId` 参数
- NavCard 新增 `watch(() => props.batchDragging)` 自动清理 `isDragOver`
- `batch-drop-target` CSS 样式

---

## 4. 移动撤回功能

**文件修改：**
- [src/stores/nav.ts](file:///d:/vscode/gg/src/stores/nav.ts)
- [src/components/layout/AppHeader.vue](file:///d:/vscode/gg/src/components/layout/AppHeader.vue)

**新增内容：**
- `MoveRecord` 接口 - `{ linkId, oldCategory, oldOrder }`
- `moveCache` 状态 - 移动撤回缓存
- `recordMove()` 方法 - 单独拖拽前记录原始位置
- `restoreMovedLinks()` 方法 - 撤回移动
- `batchMoveLinks()` 方法支持 `targetLinkId` 参数，并自动记录撤回数据
- AppHeader 新增蓝色「撤回移动」按钮

---

## 5. 悬浮工具栏自动展开优化

**文件修改：**
- [src/App.vue](file:///d:/vscode/gg/src/App.vue)

**修改内容：**
- 新增 `hasSubmenuOpen` 检测（FAB、用户菜单、筛选面板打开状态）
- 鼠标离开延迟从 0 改为 300ms
- `handleMouseMove()` 逻辑更新

---

## 6. 删除双列布局

**文件修改：**
- [src/components/navigation/CategorySection.vue](file:///d:/vscode/gg/src/components/navigation/CategorySection.vue)
  - 删除 `isDoubleColumn` 计算属性
  - 删除 `double-column` class 绑定
  - 删除 `.category-list.double-column` CSS
  - 更新注释：删除「单列和双列都生效」

- [src/components/settings/SettingsPanel.vue](file:///d:/vscode/gg/src/components/settings/SettingsPanel.vue)
  - 删除「分类布局」切换按钮 UI

- [src/stores/settings.ts](file:///d:/vscode/gg/src/stores/settings.ts)
  - 删除 `setCategoryLayout` 函数
  - 删除 `CategoryLayout` import

- [src/types/index.ts](file:///d:/vscode/gg/src/types/index.ts)
  - 删除 `CategoryLayout` 类型定义
  - 从 `LayoutSettings` 接口删除 `categoryLayout` 字段

- [src/utils/defaults.ts](file:///d:/vscode/gg/src/utils/defaults.ts)
  - 从 layout 默认值删除 `categoryLayout: 'single'`

---

## nav.ts 新增导出（return 对象中）

```typescript
return {
  // ... 原有导出

  // ===== 新增 =====
  lastSelectedLinkId,        // [L167]
  shiftSelectLinks,          // [L191-L213]
  moveCache,                 // [L253]
  recordMove,                // [L290-L295]
  restoreMovedLinks,         // [L275-L288]
  batchMoveLinks,            // [L297-L334]
}
```
