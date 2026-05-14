<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import type { NavCategory, NavLink } from '@/types'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { useNetworkStore } from '@/stores/network'
import NavCard from './NavCard.vue'
import { useFlipSort } from '@/composables/useFlipSort'
import { useToast } from '@/composables/useToast'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ContextMenu from '@/components/common/ContextMenu.vue'
import type { ContextMenuItem } from '@/components/common/ContextMenu.vue'

const emit = defineEmits<{
  'open-editor': [id: string | null, categoryId?: string]
}>()

const navStore = useNavStore()
const settingsStore = useSettingsStore()
const networkStore = useNetworkStore()
const toast = useToast()
const draggingId = ref<string | null>(null)
const categoryListRef = ref<HTMLElement | null>(null)
const { recordPositions, animateFlip } = useFlipSort(categoryListRef)
const { recordPositions: recordCategoryPositions, animateFlip: animateCategoryFlip } = useFlipSort(categoryListRef, '.category-section', 'categoryId')

// 桌面端拖拽滚动相关
let desktopDragging = false
let desktopDragScrollRaf: number | null = null
let currentMouseY = 0
let currentMouseX = 0
let isScrolling = false
const dropTargetCategory = ref<string | null>(null)

const draggingCategoryId = ref<string | null>(null)
const categoryDropTarget = ref<string | null>(null)
const isBatchDragging = ref(false)
// dropTargetLinkId 现在使用 navStore.dropTargetLinkId

function clearTimer(timer: number) { clearTimeout(timer) }

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && navStore.selectionMode) {
    navStore.exitSelectionMode()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('dragover', handleDesktopDragOver)
  document.addEventListener('dragend', handleDesktopDragEnd)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('dragover', handleDesktopDragOver)
  document.removeEventListener('dragend', handleDesktopDragEnd)
  if (desktopDragScrollRaf) {
    cancelAnimationFrame(desktopDragScrollRaf)
  }
})

function handleDesktopDragOver(e: DragEvent) {
  if (!draggingId.value && !draggingCategoryId.value) return
  
  currentMouseX = e.clientX
  currentMouseY = e.clientY
  if (!desktopDragging) {
    startDesktopScroll()
  }
}

function startDesktopScroll() {
  desktopDragging = true
  const scrollThreshold = 120
  const baseScrollSpeed = 18
  const maxScrollSpeed = 80
  
  function scrollLoop() {
    if (!desktopDragging) return
    
    let wasScrolling = isScrolling
    let canScroll = true
    
    // 检查鼠标当前位置是否在卡片网格区域内
    // 使用多个检测点提高准确性
    const checkPoints = [
      { x: currentMouseX - 50, y: currentMouseY },
      { x: currentMouseX + 50, y: currentMouseY },
      { x: currentMouseX, y: currentMouseY - 50 },
      { x: currentMouseX, y: currentMouseY + 50 }
    ]
    
    // 临时禁用所有拖拽元素的 pointer-events，以便正确检测底层元素
    const dragHandles = document.querySelectorAll('.card-dragging, .cat-dragging')
    const originalStyles: Array<{ el: Element, style: string | null }> = []
    dragHandles.forEach(el => {
      const htmlEl = el as HTMLElement
      originalStyles.push({ el, style: htmlEl.style.pointerEvents })
      htmlEl.style.pointerEvents = 'none'
    })
    
    for (const point of checkPoints) {
      const elemBelow = document.elementFromPoint(point.x, point.y)
      if (elemBelow) {
        const navGrid = elemBelow.closest('.nav-grid')
        if (navGrid) {
          // 在卡片网格区域内，不允许任何滚动
          canScroll = false
          break
        }
      }
    }
    
    // 恢复 pointer-events
    originalStyles.forEach(({ el, style }) => {
      (el as HTMLElement).style.pointerEvents = style || ''
    })
    
    if (canScroll) {
      if (currentMouseY < scrollThreshold) {
        isScrolling = true
        const ratio = 1 - (currentMouseY / scrollThreshold)
        const speed = Math.min(baseScrollSpeed + ratio * (maxScrollSpeed - baseScrollSpeed), maxScrollSpeed)
        window.scrollBy({ top: -speed, behavior: 'auto' })
      } else if (currentMouseY > window.innerHeight - scrollThreshold) {
        isScrolling = true
        const ratio = 1 - ((window.innerHeight - currentMouseY) / scrollThreshold)
        const speed = Math.min(baseScrollSpeed + ratio * (maxScrollSpeed - baseScrollSpeed), maxScrollSpeed)
        window.scrollBy({ top: speed, behavior: 'auto' })
      } else {
        isScrolling = false
      }
    } else {
      isScrolling = false
    }
    
    // 滚动停止时更新一次位置
    if (wasScrolling && !isScrolling) {
      forcePositionUpdate()
    }
    
    desktopDragScrollRaf = requestAnimationFrame(scrollLoop)
  }
  
  if (!desktopDragScrollRaf) {
    scrollLoop()
  }
}

function forcePositionUpdate() {
  if (!draggingId.value) return
  const currentCategory = navStore.links.find(l => l.id === draggingId.value)?.category
  if (currentCategory) {
    const categoryLinks = navStore.getLinksByCategory(currentCategory)
    const ids = categoryLinks.map(l => l.id)
    const fromIdx = ids.indexOf(draggingId.value)
    if (fromIdx !== -1) {
      navStore.reorderLinks([...ids])
    }
  }
}

function handleDesktopDragEnd() {
  desktopDragging = false
  isScrolling = false
  if (desktopDragScrollRaf) {
    cancelAnimationFrame(desktopDragScrollRaf)
    desktopDragScrollRaf = null
  }
}

const showAddCategory = ref(false)
const newCatName = ref('')
const newCatParentId = ref<string | undefined>(undefined)

const showDeleteConfirm = ref(false)
const deleteTarget = ref<NavCategory | null>(null)

