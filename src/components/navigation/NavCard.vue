<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { NavLink } from '@/types'
import { useNetworkStore } from '@/stores/network'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'

import { useTouchDrag } from '@/composables/useTouchDrag'
import { useToast } from '@/composables/useToast'

const cardRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const isDragOver = ref(false)

// 长按相关
let longPressTimer: number | null = null
const LONG_PRESS_DURATION = 300 // 长按时间，单位毫秒
let touchStartX = 0
let touchStartY = 0
let isTouchingHandle = false

const props = defineProps<{
  link: NavLink
  linkIds?: string[]
  categoryId?: string
  batchDragging?: boolean
}>()

watch(() => props.batchDragging, (newVal) => {
  if (!newVal) {
    isDragOver.value = false
  }
})

const emit = defineEmits<{
  'edit': [id: string]
  'dragstart': [id: string]
  'dragover': [id: string]
  'touchdragover': [targetId: string, categoryId: string]
  'touchdragleave': []
  'dragend': []
  'contextmenu': [payload: { id: string; x: number; y: number }]
  'dragovercategory': [categoryId: string]
  'touchdrop': [categoryId: string]
}>()

const networkStore = useNetworkStore()
const navStore = useNavStore()
const settingsStore = useSettingsStore()
const toast = useToast()

const currentUrl = computed(() => {
  const { urls } = props.link
  if (networkStore.currentType === 'intranet') {
    return urls.intranet || urls.extranet || urls.tunnel || '#'
  }
  if (networkStore.currentType === 'tunnel') {
    return urls.tunnel || urls.extranet || urls.intranet || '#'
  }
  return urls.extranet || urls.intranet || urls.tunnel || '#'
})

const hasCurrentNetworkUrl = computed(() => {
  const { urls } = props.link
  if (networkStore.currentType === 'intranet') return !!urls.intranet
  if (networkStore.currentType === 'tunnel') return !!urls.tunnel
  return !!urls.extranet
})

const faviconSrc = computed(() => {
  if (props.link.cachedIconData) return props.link.cachedIconData
  if (props.link.iconUrl) return props.link.iconUrl
  return ''
})
const faviconFailed = ref(false)

function onFaviconLoad() {
  faviconFailed.value = false
}

function onFaviconError() {
  faviconFailed.value = true
  if (!props.link.cachedIconData && !props.link.iconUrl && !props.link.faviconFetchFailed) {
    navStore.updateLink(props.link.id, { faviconFetchFailed: true })
  }
}

const showPlaceholder = computed(() => {
  if (props.link.cachedIconData) return false
  if (props.link.iconUrl) return faviconFailed.value
  return true
})

const letterIcon = computed(() => {
  if (props.link.icon) return props.link.icon
  const title = props.link.title || ''
  const first = title.charAt(0)
  if (!first) return '?'
  return first.toUpperCase()
})

const cardStyle = computed(() => {
  const style: Record<string, string> = {}
  if (props.link.color) {
    style['background'] = props.link.color
  }
  if (props.link.opacity !== undefined && props.link.opacity < 1) {
    style['opacity'] = String(props.link.opacity)
  }
  if (props.link.fontColor) {
    const fc = props.link.fontColor
    const fo = props.link.fontOpacity ?? 1
    const m = fc.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
    if (m && fo < 1) {
      style['--card-font-color'] = `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${fo})`
    } else {
      style['--card-font-color'] = fc
    }
  }
  return style
})

const cardClass = computed(() => [
  'nav-card',
  `size-${settingsStore.settings.layout.cardSize}`,
  {
    'no-url': !hasCurrentNetworkUrl.value,
    'has-custom-color': !!props.link.color,
    'card-dragging': isDragging.value,
    'card-drag-over': isDragOver.value || navStore.dropTargetLinkId === props.link.id,
    'batch-drop-target': (isDragOver.value || navStore.dropTargetLinkId === props.link.id) && props.batchDragging,
    'selected': isSelected.value,
    'selection-mode': navStore.selectionMode,
    'range-start': navStore.rangeStartId === props.link.id,
  },
])

const isSelected = computed(() => navStore.selectedLinkIds.has(props.link.id))

