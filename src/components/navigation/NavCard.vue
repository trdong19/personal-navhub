<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { NavLink } from '@/types'
import { useNetworkStore } from '@/stores/network'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { getFaviconCandidates } from '@/utils/helpers'

const cardRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const isDragOver = ref(false)

const props = defineProps<{
  link: NavLink
}>()

const emit = defineEmits<{
  'edit': [id: string]
  'dragstart': [id: string]
  'dragover': [id: string]
  'dragend': []
  'contextmenu': [payload: { id: string; x: number; y: number }]
}>()

const networkStore = useNetworkStore()
const navStore = useNavStore()
const settingsStore = useSettingsStore()

const currentUrl = computed(() => {
  const { urls } = props.link
  if (networkStore.currentType === 'intranet') {
    return urls.intranet || urls.extranet || '#'
  }
  return urls.extranet || urls.intranet || '#'
})

const faviconCandidates = computed(() => {
  if (props.link.iconUrl) return [props.link.iconUrl]
  if (props.link.faviconFetchFailed) return []
  return getFaviconCandidates(currentUrl.value)
})

const faviconIndex = ref(0)
const faviconSrc = computed(() => {
  if (props.link.cachedIconData) return props.link.cachedIconData
  return faviconCandidates.value[faviconIndex.value] || ''
})
const faviconLoaded = ref(false)
const faviconFailed = ref(false)

watch(faviconCandidates, () => {
  faviconIndex.value = 0
  faviconLoaded.value = false
  faviconFailed.value = false
})

function onFaviconLoad() {
  faviconLoaded.value = true
  faviconFailed.value = false
  if (!props.link.cachedIconData && !props.link.iconUrl && faviconSrc.value) {
    cacheFaviconAsBase64()
  }
}

async function cacheFaviconAsBase64() {
  try {
    const resp = await fetch(faviconSrc.value)
    if (!resp.ok) return
    const blob = await resp.blob()
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (dataUrl && dataUrl.startsWith('data:')) {
        navStore.updateLink(props.link.id, { cachedIconData: dataUrl })
      }
    }
    reader.readAsDataURL(blob)
  } catch {}
}

function onFaviconError() {
  const nextIndex = faviconIndex.value + 1
  if (nextIndex < faviconCandidates.value.length) {
    faviconIndex.value = nextIndex
  } else {
    faviconFailed.value = true
    faviconLoaded.value = false
    if (!props.link.cachedIconData && !props.link.iconUrl) {
      navStore.updateLink(props.link.id, { faviconFetchFailed: true })
    }
  }
}

const showPlaceholder = computed(() => {
  if (props.link.cachedIconData) return false
  if (props.link.iconUrl) return faviconFailed.value
  if (!faviconSrc.value) return true
  return faviconFailed.value
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
    style['--card-custom-color'] = props.link.color
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
    'compact': settingsStore.settings.layout.compactMode,
    'no-url': currentUrl.value === '#',
    'pinned': props.link.pinned,
    'has-custom-color': !!props.link.color,
    'card-dragging': isDragging.value,
    'card-drag-over': isDragOver.value,
  },
])

function handleClick() {
  if (currentUrl.value === '#') return
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

function handleDragStart(e: DragEvent) {
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
    clone.style.borderRadius = '14px'
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
</script>

<template>
  <div
    ref="cardRef"
    :class="cardClass"
    :style="cardStyle"
    :title="link.description || link.title"
    :data-link-id="link.id"
    draggable="true"
    @click="handleClick"
    @contextmenu="handleContextMenu"
    @dragstart="handleDragStart"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @dragend="handleDragEnd"
  >
    <div class="card-content">
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
  border-radius: 16px;
  user-select: none;
  will-change: transform, opacity;
  transition: box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
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
}

.card-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 14px;
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

.nav-card.size-small {
  padding: 10px 12px;
}

.nav-card.size-small .card-icon {
  width: 32px;
  height: 32px;
  border-radius: 12px;
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
  border-radius: 16px;
}

.nav-card.size-large .card-title {
  font-size: 16px;
}

.nav-card.size-large .card-desc {
  font-size: 13px;
}

.nav-card.compact {
  padding: 10px 14px;
}

.nav-card.compact .card-content {
  gap: 10px;
}

.nav-card.has-custom-color {
  border-color: transparent;
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
    border-radius: 14px;
  }

  .card-content {
    gap: 10px;
  }

  .card-icon {
    width: 36px;
    height: 36px;
    border-radius: 12px;
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

@media (max-width: 480px) {
  .nav-card {
    padding: 10px 12px;
    border-radius: 12px;
  }

  .card-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }

  .card-icon img {
    width: 22px;
    height: 22px;
  }
}
</style>

<style>
.context-menu {
  position: fixed;
  z-index: 10000;
  background: var(--bg-card);
  border: none;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  min-width: 170px;
  padding: 4px;
  animation: ctxFadeIn 0.12s ease;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.15s ease;
  cursor: pointer;
}

.ctx-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.ctx-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.ctx-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 8px;
}

@keyframes ctxFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