const showLinkDeleteConfirm = ref(false)
const deleteLinkTarget = ref<NavLink | null>(null)

const topCategories = computed(() =>
  navStore.sortedCategories.filter(c => !c.parentId)
)

function getChildren(parentId: string): NavCategory[] {
  return navStore.sortedCategories.filter(c => c.parentId === parentId)
}

function getCategoryLinks(categoryId: string) {
  return navStore.getLinksByCategory(categoryId)
}

function getCategoryLinkIds(categoryId: string): string[] {
  const gridEl = document.querySelector(`[data-category-id="${categoryId}"] .nav-grid`)
  if (gridEl) {
    const cardEls = gridEl.querySelectorAll('[data-link-id]')
    return Array.from(cardEls).map(el => el.getAttribute('data-link-id')!).filter(Boolean)
  }
  return getCategoryLinks(categoryId).map(l => l.id)
}

let lastDragOverTarget = ''
let dragOverThrottle = 0

function handleDragStart(id: string) {
  draggingId.value = id
  lastDragOverTarget = ''
  if (navStore.selectionMode && navStore.selectedLinkIds.size > 1) {
    isBatchDragging.value = true
  } else {
    navStore.recordMove(id)
  }
}

function handleTouchDrop(categoryId: string) {
  const isBatchMode = isBatchDragging.value && navStore.selectedLinkIds.size > 0
  if (isBatchMode) {
    const targetLinkId = navStore.dropTargetLinkId
    const count = navStore.batchMoveLinks(categoryId, targetLinkId ?? undefined)
    if (count > 0) {
      toast.success(`已将 ${count} 个链接移动到分类`)
    }
    navStore.exitSelectionMode()
  } else if (draggingId.value) {
    const link = navStore.links.find(l => l.id === draggingId.value)
    if (link) {
      const isCrossCategory = link.category !== categoryId
      // 记录原始位置用于撤回
      navStore.recordMove(draggingId.value)
      // 跨分类: 记录旧位置用于动画; 同分类: 用FLIP
      const oldRect = isCrossCategory
        ? categoryListRef.value?.querySelector<HTMLElement>(`[data-link-id="${draggingId.value}"]`)?.getBoundingClientRect()
        : null
      const flipBefore = !isCrossCategory ? recordPositions(draggingId.value) : null

      if (navStore.dropTargetLinkId && categoryId) {
        // 有指定目标位置：移动到目标分类的指定位置
        if (isCrossCategory) {
          navStore.updateLink(draggingId.value, { category: categoryId })
        }

        const categoryLinks = navStore.getLinksByCategory(categoryId)
        const ids = categoryLinks.map(l => l.id)
        const toIdx = ids.indexOf(navStore.dropTargetLinkId)

        if (toIdx !== -1) {
          const updatedIds = navStore.getLinksByCategory(categoryId).map(l => l.id)
          const newFromIdx = updatedIds.indexOf(draggingId.value)
          if (newFromIdx !== -1) {
            updatedIds.splice(newFromIdx, 1)
            const newToIdx = Math.min(toIdx, updatedIds.length)
            updatedIds.splice(newToIdx, 0, draggingId.value)
            navStore.reorderLinks(updatedIds)
          }
        }
      } else if (isCrossCategory) {
        // 没有指定目标位置：只是移动到分类
        navStore.updateLink(draggingId.value, { category: categoryId })
      }

      if (isCrossCategory && oldRect) {
        // 跨分类：手动FLIP动画（卡片跨DOM容器，Vue标准FLIP不适用）
        nextTick(() => {
          const cardEl = categoryListRef.value?.querySelector<HTMLElement>(`[data-link-id="${draggingId.value}"]`)
          if (cardEl) {
            const newRect = cardEl.getBoundingClientRect()
            const dx = oldRect.left - newRect.left
            const dy = oldRect.top - newRect.top
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
              cardEl.animate(
                [
                  { transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.96)`, opacity: 0.35, offset: 0 },
                  { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1, offset: 1 }
                ],
                { duration: 250, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' }
              )
            }
          }
        })
      } else if (flipBefore) {
        // 同分类：标准FLIP动画
        animateFlip(flipBefore, draggingId.value)
      }
    }
  }
  draggingId.value = null
  isBatchDragging.value = false
  dropTargetCategory.value = null
  navStore.dropTargetLinkId = null
  categoryDropTarget.value = null
}

function handleDragOver(targetId: string, categoryId: string) {
  if (!draggingId.value) return
  if (draggingId.value === targetId) return

  if (isBatchDragging.value) {
    dropTargetCategory.value = categoryId
    navStore.dropTargetLinkId = targetId
    return
  }

  const now = Date.now()
  if (targetId === lastDragOverTarget && now - dragOverThrottle < 80) return

  // 滚动时降低重排频率
  if (isScrolling && now - dragOverThrottle < 200) return

  lastDragOverTarget = targetId
  dragOverThrottle = now

  dropTargetCategory.value = categoryId
  const categoryLinks = navStore.getLinksByCategory(categoryId)
  const ids = categoryLinks.map(l => l.id)
  const fromIdx = ids.indexOf(draggingId.value)
  const toIdx = ids.indexOf(targetId)

  // 只在滚动停止时执行动画
  const shouldAnimate = !isScrolling

  const before = shouldAnimate ? recordPositions(draggingId.value) : null

  if (toIdx === -1) {
    navStore.updateLink(draggingId.value, { category: categoryId })
    if (shouldAnimate && before) {
      animateFlip(before, draggingId.value)
    }
    return
  }

  if (fromIdx !== -1) {
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, draggingId.value)
  } else {
    ids.splice(toIdx, 0, draggingId.value)
    navStore.updateLink(draggingId.value, { category: categoryId })
  }
  navStore.reorderLinks(ids)
  if (shouldAnimate && before) {
    animateFlip(before, draggingId.value)
  }
}

// 触屏端拖拽离开目标卡片
function handleTouchDragLeave() {
  navStore.dropTargetLinkId = null
}

// 触屏端专用拖拽经过处理 - 使用目标卡片的实际分类
function handleTouchDragOver(targetId: string, touchCategoryId: string) {
  if (!draggingId.value) return
  if (draggingId.value === targetId) return

  const categoryId = touchCategoryId

  if (isBatchDragging.value) {
    dropTargetCategory.value = categoryId
    navStore.dropTargetLinkId = targetId
    return
  }

  const now = Date.now()
  if (targetId === lastDragOverTarget && now - dragOverThrottle < 80) return

  if (isScrolling && now - dragOverThrottle < 200) return

  lastDragOverTarget = targetId
  dragOverThrottle = now

  dropTargetCategory.value = categoryId
  navStore.dropTargetLinkId = targetId

  // 跨分类：只记录目标位置，不在拖拽过程中改分类（避免DOM重排导致滚动）
  const sourceCategory = navStore.links.find(l => l.id === draggingId.value)?.category
  if (sourceCategory !== categoryId) return

  // 同分类内：实时排序 + FLIP 动画
  const categoryLinks = navStore.getLinksByCategory(categoryId)
  const ids = categoryLinks.map(l => l.id)
  const fromIdx = ids.indexOf(draggingId.value)
  const toIdx = ids.indexOf(targetId)

  if (fromIdx === -1 || toIdx === -1) return

  const shouldAnimate = !isScrolling
  const before = shouldAnimate ? recordPositions(draggingId.value) : null

  ids.splice(fromIdx, 1)
  ids.splice(toIdx, 0, draggingId.value)
  navStore.reorderLinks(ids)

  if (shouldAnimate && before) {
    animateFlip(before, draggingId.value)
  }
}



function handleCategoryDrop(e: DragEvent, categoryId: string) {
  e.preventDefault()
  e.stopPropagation()
  const isBatchMode = isBatchDragging.value && navStore.selectedLinkIds.size > 0
  const hasMoved = isBatchMode ? navStore.selectedLinkIds.size > 0 : !!draggingId.value
  if (isBatchMode) {
    const targetLinkId = navStore.dropTargetLinkId
    const count = navStore.batchMoveLinks(categoryId, targetLinkId ?? undefined)
    if (count > 0) {
      toast.success(`已将 ${count} 个链接移动到分类`)
    }
    navStore.exitSelectionMode()
    nextTick(() => {
      document.body.classList.remove('is-dragging')
    })
  } else if (draggingId.value) {
    const link = navStore.links.find(l => l.id === draggingId.value)
    if (link && link.category !== categoryId) {
      navStore.updateLink(draggingId.value, { category: categoryId })
    }
  }
  
  if (hasMoved) {
    droppedCategories.add(categoryId)
    const parentIds = getAllParentCategoryIds(categoryId)
    parentIds.forEach(id => {
      droppedCategories.add(id)
    })
  }
  
  dropTargetCategory.value = null
  categoryDropTarget.value = null
  navStore.dropTargetLinkId = null
  draggingId.value = null
  isBatchDragging.value = false
  clearAllExpandTimers()
}

function clearAllExpandTimers() {
  autoExpandTimers.forEach(timer => clearTimeout(timer))
  autoExpandTimers.clear()
  autoExpandedCategories.forEach(id => {
    if (!droppedCategories.has(id)) {
      const category = navStore.categories.find(c => c.id === id)
      if (category && !category.collapsed) {
        navStore.toggleCategory(id)
      }
    }
  })
  autoExpandedCategories.clear()
  droppedCategories.clear()
}

function handleDragEnd() {
  // 清理所有卡片的拖拽状态
  document.querySelectorAll('.card-dragging').forEach(el => {
    el.classList.remove('card-dragging')
  })
  document.body.classList.remove('is-dragging')
  
  // 触摸端：如果有跨分类拖放目标，将卡片移动到目标分类
  if (draggingId.value && dropTargetCategory.value) {
    const link = navStore.links.find(l => l.id === draggingId.value)
    if (link && link.category !== dropTargetCategory.value) {
      navStore.updateLink(draggingId.value, { category: dropTargetCategory.value })
    }
  }
  draggingId.value = null
  dropTargetCategory.value = null
  categoryDropTarget.value = null
  isBatchDragging.value = false
  lastDragOverTarget = ''
  clearAllExpandTimers()
}

/** 触摸端拖拽经过分类容器时，设置跨分类拖放目标并处理自动展开 */
function handleTouchDragOverCategory(categoryId: string) {
  if (!draggingId.value) return
  dropTargetCategory.value = categoryId
  
  const currentAndParentIds = getAllParentCategoryIds(categoryId)
  
  autoExpandedCategories.forEach(id => {
    if (!currentAndParentIds.includes(id) && !droppedCategories.has(id)) {
      const category = navStore.categories.find(c => c.id === id)
      if (category && !category.collapsed) {
        navStore.toggleCategory(id)
      }
      const timer = autoExpandTimers.get(id)
      if (timer) {
        clearTimeout(timer)
        autoExpandTimers.delete(id)
      }
      autoExpandedCategories.delete(id)
    }
  })
  
  const category = navStore.categories.find(c => c.id === categoryId)
  if (category && category.collapsed) {
    if (!autoExpandTimers.has(categoryId)) {
      const timer = window.setTimeout(() => {
        navStore.toggleCategory(categoryId)
        autoExpandedCategories.add(categoryId)
        autoExpandTimers.delete(categoryId)
      }, 500)
      autoExpandTimers.set(categoryId, timer)
    }
  }
}

function handleCategoryHeaderDragStart(e: DragEvent, categoryId: string) {
  if (draggingId.value) return
  e.stopPropagation()
  draggingCategoryId.value = categoryId
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', categoryId)
}

let categoryTouchDragActive = false
let categoryTouchClone: HTMLElement | null = null
let categoryTouchRect: DOMRect | null = null

function handleCategoryDragHandleTouchStart(e: TouchEvent, categoryId: string) {
  if (e.touches.length !== 1 || categoryTouchDragActive) return
  const touch = e.touches[0]
  const target = e.currentTarget as HTMLElement
  const categorySection = target.closest('.category-section') as HTMLElement
  if (!categorySection) return
  
  categoryTouchDragActive = true
  categoryTouchRect = categorySection.getBoundingClientRect()
  draggingCategoryId.value = categoryId
  
  categorySection.classList.add('cat-dragging')
  
  categoryTouchClone = categorySection.cloneNode(true) as HTMLElement
  categoryTouchClone.style.cssText = `
    position: fixed;
    left: ${touch.clientX - categoryTouchRect.width / 2}px;
    top: ${touch.clientY - 30}px;
    width: ${categoryTouchRect.width}px;
    z-index: 9999;
    opacity: 0.9;
    transform: rotate(1deg);
    box-shadow: 0 12px 40px rgba(99, 102, 241, 0.3);
    border-radius: 12px;
    pointer-events: none;
    transition: none;
  `
  document.body.appendChild(categoryTouchClone)
  
  if (navigator.vibrate) navigator.vibrate(30)
  
  document.addEventListener('touchmove', handleCategoryTouchMove, { passive: false })
  document.addEventListener('touchend', handleCategoryTouchEnd)
  document.addEventListener('touchcancel', handleCategoryTouchEnd)
}

function handleCategoryTouchMove(e: TouchEvent) {
  if (!categoryTouchDragActive || e.touches.length !== 1) return
  e.preventDefault()
  const touch = e.touches[0]
  
  if (categoryTouchClone && categoryTouchRect) {
    categoryTouchClone.style.left = (touch.clientX - categoryTouchRect.width / 2) + 'px'
    categoryTouchClone.style.top = (touch.clientY - 30) + 'px'
  }
  
  // 自动滚动页面
  const scrollThreshold = 80
  const scrollSpeed = 8
  if (touch.clientY < scrollThreshold) {
    window.scrollBy({ top: -scrollSpeed, behavior: 'auto' })
  } else if (touch.clientY > window.innerHeight - scrollThreshold) {
    window.scrollBy({ top: scrollSpeed, behavior: 'auto' })
  }
  
  const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY)
  if (elemBelow) {
    const targetSection = elemBelow.closest<HTMLElement>('.category-section')
    if (targetSection && targetSection.dataset.categoryId) {
      const targetId = targetSection.dataset.categoryId
      if (targetId !== draggingCategoryId.value) {
        categoryDropTarget.value = targetId
        lastCategoryDropTarget = targetId
        
        // 手机端分类拖拽时自动展开/收缩
        const currentAndParentIds = getAllParentCategoryIds(targetId)
        
        autoExpandedCategories.forEach(id => {
          if (!currentAndParentIds.includes(id) && !droppedCategories.has(id)) {
            const category = navStore.categories.find(c => c.id === id)
            if (category && !category.collapsed) {
              navStore.toggleCategory(id)
            }
            const timer = autoExpandTimers.get(id)
            if (timer) {
              clearTimeout(timer)
              autoExpandTimers.delete(id)
            }
            autoExpandedCategories.delete(id)
          }
        })
        
        const category = navStore.categories.find(c => c.id === targetId)
        if (category && category.collapsed) {
          if (!autoExpandTimers.has(targetId)) {
            const timer = window.setTimeout(() => {
              navStore.toggleCategory(targetId)
              autoExpandedCategories.add(targetId)
              autoExpandTimers.delete(targetId)
            }, 500)
            autoExpandTimers.set(targetId, timer)
          }
        }
      }
    }
  }
}

function handleCategoryTouchEnd(e: TouchEvent) {
  document.removeEventListener('touchmove', handleCategoryTouchMove)
  document.removeEventListener('touchend', handleCategoryTouchEnd)
  document.removeEventListener('touchcancel', handleCategoryTouchEnd)
  
  if (categoryTouchClone) {
    categoryTouchClone.remove()
    categoryTouchClone = null
  }
  
  const allSections = document.querySelectorAll('.category-section')
  allSections.forEach(s => s.classList.remove('cat-dragging'))
  
  if (draggingCategoryId.value && categoryDropTarget.value) {
    const ids = topCategories.value.map(c => c.id)
    const fromIdx = ids.indexOf(draggingCategoryId.value)
    const toIdx = ids.indexOf(categoryDropTarget.value)
    if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
      ids.splice(fromIdx, 1)
      ids.splice(toIdx, 0, draggingCategoryId.value)
      navStore.reorderCategories(ids)
    }
  }
  
  categoryTouchDragActive = false
  draggingCategoryId.value = null
  categoryDropTarget.value = null
  categoryTouchRect = null
}

let lastCategoryDropTarget = ''
let categoryDragOverThrottle = 0
let autoExpandTimers: Map<string, number> = new Map()
let autoExpandedCategories: Set<string> = new Set()
let droppedCategories: Set<string> = new Set()

function getAllParentCategoryIds(categoryId: string): string[] {
  const ids: string[] = [categoryId]
  let category = navStore.categories.find(c => c.id === categoryId)
  while (category && category.parentId) {
    ids.push(category.parentId)
    category = navStore.categories.find(c => c.id === category!.parentId)
  }
  return ids
}

function handleCategoryHeaderDragOver(e: DragEvent, targetId: string) {
  if (!draggingCategoryId.value || draggingCategoryId.value === targetId) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  
  const now = Date.now()
  if (targetId === lastCategoryDropTarget && now - categoryDragOverThrottle < 100) return
  lastCategoryDropTarget = targetId
  categoryDragOverThrottle = now
  
  categoryDropTarget.value = targetId
}

function handleCategoryDragOver(e: DragEvent, categoryId: string) {
  e.preventDefault()
  e.stopPropagation()
  e.dataTransfer!.dropEffect = 'move'
  dropTargetCategory.value = categoryId
  if (isBatchDragging.value) {
    categoryDropTarget.value = categoryId
  }
  
  const currentAndParentIds = getAllParentCategoryIds(categoryId)
  
  autoExpandedCategories.forEach(id => {
    if (!currentAndParentIds.includes(id) && !droppedCategories.has(id)) {
      const category = navStore.categories.find(c => c.id === id)
      if (category && !category.collapsed) {
        navStore.toggleCategory(id)
      }
      const timer = autoExpandTimers.get(id)
      if (timer) {
        clearTimeout(timer)
        autoExpandTimers.delete(id)
      }
      autoExpandedCategories.delete(id)
    }
  })
  
  const category = navStore.categories.find(c => c.id === categoryId)
  if (category && category.collapsed) {
    if (!autoExpandTimers.has(categoryId)) {
      const timer = window.setTimeout(() => {
        navStore.toggleCategory(categoryId)
        autoExpandedCategories.add(categoryId)
        autoExpandTimers.delete(categoryId)
      }, 500)
      autoExpandTimers.set(categoryId, timer)
    }
  }
}

function handleCategoryHeaderDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  if (!draggingCategoryId.value || draggingCategoryId.value === targetId) return
  const ids = topCategories.value.map(c => c.id)
  const fromIdx = ids.indexOf(draggingCategoryId.value)
  const toIdx = ids.indexOf(targetId)
  if (fromIdx === -1 || toIdx === -1) return
  const before = recordCategoryPositions(draggingCategoryId.value)
  ids.splice(fromIdx, 1)
  ids.splice(toIdx, 0, draggingCategoryId.value)
  navStore.reorderCategories(ids)
  animateCategoryFlip(before, draggingCategoryId.value)
  draggingCategoryId.value = null
  categoryDropTarget.value = null
  clearAllExpandTimers()
}

function handleCategoryHeaderDragEnd() {
  draggingCategoryId.value = null
  categoryDropTarget.value = null
  isBatchDragging.value = false
  clearAllExpandTimers()
}

function openAddCategory(parentId?: string) {
  newCatName.value = ''
  newCatParentId.value = parentId
  showAddCategory.value = true
}

function confirmAddCategory() {
  const name = newCatName.value.trim()
  if (!name) return
  const exists = navStore.categories.some(
    c => c.name === name && c.parentId === (newCatParentId.value || undefined)
  )
  if (exists) {
    toast.warning('该分类下已存在同名分类')
    return
  }
  navStore.addCategory(name, '📁', '#6366f1', newCatParentId.value)
  showAddCategory.value = false
  newCatName.value = ''
}

function requestDeleteCategory(cat: NavCategory) {
  deleteTarget.value = cat
  showDeleteConfirm.value = true
}

function confirmDeleteCategory() {
  if (deleteTarget.value) {
    navStore.deleteCategory(deleteTarget.value.id)
  }
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

function cancelDeleteCategory() {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

const deleteMsg = computed(() => {
  if (!deleteTarget.value) return ''
  const cat = deleteTarget.value
  const childCount = getChildren(cat.id).length
  const linkCount = navStore.getTotalLinksByCategory(cat.id)
  if (childCount > 0) return `确定删除分类「${cat.name}」及其 ${childCount} 个子分类和 ${linkCount} 个链接吗？`
  if (linkCount > 0) return `确定删除分类「${cat.name}」及其 ${linkCount} 个链接吗？`
  return `确定删除分类「${cat.name}」吗？`
})

const ctxMenu = ref<{ x: number; y: number; visible: boolean; linkId: string }>({ x: 0, y: 0, visible: false, linkId: '' })

function handleCardContextMenu(payload: { id: string; x: number; y: number }) {
  ctxMenu.value = { x: payload.x, y: payload.y, visible: true, linkId: payload.id }
}

function closeCtxMenu() {
  ctxMenu.value.visible = false
  document.body.classList.remove('is-dragging')
  // 清除所有可能残留的拖拽状态
  const draggingCards = document.querySelectorAll('.card-dragging')
  draggingCards.forEach(card => card.classList.remove('card-dragging'))
  draggingId.value = null
  isBatchDragging.value = false
  dropTargetCategory.value = null
  categoryDropTarget.value = null
  lastCategoryDropTarget = ''
  autoExpandTimers.forEach(timer => clearTimeout(timer))
  autoExpandTimers.clear()
  // 收缩所有自动展开的分类
  autoExpandedCategories.forEach(id => {
    const category = navStore.categories.find(c => c.id === id)
    if (category && !category.collapsed) {
      navStore.toggleCategory(id)
    }
  })
  autoExpandedCategories.clear()
}

/** 右键菜单项配置 */
const ctxMenuItems = computed<ContextMenuItem[]>(() => {
  const link = ctxLink.value
  if (!link) return []

  const { urls } = link
  const current = networkStore.currentType

  // 构建地址菜单项：排除当前模式的地址
  const addressItems: ContextMenuItem[] = []

  if (current !== 'extranet' && urls.extranet) {
    addressItems.push({
      label: '打开外网地址',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
      action: () => { if (link?.urls.extranet) window.open(link.urls.extranet, '_blank') },
    })
  }
  if (current !== 'intranet' && urls.intranet) {
    addressItems.push({
      label: '打开内网地址',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
      action: () => { if (link?.urls.intranet) window.open(link.urls.intranet, '_blank') },
    })
  }
  if (current !== 'tunnel' && urls.tunnel) {
    addressItems.push({
      label: '打开隧道地址',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
      action: () => { if (link?.urls.tunnel) window.open(link.urls.tunnel, '_blank') },
    })
  }

  const items: ContextMenuItem[] = []

  // 如果有地址选项，添加分隔线
  if (addressItems.length > 0) {
    items.push(...addressItems)
    items.push({ label: '', action: () => {} })
  }

  // 添加其他菜单项
  items.push(
    {
      label: link.pinned ? '取消置顶' : '置顶',
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="${link.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z"/></svg>`,
      action: () => { if (link) navStore.updateLink(link.id, { pinned: !link.pinned }) },
    },
    {
      label: '编辑',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
      action: () => emit('open-editor', ctxMenu.value.linkId),
    },
    { label: '', action: () => {} },
    {
      label: '批量选择',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>',
      action: () => {
        navStore.enterSelectionMode()
        navStore.toggleLinkSelection(ctxMenu.value.linkId)
      },
    },
    {
      label: '删除',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
      danger: true,
      action: () => {
        if (link) {
          deleteLinkTarget.value = link
          showLinkDeleteConfirm.value = true
        }
      },
    },
  )

  return items
})

function confirmDeleteLink() {
  if (deleteLinkTarget.value) {
    navStore.deleteLink(deleteLinkTarget.value.id)
  }
  showLinkDeleteConfirm.value = false
  deleteLinkTarget.value = null
}

function cancelDeleteLink() {
  showLinkDeleteConfirm.value = false
  deleteLinkTarget.value = null
}

const ctxLink = computed(() => navStore.links.find(l => l.id === ctxMenu.value.linkId) || null)
</script>

<template>
  <div ref="categoryListRef" class="category-list" :class="{ 'batch-dragging': isBatchDragging }">
    <section
      v-for="category in topCategories"
      :key="category.id"
      class="category-section"
      :class="{
        'drop-target': dropTargetCategory === category.id,
        'cat-drop-target': categoryDropTarget === category.id,
        'cat-dragging': draggingCategoryId === category.id,
        'no-card': !settingsStore.settings.layout.showCategoryCard
      }"
      :data-category-id="category.id"
      @dragover="draggingCategoryId ? handleCategoryHeaderDragOver($event, category.id) : handleCategoryDragOver($event, category.id)"
      @drop="draggingCategoryId ? handleCategoryHeaderDrop($event, category.id) : handleCategoryDrop($event, category.id)"
      @dragend="handleCategoryHeaderDragEnd"
      @dragleave="
        if (dropTargetCategory === category.id) { dropTargetCategory = null; }
        if (categoryDropTarget === category.id) { categoryDropTarget = null; }
        // 清除该分类的自动展开定时器（不收缩，因为可能只是鼠标经过子元素）
        const timer = autoExpandTimers.get(category.id);
        if (timer) { clearTimer(timer); autoExpandTimers.delete(category.id); }
      "
    >
      <div class="category-header">
        <div class="category-title-wrapper" @click="navStore.toggleCategory(category.id)" :draggable="true" @dragstart="handleCategoryHeaderDragStart($event, category.id)" role="button" :aria-expanded="!category.collapsed" tabindex="0" @keydown.enter="navStore.toggleCategory(category.id)" @keydown.space.prevent="navStore.toggleCategory(category.id)">
          <span class="category-icon" :style="{ background: category.color }">
            <svg :class="['chevron-icon', { rotated: !category.collapsed }]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </span>
          <h3 class="category-name">{{ category.name }}</h3>
          <span class="category-count">{{ navStore.getTotalLinksByCategory(category.id) }}</span>
        </div>
        <div class="category-drag-handle" @touchstart.stop="handleCategoryDragHandleTouchStart($event, category.id)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/>
            <circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/>
            <circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>
        <div class="category-actions">
          <button class="cat-action-btn add-link-btn" title="添加链接" @click.stop="emit('open-editor', null, category.id)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
          <button class="cat-action-btn" title="添加子分类" @click.stop="openAddCategory(category.id)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          </button>
          <button class="cat-action-btn cat-action-delete" title="删除分类" @click.stop="requestDeleteCategory(category)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      <div :class="['category-collapse', { collapsed: category.collapsed }]" :aria-hidden="category.collapsed">
        <div class="category-collapse-inner">
          <div class="nav-grid">
            <NavCard
              v-for="link in getCategoryLinks(category.id)"
              :key="link.id"
              :link="link"
              :link-ids="getCategoryLinkIds(category.id)"
              :category-id="category.id"
              :batch-dragging="isBatchDragging"
              @edit="emit('open-editor', $event)"
              @contextmenu="handleCardContextMenu"
              @dragstart="handleDragStart"
              @dragover="handleDragOver($event, category.id)"
              @touchdragover="handleTouchDragOver"
              @touchdragleave="handleTouchDragLeave"
              @dragend="handleDragEnd"
              @dragovercategory="handleTouchDragOverCategory"
              @touchdrop="handleTouchDrop"
            />
          </div>

          <template v-for="child in getChildren(category.id)" :key="child.id">
            <div
              class="sub-category"
              :data-category-id="child.id"
              @dragover="handleCategoryDragOver($event, child.id)"
              @drop="handleCategoryDrop($event, child.id)"
              @dragleave="
                if (dropTargetCategory === child.id) { dropTargetCategory = null; }
                if (categoryDropTarget === child.id) { categoryDropTarget = null; }
                // 清除该分类的自动展开定时器（不收缩，因为可能只是鼠标经过子元素）
                const timer = autoExpandTimers.get(child.id);
                if (timer) { clearTimer(timer); autoExpandTimers.delete(child.id); }
              "
              :class="{ 'drop-target': dropTargetCategory === child.id, 'cat-drop-target': categoryDropTarget === child.id, 'no-card': !settingsStore.settings.layout.showCategoryCard }"
            >
              <div class="sub-category-header">
                <div class="sub-category-title-wrapper" @click="navStore.toggleCategory(child.id)" role="button" :aria-expanded="!child.collapsed" tabindex="0" @keydown.enter="navStore.toggleCategory(child.id)" @keydown.space.prevent="navStore.toggleCategory(child.id)">
                  <svg :class="['chevron-icon-sm', { rotated: !child.collapsed }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  <span class="sub-cat-dot" :style="{ background: child.color }"></span>
                  <span class="sub-cat-name">{{ child.name }}</span>
                  <span class="sub-cat-count">{{ navStore.getTotalLinksByCategory(child.id) }}</span>
                </div>
                <div class="category-actions">
                  <button class="cat-action-btn add-link-btn" title="添加链接" @click.stop="emit('open-editor', null, child.id)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </button>
                  <button class="cat-action-btn" title="添加子分类" @click.stop="openAddCategory(child.id)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  </button>
                  <button class="cat-action-btn cat-action-delete" title="删除分类" @click.stop="requestDeleteCategory(child)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>

              <div :class="['category-collapse', { collapsed: child.collapsed }]" :aria-hidden="child.collapsed">
                <div class="category-collapse-inner">
                  <div class="nav-grid">
                    <NavCard
                      v-for="link in getCategoryLinks(child.id)"
                      :key="link.id"
                      :link="link"
                      :link-ids="getCategoryLinkIds(child.id)"
                      :category-id="child.id"
                      :batch-dragging="isBatchDragging"
                      @edit="emit('open-editor', $event)"
                      @contextmenu="handleCardContextMenu"
                      @dragstart="handleDragStart"
                      @dragover="handleDragOver($event, child.id)"
                      @touchdragover="handleTouchDragOver"
                      @touchdragleave="handleTouchDragLeave"
                      @dragend="handleDragEnd"
                      @dragovercategory="handleTouchDragOverCategory"
                      @touchdrop="handleTouchDrop"
                    />
                  </div>

                  <template v-for="grandchild in getChildren(child.id)" :key="grandchild.id">
                    <div
                      class="sub-category sub-category-deep"
                      :data-category-id="grandchild.id"
                      @dragover="handleCategoryDragOver($event, grandchild.id)"
                      @drop="handleCategoryDrop($event, grandchild.id)"
                      @dragleave="
                        if (dropTargetCategory === grandchild.id) { dropTargetCategory = null; }
                        if (categoryDropTarget === grandchild.id) { categoryDropTarget = null; }
                        // 清除该分类的自动展开定时器（不收缩，因为可能只是鼠标经过子元素）
                        const timer = autoExpandTimers.get(grandchild.id);
                        if (timer) { clearTimer(timer); autoExpandTimers.delete(grandchild.id); }
                      "
                      :class="{ 'drop-target': dropTargetCategory === grandchild.id, 'cat-drop-target': categoryDropTarget === grandchild.id, 'no-card': !settingsStore.settings.layout.showCategoryCard }"
                    >
                      <div class="sub-category-header">
                        <div class="sub-category-title-wrapper" @click="navStore.toggleCategory(grandchild.id)" role="button" :aria-expanded="!grandchild.collapsed" tabindex="0" @keydown.enter="navStore.toggleCategory(grandchild.id)" @keydown.space.prevent="navStore.toggleCategory(grandchild.id)">
                          <svg :class="['chevron-icon-sm', { rotated: !grandchild.collapsed }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          <span class="sub-cat-dot" :style="{ background: grandchild.color }"></span>
                          <span class="sub-cat-name">{{ grandchild.name }}</span>
                          <span class="sub-cat-count">{{ navStore.getTotalLinksByCategory(grandchild.id) }}</span>
                        </div>
                        <div class="category-actions">
                          <button class="cat-action-btn add-link-btn" title="添加链接" @click.stop="emit('open-editor', null, grandchild.id)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          </button>
                          <button class="cat-action-btn cat-action-delete" title="删除分类" @click.stop="requestDeleteCategory(grandchild)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </div>

                      <div :class="['category-collapse', { collapsed: grandchild.collapsed }]" :aria-hidden="grandchild.collapsed">
                        <div class="category-collapse-inner">
                          <div class="nav-grid">
                            <NavCard
                              v-for="link in getCategoryLinks(grandchild.id)"
                              :key="link.id"
                              :link="link"
                              :link-ids="getCategoryLinkIds(grandchild.id)"
                              :category-id="grandchild.id"
                              :batch-dragging="isBatchDragging"
                              @edit="emit('open-editor', $event)"
                              @contextmenu="handleCardContextMenu"
                              @dragstart="handleDragStart"
                              @dragover="handleDragOver($event, grandchild.id)"
                              @touchdragover="handleTouchDragOver"
                              @touchdragleave="handleTouchDragLeave"
                              @dragend="handleDragEnd"
                              @dragovercategory="handleTouchDragOverCategory"
                              @touchdrop="handleTouchDrop"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </section>

    <ContextMenu
      :visible="ctxMenu.visible"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :items="ctxMenuItems"
      @close="closeCtxMenu"
    />

    <ConfirmDialog
      :visible="showAddCategory"
      :title="`添加${newCatParentId ? '子' : ''}分类`"
      @update:visible="showAddCategory = $event"
      @confirm="confirmAddCategory"
      @cancel="showAddCategory = false"
    >
      <input
        v-model="newCatName"
        type="text"
        class="add-cat-input"
        placeholder="输入分类名称"
        @keyup.enter="confirmAddCategory"
        autofocus
      />
    </ConfirmDialog>

    <ConfirmDialog
      :visible="showDeleteConfirm"
      title="删除分类"
      :message="deleteMsg"
      confirm-text="确定删除"
      danger
      @update:visible="showDeleteConfirm = $event"
      @confirm="confirmDeleteCategory"
      @cancel="cancelDeleteCategory"
    />

    <ConfirmDialog
      :visible="showLinkDeleteConfirm"
      title="删除链接"
      :message="`确定删除「${deleteLinkTarget?.title}」吗？\n\n⚠️ 删除后可撤回，但刷新页面后撤回功能将失效`"
      confirm-text="确定删除"
      danger
      @update:visible="showLinkDeleteConfirm = $event"
      @confirm="confirmDeleteLink"
      @cancel="cancelDeleteLink"
    />
  </div>
</template>

<style scoped>
.category-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 分类区块添加独立卡片背景 */
.category-section:not(.no-card) {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border);
}

.category-section {
  transition: box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  /* 分类区块圆角跟随全局设置 */
  border-radius: var(--radius);
  padding: 0 4px;
}

/* 关闭分类白框时的样式 */
.category-section.no-card {
  background: none !important;
  padding: 0 4px !important;
  box-shadow: none !important;
  border: none !important;
  border-radius: 0 !important;
}

.category-section.drop-target {
  box-shadow: 0 0 0 2px var(--primary), 0 4px 16px rgba(99, 102, 241, 0.15);
}

.category-header {
  display: flex;
  align-items: center;
  padding: 8px 0;
  gap: 8px;
}

.category-title-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  /* 分类标题区域圆角 */
  border-radius: calc(var(--radius) - 4px);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.category-title-wrapper:hover {
  background: var(--bg-hover);
}

.category-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.category-header:hover .category-icon {
  transform: scale(1.05);
}

.chevron-icon,
.chevron-icon-sm {
  transition: transform 0.2s ease-out;
  transform: rotate(-90deg);
}

.chevron-icon.rotated,
.chevron-icon-sm.rotated {
  transform: rotate(0deg);
}

.category-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.category-count {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--bg-secondary);
  border-radius: 10px;
  color: var(--text-muted);
}

.category-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.category-drag-handle {
  display: none;
}

@media (max-width: 768px) {
  .category-drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    color: var(--text-muted);
    opacity: 1;
    cursor: grab;
  }
}.category-header:hover .category-actions,
.sub-category-header:hover .category-actions {
  opacity: 1;
}

.cat-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--text-muted);
  transition: all 0.2s ease;
  cursor: pointer;
}