function handleClick(e?: MouseEvent) {
  if (navStore.selectionMode) {
    if (navStore.rangeSelectMode) {
      // 范围选择模式
      navStore.handleRangeSelectClick(props.link.id, () => props.linkIds || [])
    } else if (e?.shiftKey) {
      // Shift键多选
      navStore.shiftSelectLinks(props.link.id, navStore.lastSelectedLinkId || undefined, () => props.linkIds || [])
    } else {
      // 普通单选
      navStore.toggleLinkSelection(props.link.id)
    }
    return
  }
  if (currentUrl.value === '#') return
  if (!hasCurrentNetworkUrl.value) {
    const label = networkStore.currentType === 'intranet' ? '内网' : networkStore.currentType === 'tunnel' ? '隧道' : '外网'
    toast.warning(`该链接未添加${label}地址`)
    return
  }
  navStore.recordAccess(props.link.id, networkStore.currentType)
  window.open(currentUrl.value, '_blank')
}

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  emit('contextmenu', {
    id: props.link.id,
    x: Math.min(e.clientX, window.innerWidth - 180),
    y: Math.min(e.clientY, window.innerHeight - 260),
  })
}

// 处理触摸开始 - 用于长按检测
function handleTouchStartForLongPress(e: TouchEvent) {
  if (e.touches.length !== 1) return
  const touch = e.touches[0]

  // 如果触摸在拖拽手柄上，不触发长按
  const target = e.target as HTMLElement
  if (target.closest('.drag-handle')) {
    return
  }

  touchStartX = touch.clientX
  touchStartY = touch.clientY
  longPressTimer = window.setTimeout(() => {
    longPressTimer = null
    // 拖拽中或触摸手柄时不触发右键菜单
    if (isDragging.value || isTouchingHandle) return
    // 触发长按事件
    emit('contextmenu', {
      id: props.link.id,
      x: Math.min(touchStartX, window.innerWidth - 180),
      y: Math.min(touchStartY, window.innerHeight - 260),
    })
    // 触觉反馈
    if (navigator.vibrate) navigator.vibrate(30)
  }, LONG_PRESS_DURATION)
}

// 处理触摸移动 - 取消长按
function handleTouchMoveForLongPress(e: TouchEvent) {
  if (!longPressTimer) return
  const touch = e.touches[0]
  const deltaX = Math.abs(touch.clientX - touchStartX)
  const deltaY = Math.abs(touch.clientY - touchStartY)
  // 如果移动超过 10px，取消长按
  if (deltaX > 10 || deltaY > 10) {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }
}

// 处理触摸结束 - 取消长按
function handleTouchEndForLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  isTouchingHandle = false
}

// 拖拽手柄触摸开始
function handleDragHandleTouchStart(e: TouchEvent) {
  isTouchingHandle = true
  handleTouchStart(e)
}

// 桌面端：使用原生 drag & drop API
function handleNativeDragStart(e: DragEvent) {
  if (currentUrl.value === '#') return
  isDragging.value = true
  document.body.classList.add('is-dragging')
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', props.link.id)
  
  if (cardRef.value) {
    const clone = cardRef.value.cloneNode(true) as HTMLElement
    clone.style.width = cardRef.value.offsetWidth + 'px'
    clone.style.opacity = '0.85'
    clone.style.transform = 'rotate(2deg)'
    clone.style.position = 'absolute'
    clone.style.top = '-9999px'
    clone.style.left = '-9999px'
    clone.style.boxShadow = '0 8px 32px rgba(99, 102, 241, 0.25)'
    clone.style.borderRadius = 'var(--radius)'
    document.body.appendChild(clone)
    e.dataTransfer!.setDragImage(clone, cardRef.value.offsetWidth / 2, 20)
    requestAnimationFrame(() => document.body.removeChild(clone))
  }
  
  emit('dragstart', props.link.id)
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  if (!isDragging.value) {
    isDragOver.value = true
  }
  emit('dragover', props.link.id)
}

function handleDragLeave() {
  isDragOver.value = false
}

function handleDragEnd() {
  isDragging.value = false
  isDragOver.value = false
  document.body.classList.remove('is-dragging')
  emit('dragend')
}

const { handleTouchStart, cleanup } = useTouchDrag({
  cardRef,
  handleRef,
  onDragStart: (id) => {
    isDragging.value = true
    emit('dragstart', id)
  },
  onDragOver: (targetId, categoryId) => {
    isDragOver.value = true
    emit('touchdragover', targetId, categoryId)
  },
  onDragEnd: (targetCategoryId) => {
    isDragging.value = false
    isDragOver.value = false
    document.body.classList.remove('is-dragging')
    if (targetCategoryId) {
      emit('touchdrop', targetCategoryId)
    }
    emit('dragend')
  },
  onDragOverCategory: (categoryId) => {
    emit('dragovercategory', categoryId)
  },
  onDragLeave: () => {
    isDragOver.value = false
    emit('touchdragleave')
  },
})

onUnmounted(() => {
  cleanup()
  // 清理长按定时器
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
})
</script>

<template>
  <div
    ref="cardRef"
    :class="cardClass"
    :style="cardStyle"
    :title="link.description ? `${link.title} — ${link.description}` : link.title"
    :data-link-id="link.id"
    role="listitem"
    :aria-label="link.description ? `${link.title} - ${link.description}` : `${link.title} - 书签`"
    :aria-grabbed="isDragging"
    draggable="true"
    @click="handleClick"
    @contextmenu="handleContextMenu"
    @dragstart="handleNativeDragStart"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @dragend="handleDragEnd"
    @touchstart.passive="handleTouchStartForLongPress"
    @touchmove.passive="handleTouchMoveForLongPress"
    @touchend="handleTouchEndForLongPress"
    @touchcancel="handleTouchEndForLongPress"
  >
    <Transition name="check-fade">
      <div v-if="navStore.selectionMode" class="selection-check" :class="{ checked: isSelected }">
        <svg v-if="isSelected" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    </Transition>
    <div class="card-content">
      <div class="card-icon-wrapper">
        <div class="card-icon">
          <img
            v-if="faviconSrc && !showPlaceholder"
            :src="faviconSrc"
            :alt="link.title"
            @load="onFaviconLoad"
            @error="onFaviconError"
          />
          <div v-else class="icon-placeholder">{{ letterIcon }}</div>
        </div>
        <div ref="handleRef" class="drag-handle" @touchstart.stop="handleDragHandleTouchStart" @contextmenu.stop.prevent>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5"/>
            <circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/>
            <circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">{{ link.title }}</div>
        <div v-if="settingsStore.settings.layout.showDescription && link.description" class="card-desc">
          {{ link.description }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nav-card {
  position: relative;
  padding: 16px;
  background: var(--bg-card);
  border: none;
  /* 圆角跟随全局设置 */
  border-radius: var(--radius);
  user-select: none;
  will-change: transform, opacity;
  contain: layout style paint; /* 提升渲染性能 */
  transition: box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  /* Grid 子元素默认 min-width: auto 会阻止内容收缩，导致 text-overflow 失效 */
  min-width: 0;
  overflow: hidden;
}

/* 拖拽期间禁用过渡动画，提高性能 */
.category-list.batch-dragging .nav-card,
.nav-card.card-dragging {
  transition: none !important;
}

.nav-card:hover {
  box-shadow: 0 6px 24px rgba(99, 102, 241, 0.18);
  transform: translateY(-3px);
}

.nav-card.card-dragging {
  opacity: 0.35;
  transform: scale(0.96);
  box-shadow: none;
}

.nav-card.card-drag-over {
  box-shadow: 0 0 0 2px var(--primary), 0 4px 16px rgba(99, 102, 241, 0.2);
  transform: scale(1.03);
}

.nav-card.batch-drop-target {
  border-left: 3px solid var(--primary);
  transform: translateX(4px);
}

.nav-card.no-url {
  opacity: 0.4;
  cursor: not-allowed;
}

.nav-card.no-url:hover {
  transform: none;
  box-shadow: none;
}

.card-content {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
}

.card-icon-wrapper {
  position: relative;
  flex-shrink: 0;
}

.card-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  /* 图标容器圆角略小于卡片 */
  border-radius: calc(var(--radius) - 2px);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}

.card-icon img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  image-rendering: auto;
}

.drag-handle {
  position: absolute;
  top: 0;
  left: -20px;
  right: -20px;
  bottom: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(99, 102, 241, 0.1);
  border-radius: calc(var(--radius) - 2px);
  color: var(--primary);
  cursor: grab;
}