.cat-action-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.cat-action-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.add-link-btn:hover {
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}

.category-collapse {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.category-collapse.collapsed {
  grid-template-rows: 0fr;
}

.category-collapse-inner {
  overflow: hidden;
  min-height: 0;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  padding-top: 6px;
  padding-bottom: 4px;
}

/* 子分类样式：优化视觉层级表达 */
.sub-category {
  margin-top: 8px;
  margin-left: 16px;
  padding: 6px 10px;
  border-left: 2px solid var(--border);
  /* 子分类右侧圆角 */
  border-radius: 0 calc(var(--radius) - 6px) calc(var(--radius) - 6px) 0;
  background: color-mix(in srgb, var(--bg-card) 60%, var(--bg));
  transition: all 0.2s ease;
}

.sub-category:hover {
  background: color-mix(in srgb, var(--bg-card) 80%, var(--bg));
}

.sub-category.no-card {
  background: none;
  border-left: none;
  padding-left: 0;
  margin-left: 16px;
}

.sub-category.no-card:hover {
  background: none;
}

.sub-category.drop-target {
  border-left-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary), 0 4px 16px rgba(99, 102, 241, 0.15);
}

.sub-category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}

.sub-category-title-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.sub-category-title-wrapper:hover {
  background: var(--bg-hover);
}