@media (max-width: 768px) {
  .drag-handle {
    display: flex;
    opacity: 0;
  }
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--primary);
  background: rgba(99, 102, 241, 0.1);
}

.card-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--card-font-color, var(--text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-desc {
  font-size: 12px;
  color: var(--card-font-color, var(--text-muted));
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-card.size-tiny {
  padding: 6px 8px;
  border-radius: calc(var(--radius) - 4px);
}

.nav-card.size-tiny .card-icon {
  width: 24px;
  height: 24px;
  border-radius: calc(var(--radius) - 6px);
}

.nav-card.size-tiny .card-title {
  font-size: 12px;
}

.nav-card.size-small {
  padding: 10px 12px;
  /* 小尺寸卡片圆角略小 */
  border-radius: calc(var(--radius) - 2px);
}

.nav-card.size-small .card-icon {
  width: 32px;
  height: 32px;
  /* 小尺寸图标容器圆角更小 */
  border-radius: calc(var(--radius) - 4px);
}

.nav-card.size-small .card-title {
  font-size: 13px;
}

.nav-card.size-large {
  padding: 20px;
}

.nav-card.size-large .card-icon {
  width: 48px;
  height: 48px;
  /* 大尺寸图标容器圆角与卡片一致 */
  border-radius: var(--radius);
}

.nav-card.size-large .card-title {
  font-size: 16px;
}

.nav-card.size-large .card-desc {
  font-size: 13px;
}

.nav-card.has-custom-color .card-title {
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.nav-card.has-custom-color .card-desc {
  color: rgba(255,255,255,0.8);
}

.nav-card.has-custom-color .icon-placeholder {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

@media (max-width: 768px) {
  .nav-card {
    padding: 12px;
    /* 平板端圆角略小 */
    border-radius: calc(var(--radius) - 2px);
  }

  .card-content {
    gap: 10px;
  }

  .card-icon {
    width: 36px;
    height: 36px;
    /* 平板端图标容器圆角 */
    border-radius: calc(var(--radius) - 4px);
  }

  .card-icon img {
    width: 24px;
    height: 24px;
  }

  .card-title {
    font-size: 13px;
  }

  .card-desc {
    font-size: 11px;
  }
}

.nav-card.selection-mode {
  cursor: pointer;
}

.nav-card.selection-mode:hover {
  transform: translateY(-1px);
}

.nav-card.selected {
  box-shadow: 0 0 0 2px var(--primary), 0 4px 16px rgba(99, 102, 241, 0.2);
}

.nav-card.range-start {
  box-shadow: 0 0 0 3px var(--primary), 0 0 0 6px rgba(99, 102, 241, 0.15), 0 4px 16px rgba(99, 102, 241, 0.2);
}

.nav-card.range-start::before {
  content: '起点';
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--primary);
  color: white;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  z-index: 10;
}

.selection-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  transition: all 0.15s ease;
  z-index: 2;
}

.selection-check.checked {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.check-fade-enter-active,
.check-fade-leave-active {
  transition: all 0.15s ease;
}

.check-fade-enter-from,
.check-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

@media (max-width: 480px) {
  .nav-card {
    padding: 12px;
    /* 手机端圆角更小 */
    border-radius: calc(var(--radius) - 4px);
    min-height: 56px;
  }

  .nav-card.size-tiny {
    padding: 6px 8px;
    min-height: 0;
  }

  .card-icon {
    width: 32px;
    height: 32px;
    /* 手机端图标容器圆角 */
    border-radius: calc(var(--radius) - 6px);
  }

  .nav-card.size-tiny .card-icon {
    width: 24px;
    height: 24px;
  }

  .card-icon img {
    width: 22px;
    height: 22px;
  }

  .nav-card.size-tiny .card-icon img {
    width: 16px;
    height: 16px;
  }

  .card-title {
    font-size: 13px;
  }

  .nav-card.size-tiny .card-title {
    font-size: 12px;
  }

  .card-desc {
    font-size: 11px;
  }

  .card-content {
    gap: 10px;
  }

  .nav-card.size-tiny .card-content {
    gap: 8px;
  }

  .selection-check {
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    border-radius: 5px;
  }
}

</style>