.sub-cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sub-cat-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.sub-cat-count {
  font-size: 11px;
  padding: 1px 6px;
  background: var(--bg-secondary);
  border-radius: 8px;
  color: var(--text-muted);
}

/* 孙分类样式：更深的层级视觉 */
.sub-category-deep {
  margin-left: 16px;
  border-left-color: var(--primary-light);
  background: color-mix(in srgb, var(--bg-card) 40%, var(--bg));
}

/* 孙分类标题字号缩小，区分层级 */
.sub-category-deep .sub-cat-name {
  font-size: 13px;
}

.add-cat-input {
  width: 100%;
  padding: 10px 14px;
  border: none;
  /* 输入框圆角跟随全局设置 */
  border-radius: var(--radius);
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
  outline: none;
  transition: box-shadow 0.2s ease;
  box-sizing: border-box;
}

.add-cat-input:focus {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.category-section.cat-dragging {
  opacity: 0.4;
  transform: scale(0.98);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.category-section.cat-drop-target {
  position: relative;
}

.category-section.cat-drop-target::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--primary);
  border-radius: 3px;
  animation: cat-drop-pulse 1s ease-in-out infinite;
  z-index: 10;
}

@keyframes cat-drop-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.category-list.batch-dragging .category-section {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.category-list.batch-dragging .nav-card {
  cursor: grabbing;
}

.category-list.batch-dragging .nav-card.selected {
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
  transform: scale(1.02);
}

/* 批量拖拽：被选中卡片叠加收缩动画 */
.category-list.batch-dragging .nav-card.selected:not(.card-dragging) {
  animation: card-stack-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.category-list.batch-dragging .nav-card.selected:nth-of-type(2):not(.card-dragging) { animation-delay: 0.03s; }
.category-list.batch-dragging .nav-card.selected:nth-of-type(3):not(.card-dragging) { animation-delay: 0.06s; }
.category-list.batch-dragging .nav-card.selected:nth-of-type(4):not(.card-dragging) { animation-delay: 0.09s; }
.category-list.batch-dragging .nav-card.selected:nth-of-type(5):not(.card-dragging) { animation-delay: 0.12s; }

@keyframes card-stack-in {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(0.88) rotate(-0.5deg);
    opacity: 0.55;
    box-shadow: 0 2px 12px rgba(99, 102, 241, 0.25);
  }
}

@media (max-width: 768px) {
  .nav-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }

  .category-name {
    font-size: 15px;
  }

  .sub-category {
    margin-left: 12px;
  }
}

@media (max-width: 480px) {
  .nav-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .category-section:not(.no-card) {
    padding: 10px 0;
  }

  .category-icon {
    width: 24px;
    height: 24px;
  }

  .category-name {
    font-size: 14px;
  }

  .category-count {
    font-size: 11px;
    padding: 1px 6px;
  }

  .sub-category {
    margin-left: 4px;
  }

  .sub-cat-name {
    font-size: 13px;
  }
}
</style>
